-- Plan anual (pago único por 12 meses): planes completos desde el inicio, renovación sin pagar,
-- vencimiento (vuelve la muestra gratis y se conserva lo hecho) y panel separado por intervalo.
begin;
create function pg_temp.check(p_ok boolean, p_label text) returns void language plpgsql as $$
begin
  if not coalesce(p_ok, false) then raise exception 'Falló: %', p_label; end if;
end; $$;
grant execute on all functions in schema pg_temp to anon, authenticated;

insert into auth.users (id, email) values
  ('a9a9a9a9-0000-4000-8000-0000000000a9', 'anual-activo@test.local'),
  ('b9b9b9b9-0000-4000-8000-0000000000b9', 'anual-vencido@test.local'),
  ('c9c9c9c9-0000-4000-8000-0000000000c9', 'anual-admin@test.local');
update public.profiles set role = 'admin' where id = 'c9c9c9c9-0000-4000-8000-0000000000c9';

-- Anual activo: compró hace 10 días; renovó antes de tiempo (la segunda compra empieza al vencer la primera).
insert into public.subscriptions (user_id, product_id, provider, provider_subscription_id, status, started_at, current_period_start, current_period_end, cancel_at_period_end)
values
  ('a9a9a9a9-0000-4000-8000-0000000000a9', '00000000-0000-4000-8000-000000000003', 'mercadopago', 'payment:a-1', 'active',
   now() - interval '10 days', now() - interval '10 days', now() - interval '10 days' + interval '12 months', true),
  ('a9a9a9a9-0000-4000-8000-0000000000a9', '00000000-0000-4000-8000-000000000003', 'mercadopago', 'payment:a-2', 'active',
   now(), now() - interval '10 days' + interval '12 months', now() - interval '10 days' + interval '24 months', true);
insert into public.subscription_payments (user_id, subscription_id, provider, provider_payment_id, status, amount_minor, currency, paid_at)
select user_id, id, 'mercadopago', provider_subscription_id, 'approved', 25000000, 'ARS', now() - interval '10 days'
from public.subscriptions where provider_subscription_id = 'payment:a-1';

-- Plan de 1 mes (plan-01, 4 semanas) terminado y renovado; plan de 3 meses (plan-13, 12 semanas) terminado y renovado.
-- (Una inscripción nueva empieza activa: se cierran una por una, como al terminar cada plan.)
insert into public.plan_enrollments (id, user_id, content_version, plan_id, start_date, race_date, created_at)
values ('a1000000-0000-4000-8000-0000000000a1', 'a9a9a9a9-0000-4000-8000-0000000000a9', '2026.11', 'plan-01',
        date_trunc('week', current_date)::date - 35, date_trunc('week', current_date)::date - 35 + 3 * 7 + 6, now() - interval '9 days');
update public.plan_enrollments set status = 'completed', ended_at = now() where id = 'a1000000-0000-4000-8000-0000000000a1';
insert into public.plan_enrollments (id, user_id, content_version, plan_id, start_date, race_date, created_at)
values ('a2000000-0000-4000-8000-0000000000a2', 'a9a9a9a9-0000-4000-8000-0000000000a9', '2026.11', 'plan-01',
        date_trunc('week', current_date)::date - 7, date_trunc('week', current_date)::date - 7 + 3 * 7 + 6, now() - interval '8 days');
update public.plan_enrollments set status = 'completed', ended_at = now() where id = 'a2000000-0000-4000-8000-0000000000a2';
insert into public.plan_enrollments (id, user_id, content_version, plan_id, start_date, race_date, created_at)
values ('a3000000-0000-4000-8000-0000000000a3', 'a9a9a9a9-0000-4000-8000-0000000000a9', '2026.11', 'plan-13',
        date_trunc('week', current_date)::date + 7, date_trunc('week', current_date)::date + 7 + 11 * 7 + 6, now());

-- Anual vencido: estuvo vigente hasta hace 35 días; el plan empezado con el anual se conserva.
insert into public.subscriptions (user_id, product_id, provider, provider_subscription_id, status, started_at, current_period_start, current_period_end, cancel_at_period_end)
values ('b9b9b9b9-0000-4000-8000-0000000000b9', '00000000-0000-4000-8000-000000000003', 'mercadopago', 'payment:b-1', 'active',
        now() - interval '400 days', now() - interval '400 days', now() - interval '35 days', true);
insert into public.plan_enrollments (id, user_id, content_version, plan_id, start_date, race_date, created_at)
values ('b1000000-0000-4000-8000-0000000000b1', 'b9b9b9b9-0000-4000-8000-0000000000b9', '2026.11', 'plan-13',
        date_trunc('week', current_date)::date - 84, date_trunc('week', current_date)::date - 84 + 11 * 7 + 6, now() - interval '90 days');
update public.plan_enrollments set status = 'completed', ended_at = now() where id = 'b1000000-0000-4000-8000-0000000000b1';
insert into public.plan_enrollments (id, user_id, content_version, plan_id, start_date, race_date, created_at)
values ('b2000000-0000-4000-8000-0000000000b2', 'b9b9b9b9-0000-4000-8000-0000000000b9', '2026.11', 'plan-16',
        date_trunc('week', current_date)::date + 7, date_trunc('week', current_date)::date + 7 + 11 * 7 + 6, now());

set role authenticated;

-- ANUAL ACTIVO ------------------------------------------------------------------------------
set request.jwt.claim.sub = 'a9a9a9a9-0000-4000-8000-0000000000a9';
select pg_temp.check(public.has_premium('a9a9a9a9-0000-4000-8000-0000000000a9'), 'anual activo: Premium');
select pg_temp.check(public.annual_access_until('a9a9a9a9-0000-4000-8000-0000000000a9') > now() + interval '23 months', 'anual: la renovación anticipada suma 12 meses');
-- Plan de 1 mes: completo, y su renovación también completa sin otro pago.
select pg_temp.check(public.enrollment_open_weeks('a1000000-0000-4000-8000-0000000000a1') = 4, '1 mes: completo');
select pg_temp.check(public.enrollment_open_weeks('a2000000-0000-4000-8000-0000000000a2') = 4, '1 mes renovado: completo sin pagar');
select pg_temp.check((select count(*) from public.subscription_payments) = 1, 'un solo pago');
-- Plan de 3 meses: las 12 semanas desde el inicio (aunque empiece la semana que viene).
select pg_temp.check(public.enrollment_open_weeks('a3000000-0000-4000-8000-0000000000a3') = 12, '3 meses: completo desde el inicio');
select pg_temp.check((select max(week) from public.library_days where content_version = '2026.11' and plan_id = 'plan-13') = 12, '3 meses: ve la semana 12');
select pg_temp.check((select max(week) from public.library_days where content_version = '2026.11' and plan_id = 'plan-01') = 4, '1 mes: ve las 4 semanas');
-- Otro plan al que no se inscribió: solo la muestra (lo genera al elegirlo).
select pg_temp.check((select max(week) from public.library_days where content_version = '2026.11' and plan_id = 'plan-07') = 1, 'plan no elegido: muestra');

-- ANUAL VENCIDO -----------------------------------------------------------------------------
set request.jwt.claim.sub = 'b9b9b9b9-0000-4000-8000-0000000000b9';
select pg_temp.check(not public.has_premium('b9b9b9b9-0000-4000-8000-0000000000b9'), 'vencido: sin Premium');
select pg_temp.check(public.annual_access_until('b9b9b9b9-0000-4000-8000-0000000000b9') is null, 'vencido: sin acceso anual');
-- Conserva el plan hecho con el anual (historial completo).
select pg_temp.check(public.enrollment_open_weeks('b1000000-0000-4000-8000-0000000000b1') = 12, 'vencido: conserva el plan hecho con el anual');
select pg_temp.check((select max(week) from public.library_days where content_version = '2026.11' and plan_id = 'plan-13') = 12, 'vencido: ve el historial');
-- Un plan nuevo después del vencimiento ya no se genera completo: muestra gratis.
select pg_temp.check(public.enrollment_open_weeks('b2000000-0000-4000-8000-0000000000b2') = 1, 'vencido: plan nuevo solo con la muestra');
select pg_temp.check((select max(week) from public.library_days where content_version = '2026.11' and plan_id = 'plan-16') = 1, 'vencido: plan nuevo bloqueado');
-- No puede consultar el acceso anual de otra persona.
select pg_temp.check(public.annual_access_until('a9a9a9a9-0000-4000-8000-0000000000a9') is null, 'no ve el anual de otra persona');

-- PANEL: anuales separados y sus ingresos ---------------------------------------------------
set request.jwt.claim.sub = 'c9c9c9c9-0000-4000-8000-0000000000c9';
select pg_temp.check((public.admin_dashboard() -> 'subs_by_interval' -> 'year' ->> 'active')::int >= 1, 'panel: anuales activos');
select pg_temp.check((public.admin_dashboard() -> 'subs_by_interval' -> 'year' ->> 'ended')::int >= 1, 'panel: anuales vencidos');
select pg_temp.check(exists (
  select 1 from jsonb_array_elements(public.admin_dashboard() -> 'revenue_by_interval') r
  where r ->> 'interval' = 'year' and r ->> 'currency' = 'ARS' and (r ->> 'amount_minor')::bigint >= 25000000), 'panel: ingresos anuales');
reset role;
rollback;
