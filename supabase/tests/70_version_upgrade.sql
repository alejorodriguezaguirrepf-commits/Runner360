-- Convivencia de versiones: al publicar una versión nueva, las inscripciones en 2026.10 conservan su versión.
begin;
create function pg_temp.check(p_ok boolean, p_label text) returns void language plpgsql as $$
begin
  if not coalesce(p_ok, false) then raise exception 'Falló: %', p_label; end if;
end; $$;
create function pg_temp.expect_error(p_sql text, p_label text) returns void language plpgsql as $$
begin
  begin execute p_sql; exception when others then return; end;
  raise exception 'Se esperaba un error y no ocurrió: %', p_label;
end; $$;

-- Versión anterior simulada: copia de los planes 01–18 bajo '2026.10' (no vigente).
insert into public.library_versions
select (jsonb_populate_record(null::public.library_versions, to_jsonb(v)
  || jsonb_build_object('content_version', '2026.10', 'is_current', false, 'checksum', repeat('0', 64)))).*
from public.library_versions v where content_version = '2026.12';
insert into public.library_intensities
select (jsonb_populate_record(null::public.library_intensities, to_jsonb(t) || '{"content_version":"2026.10"}')).*
from public.library_intensities t where content_version = '2026.12';
insert into public.library_session_types
select (jsonb_populate_record(null::public.library_session_types, to_jsonb(t) || '{"content_version":"2026.10"}')).*
from public.library_session_types t where content_version = '2026.12';
insert into public.library_strength_exercises
select (jsonb_populate_record(null::public.library_strength_exercises, to_jsonb(t) || '{"content_version":"2026.10"}')).*
from public.library_strength_exercises t where content_version = '2026.12';
insert into public.library_plans
select (jsonb_populate_record(null::public.library_plans, to_jsonb(t) || '{"content_version":"2026.10"}')).*
from public.library_plans t where content_version = '2026.12' and number <= 18;
insert into public.library_weeks
select (jsonb_populate_record(null::public.library_weeks, to_jsonb(t) || '{"content_version":"2026.10"}')).*
from public.library_weeks t where content_version = '2026.12' and plan_id <= 'plan-18';
insert into public.library_days
select (jsonb_populate_record(null::public.library_days, to_jsonb(t) || '{"content_version":"2026.10"}')).*
from public.library_days t where content_version = '2026.12' and plan_id <= 'plan-18';

insert into auth.users (id, email) values
  ('a7a7a7a7-0000-4000-8000-0000000000a7', 'old-version@test.local'),
  ('b7b7b7b7-0000-4000-8000-0000000000b7', 'new-version@test.local');

-- Inscripción hecha antes de la publicación: queda en 2026.10.
insert into public.plan_enrollments (id, user_id, content_version, plan_id, start_date, race_date)
values ('e7e7e7e7-0000-4000-8000-0000000000e7', 'a7a7a7a7-0000-4000-8000-0000000000a7', '2026.10', 'plan-01', '2026-10-19', '2026-11-15');

select pg_temp.check((select content_version from public.library_versions where is_current) = '2026.12', 'vigente: 2026.12');
select pg_temp.check((select count(*) from public.library_plans where content_version = '2026.12') = 21, '21 planes vigentes');
select pg_temp.check((select count(*) from public.library_plans where content_version = '2026.10') = 18, '18 planes en 2026.10');
select pg_temp.check((select content_version from public.plan_enrollments where id = 'e7e7e7e7-0000-4000-8000-0000000000e7') = '2026.10',
  'la inscripción anterior conserva su versión');
-- Su plan es idéntico en las dos versiones (mismas semanas y sesiones).
select pg_temp.check(not exists (
  (select plan_id, week, day_index, code, main_set, duration_min_est, distance_km_est from public.library_days where content_version = '2026.10' and plan_id = 'plan-01')
  except
  (select plan_id, week, day_index, code, main_set, duration_min_est, distance_km_est from public.library_days where content_version = '2026.12' and plan_id = 'plan-01')
), 'plan-01 igual en ambas versiones');
select pg_temp.check(public.library_day_map_violations('2026.10', 'plan-01', array[0,1,2,3,4,5,6]::smallint[]) = '{}',
  'mover días sigue funcionando sobre la versión anterior');
-- Los planes nuevos no existen en la versión anterior.
select pg_temp.expect_error($$insert into public.plan_enrollments (user_id, content_version, plan_id, start_date, race_date)
  values ('b7b7b7b7-0000-4000-8000-0000000000b7', '2026.10', 'plan-19', '2026-10-19', '2026-12-27')$$, 'plan-19 en 2026.10');

-- Inscripción nueva en el 5 km intermedio: 10 semanas, carrera el domingo de la semana 10.
select pg_temp.expect_error($$insert into public.plan_enrollments (user_id, content_version, plan_id, start_date, race_date)
  values ('b7b7b7b7-0000-4000-8000-0000000000b7', '2026.12', 'plan-19', '2026-10-19', '2027-01-03')$$, 'fecha de carrera fuera de la semana 10');
insert into public.plan_enrollments (user_id, content_version, plan_id, start_date, race_date)
values ('b7b7b7b7-0000-4000-8000-0000000000b7', '2026.12', 'plan-19', '2026-10-19', '2026-12-27');
select pg_temp.check((select race_date - start_date from public.plan_enrollments where user_id = 'b7b7b7b7-0000-4000-8000-0000000000b7') = 69,
  'carrera = inicio + 69 días');
rollback;
