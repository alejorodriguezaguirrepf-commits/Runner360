"use server";
import { redirect } from "next/navigation";
import { incidentReportSchema, LEGAL_VERSIONS } from "@runner360/shared";
import { getViewer } from "@/lib/auth";
import { dbErrorState, str, zodToState, type ActionState } from "@/lib/form";
import { rateLimit } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function revokeHealthConsentAction() {
  const viewer = await getViewer();
  if (!viewer) redirect("/ingresar");
  const supabase = await createClient();
  // Primero se eliminan los datos, luego se registra la revocación (historial de consentimientos inmutable).
  await supabase.from("training_health_info").delete().eq("user_id", viewer.id);
  await supabase.from("user_consents").insert({
    user_id: viewer.id,
    consent_type: "health_data",
    document_version: LEGAL_VERSIONS.health_data,
    granted: false,
  });
  redirect("/app/perfil?salud=revocado");
}

export async function reportIncidentAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const viewer = await getViewer();
  if (!viewer) return { ok: false, message: "Tu sesión expiró." };
  if (!rateLimit(`incident:${viewer.id}`, 5, 60 * 60_000)) return { ok: false, message: "Enviaste varios reportes. Probá más tarde." };
  const parsed = incidentReportSchema.safeParse({ kind: str(fd, "kind"), description: str(fd, "description") });
  if (!parsed.success) return zodToState(parsed.error);
  const supabase = await createClient();
  const { error } = await supabase.from("incident_reports").insert({ user_id: viewer.id, ...parsed.data });
  if (error) return dbErrorState("incident.insert", error);
  return { ok: true, message: "¡Gracias! Recibimos tu reporte." };
}

/**
 * Eliminación de cuenta. Con la clave de servicio configurada se elimina el usuario de Supabase Auth
 * y, por cascada, todos sus datos. Sin ella, queda registrada la solicitud para procesarla manualmente.
 */
export async function deleteAccountAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const viewer = await getViewer();
  if (!viewer) return { ok: false, message: "Tu sesión expiró." };
  if (str(fd, "confirm") !== "ELIMINAR") {
    return { ok: false, message: "Escribí ELIMINAR para confirmar.", fieldErrors: { confirm: "Escribí ELIMINAR en mayúsculas" } };
  }
  const supabase = await createClient();
  const admin = createAdminClient();
  if (!admin) {
    const { error } = await supabase.from("account_deletion_requests").insert({ user_id: viewer.id, reason: str(fd, "reason").slice(0, 500) || null });
    if (error && error.code !== "23505") return dbErrorState("account.delete_request", error);
    return { ok: true, message: "Registramos tu solicitud de eliminación. La procesaremos y te confirmaremos por correo." };
  }
  const { error } = await admin.auth.admin.deleteUser(viewer.id);
  if (error) {
    console.error("[account.delete] auth_error", error.status ?? "");
    return { ok: false, message: "No pudimos eliminar la cuenta. Intentá nuevamente o reportalo." };
  }
  await supabase.auth.signOut();
  redirect("/?cuenta=eliminada");
}
