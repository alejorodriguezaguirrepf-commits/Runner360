// Genera supabase/seed/40_plan_library.sql desde content/training-plans/running_plans_library.json.
// Uso: pnpm --filter @runner360/plan-library seed:generate   (también corre con `pnpm seed:generate`)
import { writeFileSync } from "node:fs";
import { LIBRARY_JSON, SEED_FILE, renderSeed } from "./paths";

const sql = renderSeed();
writeFileSync(SEED_FILE, sql);
console.log(`Listo: ${SEED_FILE} (${(sql.length / 1024 / 1024).toFixed(1)} MB) desde ${LIBRARY_JSON}`);
