// Importa la biblioteca de planes en una base, dentro de una transacción.
//
//   DATABASE_URL=postgresql://… pnpm plans:import                 (archivo por defecto del repo)
//   DATABASE_URL=… pnpm plans:import -- --file otra/ruta.json
//   pnpm plans:import -- --check                                   solo valida (no necesita base)
//
// Idempotente: si la content_version ya está con la misma huella, no cambia nada. Si está con otra
// huella, aborta. Las inscripciones existentes conservan su versión.
import pg from "pg";
import { buildImportSql, LibraryValidationError, parseLibrary } from "../src/import-sql";
import { planTotals } from "../src/invariants";
import { LIBRARY_JSON, readLibraryJson } from "./paths";

const args = process.argv.slice(2);
const fileArg = args.indexOf("--file");
const file = fileArg >= 0 && args[fileArg + 1] ? args[fileArg + 1]! : LIBRARY_JSON;

async function main() {
  const { library, checksum } = parseLibrary(readLibraryJson(file));
  const totals = library.plans.map(planTotals);
  console.log(
    `✓ ${library.plans.length} planes válidos · ${totals.reduce((s, t) => s + t.weeks, 0)} semanas · ` +
      `${totals.reduce((s, t) => s + t.sessions, 0)} sesiones · content_version ${library.content_version}`,
  );
  if (args.includes("--check")) return;

  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("Falta DATABASE_URL (o usá --check para solo validar).");
  const local = /@(localhost|127\.0\.0\.1)[:/]/.test(url);
  const client = new pg.Client({ connectionString: url, ssl: local ? false : { rejectUnauthorized: false } });
  await client.connect();
  try {
    await client.query("begin");
    await client.query(buildImportSql(library, checksum));
    await client.query("commit");
    await client.query("notify pgrst, 'reload schema'");
    const { rows } = await client.query(
      "select (select count(*) from public.library_plans where content_version = $1)::int as plans, " +
        "(select count(*) from public.library_days where content_version = $1 and not is_rest)::int as sessions",
      [library.content_version],
    );
    console.log(`✓ Importado: ${rows[0].plans} planes y ${rows[0].sessions} sesiones en la versión ${library.content_version}.`);
  } catch (e) {
    await client.query("rollback").catch(() => {});
    throw e;
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(e instanceof LibraryValidationError ? e.message : `✗ ${(e as Error).message}`);
  process.exit(1);
});
