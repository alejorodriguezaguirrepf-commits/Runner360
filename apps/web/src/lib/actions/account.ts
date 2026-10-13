"use server";

import { fieldErrors, formDataToObject, incidentSchema } from "@runner360/shared";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { t } from "@/i18n";
import type { ActionState } from "@/lib/action-state";
import { requireSession } from "@/lib/auth";
import { LEGAL_VERSIONS } from "@/lib/legal";
import { logError } from "@/lib/log";
import { createAdminClient } from "@/lib/supabase/admin";

export async function revokeHealthConsentAction(): Promise<void> {
  const { supabase, user } = await requireSession();
  // Sin consentimiento no se conserva ningún dato de salud: tampoco el de los registros.
  await supabase
    .from("workout_logs")
    .update({ pain_score: null, red_flags: [], sleep_quality: null, pain_reported: false })
    .eq("user_id", user.id);
  await supabase.from("health_screenings").delete().eq("user_id", user.id);
  await supabase.from("user_consents").insert({ user_id: user.id, consent_type: "health_data", document_version: LEGAL_VERSIONS.health_data, granted: false });
  revalidatePath("/perfil");
}

/**
 * Borra los datos de salud de los registros (dolor, señales de alarma, sueño y notas) y retira el
 * consentimiento. Se conservan fecha, duración, distancia y RPE.
 */
export async function deleteHealthDataAction(_prev: ActionState): Promise<ActionState> {
  const { supabase, user } = await requireSession();
  const { error } = await supabase
    .from("workout_logs")
    .update({ pain_score: null, red_flags: [], sleep_quality: null, comments: null, pain_reported: false })
    .eq("user_id", user.id);
  if (error) {
    logError("deleteHealthData", { code: error.code });
    return { ok: false, message: t.library.health.generic };
  }
  await supabase.from("health_screenings").delete().eq("user_id", user.id);
  await supabase.from("user_consents").insert({ user_id: user.id, consent_type: "health_data", document_version: LEGAL_VERSIONS.health_data, granted: false });
  revalidatePath("/perfil");
  return { ok: true, message: t.library.health.deleted };
}

export async function reportIncidentAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase, user } = await requireSession();
  const parsed = incidentSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };
  const { error } = await supabase.from("incident_reports").insert({
    user_id: user.id,
    category: parsed.data.category,
    message: parsed.data.message,
    page_path: parsed.data.pagePath,
  });
  if (error) {
    logError("reportIncident", error);
    return { ok: false, message: "No pudimos enviar el reporte." };
  }
  return { ok: true, message: "Gracias. Recibimos tu reporte." };
}

/**
 * Eliminación de cuenta: borra el usuario de Supabase Auth (cascada sobre todos sus datos).
 * Requiere SUPABASE_SERVICE_ROLE_KEY en el servidor. Sin esa clave, se registra la solicitud
 * (deletion_requested_at) para que un administrador la procese, y se informa con claridad.
 */
export async function deleteAccountAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase, user } = await requireSession();
  if (formData.get("confirm") !== "ELIMINAR") return { ok: false, errors: { confirm: "Escribí ELIMINAR para confirmar" } };

  await supabase.from("profiles").update({ deletion_requested_at: new Date().toISOString() }).eq("id", user.id);
  const admin = createAdminClient();
  if (!admin) {
    return {
      ok: true,
      message: "Registramos tu solicitud de eliminación. La eliminación automática está pendiente de configuración; un administrador la procesará y te avisará por correo.",
    };
  }
  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) {
    logError("deleteAccount", error);
    return { ok: false, message: "No pudimos eliminar la cuenta. Tu solicitud quedó registrada." };
  }
  await supabase.auth.signOut();
  redirect("/?cuenta=eliminada");
}
