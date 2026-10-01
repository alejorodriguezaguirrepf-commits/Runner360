"use server";
import { revalidatePath } from "next/cache";
import { hydrationLogSchema, hydrationReminderSchema } from "@runner360/shared";
import { getViewer } from "@/lib/auth";
import { localInputToIso } from "@/lib/datetime";
import { bool, dbErrorState, intList, intOrNull, str, strOrNull, zodToState, type ActionState } from "@/lib/form";
import { createClient } from "@/lib/supabase/server";

export async function addHydrationAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const viewer = await getViewer();
  if (!viewer) return { ok: false, message: "Tu sesión expiró." };
  const parsed = hydrationLogSchema.safeParse({
    loggedAt: localInputToIso(str(fd, "loggedAt"), intOrNull(fd, "tzOffset")) ?? "",
    beverageType: str(fd, "beverageType"),
    volumeMl: intOrNull(fd, "volumeMl"),
    units: intOrNull(fd, "units"),
    context: str(fd, "context"),
    notes: strOrNull(fd, "notes"),
  });
  if (!parsed.success) return zodToState(parsed.error);
  const v = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.from("hydration_logs").insert({
    user_id: viewer.id, logged_at: v.loggedAt, beverage_type: v.beverageType, volume_ml: v.volumeMl, units: v.units, context: v.context, notes: v.notes,
  });
  if (error) return dbErrorState("hydration.insert", error);
  revalidatePath("/app/hidratacion");
  return { ok: true, message: "Registro guardado." };
}

export async function deleteHydrationAction(fd: FormData) {
  const viewer = await getViewer();
  if (!viewer) return;
  const supabase = await createClient();
  await supabase.from("hydration_logs").delete().eq("id", String(fd.get("id") ?? "")).eq("user_id", viewer.id);
  revalidatePath("/app/hidratacion");
}

export async function addReminderAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const viewer = await getViewer();
  if (!viewer) return { ok: false, message: "Tu sesión expiró." };
  const parsed = hydrationReminderSchema.safeParse({
    label: str(fd, "label"), timeOfDay: str(fd, "timeOfDay"), weekdays: intList(fd, "weekdays"), enabled: true,
  });
  if (!parsed.success) return zodToState(parsed.error);
  const supabase = await createClient();
  const { error } = await supabase.from("hydration_reminders").insert({
    user_id: viewer.id, label: parsed.data.label, time_of_day: parsed.data.timeOfDay, weekdays: parsed.data.weekdays, enabled: true,
  });
  if (error) return dbErrorState("reminder.insert", error);
  revalidatePath("/app/hidratacion");
  return { ok: true, message: "Recordatorio guardado." };
}

export async function toggleReminderAction(fd: FormData) {
  const viewer = await getViewer();
  if (!viewer) return;
  const supabase = await createClient();
  await supabase.from("hydration_reminders").update({ enabled: bool(fd, "enabled") }).eq("id", String(fd.get("id") ?? "")).eq("user_id", viewer.id);
  revalidatePath("/app/hidratacion");
}

export async function deleteReminderAction(fd: FormData) {
  const viewer = await getViewer();
  if (!viewer) return;
  const supabase = await createClient();
  await supabase.from("hydration_reminders").delete().eq("id", String(fd.get("id") ?? "")).eq("user_id", viewer.id);
  revalidatePath("/app/hidratacion");
}
