-- Pruebas de seguridad (RLS) e integridad. Se ejecutan con scripts/db-test.sh.
-- Cada bloque falla con una excepción si una expectativa no se cumple. Todo se revierte al final.
begin;

create function pg_temp.expect_error(p_sql text, p_label text) returns void language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    return;
  end;
  raise exception 'Se esperaba un error y no ocurrió: %', p_label;
end;
$$;

create function pg_temp.expect_eq(p_actual bigint, p_expected bigint, p_label text) returns void language plpgsql as $$
begin
  if p_actual is distinct from p_expected then
    raise exception 'FALLÓ %: esperado %, obtenido %', p_label, p_expected, p_actual;
  end if;
end;
$$;
grant execute on all functions in schema pg_temp to authenticated, anon;

-- Usuarios de prueba
insert into auth.users (id, email, raw_user_meta_data) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'a@test.local', '{"display_name":"Ana"}'),
  ('bbbbbbbb-0000-4000-8000-000000000002', 'b@test.local', '{"display_name":"Beto"}'),
  ('cccccccc-0000-4000-8000-000000000003', 'admin@test.local', '{}');
update public.profiles set role = 'admin' where id = 'cccccccc-0000-4000-8000-000000000003';

select pg_temp.expect_eq((select count(*) from public.profiles where display_name = 'Ana'), 1, 'perfil creado por trigger');

-- Ids de referencia
create temp table ref as
select
  (select v.id from public.training_plan_versions v join public.training_plans p on p.id = v.plan_id
    where p.slug = 'demo-5k-beginner') as free_version,
  (select v.id from public.training_plan_versions v join public.training_plans p on p.id = v.plan_id
    where p.slug = 'demo-10k-beginner') as premium_version;
grant select on ref to authenticated, anon;

-- ============================ Usuario A ============================
set role authenticated;
set request.jwt.claim.sub = 'aaaaaaaa-0000-4000-8000-000000000001';

select pg_temp.expect_eq((select count(*) from public.profiles), 1, 'A solo ve su perfil');
select pg_temp.expect_error($$update public.profiles set role = 'admin' where id = 'aaaaaaaa-0000-4000-8000-000000000001'$$, 'A no puede elevar su rol');
select pg_temp.expect_error($$update public.profiles set can_validate_plans = true where id = 'aaaaaaaa-0000-4000-8000-000000000001'$$, 'A no puede otorgarse validación');
update public.profiles set display_name = 'Ana R.' where id = 'aaaaaaaa-0000-4000-8000-000000000001';

insert into public.training_profiles (user_id, target_distance, level, experience, weekly_km, available_weekdays, goal)
values ('aaaaaaaa-0000-4000-8000-000000000001', '5K', 'beginner', 'none', 0, '{2,4,6}', 'complete');
select pg_temp.expect_error($$insert into public.training_profiles (user_id, target_distance, level, experience, weekly_km, available_weekdays, goal)
  values ('bbbbbbbb-0000-4000-8000-000000000002', '5K', 'beginner', 'none', 0, '{2,4,6}', 'complete')$$, 'A no crea perfiles ajenos');

-- Datos de salud: requieren consentimiento
select pg_temp.expect_error($$insert into public.health_screenings (user_id, flags) values ('aaaaaaaa-0000-4000-8000-000000000001', '{recent_injury}')$$, 'salud sin consentimiento');
insert into public.user_consents (user_id, consent_type, document_version, granted) values ('aaaaaaaa-0000-4000-8000-000000000001', 'health_data', '2026-10', true);
insert into public.health_screenings (user_id, flags) values ('aaaaaaaa-0000-4000-8000-000000000001', '{recent_injury}');

-- Catálogo y contenido
select pg_temp.expect_eq((select count(*) from public.training_plans), 15, 'A ve el catálogo de 15 planes');
select pg_temp.expect_eq((select count(*) from public.training_sessions where version_id = (select free_version from ref)), 24, 'A ve sesiones del plan gratuito');
select pg_temp.expect_eq((select count(*) from public.training_sessions where version_id = (select premium_version from ref)), 0, 'A no ve sesiones Premium');
select pg_temp.expect_eq((select count(*) from public.payment_events), 0, 'A no ve eventos de pago');
select pg_temp.expect_error($$insert into public.subscriptions (user_id, product_id, provider, status) values ('aaaaaaaa-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', 'manual', 'active')$$, 'A no se autoasigna Premium');

-- Inscripción en plan gratuito y calendario
insert into public.user_training_plans (id, user_id, plan_version_id, variant_id, start_date, start_week)
select 'a0000000-0000-4000-8000-0000000000a1', 'aaaaaaaa-0000-4000-8000-000000000001', r.free_version, sv.id, date '2026-10-05', 1
from ref r join public.training_plan_schedule_variants sv on sv.version_id = r.free_version and sv.code = 'v3-a';

insert into public.user_training_calendar (id, user_plan_id, user_id, session_id, week_number, session_number, scheduled_date)
select 'a0000000-0000-4000-8000-0000000000c1', 'a0000000-0000-4000-8000-0000000000a1', 'aaaaaaaa-0000-4000-8000-000000000001', s.id, 1, 1, date '2026-10-06'
from public.training_sessions s, ref r where s.version_id = r.free_version and s.week_number = 1 and s.session_number = 1;

select pg_temp.expect_error($$insert into public.user_training_plans (user_id, plan_version_id, variant_id, start_date, start_week)
  select 'aaaaaaaa-0000-4000-8000-000000000001', r.premium_version, sv.id, date '2026-10-05', 1
  from ref r join public.training_plan_schedule_variants sv on sv.version_id = r.free_version limit 1$$, 'A no se inscribe en Premium sin suscripción');
select pg_temp.expect_error($$insert into public.user_training_plans (user_id, plan_version_id, variant_id, start_date, start_week)
  select 'aaaaaaaa-0000-4000-8000-000000000001', r.free_version, sv.id, date '2026-10-05', 1
  from ref r join public.training_plan_schedule_variants sv on sv.version_id = r.free_version limit 1$$, 'una sola inscripción activa');
select pg_temp.expect_error($$update public.user_training_calendar set scheduled_date = date '2026-10-07' where id = 'a0000000-0000-4000-8000-0000000000c1'$$, 'A no mueve fechas del calendario');

-- Registro de entrenamiento sincroniza el calendario
insert into public.workout_logs (id, user_id, calendar_entry_id, workout_date, status, distance_m, duration_s, rpe)
values ('a0000000-0000-4000-8000-0000000000e1', 'aaaaaaaa-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-0000000000c1', date '2026-10-06', 'completed', 5000, 1800, 4);
select pg_temp.expect_eq((select count(*) from public.user_training_calendar where id = 'a0000000-0000-4000-8000-0000000000c1' and status = 'completed'), 1, 'calendario marcado como completado');
select pg_temp.expect_eq((select (avg_pace_s_per_km * 100)::bigint from public.workout_logs where id = 'a0000000-0000-4000-8000-0000000000e1'), 36000, 'ritmo medio 6:00 calculado');
select pg_temp.expect_error($$insert into public.workout_logs (user_id, workout_date, status, distance_m) values ('aaaaaaaa-0000-4000-8000-000000000001', date '2026-10-06', 'completed', 5000)$$, 'registro completado sin duración');
select pg_temp.expect_error($$insert into public.workout_logs (user_id, workout_date, status, distance_m, duration_s, avg_hr, max_hr) values ('aaaaaaaa-0000-4000-8000-000000000001', date '2026-10-06', 'completed', 5000, 1500, 170, 150)$$, 'FC media mayor que máxima');

insert into public.incident_reports (user_id, category, message) values ('aaaaaaaa-0000-4000-8000-000000000001', 'bug', 'No carga el calendario');

-- ============================ Usuario B ============================
set request.jwt.claim.sub = 'bbbbbbbb-0000-4000-8000-000000000002';
select pg_temp.expect_eq((select count(*) from public.workout_logs), 0, 'B no ve entrenamientos de A');
select pg_temp.expect_eq((select count(*) from public.training_profiles), 0, 'B no ve perfiles deportivos de A');
select pg_temp.expect_eq((select count(*) from public.health_screenings), 0, 'B no ve datos de salud de A');
select pg_temp.expect_eq((select count(*) from public.incident_reports), 0, 'B no ve incidencias de A');
select pg_temp.expect_eq((select count(*) from public.audit_logs), 0, 'B no ve auditoría');
with u as (update public.user_training_calendar set status = 'skipped' where id = 'a0000000-0000-4000-8000-0000000000c1' returning 1)
select pg_temp.expect_eq((select count(*) from u), 0, 'B no modifica el calendario de A');
select pg_temp.expect_error($$insert into public.workout_logs (user_id, calendar_entry_id, workout_date, status, distance_m, duration_s)
  values ('bbbbbbbb-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-0000000000c1', date '2026-10-06', 'completed', 1000, 300)$$, 'B no vincula registros al calendario de A');
select pg_temp.expect_error($$insert into public.workout_logs (user_id, workout_date, status, duration_s) values ('aaaaaaaa-0000-4000-8000-000000000001', date '2026-10-06', 'completed', 100)$$, 'B no escribe registros a nombre de A');

-- ============================ Anónimo ============================
reset request.jwt.claim.sub;
set role anon;
select pg_temp.expect_eq((select count(*) from public.subscription_products), 3, 'anónimo ve productos activos');
select pg_temp.expect_eq((select count(*) from public.product_prices), 1, 'anónimo ve precios activos');
select pg_temp.expect_eq((select count(*) from public.educational_contents), 3, 'anónimo ve contenido gratuito publicado');
select pg_temp.expect_eq((select count(*) from public.training_sessions), 0, 'anónimo no ve sesiones');

-- ============================ Administrador ============================
set role authenticated;
set request.jwt.claim.sub = 'cccccccc-0000-4000-8000-000000000003';
select pg_temp.expect_eq((select count(*) from public.health_screenings), 0, 'el admin tampoco ve datos de salud');
select pg_temp.expect_eq((select count(*) from public.incident_reports), 1, 'admin ve incidencias');
select pg_temp.expect_error($$update public.training_sessions set title = 'x' where version_id = (select free_version from ref)$$, 'sesiones publicadas inmutables');
select pg_temp.expect_error($$update public.training_plan_versions set duration_weeks = 9 where id = (select free_version from ref)$$, 'versión publicada inmutable');
select pg_temp.expect_error($$update public.profiles set role = 'user' where id = 'cccccccc-0000-4000-8000-000000000003'$$, 'admin no se quita su propio rol');

-- Premium manual para B
insert into public.subscriptions (user_id, product_id, provider, status, started_at, current_period_start, current_period_end)
values ('bbbbbbbb-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000002', 'manual', 'active', now(), now(), now() + interval '30 days');
select pg_temp.expect_eq((select count(*) from public.subscription_events where user_id = 'bbbbbbbb-0000-4000-8000-000000000002'), 1, 'evento de suscripción registrado');

-- Nueva versión (clon), edición, validación y publicación
create temp table cloned as select public.clone_plan_version((select free_version from ref), 'Ajuste de prueba') as id;
select pg_temp.expect_eq((select count(*) from public.training_sessions where version_id = (select id from cloned)), 24, 'clon copia sesiones');
select pg_temp.expect_eq((select count(*) from public.training_session_exercises e join public.training_sessions s on s.id = e.session_id where s.version_id = (select id from cloned)), 0, 'clon sin ejercicios (plan sin fuerza)');
update public.training_sessions set title = 'Rodaje fácil (v2)' where version_id = (select id from cloned) and week_number = 1 and session_number = 1;
update public.training_plan_versions set is_demo = false where id = (select id from cloned);
update public.training_plan_versions set status = 'in_review' where id = (select id from cloned);
select pg_temp.expect_error($$select public.publish_plan_version((select id from cloned))$$, 'no publica sin validación profesional');
select pg_temp.expect_error($$select public.sign_off_plan_version((select id from cloned), 'ok')$$, 'admin sin permiso de validación no firma');
update public.profiles set can_validate_plans = true where id = 'cccccccc-0000-4000-8000-000000000003';
select public.sign_off_plan_version((select id from cloned), 'Revisado');
select public.publish_plan_version((select id from cloned));
select pg_temp.expect_eq((select count(*) from public.training_plan_versions where id = (select free_version from ref) and status = 'archived'), 1, 'versión anterior archivada');
select pg_temp.expect_eq((select count(*) from public.audit_logs where actor_id = 'cccccccc-0000-4000-8000-000000000003' and action in ('plan_version.published', 'plan_version.signed_off', 'profile.privileges_changed')), 3, 'acciones auditadas');
select pg_temp.expect_eq(((public.admin_business_stats() ->> 'users_total')::bigint), 3, 'estadísticas agregadas');

-- ============================ Historial preservado ============================
set request.jwt.claim.sub = 'aaaaaaaa-0000-4000-8000-000000000001';
select pg_temp.expect_eq((select count(*) from public.training_sessions where version_id = (select free_version from ref)), 24, 'A conserva acceso a su versión archivada');
select pg_temp.expect_eq((select count(*) from public.training_sessions where version_id = (select free_version from ref) and title = 'Rodaje fácil (v2)'), 0, 'la versión de A no cambió');
select pg_temp.expect_error($$select public.admin_business_stats()$$, 'usuario no accede a estadísticas');
select pg_temp.expect_error($$select public.clone_plan_version((select free_version from ref))$$, 'usuario no clona planes');

set request.jwt.claim.sub = 'bbbbbbbb-0000-4000-8000-000000000002';
select pg_temp.expect_eq((select count(*) from public.training_sessions where version_id = (select premium_version from ref)), 30, 'B Premium ve sesiones Premium');

reset role;
rollback;
