-- Reversión de 20261013000100_enrollment_mark.sql (borra las marcas cargadas en las inscripciones).
begin;
alter table public.plan_enrollments
  drop constraint if exists plan_enrollments_mark_complete,
  drop column if exists mark_date,
  drop column if exists mark_time_s,
  drop column if exists mark_distance_m;
do $$
begin
  if to_regclass('runner360_meta.schema_migrations') is not null then
    delete from runner360_meta.schema_migrations where version = '20261013000100';
  end if;
end $$;
commit;
