import type { FaqItem } from "@/i18n/es-AR/faq";

/** Preguntas en el orden en que se muestran. */
export function sortedFaq(items: readonly FaqItem[]): FaqItem[] {
  return [...items].sort((a, b) => a.order - b.order);
}

/** Datos estructurados FAQPage (schema.org) con el mismo texto que se ve en pantalla. */
export function faqJsonLd(items: readonly FaqItem[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: sortedFaq(items).map((i) => ({
      "@type": "Question",
      name: i.question,
      acceptedAnswer: { "@type": "Answer", text: i.answer },
    })),
  };
}

/** JSON para un <script type="application/ld+json">, sin "<" literal (evita cerrar la etiqueta). */
export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
