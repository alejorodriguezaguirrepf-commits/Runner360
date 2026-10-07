// Genera los archivos para configurar un proyecto Supabase en la nube pegándolos en el SQL Editor:
//   supabase/nube/1-estructura.sql  → migraciones + productos + contenidos educativos
//   supabase/nube/2-planes-demo.sql → 15 planes DEMO / NO VALIDADOS
// Uso: node scripts/build-cloud-setup.mjs   (también corre con `pnpm cloud:sql`)
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const mig = join(root, "supabase", "migrations");
const seed = join(root, "supabase", "seed");
const header = (title) =>
  `-- RUNNER 360 — ${title}\n-- GENERADO por scripts/build-cloud-setup.mjs. No editar a mano.\n` +
  `-- Pegar completo en Supabase → SQL Editor → New query → Run, en un proyecto NUEVO (vacío).\n\n`;

const parts = [
  ...readdirSync(mig).filter((f) => f.endsWith(".sql")).sort().map((f) => join(mig, f)),
  join(seed, "10_products.sql"),
  join(seed, "30_educational_content.sql"),
];
const body = parts.map((p) => `-- ===== ${p.slice(root.length + 1)} =====\n${readFileSync(p, "utf8")}`).join("\n\n");
writeFileSync(join(root, "supabase", "nube", "1-estructura.sql"), header("Paso 1 de 2: estructura, seguridad y configuración inicial") + body);
writeFileSync(
  join(root, "supabase", "nube", "2-planes-demo.sql"),
  header("Paso 2 de 2: planes DEMO / NO VALIDADOS (ejecutar después del paso 1)") + readFileSync(join(seed, "20_demo_plans.sql"), "utf8"),
);
console.log("Listo: supabase/nube/1-estructura.sql y supabase/nube/2-planes-demo.sql");
