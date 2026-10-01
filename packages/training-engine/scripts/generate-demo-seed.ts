/**
 * Genera supabase/seed/10_demo_plans.sql a partir de las plantillas DEMO del motor.
 * Uso: pnpm seed:generate
 * El SQL resultante es determinista (UUID derivados del contenido) y se puede reaplicar sin duplicar.
 */
import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildAllDemoPlans, validatePlanVersion, type PlanVersion } from "../src";

const here = dirname(fileURLToPath(import.meta.url));
const out = resolve(here, "../../../supabase/seed/10_demo_plans.sql");

function uuidFrom(key: string): string {
  const h = createHash("sha1").update(`runner360:${key}`).digest("hex");
  // Formato UUID v5-like (variante RFC 4122).
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-${((parseInt(h.slice(16, 18), 16) & 0x3f) | 0x80).toString(16)}${h.slice(18, 20)}-${h.slice(20, 32)}`;
}

const q = (v: string | null) => (v == null ? "null" : `'${v.replace(/'/g, "''")}'`);
const n = (v: number | null) => (v == null ? "null" : String(v));
const j = (v: unknown) => `${q(JSON.stringify(v))}::jsonb`;

function planSlug(p: PlanVersion) {
  return p.kind === "introductory" ? "demo-introductorio" : `demo-${p.targetDistance}-${p.level}`;
}

const lines: string[] = [
  "-- GENERADO AUTOMÁTICAMENTE por packages/training-engine/scripts/generate-demo-seed.ts. No editar a mano.",
  "-- PLANES DE DEMOSTRACIÓN — NO VALIDADOS PROFESIONALMENTE. Solo para probar el producto.",
  "begin;",
];

for (const plan of buildAllDemoPlans()) {
  const v = validatePlanVersion(plan);
  if (!v.valid) throw new Error(`${plan.name}: ${v.errors.map((e) => e.message).join("; ")}`);
  const slug = planSlug(plan);
  const planId = uuidFrom(`plan:${slug}`);
  const versionId = uuidFrom(`version:${slug}:${plan.version}`);
  lines.push(`\n-- ${plan.name}`);
  // Idempotente: si la versión ya existe no se toca (las versiones publicadas son inmutables).
  lines.push(`do $seed$ begin\nif exists (select 1 from public.training_plan_versions where id = ${q(versionId)}) then return; end if;`);
  lines.push(
    `insert into public.training_plans (id, slug, kind, target_distance, level, is_demo) values (${q(planId)}, ${q(slug)}, ${q(plan.kind)}, ${q(plan.targetDistance)}, ${q(plan.level)}, true) on conflict (id) do nothing;`,
  );
  lines.push(
    `insert into public.training_plan_versions (id, plan_id, version, name, status, validation_status, duration_weeks, sessions_per_week, objective, entry_requirements, progression_criteria, reduce_or_stop_criteria, progression_rules, schedule_variants, requires_premium) values (${q(versionId)}, ${q(planId)}, ${plan.version}, ${q(plan.name)}, 'draft', 'demo_unvalidated', ${plan.durationWeeks}, ${plan.sessionsPerWeek}, ${q(plan.objective)}, ${j(plan.entryRequirements)}, ${q(plan.progressionCriteria)}, ${q(plan.reduceOrStopCriteria)}, ${j(plan.progressionRules)}, ${j(plan.scheduleVariants)}, ${plan.requiresPremium}) on conflict (id) do nothing;`,
  );
  const weekRows: string[] = [];
  const sessionRows: string[] = [];
  const exerciseRows: string[] = [];
  for (const w of plan.weeks) {
    const weekId = uuidFrom(`week:${versionId}:${w.weekNumber}`);
    weekRows.push(`(${q(weekId)}, ${q(versionId)}, ${w.weekNumber}, ${q(w.focus)}, ${q(w.notes)})`);
    for (const s of w.sessions) {
      const sid = uuidFrom(`session:${weekId}:${s.sessionNumber}`);
      sessionRows.push(
        `(${q(sid)}, ${q(weekId)}, ${q(versionId)}, ${s.sessionNumber}, ${s.daySlot}, ${q(s.type)}, ${q(s.title)}, ${q(s.objective)}, ${n(s.distanceM)}, ${n(s.durationS)}, ${q(s.intensity)}, ${n(s.rpeMin)}, ${n(s.rpeMax)}, ${q(s.warmup)}, ${q(s.mainSet)}, ${q(s.cooldown)}, ${q(s.notes)})`,
      );
      for (const e of s.exercises) {
        exerciseRows.push(
          `(${q(uuidFrom(`exercise:${sid}:${e.order}`))}, ${q(sid)}, ${e.order}, ${q(e.name)}, ${n(e.sets)}, ${n(e.reps)}, ${n(e.durationS)}, ${n(e.distanceM)}, ${n(e.restS)}, ${q(e.notes)})`,
        );
      }
    }
  }
  lines.push(
    `insert into public.training_plan_weeks (id, plan_version_id, week_number, focus, notes) values\n  ${weekRows.join(",\n  ")}\non conflict (id) do nothing;`,
  );
  lines.push(
    `insert into public.training_sessions (id, week_id, plan_version_id, session_number, day_slot, session_type, title, objective, distance_m, duration_s, intensity, rpe_min, rpe_max, warmup, main_set, cooldown, notes) values\n  ${sessionRows.join(",\n  ")}\non conflict (id) do nothing;`,
  );
  if (exerciseRows.length) {
    lines.push(
      `insert into public.training_session_exercises (id, session_id, sort_order, name, sets, reps, duration_s, distance_m, rest_s, notes) values\n  ${exerciseRows.join(",\n  ")}\non conflict (id) do nothing;`,
    );
  }
  // Flujo de publicación completo (los triggers validan cada transición).
  for (const st of ["in_review", "approved", "published"]) {
    lines.push(`update public.training_plan_versions set status = '${st}' where id = ${q(versionId)} and status = '${st === "in_review" ? "draft" : st === "approved" ? "in_review" : "approved"}';`);
  }
  lines.push("end $seed$;");
}
lines.push("\ncommit;\n");
writeFileSync(out, lines.join("\n"));
console.log(`Escrito ${out}`);
