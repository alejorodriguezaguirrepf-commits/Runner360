-- Biblioteca de planes: importación, inmutabilidad, acceso por semanas, inscripciones y registros.
begin;
create function pg_temp.expect_error(p_sql text, p_label text) returns void language plpgsql as $$
begin
  begin execute p_sql; exception when others then return; end;
  raise exception 'Se esperaba un error y no ocurrió: %', p_label;
end; $$;
create function pg_temp.check(p_ok boolean, p_label text) returns void language plpgsql as $$
begin
  if not coalesce(p_ok, false) then raise exception 'Falló: %', p_label; end if;
end; $$;
grant execute on all functions in schema pg_temp to anon, authenticated;

-- Importación completa (y reimportación idempotente: db-test.sh aplica el seed dos veces).
select pg_temp.check((select count(*) from public.library_versions) = 1, 'una sola versión importada');
select pg_temp.check((select content_version from public.library_versions where is_current) = '2026.10', 'versión vigente');
select pg_temp.check((select count(*) from public.library_plans) = 18, '18 planes');
select pg_temp.check((select count(*) from public.library_weeks) = 324, '324 semanas');
select pg_temp.check((select count(*) from public.library_days) = 324 * 7, '7 días por semana');
select pg_temp.check((select count(*) from public.library_days where not is_rest) = 1632, '1632 sesiones');
select pg_temp.check((select race_week from public.library_plans where id = 'plan-18') = 45, 'plan 18: competencia en la semana 45');
select pg_temp.check((select count(*) from public.library_intensities) = 6, '6 intensidades');
select pg_temp.check(not exists (
  select 1 from public.library_weeks w
  where abs(w.distance_km_est - (select coalesce(sum(d.distance_km_est), 0) from public.library_days d
    where d.content_version = w.content_version and d.plan_id = w.plan_id and d.week = w.week)) > 0.1
), 'km semanales = suma de los días');

-- Inmutabilidad del contenido (aun para el dueño de la base).
select pg_temp.expect_error($$update public.library_days set main_set = 'x' where plan_id = 'plan-01' and week = 1 and day_index = 1$$, 'día inmutable');
select pg_temp.expect_error($$update public.library_plans set title = 'x' where id = 'plan-01'$$, 'plan inmutable');
update public.library_versions set is_current = true where content_version = '2026.10';

-- Mapeo de días: regla de días exigentes y competencia fija.
select pg_temp.check(public.library_day_map_violations('2026.10', 'plan-13', '{0,1,2,3,4,5,6}') = '{}', 'mapeo original válido');
select pg_temp.check('consecutive_demanding' = any (public.library_day_map_violations('2026.10', 'plan-13', '{0,2,1,3,4,5,6}')), 'dos exigentes seguidas');
select pg_temp.check('race_moved' = any (public.library_day_map_violations('2026.10', 'plan-01', '{0,1,2,3,4,6,5}')), 'competencia movida');
select pg_temp.check(public.library_day_map_violations('2026.10', 'plan-01', '{1,0,2,3,4,5,6}') = '{}', 'mover martes a lunes en plan 1');

insert into auth.users (id, email) values
  ('a1a1a1a1-0000-4000-8000-0000000000a1', 'lib-free@test.local'),
  ('b2b2b2b2-0000-4000-8000-0000000000b2', 'lib-premium@test.local');
insert into public.subscriptions (user_id, product_id, provider, status, current_period_start, current_period_end)
values ('b2b2b2b2-0000-4000-8000-0000000000b2', '00000000-0000-4000-8000-000000000002', 'manual', 'active', now(), now() + interval '30 days');

-- Visitante: ficha y semana 1, no el resto.
set role anon;
select pg_temp.check((select count(*) from public.library_plans) = 18, 'anon ve las fichas');
select pg_temp.check((select count(*) from public.library_days where plan_id = 'plan-01' and week = 1) = 7, 'anon ve la semana 1');
select pg_temp.check((select count(*) from public.library_days where week = 2) = 0, 'anon no ve la semana 2');
reset role;

-- Usuario gratuito.
set role authenticated;
set request.jwt.claim.sub = 'a1a1a1a1-0000-4000-8000-0000000000a1';
select pg_temp.check((select count(*) from public.library_days where week = 2) = 0, 'free no ve la semana 2');
select pg_temp.expect_error($$insert into public.library_settings (id, free_preview_weeks) values (true, 5)$$, 'free no edita la configuración');
delete from public.library_plans where id = 'plan-01';
select pg_temp.check((select count(*) from public.library_plans) = 18, 'free no borra el catálogo');

-- Inscripción: fecha de competencia coherente, una abierta por persona, mapeo válido.
select pg_temp.expect_error($$insert into public.plan_enrollments (user_id, content_version, plan_id, start_date, race_date)
  values ('a1a1a1a1-0000-4000-8000-0000000000a1', '2026.10', 'plan-01', '2026-10-19', '2026-11-22')$$, 'fecha de competencia incoherente');
select pg_temp.expect_error($$insert into public.plan_enrollments (user_id, content_version, plan_id, start_date, race_date, day_map)
  values ('a1a1a1a1-0000-4000-8000-0000000000a1', '2026.10', 'plan-01', '2026-10-19', '2026-11-15', '{0,0,2,3,4,5,6}')$$, 'mapeo que no es permutación');
select pg_temp.expect_error($$insert into public.plan_enrollments (user_id, content_version, plan_id, start_date, race_date)
  values ('b2b2b2b2-0000-4000-8000-0000000000b2', '2026.10', 'plan-01', '2026-10-19', '2026-11-15')$$, 'inscribir a otra persona');
insert into public.plan_enrollments (id, user_id, content_version, plan_id, start_date, race_date, day_map)
values ('e1e1e1e1-0000-4000-8000-0000000000e1', 'a1a1a1a1-0000-4000-8000-0000000000a1', '2026.10', 'plan-01', '2026-10-19', '2026-11-15', '{1,0,2,3,4,5,6}');
select pg_temp.expect_error($$insert into public.plan_enrollments (user_id, content_version, plan_id, start_date, race_date)
  values ('a1a1a1a1-0000-4000-8000-0000000000a1', '2026.10', 'plan-04', '2026-10-19', '2027-01-10')$$, 'segunda inscripción abierta');
select pg_temp.expect_error($$update public.plan_enrollments set day_map = '{0,1,2,3,4,6,5}' where id = 'e1e1e1e1-0000-4000-8000-0000000000e1'$$, 'mover la competencia');
select pg_temp.expect_error($$update public.plan_enrollments set plan_id = 'plan-02' where id = 'e1e1e1e1-0000-4000-8000-0000000000e1'$$, 'cambiar de plan');
update public.plan_enrollments set day_map = '{0,1,2,3,4,5,6}' where id = 'e1e1e1e1-0000-4000-8000-0000000000e1';

-- Registro post-sesión y check-in.
insert into public.workout_logs (user_id, enrollment_id, plan_week, plan_day_index, workout_date, status, duration_s, rpe, pain_score, sleep_quality)
values ('a1a1a1a1-0000-4000-8000-0000000000a1', 'e1e1e1e1-0000-4000-8000-0000000000e1', 1, 1, '2026-10-20', 'completed', 2100, 4, 1, 'good');
select pg_temp.expect_error($$insert into public.workout_logs (user_id, enrollment_id, plan_week, plan_day_index, workout_date, status, duration_s, pain_score)
  values ('a1a1a1a1-0000-4000-8000-0000000000a1', 'e1e1e1e1-0000-4000-8000-0000000000e1', 1, 3, '2026-10-22', 'completed', 2100, 11)$$, 'dolor fuera de rango');
select pg_temp.expect_error($$insert into public.workout_logs (user_id, enrollment_id, plan_week, plan_day_index, workout_date, status, duration_s, red_flags)
  values ('a1a1a1a1-0000-4000-8000-0000000000a1', 'e1e1e1e1-0000-4000-8000-0000000000e1', 1, 3, '2026-10-22', 'completed', 2100, '{dizzy}')$$, 'señal desconocida');
select pg_temp.expect_error($$insert into public.workout_logs (user_id, enrollment_id, plan_week, plan_day_index, workout_date, status, duration_s)
  values ('a1a1a1a1-0000-4000-8000-0000000000a1', 'e1e1e1e1-0000-4000-8000-0000000000e1', 1, 1, '2026-10-20', 'completed', 1800)$$, 'dos registros el mismo día');
insert into public.weekly_checkins (enrollment_id, user_id, week_start, plan_week, criterion_met, recommendation, decision, next_week_start, next_plan_week)
values ('e1e1e1e1-0000-4000-8000-0000000000e1', 'a1a1a1a1-0000-4000-8000-0000000000a1', '2026-10-19', 1, false, 'repeat', 'repeat', '2026-10-26', 1);
select pg_temp.expect_error($$insert into public.weekly_checkins (enrollment_id, user_id, week_start, plan_week, recommendation, decision, next_week_start, next_plan_week)
  values ('e1e1e1e1-0000-4000-8000-0000000000e1', 'a1a1a1a1-0000-4000-8000-0000000000a1', '2026-10-26', 1, 'advance', 'pause', '2026-11-02', 2)$$, 'pausa con semana siguiente');

-- Otra persona no ve ni usa la inscripción ajena.
set request.jwt.claim.sub = 'b2b2b2b2-0000-4000-8000-0000000000b2';
select pg_temp.check((select count(*) from public.plan_enrollments) = 0, 'no ve inscripciones ajenas');
select pg_temp.check((select count(*) from public.weekly_checkins) = 0, 'no ve check-ins ajenos');
select pg_temp.check((select count(*) from public.workout_logs where enrollment_id is not null) = 0, 'no ve registros ajenos');
select pg_temp.expect_error($$insert into public.workout_logs (user_id, enrollment_id, plan_week, plan_day_index, workout_date, status, duration_s)
  values ('b2b2b2b2-0000-4000-8000-0000000000b2', 'e1e1e1e1-0000-4000-8000-0000000000e1', 1, 3, '2026-10-22', 'completed', 1800)$$, 'registrar en inscripción ajena');
select pg_temp.expect_error($$insert into public.weekly_checkins (enrollment_id, user_id, week_start, plan_week, recommendation, decision, next_week_start, next_plan_week)
  values ('e1e1e1e1-0000-4000-8000-0000000000e1', 'b2b2b2b2-0000-4000-8000-0000000000b2', '2026-11-02', 1, 'advance', 'advance', '2026-11-09', 2)$$, 'check-in en inscripción ajena');
-- Premium sin inscripción: solo la muestra (el plan se libera mes a mes al inscribirse; ver 50_monthly_release).
select pg_temp.check((select count(*) from public.library_days where plan_id = 'plan-18') = 7, 'premium sin inscripción ve la muestra');
reset role;

-- El administrador puede ampliar las semanas gratis sin tocar el código.
update public.library_settings set free_preview_weeks = 2;
set role anon;
select pg_temp.check((select count(*) from public.library_days where plan_id = 'plan-01' and week = 2) = 7, 'semana 2 abierta por configuración');
reset role;

-- Una versión usada por inscripciones no se puede borrar.
select pg_temp.expect_error($$delete from public.library_versions where content_version = '2026.10'$$, 'borrar versión en uso');

rollback;
