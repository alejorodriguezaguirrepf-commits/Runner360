import { redirect } from "next/navigation";

/** La evaluación previa se quitó: los enlaces viejos llevan al selector de planes. */
export default async function LegacyAssistantPage({ searchParams }: { searchParams: Promise<{ plan?: string }> }) {
  const { plan } = await searchParams;
  redirect(plan && /^plan-\d{2}$/.test(plan) ? `/planes?plan=${plan}` : "/planes");
}
