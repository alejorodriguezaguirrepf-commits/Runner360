"use server";

import {
  DISTANCE_CODES,
  LEVELS,
  entryRequirementsSchema,
  planVersionSchema,
  progressionRulesSchema,
  scheduleVariantSchema,
  sessionSchema,
  validatePlanVersion,
  weekdayListSchema,
} from "@runner360/training-engine";
import { contentSchema, fieldErrors, formDataToObject, priceSchema, roleChangeSchema } from "@runner360/shared";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { ActionState } from "@/lib/action-state";
import { requireAdmin } from "@/lib/auth";
import { loadPlanVersions } from "@/lib/data/training";
import { logError } from "@/lib/log";

const uuid = z.uuid();
const fail = (context: string, error: unknown, message = "No se pudo completar la operación."): ActionState => {
  logError(`admin:${context}`, error);
  const detail = typeof error === "object" && error && "message" in error ? String((error as { message: string }).message) : "";
  return { ok: false, message: detail ? `${message} (${detail})` : message };
};

// ------------------------------------------------------------------ Usuarios

export async function changeRoleAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase } = await requireAdmin();
  const parsed = roleChangeSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return { ok: false, message: "Datos inválidos." };
  const { error } = await supabase
    .from("profiles")
    .update({ role: parsed.data.role, can_validate_plans: parsed.data.role !== "user" && parsed.data.canValidatePlans })
    .eq("id", parsed.data.userId);
  if (error) return fail("role", error);
  revalidatePath("/admin/usuarios");
  return { ok: true, message: "Permisos actualizados." };
}

export async function grantManualPremiumAction(formData: FormData): Promise<void> {
  const { supabase } = await requireAdmin();
  const userId = uuid.parse(formData.get("userId"));
  const days = z.coerce.number().int().min(1).max(366).parse(formData.get("days") ?? 30);
  const { data: product } = await supabase.from("subscription_products").select("id").eq("code", "premium_monthly").single<{ id: string }>();
  if (!product) return;
  const now = new Date();
  await supabase.from("subscriptions").insert({
    user_id: userId,
    product_id: product.id,
    provider: "manual",
    status: "active",
    started_at: now.toISOString(),
    current_period_start: now.toISOString(),
    current_period_end: new Date(now.getTime() + days * 86_400_000).toISOString(),
  });
  await supabase.rpc("write_audit_log", { p_action: "subscription.manual_grant", p_entity_type: "profile", p_entity_id: userId, p_metadata: { days } });
  revalidatePath("/admin/usuarios");
}

export async function revokeManualPremiumAction(formData: FormData): Promise<void> {
  const { supabase } = await requireAdmin();
  const userId = uuid.parse(formData.get("userId"));
  await supabase.from("subscriptions").update({ status: "cancelled", cancelled_at: new Date().toISOString(), current_period_end: new Date().toISOString() }).eq("user_id", userId).eq("provider", "manual").in("status", ["active", "trialing"]);
  revalidatePath("/admin/usuarios");
}

// ------------------------------------------------------------------ Productos y precios

export async function addPriceAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase } = await requireAdmin();
  const parsed = priceSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };
  const v = parsed.data;
  // Reemplaza el precio activo equivalente (mismo producto, moneda y proveedor).
  let q = supabase.from("product_prices").update({ active: false }).eq("product_id", v.productId).eq("currency", v.currency).eq("active", true);
  q = v.provider ? q.eq("provider", v.provider) : q.is("provider", null);
  const { error: e1 } = await q;
  if (e1) return fail("price:deactivate", e1);
  const { error } = await supabase.from("product_prices").insert({
    product_id: v.productId,
    currency: v.currency,
    amount_minor: v.amount,
    provider: v.provider,
    provider_price_id: v.providerPriceId,
    active: true,
  });
  if (error) return fail("price:insert", error);
  revalidatePath("/admin/productos");
  return { ok: true, message: "Precio actualizado." };
}

export async function deactivatePriceAction(formData: FormData): Promise<void> {
  const { supabase } = await requireAdmin();
  await supabase.from("product_prices").update({ active: false }).eq("id", uuid.parse(formData.get("id")));
  revalidatePath("/admin/productos");
}

export async function toggleProductAction(formData: FormData): Promise<void> {
  const { supabase } = await requireAdmin();
  await supabase.from("subscription_products").update({ active: formData.get("active") === "true" }).eq("id", uuid.parse(formData.get("id")));
  revalidatePath("/admin/productos");
}

export async function toggleFeatureAction(formData: FormData): Promise<void> {
  const { supabase } = await requireAdmin();
  const key = z.string().regex(/^[a-z_]{2,40}$/).parse(formData.get("key"));
  await supabase.from("app_features").update({ requires_premium: formData.get("requiresPremium") === "true" }).eq("key", key);
  await supabase.rpc("write_audit_log", { p_action: "feature.updated", p_entity_type: "app_feature", p_entity_id: key, p_metadata: { requires_premium: formData.get("requiresPremium") === "true" } });
  revalidatePath("/admin/productos");
}

// ------------------------------------------------------------------ Planes

const newPlanSchema = z.object({
  slug: z.string().trim().regex(/^[a-z0-9-]{3,80}$/, "Usá minúsculas, números y guiones"),
  name: z.string().trim().min(1).max(120),
  distance: z.enum(DISTANCE_CODES),
  level: z.enum(LEVELS),
  isPremium: z.preprocess((v) => v === "on", z.boolean()),
  durationWeeks: z.coerce.number().int().min(8).max(24),
  sessionsPerWeek: z.coerce.number().int().min(1).max(7),
});

export async function createPlanAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase, user } = await requireAdmin();
  const parsed = newPlanSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };
  const v = parsed.data;
  const { data: plan, error } = await supabase
    .from("training_plans")
    .insert({ slug: v.slug, name: v.name, distance: v.distance, level: v.level, is_premium: v.isPremium, created_by: user.id })
    .select("id")
    .single<{ id: string }>();
  if (error || !plan) return fail("plan:create", error, "No se pudo crear el plan (¿slug repetido?).");
  const { data: version, error: vErr } = await supabase
    .from("training_plan_versions")
    .insert({
      plan_id: plan.id,
      version_number: 1,
      status: "draft",
      is_demo: false,
      name: v.name,
      duration_weeks: v.durationWeeks,
      sessions_per_week: v.sessionsPerWeek,
      entry_requirements: entryRequirementsSchema.parse({}),
      progression_rules: progressionRulesSchema.parse({}),
      created_by: user.id,
    })
    .select("id")
    .single<{ id: string }>();
  if (vErr || !version) return fail("plan:version", vErr);
  await supabase.from("training_plan_weeks").insert(Array.from({ length: v.durationWeeks }, (_, i) => ({ version_id: version.id, week_number: i + 1 })));
  redirect(`/admin/planes/${version.id}`);
}

const versionMetaSchema = z.object({
  versionId: z.uuid(),
  name: z.string().trim().min(1).max(120),
  objective: z.string().max(1000),
  changeNotes: z.string().max(1000),
  durationWeeks: z.coerce.number().int().min(8).max(24),
  sessionsPerWeek: z.coerce.number().int().min(1).max(7),
  minWeeklyKm: z.coerce.number().min(0).max(300),
  minExperienceMonths: z.coerce.number().int().min(0).max(600),
  minAge: z.coerce.number().int().min(13).max(100),
  requirementNotes: z.string().max(1000),
  minComplianceToAdvance: z.coerce.number().min(0).max(100),
  repeatWeekBelowCompliance: z.coerce.number().min(0).max(100),
  reviewAboveAvgRpe: z.coerce.number().min(1).max(10),
  maxWeeklyVolumeIncreasePct: z.coerce.number().min(0).max(100),
});

export async function updateVersionMetaAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase } = await requireAdmin();
  const parsed = versionMetaSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error), message: "Revisá los campos." };
  const v = parsed.data;
  const rules = progressionRulesSchema.safeParse({
    minComplianceToAdvance: v.minComplianceToAdvance / 100,
    repeatWeekBelowCompliance: v.repeatWeekBelowCompliance / 100,
    reviewAboveAvgRpe: v.reviewAboveAvgRpe,
    reviewOnPainReport: true,
    maxWeeklyVolumeIncreasePct: v.maxWeeklyVolumeIncreasePct,
  });
  if (!rules.success) return { ok: false, message: rules.error.issues[0]?.message ?? "Reglas inválidas" };
  const { error } = await supabase
    .from("training_plan_versions")
    .update({
      name: v.name,
      objective: v.objective,
      change_notes: v.changeNotes,
      duration_weeks: v.durationWeeks,
      sessions_per_week: v.sessionsPerWeek,
      entry_requirements: { minWeeklyKm: v.minWeeklyKm, minExperienceMonths: v.minExperienceMonths, minAge: v.minAge, notes: v.requirementNotes },
      progression_rules: rules.data,
    })
    .eq("id", v.versionId)
    .eq("status", "draft");
  if (error) return fail("version:meta", error);
  // Sincroniza semanas con la duración.
  const { data: weeks } = await supabase.from("training_plan_weeks").select("week_number").eq("version_id", v.versionId);
  const have = new Set(((weeks ?? []) as { week_number: number }[]).map((w) => w.week_number));
  const missing = Array.from({ length: v.durationWeeks }, (_, i) => i + 1).filter((w) => !have.has(w));
  if (missing.length) await supabase.from("training_plan_weeks").insert(missing.map((w) => ({ version_id: v.versionId, week_number: w })));
  await supabase.from("training_plan_weeks").delete().eq("version_id", v.versionId).gt("week_number", v.durationWeeks);
  revalidatePath(`/admin/planes/${v.versionId}`);
  return { ok: true, message: "Versión actualizada." };
}

const sessionFormSchema = z.object({
  versionId: z.uuid(),
  weekNumber: z.coerce.number().int().min(1).max(24),
  sessionNumber: z.coerce.number().int().min(1).max(7),
  type: z.string(),
  title: z.string(),
  objective: z.string().default(""),
  durationMin: z.preprocess((v) => (v === "" ? null : v), z.coerce.number().int().min(1).max(360).nullable()),
  distanceKm: z.preprocess((v) => (v === "" ? null : v), z.coerce.number().min(0.1).max(100).nullable()),
  intensity: z.string(),
  rpeMin: z.preprocess((v) => (v === "" ? null : v), z.coerce.number().int().min(1).max(10).nullable()),
  rpeMax: z.preprocess((v) => (v === "" ? null : v), z.coerce.number().int().min(1).max(10).nullable()),
  warmup: z.string().default(""),
  mainSet: z.string().default(""),
  cooldown: z.string().default(""),
  notes: z.string().default(""),
  progressionCriteria: z.string().default(""),
  stopCriteria: z.string().default(""),
});

export async function saveSessionAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase } = await requireAdmin();
  const form = sessionFormSchema.safeParse(formDataToObject(formData));
  if (!form.success) return { ok: false, errors: fieldErrors(form.error), message: "Revisá los campos." };
  const f = form.data;
  // Validación determinista con el esquema del motor.
  const session = sessionSchema.safeParse({
    weekNumber: f.weekNumber,
    sessionNumber: f.sessionNumber,
    type: f.type,
    title: f.title,
    objective: f.objective,
    durationS: f.durationMin ? f.durationMin * 60 : null,
    distanceM: f.distanceKm ? Math.round(f.distanceKm * 1000) : null,
    intensity: f.intensity,
    rpeMin: f.rpeMin,
    rpeMax: f.rpeMax,
    warmup: f.warmup,
    mainSet: f.mainSet,
    cooldown: f.cooldown,
    notes: f.notes,
    progressionCriteria: f.progressionCriteria,
    stopCriteria: f.stopCriteria,
  });
  if (!session.success) return { ok: false, message: session.error.issues.map((i) => i.message).join(" · ") };
  const s = session.data;
  const { data: week } = await supabase.from("training_plan_weeks").select("id").eq("version_id", f.versionId).eq("week_number", s.weekNumber).maybeSingle<{ id: string }>();
  if (!week) return { ok: false, message: "La semana no existe en esta versión." };
  const { error } = await supabase.from("training_sessions").upsert(
    {
      version_id: f.versionId,
      week_id: week.id,
      week_number: s.weekNumber,
      session_number: s.sessionNumber,
      session_type: s.type,
      title: s.title,
      objective: s.objective,
      distance_m: s.distanceM,
      duration_s: s.durationS,
      intensity: s.intensity,
      rpe_min: s.rpeMin,
      rpe_max: s.rpeMax,
      warmup: s.warmup,
      main_set: s.mainSet,
      cooldown: s.cooldown,
      notes: s.notes,
      progression_criteria: s.progressionCriteria,
      stop_criteria: s.stopCriteria,
    },
    { onConflict: "version_id,week_number,session_number" },
  );
  if (error) return fail("session:save", error);
  revalidatePath(`/admin/planes/${f.versionId}`);
  return { ok: true, message: `Sesión ${s.sessionNumber} de la semana ${s.weekNumber} guardada.` };
}

export async function deleteSessionAction(formData: FormData): Promise<void> {
  const { supabase } = await requireAdmin();
  const versionId = uuid.parse(formData.get("versionId"));
  await supabase.from("training_sessions").delete().eq("id", uuid.parse(formData.get("id"))).eq("version_id", versionId);
  revalidatePath(`/admin/planes/${versionId}`);
}

export async function addVariantAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase } = await requireAdmin();
  const versionId = uuid.safeParse(formData.get("versionId"));
  const weekdays = z
    .string()
    .transform((s) => s.split(/[,\s]+/).filter(Boolean).map(Number))
    .pipe(weekdayListSchema)
    .safeParse(String(formData.get("weekdays") ?? ""));
  const variant = scheduleVariantSchema.safeParse({
    code: formData.get("code"),
    label: formData.get("label"),
    weekdays: weekdays.success ? weekdays.data : [],
    priority: Number(formData.get("priority") ?? 0),
  });
  if (!versionId.success || !weekdays.success || !variant.success) return { ok: false, message: "Variante inválida: usá días 1 (lunes) a 7 (domingo) separados por coma." };
  const { error } = await supabase.from("training_plan_schedule_variants").insert({
    version_id: versionId.data,
    code: variant.data.code,
    label: variant.data.label,
    weekdays: variant.data.weekdays,
    priority: variant.data.priority,
  });
  if (error) return fail("variant", error);
  revalidatePath(`/admin/planes/${versionId.data}`);
  return { ok: true, message: "Variante agregada." };
}

export async function deleteVariantAction(formData: FormData): Promise<void> {
  const { supabase } = await requireAdmin();
  const versionId = uuid.parse(formData.get("versionId"));
  await supabase.from("training_plan_schedule_variants").delete().eq("id", uuid.parse(formData.get("id"))).eq("version_id", versionId);
  revalidatePath(`/admin/planes/${versionId}`);
}

/** Importa contenido completo (semanas, sesiones, variantes) desde JSON con el formato del motor. */
export async function importPlanJsonAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase } = await requireAdmin();
  const versionId = uuid.safeParse(formData.get("versionId"));
  if (!versionId.success) return { ok: false, message: "Versión inválida." };
  let json: unknown;
  try {
    json = JSON.parse(String(formData.get("json") ?? ""));
  } catch {
    return { ok: false, message: "El texto no es JSON válido." };
  }
  const content = planVersionSchema.pick({ weeks: true, sessions: true, scheduleVariants: true }).safeParse(json);
  if (!content.success) return { ok: false, message: `Formato inválido: ${content.error.issues.slice(0, 3).map((i) => `${i.path.join(".")}: ${i.message}`).join(" · ")}` };
  const { data: version } = await supabase.from("training_plan_versions").select("status").eq("id", versionId.data).single<{ status: string }>();
  if (version?.status !== "draft") return { ok: false, message: "Solo se importa sobre borradores." };

  const id = versionId.data;
  await supabase.from("training_sessions").delete().eq("version_id", id);
  await supabase.from("training_plan_schedule_variants").delete().eq("version_id", id);
  await supabase.from("training_plan_weeks").delete().eq("version_id", id);
  const { data: weeks, error: wErr } = await supabase
    .from("training_plan_weeks")
    .insert(content.data.weeks.map((w) => ({ version_id: id, week_number: w.weekNumber, focus: w.focus, notes: w.notes })))
    .select("id, week_number");
  if (wErr) return fail("import:weeks", wErr);
  const weekId = new Map(((weeks ?? []) as { id: string; week_number: number }[]).map((w) => [w.week_number, w.id]));
  const sessionRows = content.data.sessions.map((s) => ({
    version_id: id,
    week_id: weekId.get(s.weekNumber),
    week_number: s.weekNumber,
    session_number: s.sessionNumber,
    session_type: s.type,
    title: s.title,
    objective: s.objective,
    distance_m: s.distanceM,
    duration_s: s.durationS,
    intensity: s.intensity,
    rpe_min: s.rpeMin,
    rpe_max: s.rpeMax,
    warmup: s.warmup,
    main_set: s.mainSet,
    cooldown: s.cooldown,
    notes: s.notes,
    progression_criteria: s.progressionCriteria,
    stop_criteria: s.stopCriteria,
  }));
  if (sessionRows.some((r) => !r.week_id)) return { ok: false, message: "Hay sesiones en semanas no declaradas." };
  const { data: inserted, error: sErr } = await supabase.from("training_sessions").insert(sessionRows).select("id, week_number, session_number");
  if (sErr) return fail("import:sessions", sErr);
  const sid = new Map(((inserted ?? []) as { id: string; week_number: number; session_number: number }[]).map((r) => [`${r.week_number}:${r.session_number}`, r.id]));
  const exercises = content.data.sessions.flatMap((s) =>
    s.exercises.map((e) => ({ session_id: sid.get(`${s.weekNumber}:${s.sessionNumber}`), position: e.position, name: e.name, sets: e.sets, reps: e.reps, duration_s: e.durationS, rest_s: e.restS, notes: e.notes })),
  );
  if (exercises.length) {
    const { error } = await supabase.from("training_session_exercises").insert(exercises);
    if (error) return fail("import:exercises", error);
  }
  if (content.data.scheduleVariants.length) {
    const { error } = await supabase.from("training_plan_schedule_variants").insert(
      content.data.scheduleVariants.map((v) => ({ version_id: id, code: v.code, label: v.label, weekdays: v.weekdays, priority: v.priority })),
    );
    if (error) return fail("import:variants", error);
  }
  revalidatePath(`/admin/planes/${id}`);
  return { ok: true, message: `Importadas ${content.data.weeks.length} semanas y ${content.data.sessions.length} sesiones.` };
}

const transitionSchema = z.object({ versionId: z.uuid(), to: z.enum(["in_review", "draft", "published", "archived", "sign_off", "clone"]), notes: z.string().max(1000).optional() });

export async function versionTransitionAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase } = await requireAdmin();
  const parsed = transitionSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return { ok: false, message: "Acción inválida." };
  const { versionId, to } = parsed.data;

  if (to === "clone") {
    const { data, error } = await supabase.rpc("clone_plan_version", { p_version: versionId, p_change_notes: parsed.data.notes ?? "" });
    if (error) return fail("clone", error);
    redirect(`/admin/planes/${data as string}`);
  }
  if (to === "sign_off") {
    const { error } = await supabase.rpc("sign_off_plan_version", { p_version: versionId, p_notes: parsed.data.notes ?? "" });
    if (error) return fail("sign_off", error);
  } else if (to === "published") {
    // La validación determinista del motor debe pasar antes de llamar a la base (que vuelve a validar).
    const [version] = await loadPlanVersions(supabase, [versionId]);
    if (!version) return { ok: false, message: "Versión inexistente." };
    const check = validatePlanVersion(version);
    if (!check.ok) return { ok: false, message: `No cumple los criterios de publicación: ${check.issues.filter((i) => i.severity === "error").slice(0, 3).map((i) => i.message).join(" · ")}` };
    const { error } = await supabase.rpc("publish_plan_version", { p_version: versionId });
    if (error) return fail("publish", error);
  } else {
    if (to === "in_review") {
      const [version] = await loadPlanVersions(supabase, [versionId]);
      const check = version ? validatePlanVersion({ ...version, isDemo: true }) : null;
      if (!check?.ok) return { ok: false, message: "Corregí los errores de estructura antes de enviar a revisión." };
    }
    const { error } = await supabase.from("training_plan_versions").update({ status: to }).eq("id", versionId);
    if (error) return fail(`status:${to}`, error);
  }
  revalidatePath(`/admin/planes/${versionId}`);
  revalidatePath("/admin/planes");
  return { ok: true, message: "Estado actualizado." };
}

// ------------------------------------------------------------------ Contenidos

export async function saveContentAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase, user } = await requireAdmin();
  const parsed = contentSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };
  const id = uuid.safeParse(formData.get("id"));
  const row = { slug: parsed.data.slug, title: parsed.data.title, summary: parsed.data.summary, body: parsed.data.body, category: parsed.data.category, is_premium: parsed.data.isPremium };
  const { error } = id.success
    ? await supabase.from("educational_contents").update(row).eq("id", id.data)
    : await supabase.from("educational_contents").insert({ ...row, created_by: user.id });
  if (error) return fail("content", error);
  revalidatePath("/admin/contenidos");
  return { ok: true, message: "Contenido guardado." };
}

export async function contentStatusAction(formData: FormData): Promise<void> {
  const { supabase, user, profile } = await requireAdmin();
  const id = uuid.parse(formData.get("id"));
  const action = z.enum(["publish", "archive", "draft", "review"]).parse(formData.get("action"));
  const changes: Record<string, unknown> =
    action === "publish"
      ? { status: "published", published_at: new Date().toISOString() }
      : action === "archive"
        ? { status: "archived" }
        : action === "draft"
          ? { status: "draft" }
          : profile.can_validate_plans
            ? { reviewed_by: user.id, reviewed_at: new Date().toISOString() }
            : {};
  if (Object.keys(changes).length) await supabase.from("educational_contents").update(changes).eq("id", id);
  revalidatePath("/admin/contenidos");
}

// ------------------------------------------------------------------ Incidencias

export async function incidentStatusAction(formData: FormData): Promise<void> {
  const { supabase } = await requireAdmin();
  const status = z.enum(["open", "in_progress", "resolved"]).parse(formData.get("status"));
  await supabase
    .from("incident_reports")
    .update({ status, resolved_at: status === "resolved" ? new Date().toISOString() : null, admin_notes: String(formData.get("adminNotes") ?? "").slice(0, 2000) })
    .eq("id", uuid.parse(formData.get("id")));
  revalidatePath("/admin/incidencias");
}
