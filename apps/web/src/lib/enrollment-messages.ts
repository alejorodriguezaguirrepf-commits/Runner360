import { READINESS_MESSAGES } from "@runner360/shared";
import type { EnrollmentOutcome } from "@/lib/data/training";

const UNMET: Record<string, string> = {
  MIN_WEEKLY_KM: "tu volumen semanal actual es menor al requerido",
  MIN_EXPERIENCE: "tu experiencia corriendo es menor a la requerida",
  MIN_AGE: "no alcanzás la edad mínima del plan",
};

/** Traduce el resultado del motor a mensajes en es-AR para la interfaz. */
export function enrollmentMessage(outcome: EnrollmentOutcome): { tone: "info" | "warning" | "danger"; title: string; text: string } {
  switch (outcome.kind) {
    case "enrolled":
      return { tone: "info", title: "Plan disponible", text: "Podés comenzar este plan." };
    case "readiness_blocked":
      return {
        tone: "warning",
        title: outcome.readiness.status === "professional_review" ? "Te recomendamos una revisión profesional" : "Te sugerimos una fase introductoria",
        text: outcome.readiness.reasons.map((r) => READINESS_MESSAGES[r]).join(" "),
      };
    case "no_published_plan":
      return { tone: "info", title: "Todavía no hay un plan publicado para tu perfil", text: "Estamos preparando planes para esta combinación de distancia y nivel. Podés elegir otro plan del catálogo." };
    case "requirements_not_met":
      return {
        tone: "warning",
        title: "Este plan tiene requisitos de ingreso",
        text: `No te lo asignamos porque ${outcome.unmet.map((u) => UNMET[u]).join(" y ")}. Te sugerimos un plan de menor exigencia o consultar con un profesional.`,
      };
    case "needs_professional_configuration":
      return {
        tone: "warning",
        title: "Se necesita una configuración profesional",
        text: `El plan requiere ${outcome.sessionsPerWeek} sesiones por semana y no hay una distribución aprobada para los días que marcaste. Probá sumar días disponibles o consultá a un entrenador; no generamos distribuciones no validadas.`,
      };
    case "insufficient_time":
      return {
        tone: "warning",
        title: "No hay tiempo suficiente hasta la competencia",
        text: `El plan necesita ${outcome.weeksRequired} semanas y quedan ${outcome.weeksAvailable}. No comprimimos planes automáticamente: elegí otra fecha o consultá a un profesional.`,
      };
    case "race_date_in_past":
      return { tone: "warning", title: "La fecha de competencia ya pasó", text: "Actualizá la fecha en tu perfil de corredor." };
    case "premium_required":
      return { tone: "info", title: "Plan Premium", text: `${outcome.versionName} está incluido en la suscripción Premium.` };
    case "content_unavailable":
      return { tone: "danger", title: "Contenido no disponible", text: "No pudimos cargar todas las sesiones del plan. Probá más tarde." };
    case "error":
      return { tone: "danger", title: "Error", text: outcome.message };
  }
}
