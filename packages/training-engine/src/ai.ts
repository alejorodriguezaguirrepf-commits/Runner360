import { planVersionSchema, type PlanVersion } from "./model";
import { validatePlanVersion, type ValidationIssue } from "./validation";

/**
 * Punto de extensión para futuras funciones de IA. El MVP no depende de ninguna implementación.
 * Reglas: una propuesta de IA nunca se publica ni se asigna directamente. Siempre entra como
 * BORRADOR, pasa por validación determinista y requiere revisión y aprobación humana.
 */
export interface PlanSuggestionProvider {
  readonly id: string;
  suggestDraft(input: { brief: string; base?: PlanVersion }): Promise<unknown>;
}

export type AiProposalResult =
  | { ok: true; draft: PlanVersion; warnings: ValidationIssue[] }
  | { ok: false; errors: ValidationIssue[] };

export function acceptAiProposal(raw: unknown): AiProposalResult {
  const parsed = planVersionSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.issues.map((i) => ({ code: "schema", message: i.message, path: i.path.join(".") })),
    };
  }
  const draft: PlanVersion = {
    ...parsed.data,
    status: "draft",
    validationStatus: "pending_review",
    approvedAt: null,
    isDemo: false,
  };
  const v = validatePlanVersion(draft);
  if (!v.valid) return { ok: false, errors: v.errors };
  return { ok: true, draft, warnings: v.warnings };
}
