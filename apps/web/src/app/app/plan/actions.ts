"use server";
import { redirect } from "next/navigation";
import { getViewer, hasFeature } from "@/lib/auth";
import { startPlanForUser } from "@/lib/data/start-plan";
import { createClient } from "@/lib/supabase/server";

/** Inicia el plan sugerido (la lógica vive en lib/data/start-plan.ts, compartida con la API móvil). */
export async function startPlanAction(fd: FormData) {
  const viewer = await getViewer();
  if (!viewer) redirect("/ingresar?next=/app/plan");
  const choice = fd.get("choice") === "introductory" ? "introductory" : "recommended";
  const supabase = await createClient();
  const result = await startPlanForUser(
    supabase,
    { id: viewer.id, timezone: viewer.timezone, premiumPlans: hasFeature(viewer, "premium_plans") },
    choice,
  );
  if (!result.ok) redirect(result.error === "perfil" ? "/onboarding" : `/app/plan?error=${result.error}`);
  redirect("/app/plan?iniciado=1");
}

export async function abandonPlanAction(fd: FormData) {
  const viewer = await getViewer();
  if (!viewer) redirect("/ingresar");
  const id = String(fd.get("userPlanId") ?? "");
  const supabase = await createClient();
  const { error } = await supabase
    .from("user_training_plans")
    .update({ status: "abandoned", ended_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", viewer.id)
    .eq("status", "active");
  if (error) console.error("[plan.abandon] db_error", error.code);
  redirect("/app/plan");
}
