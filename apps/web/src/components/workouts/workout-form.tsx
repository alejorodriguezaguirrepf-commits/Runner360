"use client";
import { useActionState, useEffect, useMemo, useState } from "react";
import { Minus, Plus } from "lucide-react";
import { paceSecondsPerKm, speedKmh } from "@runner360/training-engine";
import { formatPace, formatSpeedKmh, parseDuration, parseKmToMeters, WORKOUT_STATUS_LABELS, WORKOUT_STATUSES } from "@runner360/shared";
import { saveWorkoutAction } from "@/app/app/registrar/actions";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { initialActionState, v } from "@/lib/form";

export function WorkoutForm({
  calendarEntryId,
  defaultStartedAt,
  plannedLabel,
}: {
  calendarEntryId: string | null;
  defaultStartedAt: string;
  plannedLabel: string | null;
}) {
  const [state, action] = useActionState(saveWorkoutAction, initialActionState);
  const fe = state.fieldErrors ?? {};
  const [status, setStatus] = useState<string>("completed");
  const [km, setKm] = useState("");
  const [duration, setDuration] = useState("");
  const [splits, setSplits] = useState<number[]>([]);
  const [tzOffset, setTzOffset] = useState("180");
  useEffect(() => setTzOffset(String(new Date().getTimezoneOffset())), []);

  const preview = useMemo(() => {
    const m = parseKmToMeters(km);
    const s = parseDuration(duration);
    if (!m || !s) return null;
    return { pace: formatPace(paceSecondsPerKm(m, s)), speed: formatSpeedKmh(speedKmh(m, s)) };
  }, [km, duration]);
  const skipped = status === "skipped";
  const d = (key: string, fallback = "") => (state.values ? v(state.values, key) : fallback);

  return (
    <form action={action} className="space-y-6" noValidate>
      <input type="hidden" name="tzOffset" value={tzOffset} />
      {calendarEntryId ? <input type="hidden" name="calendarEntryId" value={calendarEntryId} /> : null}
      {state.message ? <Alert tone="danger">{state.message}</Alert> : null}
      {plannedLabel ? <Alert>Sesión planificada asociada: <strong>{plannedLabel}</strong></Alert> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Estado" htmlFor="status" error={fe.status}>
          <Select id="status" name="status" value={status} onChange={(e) => setStatus(e.target.value)}>
            {WORKOUT_STATUSES.map((s) => <option key={s} value={s}>{WORKOUT_STATUS_LABELS[s]}</option>)}
          </Select>
        </Field>
        <Field label="Fecha y hora de inicio" htmlFor="startedAt" error={fe.startedAt}>
          <Input id="startedAt" name="startedAt" type="datetime-local" defaultValue={d("startedAt", defaultStartedAt)} required invalid={!!fe.startedAt} />
        </Field>
      </div>

      {!skipped ? (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Distancia (km)" htmlFor="distanceKm" error={fe.distanceM} hint="Ej.: 8,5. Dejá vacío si no corriste (p. ej. fuerza).">
              <Input id="distanceKm" name="distanceKm" inputMode="decimal" value={km} onChange={(e) => setKm(e.target.value)} invalid={!!fe.distanceM} />
            </Field>
            <Field label="Duración" htmlFor="duration" error={fe.durationS} hint="Minutos (45), mm:ss o h:mm:ss">
              <Input id="duration" name="duration" inputMode="numeric" value={duration} onChange={(e) => setDuration(e.target.value)} required invalid={!!fe.durationS} />
            </Field>
            <div className="rounded-xl bg-surface p-3 text-sm" aria-live="polite">
              <p className="text-xs font-medium uppercase text-muted">Cálculo automático</p>
              <p className="tabular mt-1 font-semibold text-navy">Ritmo: {preview?.pace ?? "—"}</p>
              <p className="tabular text-navy">Velocidad: {preview?.speed ?? "—"}</p>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-4">
            <Field label="RPE (1-10)" htmlFor="rpe" error={fe.rpe} hint="Esfuerzo percibido">
              <Input id="rpe" name="rpe" defaultValue={d("rpe")} type="number" min={1} max={10} inputMode="numeric" invalid={!!fe.rpe} />
            </Field>
            <Field label="FC media (lpm)" htmlFor="avgHr" error={fe.avgHr}>
              <Input id="avgHr" name="avgHr" defaultValue={d("avgHr")} type="number" min={30} max={250} inputMode="numeric" invalid={!!fe.avgHr} />
            </Field>
            <Field label="FC máxima (lpm)" htmlFor="maxHr" error={fe.maxHr}>
              <Input id="maxHr" name="maxHr" defaultValue={d("maxHr")} type="number" min={30} max={250} inputMode="numeric" invalid={!!fe.maxHr} />
            </Field>
            <Field label="Desnivel + (m)" htmlFor="elevationGainM" error={fe.elevationGainM}>
              <Input id="elevationGainM" name="elevationGainM" defaultValue={d("elevationGainM")} type="number" min={0} max={10000} inputMode="numeric" invalid={!!fe.elevationGainM} />
            </Field>
          </div>

          <fieldset className="space-y-3">
            <legend className="text-sm font-medium text-navy">Parciales (opcional)</legend>
            {splits.map((k, i) => (
              <div key={k} className="grid grid-cols-[auto_1fr_1fr_auto] items-end gap-2">
                <span className="pb-3 text-sm text-muted">#{i + 1}</span>
                <Field label="Km" htmlFor={`splitKm-${k}`}><Input id={`splitKm-${k}`} name="splitKm" inputMode="decimal" defaultValue="1" /></Field>
                <Field label="Tiempo" htmlFor={`splitTime-${k}`}><Input id={`splitTime-${k}`} name="splitTime" inputMode="numeric" placeholder="5:30" /></Field>
                <Button type="button" variant="ghost" size="md" aria-label={`Quitar parcial ${i + 1}`} onClick={() => setSplits(splits.filter((x) => x !== k))}>
                  <Minus className="size-4" aria-hidden />
                </Button>
              </div>
            ))}
            {fe.splits ? <p className="text-xs font-medium text-danger">{fe.splits}</p> : null}
            <Button type="button" variant="secondary" size="sm" onClick={() => setSplits([...splits, Date.now()])}>
              <Plus className="size-4" aria-hidden /> Agregar parcial
            </Button>
          </fieldset>
        </>
      ) : null}

      <Field label="Comentarios" htmlFor="notes" error={fe.notes}>
        <Textarea id="notes" name="notes" defaultValue={d("notes")} maxLength={1000} placeholder={skipped ? "¿Por qué no se realizó? (opcional)" : "Sensaciones, clima, molestias…"} />
      </Field>
      <SubmitButton size="lg">Guardar entrenamiento</SubmitButton>
    </form>
  );
}
