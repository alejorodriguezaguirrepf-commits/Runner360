"use server";
import { revalidatePath } from "next/cache";
import { competitionResultSchema, competitionSchema, parseDuration, parseKmToMeters } from "@runner360/shared";
import { getViewer } from "@/lib/auth";
import { dbErrorState, str, strOrNull, zodToState, type ActionState } from "@/lib/form";
import { createClient } from "@/lib/supabase/server";

export async function createCompetitionAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const viewer = await getViewer();
  if (!viewer) return { ok: false, message: "Tu sesión expiró." };
  const target = str(fd, "targetTime");
  const parsed = competitionSchema.safeParse({
    name: str(fd, "name"),
    distanceM: parseKmToMeters(str(fd, "distanceKm")) ?? Number.NaN,
    raceDate: str(fd, "raceDate"),
    location: strOrNull(fd, "location"),
    targetTimeS: target === "" ? null : (parseDuration(target) ?? Number.NaN),
    userPlanId: strOrNull(fd, "userPlanId"),
  });
  if (!parsed.success) return zodToState(parsed.error);
  const c = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.from("competitions").insert({
    user_id: viewer.id, name: c.name, distance_m: c.distanceM, race_date: c.raceDate, location: c.location, target_time_s: c.targetTimeS, user_plan_id: c.userPlanId,
  });
  if (error) return dbErrorState("competition.insert", error);
  revalidatePath("/app/competencias");
  return { ok: true, message: "Competencia guardada." };
}

export async function saveResultAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const viewer = await getViewer();
  if (!viewer) return { ok: false, message: "Tu sesión expiró." };
  const kms = fd.getAll("splitKm").map(String);
  const times = fd.getAll("splitTime").map(String);
  const splits = kms
    .map((k, i) => ({ k, t: times[i] ?? "" }))
    .filter(({ k, t }) => k.trim() || t.trim())
    .map(({ k, t }) => ({ distanceM: parseKmToMeters(k) ?? Number.NaN, durationS: parseDuration(t) ?? Number.NaN }));
  const parsed = competitionResultSchema.safeParse({
    competitionId: str(fd, "competitionId"),
    finishTimeS: parseDuration(str(fd, "finishTime")) ?? Number.NaN,
    notes: strOrNull(fd, "notes"),
    splits,
  });
  if (!parsed.success) return zodToState(parsed.error);
  const r = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("competition_results")
    .insert({ competition_id: r.competitionId, user_id: viewer.id, finish_time_s: r.finishTimeS, notes: r.notes })
    .select("id")
    .single();
  if (error) {
    if (error.code === "23505") return { ok: false, message: "Esta competencia ya tiene un resultado registrado." };
    return dbErrorState("competition.result", error);
  }
  if (r.splits.length) {
    const { error: sErr } = await supabase.from("competition_result_splits").insert(
      r.splits.map((s, i) => ({ result_id: data.id, user_id: viewer.id, split_index: i + 1, distance_m: s.distanceM, duration_s: s.durationS })),
    );
    if (sErr) return dbErrorState("competition.splits", sErr);
  }
  revalidatePath("/app/competencias");
  return { ok: true, message: "Resultado registrado." };
}

export async function deleteCompetitionAction(fd: FormData) {
  const viewer = await getViewer();
  if (!viewer) return;
  const supabase = await createClient();
  await supabase.from("competitions").delete().eq("id", String(fd.get("id") ?? "")).eq("user_id", viewer.id);
  revalidatePath("/app/competencias");
}
