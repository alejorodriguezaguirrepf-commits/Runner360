-- Panel de suscripciones: quién compró, quién la tiene asignada a mano y sus débitos. Solo admin.
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

insert into auth.users (id, email, email_confirmed_at) values
  ('a8000000-0000-4000-8000-0000000000a8', 'pago@test.local', now()),
  ('b8000000-0000-4000-8000-0000000000b8', 'regalo@test.local', now()),
  ('e8000000-0000-4000-8000-0000000000e8', 'gratis@test.local', now()),
  ('c8000000-0000-4000-8000-0000000000c8', 'admin-subs@test.local', now());
update public.profiles set role = 'admin' where id = 'c8000000-0000-4000-8000-0000000000c8';

-- Compró por Mercado Pago: una suscripción vieja vencida y la actual activa, con dos débitos
-- aprobados y uno rechazado.
insert into public.subscriptions (id, user_id, product_id, provider, provider_subscription_id, status, created_at)
values ('d8000000-0000-4000-8000-0000000000d1', 'a8000000-0000-4000-8000-0000000000a8', '00000000-0000-4000-8000-000000000002',
        'mercadopago', 'pre-vieja', 'expired', now() - interval '200 days');
insert into public.subscriptions (id, user_id, product_id, provider, provider_subscription_id, status, started_at, current_period_start, current_period_end, created_at)
values ('d8000000-0000-4000-8000-0000000000d2', 'a8000000-0000-4000-8000-0000000000a8', '00000000-0000-4000-8000-000000000002',
        'mercadopago', 'pre-actual', 'active', now() - interval '40 days', now() - interval '10 days', now() + interval '20 days', now() - interval '40 days');
insert into public.subscription_payments (user_id, subscription_id, provider, provider_payment_id, status, amount_minor, currency, paid_at, failure_code) values
  ('a8000000-0000-4000-8000-0000000000a8', 'd8000000-0000-4000-8000-0000000000d2', 'mercadopago', 'sub-1', 'approved', 2000000, 'ARS', now() - interval '40 days', null),
  ('a8000000-0000-4000-8000-0000000000a8', 'd8000000-0000-4000-8000-0000000000d2', 'mercadopago', 'sub-2', 'rejected', 2100000, 'ARS', now() - interval '11 days', 'cc_rejected_insufficient_amount'),
  ('a8000000-0000-4000-8000-0000000000a8', 'd8000000-0000-4000-8000-0000000000d2', 'mercadopago', 'sub-3', 'approved', 2100000, 'ARS', now() - interval '10 days', null);
-- Premium asignado a mano, sin débitos.
insert into public.subscriptions (user_id, product_id, provider, status, started_at, current_period_start, current_period_end)
values ('b8000000-0000-4000-8000-0000000000b8', '00000000-0000-4000-8000-000000000002', 'manual', 'active', now(), now(), now() + interval '30 days');

set role authenticated;

-- Usuario común: no puede ver ninguna de las dos consultas.
set request.jwt.claim.sub = 'a8000000-0000-4000-8000-0000000000a8';
select pg_temp.expect_error($$select * from public.admin_subscribers()$$, 'usuario: sin listado de suscripciones');
select pg_temp.expect_error($$select * from public.admin_debits()$$, 'usuario: sin listado de débitos');

-- Admin: una fila por usuario con suscripción (la más reciente) y el resumen de débitos aprobados.
set request.jwt.claim.sub = 'c8000000-0000-4000-8000-0000000000c8';
select pg_temp.check((select count(*) from public.admin_subscribers() where email like '%@test.local') = 2, 'admin: dos usuarios con suscripción (el gratis no aparece)');
select pg_temp.check((select count(*) from public.admin_subscribers() where email = 'pago@test.local') = 1, 'una sola fila por usuario');
select pg_temp.check((select subscription_id = 'd8000000-0000-4000-8000-0000000000d2' and provider = 'mercadopago' and status = 'active'
                      and approved_count = 2 and total_paid_minor = 4100000 and paid_currency = 'ARS' and last_paid_minor = 2100000
                      and last_paid_at > now() - interval '11 days' and current_period_end > now()
                      from public.admin_subscribers() where email = 'pago@test.local'), 'compró: suscripción actual y débitos aprobados');
select pg_temp.check((select provider = 'manual' and approved_count = 0 and last_paid_at is null
                      from public.admin_subscribers() where email = 'regalo@test.local'), 'asignada a mano: sin débitos');
-- Débitos: todos los estados, del más nuevo al más viejo; filtrables por usuario.
select pg_temp.check((select count(*) from public.admin_debits('a8000000-0000-4000-8000-0000000000a8')) = 3, 'admin: los tres débitos del usuario');
select pg_temp.check((select array_agg(provider_payment_id order by paid_at desc) = array['sub-3', 'sub-2', 'sub-1']
                      from public.admin_debits('a8000000-0000-4000-8000-0000000000a8')), 'orden: del más nuevo al más viejo');
select pg_temp.check((select email = 'pago@test.local' and status = 'rejected' and failure_code = 'cc_rejected_insufficient_amount'
                      from public.admin_debits('a8000000-0000-4000-8000-0000000000a8') where provider_payment_id = 'sub-2'), 'débito rechazado con su motivo');
select pg_temp.check((select count(*) from public.admin_debits('b8000000-0000-4000-8000-0000000000b8')) = 0, 'asignada a mano: sin débitos');
select pg_temp.check((select total_count from public.admin_debits('a8000000-0000-4000-8000-0000000000a8', 1, 0) limit 1) = 3, 'paginado: total');

rollback;
