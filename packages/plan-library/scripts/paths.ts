import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildImportSql, parseLibrary } from "../src/import-sql";

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
export const LIBRARY_JSON = join(ROOT, "content", "training-plans", "running_plans_library.json");
export const SEED_FILE = join(ROOT, "supabase", "seed", "40_plan_library.sql");

export function readLibraryJson(path = LIBRARY_JSON): unknown {
  return JSON.parse(readFileSync(path, "utf8"));
}

/** Seed SQL completo (con transacción). Lo usan el generador y el test que verifica que esté al día. */
export function renderSeed(path = LIBRARY_JSON): string {
  const { library, checksum } = parseLibrary(readLibraryJson(path));
  return (
    "-- RUNNER 360 — Biblioteca de planes de running.\n" +
    "-- GENERADO por packages/plan-library/scripts/generate-seed.ts desde content/training-plans/running_plans_library.json.\n" +
    "-- No editar a mano: para cambiar el contenido, subí content_version en el JSON y regenerá.\n" +
    "-- runner360:reapply-on-change\n" +
    "begin;\n\n" +
    buildImportSql(library, checksum) +
    "\ncommit;\n"
  );
}
