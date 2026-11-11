"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button, cx } from "@/components/ui/primitives";
import { Sheet } from "@/components/ui/sheet";
import { saveWellnessAction } from "@/lib/actions/wellness";
import {
  WELLNESS_ADVICE,
  WELLNESS_ITEMS,
  WELLNESS_KEYS,
  WELLNESS_LEVEL_LABEL,
  wellnessLevel,
  wellnessScore,
  type WellnessAnswers,
  type WellnessKey,
} from "@/lib/wellness";

const FACES = ["😫", "😕", "😐", "🙂", "😄"] as const;
/** Evento para abrir el cuestionario desde otro lugar de la página (p. ej. el día de hoy). */
export const OPEN_WELLNESS_EVENT = "r360:wellness-open";

type Draft = { [K in WellnessKey]?: number };

/**
 * Cuestionario wellness del día. Se abre solo al entrar al plan si todavía no se respondió hoy.
 * Una pregunta por pantalla con cinco opciones grandes: al tocar una, pasa a la siguiente.
 */
export function WellnessCheckin({ autoOpen, hasConsent, initial }: { autoOpen: boolean; hasConsent: boolean; initial: WellnessAnswers | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(autoOpen);
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Draft>(initial ?? {});
  const [note, setNote] = useState("");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<number | null>(null);

  useEffect(() => {
    const onOpen = () => {
      setStep(0);
      setDone(null);
      setError(null);
      setOpen(true);
    };
    window.addEventListener(OPEN_WELLNESS_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_WELLNESS_EVENT, onOpen);
  }, []);

  const total = WELLNESS_KEYS.length;
  const complete = WELLNESS_KEYS.every((k) => typeof answers[k] === "number");
  const key = WELLNESS_KEYS[Math.min(step, total - 1)]!;
  const item = WELLNESS_ITEMS[key];

  const pick = (k: WellnessKey, v: number) => {
    setAnswers((a) => ({ ...a, [k]: v }));
    // Pasa sola a la siguiente (con un instante para ver la elección).
    window.setTimeout(() => setStep((s) => Math.min(s + 1, total)), 180);
  };

  const save = async () => {
    if (!complete) return;
    setBusy(true);
    setError(null);
    const r = await saveWellnessAction({ ...(answers as WellnessAnswers), note: note.trim() || undefined, consent: hasConsent || consent });
    setBusy(false);
    if (r.ok) {
      setDone(r.score);
      router.refresh();
    } else setError(r.message);
  };

  const close = () => setOpen(false);

  return (
    <Sheet open={open} onClose={close} title="Wellness de hoy" closeLabel={done !== null ? "Cerrar" : "Más tarde"}>
      {done !== null ? (
        <div className="space-y-4 pb-2 text-center">
          <p className="text-sm font-semibold text-muted">Tu puntaje de hoy</p>
          <p className="tabular text-7xl font-extrabold leading-none text-primary-ink">
            {done}
            <span className="text-2xl text-muted">/25</span>
          </p>
          <p className="text-xl font-bold">{WELLNESS_LEVEL_LABEL[wellnessLevel(done)]}</p>
          <p className="mx-auto max-w-sm text-sm text-muted">{WELLNESS_ADVICE[wellnessLevel(done)]}</p>
          <Button type="button" onClick={close} className="w-full text-base">Ir al entrenamiento de hoy</Button>
        </div>
      ) : step < total ? (
        <div className="space-y-4">
          <div>
            <div className="flex items-center justify-between text-sm">
              <span className="font-semibold text-muted">
                Pregunta {step + 1} de {total} · {item.label}
              </span>
              {step > 0 ? (
                <button type="button" onClick={() => setStep((s) => s - 1)} className="min-h-11 px-2 font-semibold text-primary-ink">
                  ← Atrás
                </button>
              ) : null}
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-2" aria-hidden>
              <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${(step / total) * 100}%` }} />
            </div>
          </div>
          <fieldset>
            <legend className="mb-3 text-2xl font-extrabold">{item.question}</legend>
            <div className="grid gap-2">
              {[5, 4, 3, 2, 1].map((v) => {
                const selected = answers[key] === v;
                return (
                  <button
                    key={v}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => pick(key, v)}
                    className={cx(
                      "flex min-h-14 items-center gap-3 rounded-2xl border px-4 text-left text-base font-semibold transition",
                      selected ? "border-primary-ink bg-accent text-on-accent" : "border-line bg-surface hover:border-primary",
                    )}
                  >
                    <span aria-hidden className="text-2xl">{FACES[v - 1]}</span>
                    <span className="flex-1">{item.options[v - 1]}</span>
                    <span className="tabular text-sm text-muted" aria-hidden>{v}</span>
                  </button>
                );
              })}
            </div>
          </fieldset>
          <p className="text-xs text-muted">5 es el mejor estado. Respondé cómo te sentís ahora, antes de entrenar.</p>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm font-semibold text-muted">Revisá y guardá</p>
          <ul className="divide-y divide-line rounded-2xl border border-line">
            {WELLNESS_KEYS.map((k, i) => (
              <li key={k}>
                <button type="button" onClick={() => setStep(i)} className="flex min-h-12 w-full items-center gap-3 px-3 text-left text-sm hover:bg-surface-2">
                  <span className="flex-1 font-semibold">{WELLNESS_ITEMS[k].label}</span>
                  <span className="text-muted">{answers[k] ? WELLNESS_ITEMS[k].options[answers[k]! - 1] : "—"}</span>
                  <span aria-hidden className="text-lg">{answers[k] ? FACES[answers[k]! - 1] : ""}</span>
                </button>
              </li>
            ))}
          </ul>
          {complete ? (
            <p className="text-center text-sm">
              Puntaje: <strong className="tabular text-lg">{wellnessScore(answers as WellnessAnswers)}/25</strong>
            </p>
          ) : null}
          <label className="block space-y-1 text-sm">
            <span className="text-muted">¿Algo que tu entrenador deba saber? (opcional)</span>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={300}
              rows={2}
              placeholder="Ej.: dormí poco por trabajo, me molesta el gemelo derecho…"
              className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-base text-ink placeholder:text-muted/70 sm:text-sm"
            />
          </label>
          {hasConsent ? null : (
            <label className="flex items-start gap-3 rounded-xl border border-line bg-surface-2 p-3 text-sm">
              <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 size-5 shrink-0 accent-[var(--color-primary)]" />
              <span>
                Doy mi consentimiento para registrar mi bienestar diario (sueño, energía, dolor muscular, estrés y ánimo). Son datos de salud: los
                ven vos y tu entrenador en RUNNER 360, y los podés borrar cuando quieras desde tu perfil.
              </span>
            </label>
          )}
          {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
          <Button type="button" onClick={save} disabled={!complete || busy || (!hasConsent && !consent)} className="w-full text-base">
            {busy ? "Guardando…" : "Guardar y empezar"}
          </Button>
        </div>
      )}
    </Sheet>
  );
}

/** Botón que abre el cuestionario (desde el día de hoy o el resumen). */
export function OpenWellnessButton({ children, variant = "primary", className }: { children: React.ReactNode; variant?: "primary" | "ghost"; className?: string }) {
  return (
    <Button type="button" variant={variant} className={className} onClick={() => window.dispatchEvent(new Event(OPEN_WELLNESS_EVENT))}>
      {children}
    </Button>
  );
}
