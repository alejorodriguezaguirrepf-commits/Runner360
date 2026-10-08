-- Contenido educativo inicial. Orientativo y general: NO reemplaza el consejo de un profesional.
-- reviewed_by queda en NULL: la interfaz lo muestra como "Pendiente de revisión profesional".
begin;

insert into public.educational_contents (id, slug, title, summary, body, category, is_premium, status, published_at)
values
(
  '00000000-0000-4000-8000-000000000201', 'hidratacion-basica', 'Hidratación: principios generales',
  'Por qué no existe una cantidad única de agua para todas las personas y qué señales tener en cuenta.',
  $md$Las necesidades de líquidos varían mucho entre personas. Dependen del tamaño corporal, la intensidad y duración del ejercicio, la temperatura, la humedad, la ropa y la tasa de sudoración de cada uno. Por eso RUNNER 360 no indica una cantidad universal.

**Algunas pautas generales:**

- Llegar al entrenamiento habiendo bebido con normalidad durante el día.
- En sesiones cortas y frescas, muchas personas no necesitan beber durante el ejercicio.
- En sesiones largas o con calor, planificá cómo vas a acceder a líquidos.
- Beber en exceso también puede ser riesgoso. Evitá forzarte a tomar grandes volúmenes.

**Consultá a un profesional** si entrenás con calor extremo, tenés una enfermedad, tomás medicación que afecte el balance de líquidos o tuviste síntomas como mareos, confusión, calambres intensos o dolor de cabeza persistente.

La app registra lo que vos cargás. No mide tu estado de hidratación.$md$,
  'hydration', false, 'published', now()
),
(
  '00000000-0000-4000-8000-000000000202', 'calor-y-sesiones-largas', 'Calor y sesiones largas',
  'Recaudos generales para entrenar con temperaturas altas.',
  $md$Con calor, el esfuerzo percibido sube a igual ritmo. Algunas medidas generales:

- Elegí horarios más frescos (temprano o al atardecer).
- Ajustá el ritmo por sensación de esfuerzo (RPE), no por el reloj.
- Usá ropa liviana y protección solar.
- En sesiones prolongadas, considerá bebidas con electrolitos según la indicación de tu profesional.

**Suspendé la actividad** ante mareos, confusión, náuseas, piel fría y húmeda o ausencia de sudor con calor intenso, y buscá asistencia.$md$,
  'hydration', false, 'published', now()
),
(
  '00000000-0000-4000-8000-000000000203', 'que-es-el-rpe', 'Qué es el RPE (esfuerzo percibido)',
  'Cómo usar la escala de 1 a 10 para regular la intensidad.',
  $md$El RPE (por sus siglas en inglés, *Rating of Perceived Exertion*) es una escala de 1 a 10 para describir cuán exigente sentís un esfuerzo.

- **1–2:** muy suave, podrías sostenerlo mucho tiempo.
- **3–4:** suave, podés conversar con frases completas.
- **5–6:** moderado, hablás con frases cortas.
- **7–8:** exigente, solo podés decir algunas palabras.
- **9–10:** máximo o casi máximo.

Los planes indican un rango de RPE objetivo. Si un día te sentís peor de lo habitual, priorizá el rango de esfuerzo antes que el ritmo.$md$,
  'training', false, 'published', now()
)
on conflict (id) do nothing;

commit;
