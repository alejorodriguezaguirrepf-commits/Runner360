"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { INTENSITIES, parseDuration, parseKmToMeters, RACE_DISTANCES, RUNNER_LEVELS, SESSION_TYPES } from "@runner360/shared";
import { canPublish, canTransition, nextVersionNumber, progressionRulesSchema, scheduleVariantSchema, type PlanStatus } from "@runner360/training-engine";
import { requireAdmin, requireStaff } from "@/lib/auth";
import { bool, intOrNull, str } from "@/lib/form";
import { loadFullVersion } from "@/lib/data/plans";
import { createClient } from "@/lib/supabase/server";

const UUID = /^[0-9a-f-]{36}$/i;
function back(versionId: string, q = ""): never {
  redirect(`/admin/planes/${versionId}${q}`);
}
function fail(versionId: string, msg: string): never {
  back(versionId, `?error=${encodeURIComponent(msg)}`);
}

export async function createPlanAction(fd: FormData) {
  const viewer = await requireStaff();
  const parsed = z
    .object({
      slug: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
      kind: z.enum(["standard", "introductory"]),
      targetDistance: z.enum(RACE_DISTANCES),
      level: z.enum(RUNNER_LEVELS),
      name: z.string().min(3).max(120),
      durationWeeks: z.number().int().min(1).max(52),
      sessionsPerWeek: z.number().int().min(1).max(7),
      isDemo: z.boolean(),
    })
    .safeParse({
      slug: str(fd, "slug"), kind: str(fd, "kind"), targetDistance: str(fd, "targetDistance"), level: str(fd, "level"),
      name: str(fd, "name"), durationWeeks: intOrNull(fd, "durationWeeks"), sessionsPerWeek: intOrNull(fd, "sessionsPerWeek"), isDemo: bool(fd, "isDemo"),
    });
  if (!parsed.success) redirect(`/admin/planes?error=${encodeURIComponent("Datos del plan inválidos")}`);
  const v = parsed.data;
  const supabase = await createClient();
  const { data: plan, error } = await supabase
    .from("training_plans")
    .insert({ slug: v.slug, kind: v.kind, target_distance: v.targetDistance, level: v.level, is_demo: v.isDemo, created_by: viewer.id })
    .select("id")
    .single();
  if (error) redirect(`/admin/planes?error=${encodeURIComponent(error.code === "23505" ? "El identificador ya existe" : "No se pudo crear el plan")}`);
  const { data: version, error: vErr } = await supabase
    .from("training_plan_versions")
    .insert({
      plan_id: plan.id, version: 1, name: v.name, duration_weeks: v.durationWeeks, sessions_per_week: v.sessionsPerWeek,
      validation_status: v.isDemo ? "demo_unvalidated" : "pending_review",
      progression_rules: progressionRulesSchema.parse({}),
      entry_requirements: { minWeeklyDistanceM: 0, minExperienceMonths: 0, requiresHealthClearance: true, notes: "" },
      created_by: viewer.id,
    })
    .select("id")
    .single();
  if (vErr) redirect(`/admin/planes?error=${encodeURIComponent("No se pudo crear la versión")}`);
  redirect(`/admin/planes/${version.id}`);
}

export async function updateVersionMetaAction(fd: FormData) {
  await requireStaff();
  const id = str(fd, "versionId");
  if (!UUID.test(id)) redirect("/admin/planes");
  let variants: unknown;
  try {
    variants = JSON.parse(str(fd, "scheduleVariants") || "[]");
  } catch {
    fail(id, "Las variantes de días no son JSON válido");
  }
  const v = z.array(scheduleVariantSchema).safeParse(variants);
  if (!v.success) fail(id, "Variantes de días inválidas");
  const rules = progressionRulesSchema.safeParse({
    minWeeklyCompliance: Number(str(fd, "minWeeklyCompliance") || "0.7"),
    rpeOverTargetMargin: intOrNull(fd, "rpeOverTargetMargin") ?? 2,
    rpeOverTargetSessions: intOrNull(fd, "rpeOverTargetSessions") ?? 2,
    maxWeeklyLoadIncreasePct: Number(str(fd, "maxWeeklyLoadIncreasePct") || "10"),
    maxSkippableWeeks: intOrNull(fd, "maxSkippableWeeks") ?? 0,
  });
  if (!rules.success) fail(id, "Reglas de progresión inválidas");
  const minKm = str(fd, "minWeeklyKm");
  const supabase = await createClient();
  const { error } = await supabase
    .from("training_plan_versions")
    .update({
      name: str(fd, "name").slice(0, 120),
      duration_weeks: intOrNull(fd, "durationWeeks"),
      sessions_per_week: intOrNull(fd, "sessionsPerWeek"),
      objective: str(fd, "objective").slice(0, 2000),
      progression_criteria: str(fd, "progressionCriteria").slice(0, 2000),
      reduce_or_stop_criteria: str(fd, "reduceOrStopCriteria").slice(0, 2000),
      requires_premium: bool(fd, "requiresPremium"),
      schedule_variants: v.data,
      progression_rules: rules.data,
      entry_requirements: {
        minWeeklyDistanceM: minKm ? (parseKmToMeters(minKm) ?? 0) : 0,
        minExperienceMonths: intOrNull(fd, "minExperienceMonths") ?? 0,
        requiresHealthClearance: bool(fd, "requiresHealthClearance"),
        notes: str(fd, "entryNotes").slice(0, 1000),
      },
    })
    .eq("id", id);
  if (error) fail(id, error.code === "42501" ? "La versión no está en borrador" : "No se pudo guardar");
  revalidatePath(`/admin/planes/${id}`);
  back(id, "?ok=1");
}

export async function addWeekAction(fd: FormData) {
  await requireStaff();
  const id = str(fd, "versionId");
  const supabase = await createClient();
  const { data: weeks } = await supabase.from("training_plan_weeks").select("week_number").eq("plan_version_id", id);
  const next = Math.max(0, ...(weeks ?? []).map((w) => w.week_number as number)) + 1;
  const { error } = await supabase.from("training_plan_weeks").insert({ plan_version_id: id, week_number: next, focus: str(fd, "focus").slice(0, 200) });
  if (error) fail(id, "No se pudo agregar la semana (¿versión publicada?)");
  revalidatePath(`/admin/planes/${id}`);
}

export async function deleteWeekAction(fd: FormData) {
  await requireStaff();
  const id = str(fd, "versionId");
  const supabase = await createClient();
  const { error } = await supabase.from("training_plan_weeks").delete().eq("id", str(fd, "weekId")).eq("plan_version_id", id);
  if (error) fail(id, "No se pudo eliminar la semana");
  revalidatePath(`/admin/planes/${id}`);
}

const sessionSchema = z.object({
  sessionNumber: z.number().int().min(1).max(14),
  daySlot: z.number().int().min(1).max(7),
  type: z.enum(SESSION_TYPES),
  title: z.string().min(1).max(120),
  objective: z.string().max(500),
  distanceM: z.number().int().positive().nullable(),
  durationS: z.number().int().positive().nullable(),
  intensity: z.enum(INTENSITIES),
  rpeMin: z.number().int().min(1).max(10).nullable(),
  rpeMax: z.number().int().min(1).max(10).nullable(),
  warmup: z.string().max(1000),
  mainSet: z.string().max(2000),
  cooldown: z.string().max(1000),
  notes: z.string().max(1000),
});

export async function saveSessionAction(fd: FormData) {
  await requireStaff();
  const versionId = str(fd, "versionId");
  const km = str(fd, "distanceKm");
  const dur = str(fd, "duration");
  const parsed = sessionSchema.safeParse({
    sessionNumber: intOrNull(fd, "sessionNumber"), daySlot: intOrNull(fd, "daySlot"), type: str(fd, "type"), title: str(fd, "title"),
    objective: str(fd, "objective"), distanceM: km ? (parseKmToMeters(km) ?? Number.NaN) : null, durationS: dur ? (parseDuration(dur) ?? Number.NaN) : null,
    intensity: str(fd, "intensity"), rpeMin: intOrNull(fd, "rpeMin"), rpeMax: intOrNull(fd, "rpeMax"),
    warmup: str(fd, "warmup"), mainSet: str(fd, "mainSet"), cooldown: str(fd, "cooldown"), notes: str(fd, "notes"),
  });
  if (!parsed.success) fail(versionId, `Sesión inválida: ${parsed.error.issues[0]?.path.join(".")}`);
  const s = parsed.data;
  const row = {
    session_number: s.sessionNumber, day_slot: s.daySlot, session_type: s.type, title: s.title, objective: s.objective,
    distance_m: s.distanceM, duration_s: s.durationS, intensity: s.intensity, rpe_min: s.rpeMin, rpe_max: s.rpeMax,
    warmup: s.warmup, main_set: s.mainSet, cooldown: s.cooldown, notes: s.notes,
  };
  const supabase = await createClient();
  const sessionId = str(fd, "sessionId");
  const { error } = sessionId
    ? await supabase.from("training_sessions").update(row).eq("id", sessionId)
    : await supabase.from("training_sessions").insert({ ...row, week_id: str(fd, "weekId"), plan_version_id: versionId });
  if (error) fail(versionId, error.code === "23505" ? "Número de sesión o día repetido en la semana" : error.code === "23514" ? "Indicá distancia o duración" : "No se pudo guardar la sesión");
  revalidatePath(`/admin/planes/${versionId}`);
  back(versionId, "?ok=1");
}

export async function deleteSessionAction(fd: FormData) {
  await requireStaff();
  const versionId = str(fd, "versionId");
  const supabase = await createClient();
  const { error } = await supabase.from("training_sessions").delete().eq("id", str(fd, "sessionId"));
  if (error) fail(versionId, "No se pudo eliminar la sesión");
  revalidatePath(`/admin/planes/${versionId}`);
}

export async function transitionAction(fd: FormData) {
  const viewer = await requireStaff();
  const id = str(fd, "versionId");
  const to = str(fd, "to") as PlanStatus;
  const supabase = await createClient();
  const full = await loadFullVersion(supabase, id);
  if (!full) redirect("/admin/planes");
  if (!canTransition(full.status, to)) fail(id, "Transición no permitida");
  const patch: Record<string, unknown> = { status: to };
  if (fd.has("reviewerNotes")) patch.reviewer_notes = str(fd, "reviewerNotes").slice(0, 2000) || null;

  if (to === "approved") {
    if (!full.isDemo) {
      if (!bool(fd, "professionalValidation")) fail(id, "Confirmá la validación profesional para aprobar");
      patch.validation_status = "validated";
    }
  }
  if (to === "published" || to === "archived") {
    await requireAdmin();
  }
  if (to === "published") {
    const check = canPublish(full);
    if (!check.allowed) fail(id, check.reasons.join(" "));
  }
  const { error } = await supabase.from("training_plan_versions").update(patch).eq("id", id);
  if (error) fail(id, "La base de datos rechazó la transición (revisá permisos y validación)");
  console.info("[plan.transition]", id, full.status, "->", to, "by", viewer.id);
  revalidatePath(`/admin/planes/${id}`);
  back(id, "?ok=1");
}

/** Nueva versión borrador copiando semanas, sesiones y ejercicios. La versión original no se modifica. */
export async function cloneVersionAction(fd: FormData) {
  const viewer = await requireStaff();
  const id = str(fd, "versionId");
  const supabase = await createClient();
  const { data: src } = await supabase.from("training_plan_versions").select("*").eq("id", id).maybeSingle();
  if (!src) redirect("/admin/planes");
  const { data: siblings } = await supabase.from("training_plan_versions").select("version").eq("plan_id", src.plan_id);
  const { data: plan } = await supabase.from("training_plans").select("is_demo").eq("id", src.plan_id).single();
  const { data: created, error } = await supabase
    .from("training_plan_versions")
    .insert({
      plan_id: src.plan_id, version: nextVersionNumber((siblings ?? []).map((s) => s.version as number)), name: src.name,
      duration_weeks: src.duration_weeks, sessions_per_week: src.sessions_per_week, objective: src.objective,
      entry_requirements: src.entry_requirements, progression_criteria: src.progression_criteria, reduce_or_stop_criteria: src.reduce_or_stop_criteria,
      progression_rules: src.progression_rules, schedule_variants: src.schedule_variants, requires_premium: src.requires_premium,
      validation_status: plan?.is_demo ? "demo_unvalidated" : "pending_review", created_by: viewer.id,
    })
    .select("id")
    .single();
  if (error) fail(id, "No se pudo crear la nueva versión");
  const { data: weeks } = await supabase
    .from("training_plan_weeks")
    .select("week_number, focus, notes, training_sessions(*, training_session_exercises(*))")
    .eq("plan_version_id", id);
  for (const w of weeks ?? []) {
    const { data: nw, error: wErr } = await supabase
      .from("training_plan_weeks").insert({ plan_version_id: created.id, week_number: w.week_number, focus: w.focus, notes: w.notes }).select("id").single();
    if (wErr) fail(created.id, "Copia incompleta: revisá las semanas");
    for (const s of (w.training_sessions ?? []) as Record<string, unknown>[]) {
      const { id: _sid, week_id: _w, plan_version_id: _p, created_at: _c, updated_at: _u, training_session_exercises: ex, ...rest } = s;
      const { data: ns, error: sErr } = await supabase.from("training_sessions").insert({ ...rest, week_id: nw.id, plan_version_id: created.id }).select("id").single();
      if (sErr) fail(created.id, "Copia incompleta: revisá las sesiones");
      const exercises = ((ex ?? []) as Record<string, unknown>[]).map(({ id: _e, session_id: _s, ...r }) => ({ ...r, session_id: ns.id }));
      if (exercises.length) await supabase.from("training_session_exercises").insert(exercises);
    }
  }
  redirect(`/admin/planes/${created.id}?ok=1`);
}
