import type { PlanStatus, PlanVersion } from "./model";
import { validatePlanVersion, type PlanValidationResult } from "./validation";

/** Transiciones de estado permitidas. Una versión publicada solo puede archivarse (nunca editarse). */
export const STATUS_TRANSITIONS: Record<PlanStatus, PlanStatus[]> = {
  draft: ["in_review"],
  in_review: ["draft", "approved"],
  approved: ["draft", "published"],
  published: ["archived"],
  archived: [],
};

export function canTransition(from: PlanStatus, to: PlanStatus): boolean {
  return STATUS_TRANSITIONS[from].includes(to);
}

export function isEditable(status: PlanStatus): boolean {
  return status === "draft";
}

export function nextVersionNumber(existing: number[]): number {
  return existing.length === 0 ? 1 : Math.max(...existing) + 1;
}

/**
 * Crea un borrador nuevo a partir de una versión existente. La versión original queda intacta:
 * los usuarios que ya la tienen asignada conservan su historial.
 */
export function cloneAsDraft(source: PlanVersion, newVersion: number): PlanVersion {
  return {
    ...structuredClone(source),
    id: undefined,
    version: newVersion,
    status: "draft",
    validationStatus: source.isDemo ? "demo_unvalidated" : "pending_review",
    approvedAt: null,
    weeks: source.weeks.map((w) => ({
      ...structuredClone(w),
      id: undefined,
      sessions: w.sessions.map((s) => ({ ...structuredClone(s), id: undefined })),
    })),
  };
}

export interface PublishCheck {
  allowed: boolean;
  reasons: string[];
  validation: PlanValidationResult;
}

/**
 * Criterios para publicar:
 * 1. Estado "approved".
 * 2. Validación estructural sin errores.
 * 3. Plan DEMO: debe estar marcado como "demo_unvalidated" (se mostrará como DEMO / NO VALIDADO).
 *    Plan real: debe estar "validated" y tener aprobación profesional registrada.
 */
export function canPublish(version: PlanVersion): PublishCheck {
  const validation = validatePlanVersion(version);
  const reasons: string[] = [];
  if (version.status !== "approved") reasons.push("La versión debe estar aprobada antes de publicarse.");
  if (!validation.valid) reasons.push("La validación estructural tiene errores.");
  if (version.isDemo) {
    if (version.validationStatus !== "demo_unvalidated")
      reasons.push("Un plan DEMO debe quedar identificado como NO VALIDADO.");
  } else {
    if (version.validationStatus !== "validated") reasons.push("Falta la validación profesional del plan.");
    if (!version.approvedAt) reasons.push("Falta registrar la aprobación profesional.");
  }
  return { allowed: reasons.length === 0, reasons, validation };
}
