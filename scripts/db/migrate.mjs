#!/usr/bin/env node
// Aplica las migraciones y seeds pendientes a una base (local o Supabase en la nube).
//
//   DATABASE_URL=postgresql://… node scripts/db/migrate.mjs            (o `pnpm db:migrate`)
//   DATABASE_URL=… node scripts/db/migrate.mjs --dry-run                muestra qué aplicaría
//
// - Registra lo aplicado en runner360_meta.schema_migrations; cada archivo corre en su propia transacción.
// - Solo avanza: nunca revierte ni borra (las reversiones están en supabase/rollback y son manuales).
// - Bases instaladas antes de este registro (asistente o SQL Editor): se toma como línea de base
//   lo que ya existe (migraciones hasta 20261002000500 y seeds 10/20/30).
// - Seeds: se aplican una vez. Los marcados con "-- runner360:reapply-on-change" (idempotentes,
//   como la biblioteca de planes) se vuelven a aplicar cuando cambia su contenido.
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const MIGRATIONS = join(ROOT, "supabase", "migrations");
const SEEDS = join(ROOT, "supabase", "seed");
const BASELINE_LAST_MIGRATION = "20261002000500";
const BASELINE_SEEDS = ["10_products.sql", "20_demo_plans.sql", "30_educational_content.sql"];
const REAPPLY_MARK = "-- runner360:reapply-on-change";

const sha = (s) => createHash("sha256").update(s).digest("hex").slice(0, 16);

export function pendingWork(applied) {
  const work = [];
  for (const f of readdirSync(MIGRATIONS).filter((f) => f.endsWith(".sql")).sort()) {
    const version = f.split("_")[0];
    if (!applied.has(version)) work.push({ key: version, label: `migración ${f}`, file: join(MIGRATIONS, f) });
  }
  for (const f of readdirSync(SEEDS).filter((f) => f.endsWith(".sql")).sort()) {
    const sql = readFileSync(join(SEEDS, f), "utf8");
    const key = sql.includes(REAPPLY_MARK) ? `seed:${f}@${sha(sql)}` : `seed:${f}`;
    if (!applied.has(key)) work.push({ key, label: `seed ${f}`, file: join(SEEDS, f) });
  }
  return work;
}

/** Aplica lo pendiente con un cliente pg ya conectado. Devuelve la lista de etiquetas aplicadas. */
export async function migrate(client, { dryRun = false, log = console.log } = {}) {
  await client.query("create schema if not exists runner360_meta");
  await client.query(
    "create table if not exists runner360_meta.schema_migrations (version text primary key, applied_at timestamptz not null default now())",
  );
  // Evita dos migradores en paralelo (p. ej. dos despliegues seguidos).
  await client.query("select pg_advisory_lock(hashtext('runner360_migrate'))");
  try {
    let applied = new Set((await client.query("select version from runner360_meta.schema_migrations")).rows.map((r) => r.version));
    if (applied.size === 0) {
      const { rows } = await client.query("select to_regclass('public.app_features') is not null as installed");
      if (rows[0].installed) {
        const baseline = readdirSync(MIGRATIONS)
          .filter((f) => f.endsWith(".sql"))
          .map((f) => f.split("_")[0])
          .filter((v) => v <= BASELINE_LAST_MIGRATION)
          .concat(BASELINE_SEEDS.map((s) => `seed:${s}`));
        log(`Base existente sin registro: se toma como línea de base (${baseline.length} elementos).`);
        if (!dryRun) {
          await client.query("insert into runner360_meta.schema_migrations (version) select unnest($1::text[]) on conflict do nothing", [baseline]);
        }
        applied = new Set(baseline);
      }
    }
    const work = pendingWork(applied);
    if (work.length === 0) {
      log("La base está al día.");
      return [];
    }
    if (dryRun) {
      for (const item of work) log(`(simulación) aplicaría ${item.label}`);
      return [];
    }
    for (const item of work) {
      log(`→ ${item.label}`);
      const sql = readFileSync(item.file, "utf8");
      await client.query("begin");
      try {
        // Los seeds generados traen su propio begin/commit: se quitan para correr dentro de esta transacción.
        await client.query(sql.replace(/^\s*begin;\s*$/gim, "").replace(/^\s*commit;\s*$/gim, ""));
        if (item.key.startsWith("seed:")) {
          // Una versión anterior del mismo seed queda reemplazada por esta.
          const base = item.key.split("@")[0];
          await client.query("delete from runner360_meta.schema_migrations where version like $1", [`${base}@%`]);
        }
        await client.query("insert into runner360_meta.schema_migrations (version) values ($1)", [item.key]);
        await client.query("commit");
      } catch (e) {
        await client.query("rollback");
        throw new Error(`Falló ${item.label}: ${e.message}`);
      }
    }
    // Avisa a la API de Supabase que puede haber tablas o columnas nuevas.
    await client.query("notify pgrst, 'reload schema'");
    return work.map((w) => w.label);
  } finally {
    await client.query("select pg_advisory_unlock(hashtext('runner360_migrate'))");
  }
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("Falta DATABASE_URL (cadena de conexión de la base).");
    process.exit(1);
  }
  const { default: pg } = await import("pg");
  const local = /@(localhost|127\.0\.0\.1)[:/]/.test(url) || /host=\/tmp/.test(url);
  // Supabase exige SSL; su certificado no está en el almacén público (equivale a sslmode=require).
  const client = new pg.Client({ connectionString: url, ssl: local ? false : { rejectUnauthorized: false } });
  await client.connect();
  try {
    const done = await migrate(client, { dryRun: process.argv.includes("--dry-run") });
    if (done.length > 0) console.log(`✓ Aplicado: ${done.length} elemento(s).`);
  } finally {
    await client.end();
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((e) => {
    // Solo el mensaje: nunca la cadena de conexión.
    console.error(`✗ ${e.message}`);
    process.exit(1);
  });
}
