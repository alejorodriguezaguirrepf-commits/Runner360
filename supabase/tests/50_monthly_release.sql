-- Liberación mensual: cada débito aprobado libera 4 semanas del plan en curso.
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
grant execute on all functions in schema pg_temp to anon, authenticated;

insert into auth.users (id, email) values
  ('c3c3c3c3-0000-4000-8000-0000000000c3', 'mr-sub@test.local'),
  ('d4d4d4d4-0000-4000-8000-0000000000d4', 'mr-free@test.local');

-- Suscripción mensual de Mercado Pago al día; plan de 6 meses (24 semanas) empezado hace 5 semanas.
insert into public.subscriptions (id, user_id, product_id, provider, provider_subscription_id, status, current_period_start, current_period_end)
values ('5b5b5b5b-0000-4000-8000-00000000005b', 'c3c3c3c3-0000-4000-8000-0000000000c3', '00000000-0000-4000-8000-000000000002',
        'mercadopago', 'pre-1', 'active', now() - interval '5 days', now() + interval '25 days');
insert into public.plan_enrollments (id, user_id, content_version, plan_id, start_date, race_date, created_at)
values ('e3e3e3e3-0000-4000-8000-0000000000e3', 'c3c3c3c3-0000-4000-8000-0000000000c3', '2026.10.1', 'plan-10',
        date_trunc('week', current_date)::date - 35, date_trunc('week', current_date)::date - 35 + 23 * 7 + 6, now() - interval '36 days');
insert into public.plan_enrollments (id, user_id, content_version, plan_id, start_date, race_date)
values ('e4e4e4e4-0000-4000-8000-0000000000e4', 'd4d4d4d4-0000-4000-8000-0000000000d4', '2026.10.1', 'plan-10',
        date_trunc('week', current_date)::date + 7, date_trunc('week', current_date)::date + 7 + 23 * 7 + 6);

set role authenticated;
set request.jwt.claim.sub = 'c3c3c3c3-0000-4000-8000-0000000000c3';
-- Sin débitos informados pero al día: el mes en curso del plan (semana 6 → mes 2 → 8 semanas).
select pg_temp.check(public.enrollment_open_weeks('e3e3e3e3-0000-4000-8000-0000000000e3') = 8, 'al día: hasta el mes en curso');
select pg_temp.check((select max(week) from public.library_days where plan_id = 'plan-10') = 8, 've hasta la semana 8');
select pg_temp.check((select count(*) from public.library_days where plan_id = 'plan-11') = 7, 'otro plan: solo la muestra');
select pg_temp.check((select count(*) from public.subscription_payments) = 0, 'sin débitos');
-- Nadie puede cargarse débitos a mano.
select pg_temp.expect_error($$insert into public.subscription_payments (user_id, provider, provider_payment_id, status, paid_at)
  values ('c3c3c3c3-0000-4000-8000-0000000000c3', 'mercadopago', 'x', 'approved', now())$$, 'cargar un débito propio');
reset role;

-- Tres débitos aprobados (uno anterior a la inscripción, el vigente) y uno rechazado: 3 meses = 12 semanas.
insert into public.subscription_payments (user_id, subscription_id, provider, provider_payment_id, status, amount_minor, currency, paid_at) values
  ('c3c3c3c3-0000-4000-8000-0000000000c3', '5b5b5b5b-0000-4000-8000-00000000005b', 'mercadopago', 'p1', 'approved', 500000, 'ARS', now() - interval '40 days'),
  ('c3c3c3c3-0000-4000-8000-0000000000c3', '5b5b5b5b-0000-4000-8000-00000000005b', 'mercadopago', 'p2', 'approved', 500000, 'ARS', now() - interval '10 days'),
  ('c3c3c3c3-0000-4000-8000-0000000000c3', '5b5b5b5b-0000-4000-8000-00000000005b', 'mercadopago', 'p3', 'rejected', 500000, 'ARS', now() - interval '6 days'),
  ('c3c3c3c3-0000-4000-8000-0000000000c3', '5b5b5b5b-0000-4000-8000-00000000005b', 'mercadopago', 'p4', 'approved', 500000, 'ARS', now() - interval '5 days'),
  ('c3c3c3c3-0000-4000-8000-0000000000c3', '5b5b5b5b-0000-4000-8000-00000000005b', 'mercadopago', 'p0', 'approved', 500000, 'ARS', now() - interval '90 days');
set role authenticated;
set request.jwt.claim.sub = 'c3c3c3c3-0000-4000-8000-0000000000c3';
select pg_temp.check(public.enrollment_open_weeks('e3e3e3e3-0000-4000-8000-0000000000e3') = 12, '3 débitos aprobados = 12 semanas');
select pg_temp.check((select count(*) from public.library_days where plan_id = 'plan-10') = 12 * 7, 've 12 semanas');
select pg_temp.check((select count(*) from public.subscription_payments) = 5, 've sus débitos');
reset role;

-- Si la suscripción vence, lo pagado queda liberado.
update public.subscriptions set status = 'cancelled', current_period_end = now() - interval '1 day' where id = '5b5b5b5b-0000-4000-8000-00000000005b';
set role authenticated;
set request.jwt.claim.sub = 'c3c3c3c3-0000-4000-8000-0000000000c3';
select pg_temp.check(public.enrollment_open_weeks('e3e3e3e3-0000-4000-8000-0000000000e3') = 12, 'lo pagado queda liberado');

-- Plan gratis: solo la muestra; no ve débitos ni semanas liberadas de otros.
set request.jwt.claim.sub = 'd4d4d4d4-0000-4000-8000-0000000000d4';
select pg_temp.check(public.enrollment_open_weeks('e4e4e4e4-0000-4000-8000-0000000000e4') = 1, 'plan gratis: la semana de muestra');
select pg_temp.check((select count(*) from public.library_days where plan_id = 'plan-10') = 7, 'gratis ve la semana 1');
select pg_temp.check(public.enrollment_open_weeks('e3e3e3e3-0000-4000-8000-0000000000e3') is null, 'no consulta inscripciones ajenas');
select pg_temp.check((select count(*) from public.subscription_payments) = 0, 'no ve débitos ajenos');
reset role;

rollback;
