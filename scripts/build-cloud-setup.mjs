// Genera los archivos para configurar un proyecto Supabase en la nube pegándolos en el SQL Editor:
//   supabase/nube/1-estructura.sql         → migraciones + productos + contenidos educativos
//   supabase/nube/2-planes-demo.sql        → 15 planes DEMO / NO VALIDADOS
//   supabase/nube/3-biblioteca-planes.sql  → biblioteca de 18 planes de running
// Cada archivo deja registrado lo que instaló (runner360_meta.schema_migrations), así después
// `pnpm db:migrate` aplica solo lo nuevo.
// Uso: node scripts/build-cloud-setup.mjs   (también corre con `pnpm cloud:sql`)
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { pendingWork } from "./db/migrate.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const mig = join(root, "supabase", "migrations");
const seed = join(root, "supabase", "seed");
const out = join(root, "supabase", "nube");
const header = (title) =>
  `-- RUNNER 360 — ${title}\n-- GENERADO por scripts/build-cloud-setup.mjs. No editar a mano.\n` +
  `-- Pegar completo en Supabase → SQL Editor → New query → Run, en un proyecto NUEVO (vacío).\n\n`;

/** Registro de lo instalado (mismas claves que usa scripts/db/migrate.mjs). */
const keyOf = (file) => pendingWork(new Set()).find((w) => w.file === file).key;
const record = (files) =>
  `\n-- Registro de lo instalado (lo usa scripts/db/migrate.mjs para aplicar solo lo nuevo).\n` +
  `create schema if not exists runner360_meta;\n` +
  `create table if not exists runner360_meta.schema_migrations (version text primary key, applied_at timestamptz not null default now());\n` +
  `insert into runner360_meta.schema_migrations (version) values\n  ${files.map((f) => `('${keyOf(f)}')`).join(",\n  ")}\non conflict do nothing;\n`;

const stripTx = (sql) => sql.replace(/^\s*begin;\s*$/gim, "").replace(/^\s*commit;\s*$/gim, "");
const bundle = (files) => files.map((p) => `-- ===== ${p.slice(root.length + 1)} =====\n${stripTx(readFileSync(p, "utf8"))}`).join("\n\n");

const structure = [
  ...readdirSync(mig).filter((f) => f.endsWith(".sql")).sort().map((f) => join(mig, f)),
  join(seed, "10_products.sql"),
  join(seed, "30_educational_content.sql"),
];
const demo = [join(seed, "20_demo_plans.sql")];
const library = [join(seed, "40_plan_library.sql")];

writeFileSync(join(out, "1-estructura.sql"), header("Paso 1 de 3: estructura, seguridad y configuración inicial") + bundle(structure) + record(structure));
writeFileSync(
  join(out, "2-planes-demo.sql"),
  header("Paso 2 de 3: planes DEMO / NO VALIDADOS (ejecutar después del paso 1)") + bundle(demo) + record(demo),
);
writeFileSync(
  join(out, "3-biblioteca-planes.sql"),
  header("Paso 3 de 3: biblioteca de planes de running (ejecutar después del paso 1)") + bundle(library) + record(library),
);
console.log("Listo: supabase/nube/1-estructura.sql, 2-planes-demo.sql y 3-biblioteca-planes.sql");
