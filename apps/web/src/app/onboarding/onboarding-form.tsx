"use client";

import {
  DISTANCE_LABELS,
  EXPERIENCE_LABELS,
  GOAL_LABELS,
  HEALTH_FLAG_LABELS,
  LEVEL_LABELS,
  WEEKDAY_LABELS,
} from "@runner360/shared";
import { useState } from "react";
import { CheckboxField, ChoiceGroup, FormMessage, SelectField, SubmitButton, TextField, useFormAction } from "@/components/ui/form";
import { Card } from "@/components/ui/primitives";
import { initialActionState } from "@/lib/action-state";
import { saveOnboardingAction } from "@/lib/actions/onboarding";

export interface OnboardingDefaults {
  displayName: string;
  birthDate: string;
  targetDistance: string;
  level: string;
  experience: string;
  weeklyKm: string;
  availableWeekdays: string[];
  goal: string;
  raceDate: string;
  recentMarkDistanceKm: string;
  recentMarkTime: string;
  preferredSurface: string;
  preferredTime: string;
  healthFlags: string[];
}

const toOptions = (rec: Record<string, string>) => Object.entries(rec).map(([value, label]) => ({ value, label }));

export function OnboardingForm({ defaults }: { defaults: OnboardingDefaults }) {
  const { state, pending, onSubmit } = useFormAction(saveOnboardingAction, initialActionState);
  const [goal, setGoal] = useState(defaults.goal);
  const [healthConsent, setHealthConsent] = useState(defaults.healthFlags.length > 0);
  const e = state.errors ?? {};

  return (
    <form onSubmit={onSubmit} className="mt-6 space-y-6" noValidate>
      <Card>
        <h2 className="mb-4 font-bold">1. Datos básicos</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="Nombre visible" name="displayName" defaultValue={defaults.displayName} required maxLength={60} error={e.displayName} />
          <TextField label="Fecha de nacimiento" name="birthDate" type="date" defaultValue={defaults.birthDate} required error={e.birthDate} />
        </div>
      </Card>

      <Card>
        <h2 className="mb-4 font-bold">2. Tu objetivo</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField label="Distancia objetivo" name="targetDistance" defaultValue={defaults.targetDistance} placeholder="Elegí una distancia" options={toOptions(DISTANCE_LABELS)} error={e.targetDistance} required />
          <SelectField
            label="Objetivo"
            name="goal"
            value={goal}
            onChange={(ev) => setGoal(ev.target.value)}
            placeholder="Elegí tu objetivo"
            options={toOptions(GOAL_LABELS)}
            error={e.goal}
            required
          />
          <TextField
            label={goal === "race" ? "Fecha de la competencia" : "Fecha de la competencia (opcional)"}
            name="raceDate"
            type="date"
            defaultValue={defaults.raceDate}
            error={e.raceDate}
            hint="Si la cargás, alineamos el final del plan con esa semana."
          />
        </div>
      </Card>

      <Card>
        <h2 className="mb-4 font-bold">3. Tu experiencia</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField label="Nivel" name="level" defaultValue={defaults.level} placeholder="Elegí tu nivel" options={toOptions(LEVEL_LABELS)} error={e.level} required />
          <SelectField label="Experiencia corriendo" name="experience" defaultValue={defaults.experience} placeholder="Elegí una opción" options={toOptions(EXPERIENCE_LABELS)} error={e.experience} required />
          <TextField label="Kilómetros semanales actuales" name="weeklyKm" inputMode="decimal" defaultValue={defaults.weeklyKm} placeholder="0" error={e.weeklyKm} hint="Promedio de las últimas 4 semanas. Si no corrés, poné 0." />
        </div>
        <div className="mt-5">
          <p className="text-sm font-semibold">Marca reciente (opcional)</p>
          <div className="mt-2 grid gap-4 sm:grid-cols-2">
            <TextField label="Distancia (km)" name="recentMarkDistanceKm" inputMode="decimal" defaultValue={defaults.recentMarkDistanceKm} placeholder="5" error={e.recentMarkDistanceKm} />
            <TextField label="Tiempo (mm:ss o h:mm:ss)" name="recentMarkTime" defaultValue={defaults.recentMarkTime} placeholder="28:30" error={e.recentMarkTime} />
          </div>
        </div>
      </Card>

      <Card>
        <h2 className="mb-4 font-bold">4. Disponibilidad y preferencias</h2>
        <ChoiceGroup
          legend="Días disponibles para entrenar"
          hint="Ubicamos tus sesiones solo en estos días, usando distribuciones aprobadas del plan."
          name="availableWeekdays"
          type="checkbox"
          options={WEEKDAY_LABELS.map((label, i) => ({ value: String(i + 1), label }))}
          defaultValues={defaults.availableWeekdays}
          error={e.availableWeekdays}
        />
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <SelectField
            label="Superficie preferida"
            name="preferredSurface"
            defaultValue={defaults.preferredSurface}
            placeholder="Sin preferencia"
            options={[
              { value: "road", label: "Calle / asfalto" },
              { value: "trail", label: "Trail / tierra" },
              { value: "track", label: "Pista" },
              { value: "treadmill", label: "Cinta" },
              { value: "mixed", label: "Mixta" },
            ]}
          />
          <SelectField
            label="Momento del día"
            name="preferredTime"
            defaultValue={defaults.preferredTime}
            placeholder="Sin preferencia"
            options={[
              { value: "morning", label: "Mañana" },
              { value: "midday", label: "Mediodía" },
              { value: "evening", label: "Tarde / noche" },
              { value: "any", label: "Indistinto" },
            ]}
          />
        </div>
      </Card>

      <Card>
        <h2 className="mb-1 font-bold">5. Antecedentes relevantes (opcional)</h2>
        <p className="mb-4 text-sm text-muted">
          Son datos sensibles. Solo los ve tu cuenta y se usan para recomendarte una consulta profesional antes de asignar un plan. No hacemos diagnósticos.
        </p>
        <CheckboxField
          name="healthDataConsent"
          label="Doy mi consentimiento expreso para que RUNNER 360 registre los antecedentes que marque a continuación."
          checked={healthConsent}
          onChange={(ev) => setHealthConsent(ev.target.checked)}
          error={e.healthDataConsent}
        />
        <fieldset className="mt-4 space-y-3" disabled={!healthConsent} aria-describedby="health-hint">
          <legend className="sr-only">Antecedentes</legend>
          <p id="health-hint" className="text-xs text-muted">{healthConsent ? "Marcá lo que corresponda." : "Activá el consentimiento para completar esta sección."}</p>
          {Object.entries(HEALTH_FLAG_LABELS).map(([value, label]) => (
            <label key={value} className="flex items-start gap-3 text-sm">
              <input type="checkbox" name="healthFlags" value={value} defaultChecked={defaults.healthFlags.includes(value)} className="mt-0.5 size-5 accent-navy-900" />
              <span>{label}</span>
            </label>
          ))}
        </fieldset>
      </Card>

      <FormMessage state={state} />
      <div className="flex justify-end">
        <SubmitButton pending={pending} pendingText="Guardando perfil…" className="w-full sm:w-auto">Guardar y ver mi plan</SubmitButton>
      </div>
    </form>
  );
}
