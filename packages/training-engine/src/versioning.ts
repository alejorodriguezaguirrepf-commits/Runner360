import type { PlanVersionStatus } from "./schemas";

/**
 * Ciclo de vida de versiones de plan.
 *   draft -> in_review -> published -> archived
 *   in_review -> draft (devolución para correcciones)
 * Una versión publicada o archivada es INMUTABLE: para cambiarla se crea una nueva versión
 * (clonado). Así el historial de quienes empezaron una versión anterior nunca se altera.
 */

const TRANSITIONS: Record<PlanVersionStatus, readonly PlanVersionStatus[]> = {
  draft: ["in_review"],
  in_review: ["draft", "published"],
  published: ["archived"],
  archived: [],
};

export function canTransition(from: PlanVersionStatus, to: PlanVersionStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export function isEditable(status: PlanVersionStatus): boolean {
  return status === "draft";
}

export function nextVersionNumber(existing: readonly number[]): number {
  return existing.length === 0 ? 1 : Math.max(...existing) + 1;
}
