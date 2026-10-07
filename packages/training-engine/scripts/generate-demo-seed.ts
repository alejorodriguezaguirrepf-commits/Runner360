/**
 * Genera supabase/seed/20_demo_plans.sql a partir de los planes DEMO del motor.
 * Uso: pnpm seed:generate
 *
 * Los IDs son UUID deterministas (derivados de un nombre) para que el seed sea idempotente.
 * Cada versión se inserta como borrador, se cargan semanas/sesiones/variantes y recién después
 * pasa a revisión y publicación, respetando los triggers de inmutabilidad.
 */
import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { validatePlanVersion } from "../src";
import { buildAllDemoPlans } from "../src/demo";

const here = dirname(fileURLToPath(import.meta.url));
const out = resolve(here, "../../../supabase/seed/20_demo_plans.sql");

function uuid(name: string): string {
  const h = createHash("sha1").update(`runner360:${name}`).digest("hex");
  const variant = ((parseInt(h.slice(16, 18), 16) & 0x3f) | 0x80).toString(16);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-${variant}${h.slice(18, 20)}-${h.slice(20, 32)}`;
}

function lit(v: string | number | boolean | null): string {
  if (v === null) return "null";
  if (typeof v === "number") return String(v);
  if (typeof v === "boolean") return v ? "true" : "false";
  return `'${v.replace(/'/g, "''")}'`;
}

function json(v: unknown): string {
  return `${lit(JSON.stringify(v))}::jsonb`;
}

const lines: string[] = [
  "-- GENERADO AUTOMÁTICAMENTE por packages/training-engine/scripts/generate-demo-seed.ts. No editar a mano.",
  "-- Planes DEMO / NO VALIDADOS: estructuras de ejemplo para probar la plataforma.",
  "-- No constituyen prescripción profesional. Reemplazar por planes validados por el fundador.",
  "begin;",
];

// Los textos fijos (entrada en calor, criterios, notas) se definen una vez en una función temporal
// para que el archivo sea liviano y se pueda pegar en el editor SQL de Supabase.
const allSessions = buildAllDemoPlans().flatMap((p) => p.sessions);
function constant<T>(values: T[], label: string): T {
  const unique = [...new Set(values)];
  if (unique.length !== 1) throw new Error(`Se esperaba un único valor para ${label}`);
  return unique[0] as T;
}
const run = allSessions.filter((x) => x.type !== "strength");
const str = allSessions.filter((x) => x.type === "strength");
constant(allSessions.map((x) => x.distanceM), "distanceM");
const T = {
  objective: constant(allSessions.map((x) => x.objective), "objective"),
  notes: constant(allSessions.map((x) => x.notes), "notes"),
  progression: constant(allSessions.map((x) => x.progressionCriteria), "progressionCriteria"),
  stop: constant(allSessions.map((x) => x.stopCriteria), "stopCriteria"),
  warmup: constant(run.map((x) => x.warmup), "warmup"),
  cooldown: constant(run.map((x) => x.cooldown), "cooldown"),
  strengthWarmup: constant(str.map((x) => x.warmup), "warmup fuerza"),
  strengthCooldown: constant(str.map((x) => x.cooldown), "cooldown fuerza"),
};
lines.push(
  `create or replace function pg_temp.demo_session(p_id uuid, p_version uuid, p_week_id uuid, p_week int, p_n int, p_type text, p_title text, p_dur int, p_int text, p_rmin int, p_rmax int, p_main text, p_strength boolean)
returns void language sql as $f$
  insert into public.training_sessions (id, version_id, week_id, week_number, session_number, session_type, title, objective, distance_m, duration_s, intensity, rpe_min, rpe_max, warmup, main_set, cooldown, notes, progression_criteria, stop_criteria)
  values (p_id, p_version, p_week_id, p_week, p_n, p_type::public.session_type, p_title, ${lit(T.objective)}, null, p_dur, p_int::public.intensity_level, p_rmin, p_rmax,
    case when p_strength then ${lit(T.strengthWarmup)} else ${lit(T.warmup)} end, p_main,
    case when p_strength then ${lit(T.strengthCooldown)} else ${lit(T.cooldown)} end,
    ${lit(T.notes)}, ${lit(T.progression)}, ${lit(T.stop)});
$f$;`,
);

for (const plan of buildAllDemoPlans()) {
  const check = validatePlanVersion(plan);
  if (!check.ok) throw new Error(`${plan.name} no pasa la validación: ${JSON.stringify(check.issues)}`);

  const key = `${plan.distance}-${plan.level}`;
  const planId = uuid(`plan:${key}`);
  const versionId = uuid(`version:${key}:v1`);
  const slug = `demo-${plan.distance.toLowerCase()}-${plan.level}`;

  lines.push(`\n-- ${plan.name}`);
  lines.push(
    `insert into public.training_plans (id, slug, distance, level, name, description, is_premium) values (${[
      lit(planId), lit(slug), lit(plan.distance), lit(plan.level), lit(plan.name), lit(plan.objective), lit(plan.isPremium),
    ].join(", ")}) on conflict (id) do nothing;`,
  );
  lines.push(
    `insert into public.training_plan_versions (id, plan_id, version_number, status, is_demo, name, objective, duration_weeks, sessions_per_week, entry_requirements, progression_rules, start_week_rules, change_notes) values (${[
      lit(versionId), lit(planId), 1, lit("draft"), "true", lit(plan.name), lit(plan.objective), plan.durationWeeks, plan.sessionsPerWeek,
      json(plan.entryRequirements), json(plan.progressionRules), json(plan.startWeekRules), lit("Versión DEMO inicial"),
    ].join(", ")}) on conflict (id) do nothing;`,
  );
  // Si la versión ya existía (publicada), los inserts hijos se omiten para no chocar con la inmutabilidad.
  lines.push(`do $seed$ begin if (select status from public.training_plan_versions where id = ${lit(versionId)}) = 'draft' then`);
  for (const w of plan.weeks) {
    lines.push(
      `  insert into public.training_plan_weeks (id, version_id, week_number, focus, notes) values (${[
        lit(uuid(`week:${key}:${w.weekNumber}`)), lit(versionId), w.weekNumber, lit(w.focus), lit(w.notes),
      ].join(", ")});`,
    );
  }
  for (const s of plan.sessions) {
    const sid = uuid(`session:${key}:${s.weekNumber}:${s.sessionNumber}`);
    lines.push(
      `  perform pg_temp.demo_session(${[
        lit(sid), lit(versionId), lit(uuid(`week:${key}:${s.weekNumber}`)), s.weekNumber, s.sessionNumber, lit(s.type), lit(s.title),
        lit(s.durationS), lit(s.intensity), lit(s.rpeMin), lit(s.rpeMax), lit(s.mainSet), lit(s.type === "strength"),
      ].join(", ")});`,
    );
    for (const e of s.exercises) {
      lines.push(
        `  insert into public.training_session_exercises (session_id, position, name, sets, reps, duration_s, rest_s, notes) values (${[
          lit(sid), e.position, lit(e.name), lit(e.sets), lit(e.reps), lit(e.durationS), lit(e.restS), lit(e.notes),
        ].join(", ")});`,
      );
    }
  }
  for (const v of plan.scheduleVariants) {
    lines.push(
      `  insert into public.training_plan_schedule_variants (id, version_id, code, label, weekdays, priority) values (${[
        lit(uuid(`variant:${key}:${v.code}`)), lit(versionId), lit(v.code), lit(v.label), `'{${v.weekdays.join(",")}}'::smallint[]`, v.priority,
      ].join(", ")});`,
    );
  }
  lines.push(`  update public.training_plan_versions set status = 'in_review' where id = ${lit(versionId)};`);
  lines.push(`  update public.training_plan_versions set status = 'published' where id = ${lit(versionId)};`);
  lines.push("end if; end $seed$;");
}

lines.push("commit;", "");
writeFileSync(out, lines.join("\n"));
console.log(`Seed DEMO escrito en ${out}`);
