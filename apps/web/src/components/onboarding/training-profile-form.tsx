"use client";
import { useActionState, useState } from "react";
import {
  RACE_DISTANCE_LABELS,
  RACE_DISTANCES,
  RUNNER_LEVEL_LABELS,
  RUNNER_LEVELS,
  TRAINING_GOAL_LABELS,
  TRAINING_GOALS,
  WEEKDAY_LABELS,
  WEEKDAYS,
} from "@runner360/shared";
import { saveTrainingProfileAction } from "@/app/onboarding/actions";
import { Alert } from "@/components/ui/alert";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { initialActionState } from "@/lib/form";

export interface ProfileDefaults {
  displayName: string;
  birthDate: string;
  targetDistance: string;
  level: string;
  experienceMonths: string;
  weeklyKm: string;
  availableDays: number[];
  recentRaceKm: string;
  recentRaceTime: string;
  goal: string;
  raceDate: string;
  preferences: string;
  hasRecentInjury: boolean;
  hasMedicalCondition: boolean;
  healthNotes: string;
}

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <fieldset className="space-y-4 rounded-2xl border border-line bg-white p-5">
      <legend className="px-1 text-base font-semibold text-navy">{title}</legend>
      {description ? <p className="-mt-2 text-sm text-muted">{description}</p> : null}
      {children}
    </fieldset>
  );
}

export function TrainingProfileForm({ defaults, submitLabel }: { defaults: ProfileDefaults; submitLabel: string }) {
  const [state, action] = useActionState(saveTrainingProfileAction, initialActionState);
  const [goal, setGoal] = useState(defaults.goal || "complete");
  const [health, setHealth] = useState(defaults.hasRecentInjury || defaults.hasMedicalCondition || !!defaults.healthNotes);
  const fe = state.fieldErrors ?? {};

  return (
    <form action={action} className="space-y-6" noValidate>
      {state.message ? <Alert tone="danger">{state.message}</Alert> : null}

      <Section title="Sobre vos">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nombre visible" htmlFor="displayName" error={fe.displayName}>
            <Input id="displayName" name="displayName" defaultValue={defaults.displayName} required invalid={!!fe.displayName} />
          </Field>
          <Field label="Fecha de nacimiento" htmlFor="birthDate" error={fe.birthDate} hint="Para adecuar recomendaciones generales. Edad mínima: 16 años.">
            <Input id="birthDate" name="birthDate" type="date" defaultValue={defaults.birthDate} required invalid={!!fe.birthDate} />
          </Field>
        </div>
      </Section>

      <Section title="Tu objetivo">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Distancia objetivo" htmlFor="targetDistance" error={fe.targetDistance}>
            <Select id="targetDistance" name="targetDistance" defaultValue={defaults.targetDistance || "5k"}>
              {RACE_DISTANCES.map((d) => (
                <option key={d} value={d}>{RACE_DISTANCE_LABELS[d]}</option>
              ))}
            </Select>
          </Field>
          <Field label="Objetivo" htmlFor="goal" error={fe.goal}>
            <Select id="goal" name="goal" value={goal} onChange={(e) => setGoal(e.target.value)}>
              {TRAINING_GOALS.map((g) => (
                <option key={g} value={g}>{TRAINING_GOAL_LABELS[g]}</option>
              ))}
            </Select>
          </Field>
          <Field
            label={goal === "prepare_race" ? "Fecha de la competencia" : "Fecha de competencia (opcional)"}
            htmlFor="raceDate"
            error={fe.raceDate}
          >
            <Input id="raceDate" name="raceDate" type="date" defaultValue={defaults.raceDate} invalid={!!fe.raceDate} />
          </Field>
        </div>
      </Section>

      <Section title="Tu experiencia" description="Respondé con tu situación actual, no con la que te gustaría tener.">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Nivel" htmlFor="level" error={fe.level}>
            <Select id="level" name="level" defaultValue={defaults.level || "beginner"}>
              {RUNNER_LEVELS.map((l) => (
                <option key={l} value={l}>{RUNNER_LEVEL_LABELS[l]}</option>
              ))}
            </Select>
          </Field>
          <Field label="Meses corriendo" htmlFor="experienceMonths" error={fe.experienceMonths}>
            <Input id="experienceMonths" name="experienceMonths" type="number" min={0} max={720} inputMode="numeric" defaultValue={defaults.experienceMonths} required invalid={!!fe.experienceMonths} />
          </Field>
          <Field label="Km por semana (actual)" htmlFor="weeklyKm" error={fe.weeklyDistanceM} hint="Promedio de las últimas semanas. 0 si no corrés.">
            <Input id="weeklyKm" name="weeklyKm" inputMode="decimal" defaultValue={defaults.weeklyKm} invalid={!!fe.weeklyDistanceM} />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Marca reciente: distancia en km (opcional)" htmlFor="recentRaceKm" error={fe.recentRaceDistanceM}>
            <Input id="recentRaceKm" name="recentRaceKm" inputMode="decimal" placeholder="Ej.: 10" defaultValue={defaults.recentRaceKm} invalid={!!fe.recentRaceDistanceM} />
          </Field>
          <Field label="Marca reciente: tiempo (opcional)" htmlFor="recentRaceTime" error={fe.recentRaceTimeS} hint="mm:ss o h:mm:ss">
            <Input id="recentRaceTime" name="recentRaceTime" inputMode="numeric" placeholder="Ej.: 55:30" defaultValue={defaults.recentRaceTime} invalid={!!fe.recentRaceTimeS} />
          </Field>
        </div>
      </Section>

      <Section title="Disponibilidad" description="Marcá todos los días en los que podrías entrenar.">
        <div role="group" aria-label="Días disponibles" className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
          {WEEKDAYS.map((d) => (
            <label key={d} className="flex cursor-pointer items-center gap-2 rounded-xl border border-line px-3 py-2.5 text-sm has-[:checked]:border-navy has-[:checked]:bg-navy has-[:checked]:text-white">
              <input type="checkbox" name="availableDays" value={d} defaultChecked={defaults.availableDays.includes(d)} className="size-4 accent-lime" />
              {WEEKDAY_LABELS[d]}
            </label>
          ))}
        </div>
        {fe.availableDays ? <p className="text-xs font-medium text-danger">{fe.availableDays}</p> : null}
        <Field label="Preferencias de entrenamiento (opcional)" htmlFor="preferences" error={fe.preferences}>
          <Textarea id="preferences" name="preferences" maxLength={500} defaultValue={defaults.preferences} placeholder="Ej.: prefiero entrenar temprano, corro en cinta los días de lluvia…" />
        </Field>
      </Section>

      <Section
        title="Antecedentes para una adaptación segura"
        description="Opcional. No realizamos diagnósticos: esta información solo se usa para recomendarte una consulta profesional o una fase introductoria."
      >
        <Checkbox id="health" label="Quiero informar antecedentes de salud relevantes" checked={health} onChange={(e) => setHealth(e.target.checked)} />
        {health ? (
          <div className="space-y-4 rounded-xl bg-surface p-4">
            <Checkbox id="hasRecentInjury" name="hasRecentInjury" defaultChecked={defaults.hasRecentInjury} label="Tuve una lesión en los últimos 6 meses" />
            <Checkbox id="hasMedicalCondition" name="hasMedicalCondition" defaultChecked={defaults.hasMedicalCondition} label="Tengo una condición médica que podría verse afectada por el ejercicio" />
            <Field label="Comentarios (opcional)" htmlFor="healthNotes" error={fe.healthNotes}>
              <Textarea id="healthNotes" name="healthNotes" maxLength={500} defaultValue={defaults.healthNotes} />
            </Field>
            <Checkbox
              id="healthDataConsent"
              name="healthDataConsent"
              label="Doy mi consentimiento expreso para que RUNNER 360 guarde estos datos de salud. Solo yo puedo verlos y puedo eliminarlos cuando quiera."
            />
            {fe.healthDataConsent ? <p className="text-xs font-medium text-danger">{fe.healthDataConsent}</p> : null}
          </div>
        ) : null}
      </Section>

      <SubmitButton size="lg" className="w-full sm:w-auto">{submitLabel}</SubmitButton>
    </form>
  );
}
