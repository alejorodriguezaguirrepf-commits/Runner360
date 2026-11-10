"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState, useSyncExternalStore } from "react";
import { Button, Card } from "@/components/ui/primitives";
import { RESULT_LABEL, type MeasureResult, type MeasureState } from "@/lib/heart-rate/measurementSession";
import { useCameraHeartRate } from "./use-camera-heart-rate";

export type HeartRateContext = "reposo" | "post_carrera" | "otro";

export interface SavedMeasurement extends MeasureResult {
  context: HeartRateContext;
  runId?: string;
}

type SaveStatus = "saving" | "ok" | "fail";

const CONTEXT_LABEL: Record<HeartRateContext, string> = { reposo: "En reposo", post_carrera: "Después de correr", otro: "Otro momento" };
const FINGER_HINT = "Apoyá suavemente la yema del índice sobre la cámara de adelante (arriba de la pantalla)";
/**
 * Números gigantes del conteo y del resultado, con el color del logo. Ocupan la parte de abajo: la de
 * arriba (junto a la cámara de adelante, donde está el dedo) queda siempre en blanco para iluminarlo.
 */
const BIG = "tabular font-extrabold leading-[0.85] tracking-tight text-brand-teal";
/** Debajo de esta señal se dan consejos para acomodar el dedo. */
const WEAK_SIGNAL = 0.75;

/**
 * Pulsaciones: 100 % automático, con la cámara de adelante y la pantalla en blanco como luz. Al abrir
 * se prende la cámara y toda la pantalla queda blanca; al apoyar el dedo se estabiliza (mínimo 3"), se
 * cuentan los latidos durante 6" y el resultado (latidos × 10) se guarda solo.
 */
export function HeartRateTab({
  context = "reposo",
  runId,
  onAutoSave,
}: {
  context?: HeartRateContext;
  runId?: string;
  /** Se llama sola al terminar cada medición válida (guardado automático). */
  onAutoSave: (m: SavedMeasurement) => Promise<{ ok: boolean }>;
}) {
  const router = useRouter();
  // Estado del guardado de cada resultado (por su hora): así no hace falta reiniciarlo a mano.
  const [saved, setSaved] = useState<{ at: string; status: SaveStatus } | null>(null);
  const [closed, setClosed] = useState(false);

  const handleResult = useCallback(
    async (r: MeasureResult) => {
      setSaved({ at: r.measuredAt, status: "saving" });
      try {
        const res = await onAutoSave({ ...r, context, runId });
        setSaved({ at: r.measuredAt, status: res.ok ? "ok" : "fail" });
        if (res.ok) router.refresh(); // actualiza el historial de abajo
      } catch {
        setSaved({ at: r.measuredAt, status: "fail" });
      }
    },
    [context, runId, router, onAutoSave],
  );

  const { videoRef, state, cameraState, error, resume, close } = useCameraHeartRate(handleResult);
  const saveStatus = saved && state.result && saved.at === state.result.measuredAt ? saved.status : null;
  const lighting = cameraState === "starting" || cameraState === "on";
  const lastResult = state.result && !state.lowQuality ? state.result : null;

  return (
    <div className="space-y-4">
      <Card className="text-center">
        {/* El video tiene que estar en la página para leer los cuadros; se ve chiquito (rojo con el dedo). */}
        <video ref={videoRef} aria-hidden className="mx-auto size-14 rounded-full bg-ink object-cover" />
        <section aria-live={lighting ? undefined : "polite"} className="mt-4 grid min-h-40 content-center gap-3">
          {lighting ? <p className="text-sm text-muted">Midiendo con la luz de la pantalla…</p> : null}

          {cameraState === "error" ? (
            <>
              <p className="font-semibold text-ink">{error}</p>
              <Button type="button" onClick={resume} className="mx-auto">Reintentar</Button>
            </>
          ) : null}

          {cameraState === "off" ? (
            <>
              {lastResult ? (
                <>
                  <ResultView result={lastResult} />
                  <SaveNote status={saveStatus} />
                </>
              ) : null}
              {!closed ? <p className="font-semibold text-ink">Apagamos la cámara para cuidar la batería.</p> : null}
              <Button
                type="button"
                onClick={() => {
                  setClosed(false);
                  resume();
                }}
                className="mx-auto"
              >
                {closed ? (lastResult ? "Medir de nuevo" : "Medir pulsaciones") : "Reactivar cámara"}
              </Button>
            </>
          ) : null}
        </section>
      </Card>

      {lighting ? (
        // Luz de la medición: toda la pantalla en blanco puro, a propósito fuera de los colores del tema
        // (es una fuente de luz, no decoración). Los textos van abajo, lejos de la cámara, chicos y sin
        // animaciones: lo que cambia en pantalla cambia la luz que atraviesa el dedo.
        <div className="fixed inset-x-0 top-0 z-[60] flex h-[100lvh] flex-col justify-end bg-[#ffffff] text-[#1f2328]">
          <div className="px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] text-center">
            <ScreenStatus starting={cameraState === "starting"} state={state} saveStatus={saveStatus} />
            <p className="mt-3 text-xs text-[#57606a]">{CONTEXT_LABEL[context]} · Subí el brillo de la pantalla al máximo</p>
            <button
              type="button"
              onClick={() => {
                setClosed(true);
                close();
              }}
              className="mt-2 min-h-11 rounded-full border border-[#d0d7de] px-6 text-sm font-semibold"
            >
              Cerrar
            </button>
          </div>
        </div>
      ) : null}

      <p className="text-center text-xs text-muted">Medición estimativa con fines de entrenamiento. No es un dispositivo médico.</p>

      {/* Explicación debajo de la opción */}
      <HeartRateHelp />
    </div>
  );
}

/**
 * Estado de la medición sobre la pantalla blanca. Los números grandes van de la mitad para abajo, lejos
 * de la cámara de adelante, y sin animaciones: así casi no cambian la luz que llega al dedo.
 */
function ScreenStatus({ starting, state, saveStatus }: { starting: boolean; state: MeasureState; saveStatus: SaveStatus | null }) {
  if (!starting && state.status === "counting") {
    return (
      <div role="status" aria-live="off">
        <p className={`${BIG} block text-[min(42vh,80vw)]`} aria-label={`Quedan ${state.secondsLeft} segundos`}>{state.secondsLeft}</p>
        <p className="text-xl font-bold">segundos</p>
        <p className="mt-3 text-2xl font-bold" aria-label={`${state.liveBeats} latidos contados`}>
          <span className={`${BIG} text-6xl`}>{state.liveBeats}</span> latidos
        </p>
        <p className="mx-auto mt-2 max-w-sm text-sm font-semibold">
          {state.retrying ? "Señal inestable: volvemos a contar solos" : "Contando latidos… no muevas el dedo"}
        </p>
      </div>
    );
  }
  // El resultado queda grande también al levantar el dedo (es cuando se mira la pantalla).
  const showResult = state.status === "done" || (state.status === "waitingFinger" && state.finger !== "too_much_pressure");
  if (!starting && showResult && state.result && !state.lowQuality) {
    const r = state.result;
    const next = [saveText(saveStatus), state.status === "waitingFinger" ? "Apoyá el dedo otra vez para medir de nuevo" : null].filter(Boolean).join(" · ");
    return (
      <div role="status" aria-live="polite">
        <p className={`${BIG} block text-[min(32vh,48vw)]`} aria-label={`${r.bpm} ${RESULT_LABEL}`}>{r.bpm}</p>
        <p className="mt-1 text-2xl font-bold">{RESULT_LABEL}</p>
        <p className="mx-auto mt-1 max-w-sm text-sm">
          {r.beats} latidos en 6&quot; × 10 = {r.bpm}
        </p>
        {next ? <p className="mx-auto mt-1 max-w-sm text-sm font-semibold">{next}</p> : null}
      </div>
    );
  }

  let main: string;
  let detail: string | null = null;
  if (starting) main = "Preparando cámara…";
  else if (state.status === "stabilizing") {
    main = "Dedo detectado. Quedate quieto…";
    if (state.stabilizeProgress >= 1 && state.signal < WEAK_SIGNAL) detail = weakTip(state);
    else detail = `Señal: ${signalLabel(state.signal)}`;
  } else if (state.status === "done" && state.lowQuality) {
    main = "No pudimos obtener una lectura confiable";
    detail = "Levantá el dedo y volvé a apoyarlo tapando toda la cámara, sin apretar.";
  } else if (state.finger === "too_much_pressure") main = "Aflojá un poco la presión del dedo";
  else main = FINGER_HINT;

  return (
    <div role="status" aria-live="polite">
      <p className="mx-auto max-w-sm text-lg font-bold">{main}</p>
      {detail ? <p className="mx-auto mt-1 max-w-sm text-sm">{detail}</p> : null}
    </div>
  );
}

/** Consejo según lo que se ve cuando la señal no alcanza. */
function weakTip(state: MeasureState): string {
  if (state.finger === "too_much_pressure") return "Señal débil: aflojá la presión del dedo";
  return "Señal débil: tapá toda la cámara con la yema, sin apretar, y no muevas la mano";
}

const signalLabel = (v: number) => (v >= 0.85 ? "buena" : v >= WEAK_SIGNAL ? "regular" : "débil");
const saveText = (s: SaveStatus | null) => (s === "saving" ? "Guardando…" : s === "ok" ? "Guardado ✓" : s === "fail" ? "No se pudo guardar" : null);

function SaveNote({ status }: { status: SaveStatus | null }) {
  const text = saveText(status);
  return text ? <p className="text-sm text-muted" role="status">{text}</p> : null;
}

const quality = (c: number) => (c >= 0.75 ? "Buena" : c >= 0.5 ? "Regular" : "Baja");

function ResultView({ result, small }: { result: MeasureResult; small?: boolean }) {
  return (
    <div className={small ? "text-muted" : undefined}>
      {small ? <p className="text-xs">Última medición</p> : null}
      <p className={`tabular font-extrabold leading-none ${small ? "text-3xl" : "text-7xl text-ink"}`}>{result.bpm}</p>
      <p className={small ? "text-sm" : "mt-1 font-semibold text-ink"}>{RESULT_LABEL}</p>
      <p className="mt-1 text-sm text-muted">
        {result.beats} latidos en 6&quot; × 10 = {result.bpm} · Calidad: {quality(result.confidence)}
      </p>
    </div>
  );
}

const HELP_SEEN_KEY = "runner360.heartRateHelpSeen";
// Abierta la primera vez, cerrada las siguientes: se decide una vez por carga de página.
let helpOpen: boolean | null = null;
function readHelpOpen(): boolean {
  if (helpOpen === null) {
    try {
      helpOpen = window.localStorage.getItem(HELP_SEEN_KEY) !== "1";
      window.localStorage.setItem(HELP_SEEN_KEY, "1");
    } catch {
      helpOpen = true;
    }
  }
  return helpOpen;
}
const noop = () => () => {};

export function HeartRateHelp() {
  const open = useSyncExternalStore(noop, readHelpOpen, () => true);
  return (
    <details open={open} className="rounded-[var(--radius-card)] border border-line bg-surface p-4">
      <summary className="min-h-11 cursor-pointer content-center font-bold text-ink">¿Cómo usarlo?</summary>
      <HelpContent />
    </details>
  );
}

export function HelpContent() {
  return (
    <div className="mt-2 space-y-3 text-sm leading-relaxed text-ink">
      <ol className="list-decimal space-y-1.5 pl-5">
        <li><strong>Subí el brillo de la pantalla al máximo</strong> y abrí esta pestaña: la cámara de adelante se prende sola y la pantalla queda en blanco para iluminar tu dedo.</li>
        <li><strong>Apoyá suavemente la yema del dedo índice</strong> sobre la cámara de adelante (arriba de la pantalla), tapándola entera.</li>
        <li><strong>Quedate quieto y sin hablar.</strong> Primero la app estabiliza la señal (3&quot;) y después cuenta tus latidos durante <strong>6 segundos</strong>.</li>
        <li><strong>El resultado aparece solo:</strong> latidos contados × 10 = tus pulsaciones por minuto. Por ejemplo, 8 latidos en 6&quot; = 80. Se guarda automáticamente en tu historial.</li>
        <li><strong>Para medir de nuevo,</strong> levantá el dedo y volvé a apoyarlo.</li>
      </ol>
      <p className="font-bold">Consejos para una buena lectura</p>
      <ul className="list-disc space-y-1.5 pl-5">
        <li>No aprietes: si presionás fuerte se corta la circulación y no se detecta el pulso.</li>
        <li>Mantené la mano quieta y apoyada, más o menos a la altura del corazón.</li>
        <li>Si tenés las manos frías, frotalas unos segundos antes.</li>
        <li>Si abajo dice <strong>señal débil</strong>, acomodá el dedo para tapar toda la cámara y confirmá que el brillo esté al máximo.</li>
        <li>Medí en un lugar sin sol directo sobre la pantalla: la luz de afuera mete ruido.</li>
        <li>Pulso en reposo: medilo sentado, después de 1 minuto tranquilo. Pulso post-carrera: medilo apenas terminás.</li>
        <li>Si la señal sale inestable, la app repite el conteo sola.</li>
        <li>Tocá <strong>Cerrar</strong> para volver a ver tu historial.</li>
      </ul>
      <p className="text-xs text-muted">
        El método 6&quot; × 10 es la toma rápida clásica: el resultado va de 10 en 10. Es una estimación para entrenar, no un dispositivo médico. La imagen
        de la cámara se procesa en tu teléfono y no se guarda ni se envía.
      </p>
    </div>
  );
}
