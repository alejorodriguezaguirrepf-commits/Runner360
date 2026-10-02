import { sessionSchema, type PlanVersion, type Session } from "./schemas";
import { isEditable } from "./versioning";
import { validatePlanVersion, type PlanIssue } from "./validation";

/**
 * Punto de extensión para futuras funciones de IA.
 *
 * Reglas:
 *  - El MVP no depende de ningún proveedor de IA.
 *  - Una IA solo puede PROPONER cambios sobre versiones en borrador.
 *  - Toda propuesta pasa por la validación determinista del motor y queda pendiente de
 *    aprobación humana. Nunca se aplica automáticamente a planes publicados ni a usuarios.
 */

export interface SessionChangeProposal {
  weekNumber: number;
  sessionNumber: number;
  proposed: unknown;
  rationale: string;
}

export interface PlanSuggestionProvider {
  readonly name: string;
  suggest(version: PlanVersion, instruction: string): Promise<SessionChangeProposal[]>;
}

export type ProposalReview =
  | { status: "rejected"; reason: "VERSION_NOT_EDITABLE" | "INVALID_SESSION" | "PLAN_INVALID"; issues: PlanIssue[] }
  | { status: "pending_human_approval"; session: Session; warnings: PlanIssue[] };

export function reviewProposal(version: PlanVersion, proposal: SessionChangeProposal): ProposalReview {
  if (!isEditable(version.status)) return { status: "rejected", reason: "VERSION_NOT_EDITABLE", issues: [] };
  const parsed = sessionSchema.safeParse(proposal.proposed);
  if (
    !parsed.success ||
    parsed.data.weekNumber !== proposal.weekNumber ||
    parsed.data.sessionNumber !== proposal.sessionNumber
  ) {
    return {
      status: "rejected",
      reason: "INVALID_SESSION",
      issues: parsed.success ? [] : parsed.error.issues.map((i) => ({ severity: "error", code: "SCHEMA", message: i.message })),
    };
  }
  const sessions = version.sessions.map((s) =>
    s.weekNumber === proposal.weekNumber && s.sessionNumber === proposal.sessionNumber ? parsed.data : s,
  );
  // Se valida como si no fuera DEMO para aplicar el criterio más estricto, excepto la marca de validación.
  const result = validatePlanVersion({ ...version, sessions });
  const errors = result.issues.filter((i) => i.severity === "error" && i.code !== "NOT_VALIDATED");
  if (errors.length > 0) return { status: "rejected", reason: "PLAN_INVALID", issues: errors };
  return { status: "pending_human_approval", session: parsed.data, warnings: result.issues.filter((i) => i.severity === "warning") };
}
