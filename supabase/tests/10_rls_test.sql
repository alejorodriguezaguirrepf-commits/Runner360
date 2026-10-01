-- Pruebas de seguridad (RLS, privilegios y reglas de negocio en la base de datos).
-- Ejecutar con scripts/verify-db.sh. Cualquier fallo aborta con error.
\set ON_ERROR_STOP 1
\pset tuples_only on
\pset format unaligned

create schema if not exists test_helpers;
grant usage on schema test_helpers to anon, authenticated;

create or replace function test_helpers.login(p_uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, false);
$$;
create or replace function test_helpers.ok(p_cond boolean, p_label text) returns void language plpgsql as $$
begin
  if p_cond is distinct from true then raise exception 'FALLÓ: %', p_label; end if;
  raise notice 'ok - %', p_label;
end $$;
create or replace function test_helpers.throws(p_sql text, p_label text) returns void language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    raise notice 'ok - % (error esperado: %)', p_label, sqlerrm;
    return;
  end;
  raise exception 'FALLÓ: se esperaba un error en "%"', p_label;
end $$;
grant execute on all functions in schema test_helpers to anon, authenticated;

-- ---------- Datos ----------
insert into auth.users (id, email, raw_user_meta_data) values
  ('11111111-1111-4111-8111-111111111111', 'ana@example.com', '{"display_name":"Ana"}'),
  ('22222222-2222-4222-8222-222222222222', 'beto@example.com', '{}'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'admin@example.com', '{}'),
  ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'coach@example.com', '{}');
insert into public.user_roles (user_id, role) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'admin'),
  ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'coach');

select test_helpers.ok((select count(*) from public.profiles) = 4, 'el registro crea perfiles automáticamente');
select test_helpers.ok((select display_name from public.profiles where email = 'ana@example.com') = 'Ana', 'display_name desde metadata');

-- ---------- Usuario A ----------
set role authenticated;
select test_helpers.login('11111111-1111-4111-8111-111111111111');

select test_helpers.ok((select count(*) from public.profiles) = 1, 'A solo ve su perfil');
update public.profiles set display_name = 'Ana R' where id = '11111111-1111-4111-8111-111111111111';
select test_helpers.throws($$update public.profiles set email = 'x@x.com'$$, 'A no puede cambiar su email directamente');
select test_helpers.ok((select count(*) from public.profiles where id = '22222222-2222-4222-8222-222222222222') = 0, 'A no ve el perfil de B');
select test_helpers.throws($$insert into public.user_roles (user_id, role) values ('11111111-1111-4111-8111-111111111111', 'admin')$$, 'A no puede autoasignarse admin');
select test_helpers.ok(not public.is_admin(), 'A no es admin');

insert into public.training_profiles (user_id, target_distance, level, experience_months, weekly_distance_m, available_days, goal)
values ('11111111-1111-4111-8111-111111111111', '5k', 'beginner', 3, 8000, '{2,4,6}', 'complete');
select test_helpers.throws($$insert into public.training_profiles (user_id, target_distance, level, experience_months, weekly_distance_m, available_days, goal)
  values ('22222222-2222-4222-8222-222222222222', '5k', 'beginner', 3, 8000, '{2,4,6}', 'complete')$$, 'A no puede crear el perfil deportivo de B');

select test_helpers.throws($$insert into public.training_health_info (user_id, has_recent_injury) values ('11111111-1111-4111-8111-111111111111', true)$$,
  'sin consentimiento no se guardan datos de salud');
insert into public.user_consents (user_id, consent_type, document_version, granted)
values ('11111111-1111-4111-8111-111111111111', 'health_data', 'test', true);
insert into public.training_health_info (user_id, has_recent_injury) values ('11111111-1111-4111-8111-111111111111', true);
select test_helpers.ok((select count(*) from public.training_health_info) = 1, 'con consentimiento A guarda sus datos de salud');

select test_helpers.ok((select count(*) from public.training_plan_versions where status = 'published') = 16, 'A ve las 16 versiones DEMO publicadas');
select test_helpers.ok((select count(*) from public.training_sessions s join public.training_plan_versions v on v.id = s.plan_version_id
  join public.training_plans p on p.id = v.plan_id where p.slug = 'demo-5k-beginner') = 24, 'A ve las sesiones de un plan gratuito');

-- Inicio de plan transaccional con calendario.
select public.start_training_plan(
  v.id, date '2026-09-07', 1, '3d', '{2,4,6}', null,
  (select jsonb_agg(jsonb_build_object('sessionId', s.id, 'weekNumber', w.week_number,
     'scheduledDate', (date '2026-09-07' + (w.week_number - 1) * 7 + ((array[2,4,6])[s.day_slot] - 1))))
   from public.training_sessions s join public.training_plan_weeks w on w.id = s.week_id where s.plan_version_id = v.id))
from public.training_plan_versions v join public.training_plans p on p.id = v.plan_id where p.slug = 'demo-5k-beginner';
select test_helpers.ok((select count(*) from public.user_training_calendar) = 24, 'calendario de A creado (24 sesiones)');

-- Sesión de otra versión: rechazada por integridad.
select test_helpers.throws($$insert into public.user_training_calendar (user_plan_id, user_id, session_id, week_number, scheduled_date)
  select u.id, u.user_id, s.id, 1, date '2026-10-06' from public.user_training_plans u, public.training_sessions s
  join public.training_plan_versions v on v.id = s.plan_version_id join public.training_plans p on p.id = v.plan_id
  where p.slug = 'demo-10k-beginner' limit 1$$, 'no se puede agendar una sesión de otro plan');

insert into public.workout_logs (user_id, started_at, distance_m, duration_s, rpe, status, calendar_entry_id)
select '11111111-1111-4111-8111-111111111111', '2026-09-08T07:00:00-03:00', 5000, 1650, 4, 'completed', c.id
from public.user_training_calendar c order by c.scheduled_date limit 1;
select test_helpers.ok((select avg_pace_s_per_km from public.workout_logs) = 330.00, 'ritmo medio calculado en la base (5:30 /km)');
select test_helpers.throws($$insert into public.workout_logs (user_id, started_at, distance_m, duration_s, status) values ('11111111-1111-4111-8111-111111111111', now(), 1000, 0, 'completed')$$,
  'una sesión completada exige duración > 0');
insert into public.workout_logs (user_id, started_at, distance_m, duration_s, status) values ('11111111-1111-4111-8111-111111111111', now(), 0, 0, 'skipped');
select test_helpers.ok((select avg_pace_s_per_km from public.workout_logs where status = 'skipped') is null, 'sin división por cero en sesiones no realizadas');

select test_helpers.throws($$insert into public.hydration_logs (user_id, logged_at, beverage_type, volume_ml) values ('11111111-1111-4111-8111-111111111111', now(), 'water', 500)$$,
  'hidratación bloqueada en plan Free');
select test_helpers.throws($$insert into public.subscriptions (user_id, product_id, provider, status) select '11111111-1111-4111-8111-111111111111', id, 'manual', 'active' from public.subscription_products where code = 'premium'$$,
  'A no puede crearse una suscripción');
select test_helpers.throws($$select public.admin_grant_subscription('11111111-1111-4111-8111-111111111111', 'premium', 30)$$, 'A no puede usar funciones de admin');
select test_helpers.throws($$select public.admin_business_stats()$$, 'A no ve estadísticas del negocio');
select test_helpers.throws($$insert into public.training_plans (slug, target_distance, level) values ('hack', '5k', 'beginner')$$, 'A no puede crear planes');
select test_helpers.ok((select count(*) from public.payment_events) = 0 and (select count(*) from public.audit_logs) = 0, 'A no ve eventos de pago ni auditoría');
insert into public.incident_reports (user_id, kind, description) values ('11111111-1111-4111-8111-111111111111', 'bug', 'No carga el calendario en mi teléfono');

select id as a_entry from public.user_training_calendar order by scheduled_date offset 1 limit 1 \gset

-- ---------- Usuario B ----------
select test_helpers.login('22222222-2222-4222-8222-222222222222');
select test_helpers.ok((select count(*) from public.workout_logs) = 0, 'B no ve los entrenamientos de A');
select test_helpers.ok((select count(*) from public.user_training_calendar) = 0, 'B no ve el calendario de A');
select test_helpers.ok((select count(*) from public.training_health_info) = 0, 'B no ve datos de salud de A');
select test_helpers.ok((select count(*) from public.training_profiles) = 0, 'B no ve el perfil deportivo de A');
select test_helpers.ok((select count(*) from public.incident_reports) = 0, 'B no ve incidencias de A');
select test_helpers.throws(format($f$insert into public.workout_logs (user_id, started_at, distance_m, duration_s, status, calendar_entry_id)
  values ('22222222-2222-4222-8222-222222222222', now(), 1000, 300, 'completed', %L)$f$, :'a_entry'),
  'B no puede vincular un registro al calendario de A');
select test_helpers.throws($$insert into public.workout_logs (user_id, started_at, distance_m, duration_s, status) values ('11111111-1111-4111-8111-111111111111', now(), 1000, 300, 'completed')$$,
  'B no puede registrar entrenamientos a nombre de A');
update public.workout_logs set distance_m = 1 where user_id = '11111111-1111-4111-8111-111111111111';
delete from public.workout_logs where user_id = '11111111-1111-4111-8111-111111111111';

-- ---------- Admin ----------
select test_helpers.login('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
select test_helpers.ok(public.is_admin(), 'admin reconocido');
select test_helpers.ok((select count(*) from public.profiles) = 4, 'admin ve todos los perfiles');
select test_helpers.ok((select count(*) from public.training_health_info) = 0, 'admin NO ve datos de salud');
select test_helpers.ok((select count(*) from public.workout_logs) = 0, 'admin NO ve entrenamientos individuales');
select test_helpers.ok((public.admin_business_stats() ->> 'users_total')::int = 4, 'estadísticas agregadas para admin');
select public.admin_grant_subscription('11111111-1111-4111-8111-111111111111', 'premium', 30);
select public.admin_set_role('22222222-2222-4222-8222-222222222222', 'coach', true);
select test_helpers.throws($$select public.admin_set_role('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'admin', false)$$, 'admin no puede quitarse su propio rol');
select test_helpers.ok((select count(*) from public.audit_logs where action in ('grant_subscription', 'insert')) >= 2, 'acciones administrativas auditadas');

select test_helpers.throws($$update public.training_plan_versions set name = 'cambio' where status = 'published'$$, 'una versión publicada es inmutable');
select test_helpers.throws($$update public.training_sessions set title = 'cambio' where true$$, 'las sesiones publicadas son inmutables');
select test_helpers.throws($$delete from public.training_plan_versions where status = 'published'$$, 'no se borran versiones publicadas');

-- Plan real (no demo): no se publica sin validación profesional.
insert into public.training_plans (id, slug, target_distance, level, is_demo)
values ('99999999-9999-4999-8999-999999999999', 'real-5k-beginner', '5k', 'beginner', false);
insert into public.training_plan_versions (id, plan_id, version, name, duration_weeks, sessions_per_week, objective)
values ('98989898-9898-4898-8898-989898989898', '99999999-9999-4999-8999-999999999999', 1, 'Plan real de prueba', 8, 3, 'x');
select test_helpers.throws($$update public.training_plan_versions set status = 'published' where id = '98989898-9898-4898-8898-989898989898'$$, 'no se salta de borrador a publicado');
update public.training_plan_versions set status = 'in_review' where id = '98989898-9898-4898-8898-989898989898';
update public.training_plan_versions set status = 'approved' where id = '98989898-9898-4898-8898-989898989898';
select test_helpers.throws($$update public.training_plan_versions set status = 'published' where id = '98989898-9898-4898-8898-989898989898'$$, 'sin validación profesional no se publica');
select test_helpers.throws($$insert into public.training_plan_weeks (plan_version_id, week_number) values ('98989898-9898-4898-8898-989898989898', 1)$$, 'no se editan semanas fuera de borrador');

-- ---------- Coach ----------
select test_helpers.login('cccccccc-cccc-4ccc-8ccc-cccccccccccc');
update public.training_plan_versions set status = 'draft' where id = '98989898-9898-4898-8898-989898989898';
update public.training_plan_versions set status = 'in_review' where id = '98989898-9898-4898-8898-989898989898';
update public.training_plan_versions set status = 'approved', validation_status = 'validated' where id = '98989898-9898-4898-8898-989898989898';
select test_helpers.ok((select approved_at is not null and validated_by = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' from public.training_plan_versions where id = '98989898-9898-4898-8898-989898989898'),
  'el entrenador valida y queda registrado');
select test_helpers.throws($$update public.training_plan_versions set status = 'published' where id = '98989898-9898-4898-8898-989898989898'$$, 'el entrenador no puede publicar');

select test_helpers.login('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
select test_helpers.throws($$update public.training_plan_versions set status = 'published' where id = '98989898-9898-4898-8898-989898989898'$$,
  'no se publica si faltan semanas/sesiones cargadas');

-- ---------- A con Premium ----------
select test_helpers.login('11111111-1111-4111-8111-111111111111');
select test_helpers.ok(public.has_feature('hydration'), 'A tiene hidratación con Premium');
insert into public.hydration_logs (user_id, logged_at, beverage_type, volume_ml) values ('11111111-1111-4111-8111-111111111111', now(), 'water', 500);
insert into public.competitions (id, user_id, name, distance_m, race_date, target_time_s)
values ('77777777-7777-4777-8777-777777777777', '11111111-1111-4111-8111-111111111111', 'Carrera de prueba', 10000, date '2026-11-15', 3300);
insert into public.competition_results (competition_id, user_id, finish_time_s) values ('77777777-7777-4777-8777-777777777777', '11111111-1111-4111-8111-111111111111', 3250);
select test_helpers.ok((select status from public.competitions) = 'completed', 'registrar resultado completa la competencia');
select test_helpers.ok((select finish_time_s from public.personal_bests where distance_m = 10000) = 3250, 'marca personal derivada de resultados reales');
select test_helpers.ok((select count(*) from public.subscription_events) >= 1, 'A ve el historial de su suscripción');

-- ---------- Anónimo ----------
reset role;
set role anon;
select set_config('request.jwt.claims', '', false);
select test_helpers.ok((select count(*) from public.subscription_prices) = 1, 'anónimo ve precios activos');
select test_helpers.throws($$select count(*) from public.profiles$$, 'anónimo no accede a perfiles');
select test_helpers.throws($$select count(*) from public.workout_logs$$, 'anónimo no accede a entrenamientos');
reset role;
\echo 'TODAS LAS PRUEBAS DE SEGURIDAD PASARON'
