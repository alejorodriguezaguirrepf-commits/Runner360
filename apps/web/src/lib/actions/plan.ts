"use server";

import { todayIn } from "@runner360/shared";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { ActionState } from "@/lib/action-state";
import { hasPremium, requireOnboardedSession } from "@/lib/auth";
import { evaluateEnrollment, loadTrainingProfile } from "@/lib/data/training";
import { enrollmentMessage } from "@/lib/enrollment-messages";

const enrollSchema = z.object({ versionId: z.preprocess((v) => (v === "" ? undefined : v), z.uuid().optional()) });

export async function enrollAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireOnboardedSession();
  const parsed = enrollSchema.safeParse({ versionId: formData.get("versionId") ?? "" });
  if (!parsed.success) return { ok: false, message: "Plan inválido." };
  const tp = await loadTrainingProfile(session.supabase, session.user.id, session.profile.birth_date);
  if (!tp) redirect("/onboarding");

  const outcome = await evaluateEnrollment({
    supabase: session.supabase,
    userId: session.user.id,
    profile: tp.profile,
    today: todayIn(session.profile.timezone),
    hasPremium: await hasPremium(session),
    versionId: parsed.data.versionId,
    commit: true,
  });
  if (outcome.kind !== "enrolled") return { ok: false, message: enrollmentMessage(outcome).text };
  revalidatePath("/", "layout");
  redirect("/plan?inscripto=1");
}

export async function cancelPlanAction(): Promise<void> {
  const { supabase, user } = await requireOnboardedSession();
  await supabase.from("user_training_plans").update({ status: "cancelled" }).eq("user_id", user.id).eq("status", "active");
  revalidatePath("/", "layout");
  redirect("/plan");
}
