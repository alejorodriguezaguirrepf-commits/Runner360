-- Fuerza desde el contenido 2026.13: cada rutina tiene dos sesiones de 5 ejercicios con su patrón de
-- movimiento (básicos de rodilla y cadera, auxiliar, empuje y tracción). Solo agrega dos columnas; las
-- versiones anteriores quedan como estaban (sesión 1, sin patrón).

alter table public.library_strength_exercises
  add column session smallint not null default 1 check (session in (1, 2)),
  add column pattern text check (pattern is null or pattern in (
    'knee_basic', 'hip_basic', 'knee_aux', 'hip_aux', 'push_horizontal', 'pull_horizontal', 'push_vertical', 'pull_vertical'
  ));
comment on column public.library_strength_exercises.session is 'Sesión de fuerza de la semana (1 = pesada, 2 = liviana). Desde 2026.13.';
comment on column public.library_strength_exercises.pattern is 'Patrón de movimiento del ejercicio. Desde 2026.13; null en versiones anteriores.';
