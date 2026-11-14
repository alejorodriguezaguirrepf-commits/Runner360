-- Administración: qué impide borrar a una persona, borrar suscripciones inactivas y débitos anónimos.
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
grant execute on all functions in schema pg_temp to anon, authenticated, service_role;

insert into auth.users (id, email, email_confirmed_at) values
  ('a1600000-0000-4000-8000-0000000000a6', 'del-admin@test.local', now()),
  ('b1600000-0000-4000-8000-0000000000b6', 'del-activa@test.local', now()),
  ('c1600000-0000-4000-8000-0000000000c6', 'del-vencida@test.local', now()),
  ('d1600000-0000-4000-8000-0000000000d6', 'del-pendiente@test.local', now()),
  ('e1600000-0000-4000-8000-0000000000e6', 'del-otro-admin@test.local', now());
update public.profiles set role = 'admin' where id in ('a1600000-0000-4000-8000-0000000000a6', 'e1600000-0000-4000-8000-0000000000e6');

-- Activa (mensual de Mercado Pago), cancelada y terminada, y pendiente reciente.
insert into public.subscriptions (id, user_id, product_id, provider, provider_subscription_id, status, current_period_start, current_period_end, created_at) values
  ('51600000-0000-4000-8000-000000000051', 'b1600000-0000-4000-8000-0000000000b6', '00000000-0000-4000-8000-000000000002', 'mercadopago', 'pre-del-1', 'active', now() - interval '5 days', now() + interval '25 days', now() - interval '5 days'),
  ('52600000-0000-4000-8000-000000000052', 'c1600000-0000-4000-8000-0000000000c6', '00000000-0000-4000-8000-000000000003', 'mercadopago', 'pre-del-2', 'cancelled', now() - interval '400 days', now() - interval '35 days', now() - interval '400 days'),
  ('53600000-0000-4000-8000-000000000053', 'd1600000-0000-4000-8000-0000000000d6', '00000000-0000-4000-8000-000000000002', 'mercadopago', 'pre-del-3', 'pending', null, null, now() - interval '1 hour'),
  ('54600000-0000-4000-8000-000000000054', 'd1600000-0000-4000-8000-0000000000d6', '00000000-0000-4000-8000-000000000002', 'mercadopago', null, 'pending', null, null, now() - interval '5 days');
insert into public.subscription_payments (user_id, subscription_id, provider, provider_payment_id, status, amount_minor, currency, paid_at) values
  ('c1600000-0000-4000-8000-0000000000c6', '52600000-0000-4000-8000-000000000052', 'mercadopago', 'del-p1', 'approved', 4000000, 'ARS', now() - interval '400 days');
select pg_temp.check((select billing_interval from public.subscription_payments where provider_payment_id = 'del-p1') = 'year', 'el débito guarda el período (anual)');

-- Usuario común: no puede usar las funciones.
set role authenticated;
set request.jwt.claim.sub = 'c1600000-0000-4000-8000-0000000000c6';
select pg_temp.expect_error($$select public.admin_user_deletion_block('b1600000-0000-4000-8000-0000000000b6')$$, 'usuario: no consulta');
select pg_temp.expect_error($$select public.admin_delete_subscription('52600000-0000-4000-8000-000000000052')$$, 'usuario: no borra');
reset role;

set role authenticated;
set request.jwt.claim.sub = 'a1600000-0000-4000-8000-0000000000a6';
select pg_temp.check(public.admin_user_deletion_block('a1600000-0000-4000-8000-0000000000a6') = 'self', 'no a sí mismo');
select pg_temp.check(public.admin_user_deletion_block('e1600000-0000-4000-8000-0000000000e6') = 'admin', 'no a otro admin');
select pg_temp.check(public.admin_user_deletion_block('b1600000-0000-4000-8000-0000000000b6') = 'premium', 'no con suscripción vigente');
select pg_temp.check(public.admin_user_deletion_block('c1600000-0000-4000-8000-0000000000c6') is null, 'cancelada y terminada: se puede');
select pg_temp.check(public.admin_user_deletion_block('d1600000-0000-4000-8000-0000000000d6') = 'pending', 'pago pendiente reciente: todavía no');
select pg_temp.check(public.admin_delete_subscription('51600000-0000-4000-8000-000000000051') = 'active', 'activa: no se borra');
select pg_temp.check(public.admin_delete_subscription('53600000-0000-4000-8000-000000000053') = 'active', 'pendiente reciente: no se borra');
select pg_temp.check(public.admin_delete_subscription('54600000-0000-4000-8000-000000000054') = 'deleted', 'pendiente vieja: se borra');
select pg_temp.check(public.admin_delete_subscription('52600000-0000-4000-8000-000000000052') = 'deleted', 'cancelada y terminada: se borra');
reset role;
select pg_temp.check(not exists (select 1 from public.subscriptions where id in ('52600000-0000-4000-8000-000000000052', '54600000-0000-4000-8000-000000000054')), 'borradas');
select pg_temp.check((select subscription_id is null and billing_interval = 'year' from public.subscription_payments where provider_payment_id = 'del-p1'), 'el débito queda, con su período');
select pg_temp.check((select count(*) from public.audit_logs where action = 'subscription.deleted') = 2, 'queda en la auditoría');

-- Borrar a la persona: sus datos se van y el débito queda sin datos personales.
delete from auth.users where id = 'c1600000-0000-4000-8000-0000000000c6';
select pg_temp.check(not exists (select 1 from public.profiles where id = 'c1600000-0000-4000-8000-0000000000c6'), 'perfil borrado');
select pg_temp.check((select user_id is null and amount_minor = 4000000 from public.subscription_payments where provider_payment_id = 'del-p1'), 'débito anónimo conservado');

rollback;
