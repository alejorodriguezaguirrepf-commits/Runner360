"use client";

import { kmInputToMeters, paceSecondsPerKm, parseDuration, speedKmh } from "@runner360/training-engine";
import { formatPaceLabel, formatSpeed, WORKOUT_STATUS_LABELS } from "@runner360/shared";
import { useActionState, useState } from "react";
import { CheckboxField, FormMessage, SelectField, SubmitButton, TextAreaField, TextField } from "@/components/ui/form";
import { Stat } from "@/components/ui/primitives";
import { initialActionState } from "@/lib/action-state";
import { saveWorkoutAction } from "@/lib/actions/workouts";

export function WorkoutForm({ today, defaultDate, defaultEntryId, sessions }: { today: string; defaultDate: string; defaultEntryId: string; sessions: { id: string; label: string }[] }) {
  const [state, action] = useActionState(saveWorkoutAction, initialActionState);
  const [status, setStatus] = useState("completed");
  const [km, setKm] = useState("");
  const [duration, setDuration] = useState("");
  const e = state.errors ?? {};

  // Vista previa con las mismas funciones del motor que usa el servidor.
  const meters = kmInputToMeters(km);
  const seconds = parseDuration(duration);
  const pace = meters !== null && seconds !== null ? paceSecondsPerKm(meters, seconds) : null;
  const speed = meters !== null && seconds !== null ? speedKmh(meters, seconds) : null;
  const skipped = status === "skipped";

  return (
    <form action={action} className="space-y-5" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField
          label="Sesión planificada asociada"
          name="calendarEntryId"
          defaultValue={defaultEntryId}
          placeholder="Entrenamiento libre (sin sesión del plan)"
          options={sessions.map((s) => ({ value: s.id, label: s.label }))}
          error={e.calendarEntryId}
        />
        <SelectField
          label="Estado"
          name="status"
          value={status}
          onChange={(ev) => setStatus(ev.target.value)}
          options={Object.entries(WORKOUT_STATUS_LABELS).map(([value, label]) => ({ value, label }))}
          error={e.status}
        />
        <TextField label="Fecha" name="workoutDate" type="date" max={today} defaultValue={defaultDate} required error={e.workoutDate} />
        <TextField label="Hora de inicio (opcional)" name="startTime" type="time" error={e.startTime} />
      </div>

      {!skipped ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField label="Distancia (km)" name="distanceKm" inputMode="decimal" placeholder="8,5" value={km} onChange={(ev) => setKm(ev.target.value)} error={e.distanceKm} />
            <TextField label="Duración (mm:ss o h:mm:ss)" name="duration" placeholder="45:30" value={duration} onChange={(ev) => setDuration(ev.target.value)} required error={e.duration} />
          </div>
          <div className="grid grid-cols-2 gap-3" aria-live="polite">
            <Stat label="Ritmo medio" value={formatPaceLabel(pace)} />
            <Stat label="Velocidad media" value={formatSpeed(speed)} />
          </div>
          <div className="grid gap-4 sm:grid-cols-4">
            <TextField label="RPE (1–10)" name="rpe" type="number" min={1} max={10} inputMode="numeric" error={e.rpe} />
            <TextField label="FC media" name="avgHr" type="number" min={30} max={250} inputMode="numeric" error={e.avgHr} />
            <TextField label="FC máxima" name="maxHr" type="number" min={30} max={250} inputMode="numeric" error={e.maxHr} />
            <TextField label="Desnivel (m)" name="elevationGainM" type="number" min={0} max={10000} inputMode="numeric" error={e.elevationGainM} />
          </div>
          <TextAreaField
            label="Parciales por kilómetro (opcional)"
            name="splits"
            placeholder="5:10, 5:05, 4:58"
            hint="Un tiempo por km separado por coma o línea. El último puede corresponder a un tramo menor a 1 km."
            error={e.splits}
            rows={2}
          />
        </>
      ) : null}

      <TextAreaField label="Comentarios (opcional)" name="comments" maxLength={2000} rows={3} error={e.comments} />
      <CheckboxField name="painReported" label="Tuve dolor o una molestia fuera de lo habitual" hint="Lo usamos para sugerirte una revisión antes de seguir progresando." />
      <FormMessage state={state} />
      <SubmitButton pendingText="Guardando…" className="w-full sm:w-auto">Guardar entrenamiento</SubmitButton>
    </form>
  );
}
