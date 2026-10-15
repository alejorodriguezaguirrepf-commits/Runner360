import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { faq } from "@/i18n/es-AR/faq";
import { faqJsonLd, serializeJsonLd, sortedFaq } from "@/lib/faq";

const items = sortedFaq(faq.items);

describe("preguntas frecuentes", () => {
  it("seis preguntas en el orden aprobado, con id único", () => {
    expect(items.map((i) => i.question)).toEqual([
      "¿Quién diseña los planes?",
      "¿Necesito experiencia previa?",
      "¿La app reemplaza a un entrenador?",
      "¿Puedo usarla gratis?",
      "¿Cómo se cobran las suscripciones?",
      "¿Puedo cancelar cuando quiera?",
    ]);
    expect(items.map((i) => i.order)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(new Set(items.map((i) => i.id)).size).toBe(items.length);
  });

  it("textos aprobados", () => {
    const byId = Object.fromEntries(items.map((i) => [i.id, i.answer]));
    expect(byId["quien-disena"]).toBe(
      "Los planes los diseña Alejo Rodríguez Aguirre, licenciado en Ciencias del Entrenamiento, ex atleta de maratón y actual entrenador físico de atletas.",
    );
    expect(byId["reemplaza-entrenador"]).toBe(
      "No, no lo reemplaza. Pero te da las herramientas necesarias para llevar adelante un plan de entrenamiento serio si entrenás solo o sos autodidacta.",
    );
    expect(byId["gratis"]).toBe("Sí. Tenés una opción gratuita con la primera semana de cualquier plan.");
  });

  it("el JSON-LD (FAQPage) tiene exactamente el texto visible, en el mismo orden", () => {
    const ld = faqJsonLd(faq.items);
    expect(ld["@type"]).toBe("FAQPage");
    expect(ld.mainEntity.map((q) => [q.name, q.acceptedAnswer.text])).toEqual(items.map((i) => [i.question, i.answer]));
    expect(ld.mainEntity.every((q) => q["@type"] === "Question" && q.acceptedAnswer["@type"] === "Answer")).toBe(true);
    // Válido como JSON y sin "<" que pueda cerrar la etiqueta <script>.
    const raw = serializeJsonLd({ ...ld, x: "</script>" });
    expect(raw).not.toContain("<");
    expect(JSON.parse(raw).mainEntity).toHaveLength(items.length);
  });

  it("no quedan los textos anteriores en el código", () => {
    const removed = [
      "La metodología la administra y valida un profesional",
      "el sistema te propone una fase introductoria",
      "¿La app reemplaza a un médico o entrenador?",
      "El plan Free incluye perfil, registro básico",
    ];
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const f of readdirSync(dir)) {
        const p = join(dir, f);
        if (statSync(p).isDirectory()) walk(p);
        else if (/\.(tsx?|json|md)$/.test(f)) files.push(p);
      }
    };
    walk(join(__dirname, "..", "src"));
    for (const f of files) {
      const text = readFileSync(f, "utf8");
      for (const r of removed) expect(text.includes(r), `${r} en ${f}`).toBe(false);
    }
  });
});
