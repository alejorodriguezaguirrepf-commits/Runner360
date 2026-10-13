-- RUNNER 360 — Marca reciente en la inscripción (opcional), para estimar ritmos de referencia con Riegel.
-- Solo agrega columnas opcionales. Reversión: supabase/rollback/20261013000100_enrollment_mark.down.sql
alter table public.plan_enrollments
  add column mark_distance_m integer check (mark_distance_m between 400 and 100000),
  add column mark_time_s integer check (mark_time_s between 60 and 86400),
  add column mark_date date,
  add constraint plan_enrollments_mark_complete check (
    (mark_distance_m is null and mark_time_s is null and mark_date is null)
    or (mark_distance_m is not null and mark_time_s is not null and mark_date is not null)
  );
comment on column public.plan_enrollments.mark_date is 'Fecha de la marca: solo se usa si tiene 8 semanas o menos.';
