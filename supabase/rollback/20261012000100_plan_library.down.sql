-- Reversión de 20261012000100_plan_library.sql.
-- ATENCIÓN: borra las inscripciones, los check-ins y los datos de salud cargados en los registros
-- (dolor, señales de alarma, sueño). Los registros de entrenamiento en sí se conservan.
-- Correr solo con autorización explícita: psql "$DATABASE_URL" -f supabase/rollback/20261012000100_plan_library.down.sql
begin;

drop policy if exists workouts_insert_own on public.workout_logs;
create policy workouts_insert_own on public.workout_logs for insert to authenticated
  with check (user_id = (select auth.uid()));
drop policy if exists workouts_update_own on public.workout_logs;
create policy workouts_update_own on public.workout_logs for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

drop index if exists public.workout_logs_one_per_plan_day;
drop index if exists public.workout_logs_enrollment_idx;
alter table public.workout_logs
  drop constraint if exists workout_logs_plan_ref,
  drop column if exists sleep_quality,
  drop column if exists red_flags,
  drop column if exists pain_score,
  drop column if exists plan_day_index,
  drop column if exists plan_week,
  drop column if exists enrollment_id;

drop table if exists public.weekly_checkins;
drop table if exists public.plan_enrollments;
drop function if exists public.guard_plan_enrollment();
drop function if exists public.library_day_map_violations(text, text, smallint[]);
drop function if exists public.library_day_map_is_permutation(smallint[]);

drop function if exists public.library_week_is_open(smallint) cascade;
delete from public.app_features where key = 'plan_library';
drop table if exists public.library_settings;

drop table if exists public.library_days;
drop table if exists public.library_weeks;
drop table if exists public.library_plans;
drop table if exists public.library_strength_exercises;
drop table if exists public.library_session_types;
drop table if exists public.library_intensities;
drop table if exists public.library_versions;
drop function if exists public.guard_library_immutable();

do $$
begin
  if to_regclass('runner360_meta.schema_migrations') is not null then
    delete from runner360_meta.schema_migrations
     where version = '20261012000100' or version like 'seed:40_plan_library.sql%';
  end if;
end $$;

commit;
