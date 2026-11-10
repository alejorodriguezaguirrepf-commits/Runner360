"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState, useSyncExternalStore } from "react";
import { IconFingerprint, IconHeart } from "@/components/ui/icons";
import { Button, Card } from "@/components/ui/primitives";
import { RESULT_LABEL, STABILIZE_MS, type MeasureResult } from "@/lib/heart-rate/measurementSession";
import { useCameraHeartRate } from "./use-camera-heart-rate";

export type HeartRateContext = "reposo" | "post_carrera" | "otro";

export interface SavedMeasurement extends MeasureResult {
  context: HeartRateContext;
  runId?: string;
}

type SaveStatus = "saving" | "ok" | "fail";

/**
 * Pulsaciones: 100 % automático. Al abrir se prenden cámara y flash; al apoyar el dedo se
 * estabiliza 3", se cuentan los latidos durante 6" y el resultado (latidos × 10) se guarda solo.
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

  const { videoRef, state, cameraState, error, torchSupported, resume } = useCameraHeartRate(handleResult);
  const saveStatus = saved && state.result && saved.at === state.result.measuredAt ? saved.status : null;

  return (
    <div className="space-y-4">
      <Card className="text-center">
        {/* El video tiene que estar en la página para leer los cuadros; se ve chiquito (rojo con el dedo). */}
        <video ref={videoRef} aria-hidden className="mx-auto size-14 rounded-full bg-ink object-cover" />

        <section aria-live="polite" className="mt-4 grid min-h-64 content-center gap-3">
          {cameraState === "starting" ? <p className="text-muted">Preparando cámara…</p> : null}

          {cameraState === "error" ? (
            <>
              <p className="font-semibold text-ink">{error}</p>
              <Button type="button" onClick={resume} className="mx-auto">Reintentar</Button>
            </>
          ) : null}

          {cameraState === "off" ? (
            <>
              <p className="font-semibold text-ink">Apagamos la cámara para cuidar la batería.</p>
              <Button type="button" onClick={resume} className="mx-auto">Reactivar cámara</Button>
            </>
          ) : null}

          {cameraState === "on" ? (
            <>
              {torchSupported === false ? (
                <p className="mx-auto max-w-sm rounded-xl bg-warning-bg px-3 py-2 text-sm text-warning">
                  Tu dispositivo no permite prender el flash desde la app: medí con buena luz ambiente.
                </p>
              ) : null}

              {state.status === "waitingFinger" ? (
                <>
                  {state.result && !state.lowQuality ? <ResultView result={state.result} small /> : null}
                  <span className="mx-auto inline-flex size-16 items-center justify-center rounded-full bg-surface-2 text-primary-ink">
                    <IconFingerprint width={36} height={36} />
                  </span>
                  <p className="font-semibold text-ink">
                    {state.finger === "too_much_pressure"
                      ? "Aflojá un poco la presión del dedo"
                      : state.result
                        ? "Apoyá el dedo otra vez para una nueva medición"
                        : "Apoyá la yema del índice sobre la cámara trasera y el flash"}
                  </p>
                </>
              ) : null}

              {state.status === "stabilizing" ? (
                <>
                  <p className="font-semibold text-ink">Dedo detectado. Quedate quieto…</p>
                  <div className="mx-auto h-2 w-full max-w-xs overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-label="Estabilizando la señal" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(state.stabilizeProgress * 100)}>
                    <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${Math.round(state.stabilizeProgress * 100)}%` }} />
                  </div>
                  <p className="text-sm text-muted">Estabilizando señal ({Math.ceil(((1 - state.stabilizeProgress) * STABILIZE_MS) / 1000)}&quot;)</p>
                  <Waveform data={state.waveform} />
                </>
              ) : null}

              {state.status === "counting" ? (
                <>
                  {state.retrying ? <p className="text-sm text-muted">Señal inestable, volvemos a contar automáticamente…</p> : null}
                  <p className="tabular text-6xl font-extrabold text-ink" aria-label={`Quedan ${state.secondsLeft} segundos`}>{state.secondsLeft}&quot;</p>
                  <span key={state.liveBeats} aria-hidden className="r360-beat mx-auto inline-flex text-danger">
                    <IconHeart width={40} height={40} />
                  </span>
                  <p className="text-ink">Latidos contados: <strong className="tabular">{state.liveBeats}</strong></p>
                  <Waveform data={state.waveform} />
                </>
              ) : null}

              {state.status === "done" && state.result ? (
                state.lowQuality ? (
                  <p className="mx-auto max-w-sm font-semibold text-ink">No pudimos obtener una lectura confiable. Levantá el dedo y volvé a apoyarlo, sin apretar.</p>
                ) : (
                  <>
                    <ResultView result={state.result} />
                    <p className="text-sm text-muted" role="status">
                      {saveStatus === "saving" ? "Guardando…" : saveStatus === "ok" ? "Guardado ✓" : saveStatus === "fail" ? "No se pudo guardar" : ""}
                    </p>
                    <p className="text-sm text-muted">Levantá el dedo y volvé a apoyarlo para medir de nuevo.</p>
                  </>
                )
              ) : null}
            </>
          ) : null}
        </section>
      </Card>

      <p className="text-center text-xs text-muted">Medición estimativa con fines de entrenamiento. No es un dispositivo médico.</p>

      {/* Explicación debajo de la opción */}
      <HeartRateHelp />
    </div>
  );
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

/** Señal filtrada (los picos son latidos), con el color de la marca en claro y oscuro. */
function Waveform({ data }: { data: number[] }) {
  if (data.length < 2) return <div className="mx-auto h-[70px] w-full max-w-xs" aria-hidden />;
  const W = 300;
  const H = 70;
  const points = data
    .map((v, i) => `${((i / (data.length - 1)) * W).toFixed(1)},${(H / 2 - Math.max(-3, Math.min(3, v)) * (H / 7)).toFixed(1)}`)
    .join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="mx-auto h-[70px] w-full max-w-xs" aria-hidden>
      <polyline points={points} fill="none" className="stroke-primary-ink" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
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
        <li><strong>Abrí esta pestaña.</strong> La cámara trasera y el flash se prenden solos.</li>
        <li><strong>Apoyá suavemente la yema del dedo índice</strong> sobre la cámara trasera, tapando también el flash.</li>
        <li><strong>Quedate quieto y sin hablar.</strong> Primero la app estabiliza la señal (3&quot;) y después cuenta tus latidos durante <strong>6 segundos</strong>.</li>
        <li><strong>El resultado aparece solo:</strong> latidos contados × 10 = tus pulsaciones por minuto. Por ejemplo, 8 latidos en 6&quot; = 80. Se guarda automáticamente en tu historial.</li>
        <li><strong>Para medir de nuevo,</strong> levantá el dedo y volvé a apoyarlo.</li>
      </ol>
      <p className="font-bold">Consejos para una buena lectura</p>
      <ul className="list-disc space-y-1.5 pl-5">
        <li>No aprietes: si presionás fuerte se corta la circulación y no se detecta el pulso.</li>
        <li>Mantené la mano quieta y apoyada, más o menos a la altura del corazón.</li>
        <li>Si tenés las manos frías, frotalas unos segundos antes.</li>
        <li>Pulso en reposo: medilo sentado, después de 1 minuto tranquilo. Pulso post-carrera: medilo apenas terminás.</li>
        <li>Si la señal sale inestable, la app repite el conteo sola.</li>
        <li>Es normal que el flash caliente un poco la cámara.</li>
      </ul>
      <p className="text-xs text-muted">
        El método 6&quot; × 10 es la toma rápida clásica: el resultado va de 10 en 10. Es una estimación para entrenar, no un dispositivo médico. La imagen
        de la cámara se procesa en tu teléfono y no se guarda ni se envía.
      </p>
    </div>
  );
}
