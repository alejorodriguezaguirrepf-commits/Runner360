-- Notificaciones de pagos: gracia de un débito rechazado, avisos al admin y al usuario, push y
-- listado de pagos con problemas (permisos y deduplicación).
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
  ('a7000000-0000-4000-8000-0000000000a7', 'gracia@test.local', now()),
  ('b7000000-0000-4000-8000-0000000000b7', 'otro@test.local', now()),
  ('c7000000-0000-4000-8000-0000000000c7', 'admin-pagos@test.local', now());
update public.profiles set role = 'admin' where id = 'c7000000-0000-4000-8000-0000000000c7';

-- Suscripción mensual con un débito rechazado: past_due con 5 días de gracia.
insert into public.subscriptions (id, user_id, product_id, provider, provider_subscription_id, status, current_period_start, current_period_end, grace_until)
values ('d7000000-0000-4000-8000-0000000000d7', 'a7000000-0000-4000-8000-0000000000a7', '00000000-0000-4000-8000-000000000002',
        'mercadopago', 'pre-gracia', 'past_due', now() - interval '31 days', now() - interval '1 day', now() + interval '5 days');
insert into public.subscription_payments (user_id, subscription_id, provider, provider_payment_id, status, amount_minor, currency, paid_at, failure_code)
values ('a7000000-0000-4000-8000-0000000000a7', 'd7000000-0000-4000-8000-0000000000d7', 'mercadopago', 'ap-rechazado', 'rejected', 2000000, 'ARS', now() - interval '1 hour', 'cc_rejected_insufficient_amount');

select pg_temp.check(public.has_premium('a7000000-0000-4000-8000-0000000000a7'), 'en gracia: conserva el acceso');
update public.subscriptions set grace_until = now() - interval '1 minute' where id = 'd7000000-0000-4000-8000-0000000000d7';
select pg_temp.check(not public.has_premium('a7000000-0000-4000-8000-0000000000a7'), 'gracia vencida: sin acceso');
update public.subscriptions set grace_until = now() + interval '5 days' where id = 'd7000000-0000-4000-8000-0000000000d7';

-- Notificaciones y avisos (los escribe el servidor). La misma clave no se repite.
insert into public.admin_notifications (kind, user_id, subscription_id, title, body, dedupe_key)
values ('payment_failed', 'a7000000-0000-4000-8000-0000000000a7', 'd7000000-0000-4000-8000-0000000000d7', 'Débito rechazado', 'Fondos insuficientes', 'mercadopago:ap-rechazado:rejected');
select pg_temp.expect_error($$insert into public.admin_notifications (kind, title, body, dedupe_key) values ('payment_failed', 'x', 'x', 'mercadopago:ap-rechazado:rejected')$$, 'sin duplicados');
insert into public.user_notices (user_id, subscription_id, kind, message, action_url, dedupe_key)
values ('a7000000-0000-4000-8000-0000000000a7', 'd7000000-0000-4000-8000-0000000000d7', 'payment_failed', 'No pudimos cobrar tu suscripción', 'https://www.mercadopago.com.ar/subscriptions', 'failed:ap-rechazado');

set role authenticated;

-- Usuario: ve su aviso, puede marcarlo como visto, no puede cambiar el texto ni ver los del admin.
set request.jwt.claim.sub = 'a7000000-0000-4000-8000-0000000000a7';
select pg_temp.check((select count(*) from public.user_notices) = 1, 'usuario: ve su aviso');
select pg_temp.check((select count(*) from public.admin_notifications) = 0, 'usuario: no ve las notificaciones del admin');
update public.user_notices set seen_at = now() where dedupe_key = 'failed:ap-rechazado';
select pg_temp.expect_error($$update public.user_notices set message = 'otro' where dedupe_key = 'failed:ap-rechazado'$$, 'usuario: no cambia el texto');
select pg_temp.expect_error($$select * from public.admin_payment_problems()$$, 'usuario: sin listado de pagos con problemas');
-- Push: solo sus propios dispositivos.
insert into public.push_subscriptions (user_id, endpoint, p256dh, auth) values ('a7000000-0000-4000-8000-0000000000a7', 'https://push.example.com/a', 'k', 'a');
select pg_temp.expect_error($$insert into public.push_subscriptions (user_id, endpoint, p256dh, auth) values ('b7000000-0000-4000-8000-0000000000b7', 'https://push.example.com/b', 'k', 'a')$$, 'push de otra persona');

-- Otro usuario: no ve el aviso ajeno ni sus dispositivos.
set request.jwt.claim.sub = 'b7000000-0000-4000-8000-0000000000b7';
select pg_temp.check((select count(*) from public.user_notices) = 0, 'otro usuario: no ve avisos ajenos');
select pg_temp.check((select count(*) from public.push_subscriptions) = 0, 'otro usuario: no ve push ajenos');

-- Admin: ve y marca como leídas; no edita el contenido; listado de pagos con problemas.
set request.jwt.claim.sub = 'c7000000-0000-4000-8000-0000000000c7';
select pg_temp.check((select count(*) from public.admin_notifications where read_at is null) = 1, 'admin: una no leída');
update public.admin_notifications set read_at = now() where dedupe_key = 'mercadopago:ap-rechazado:rejected';
select pg_temp.check((select count(*) from public.admin_notifications where read_at is null) = 0, 'admin: marcada como leída');
select pg_temp.expect_error($$update public.admin_notifications set body = 'x'$$, 'admin: no edita el contenido');
select pg_temp.check((select failure_code from public.admin_payment_problems() where provider_payment_id = 'ap-rechazado') = 'cc_rejected_insufficient_amount', 'listado: motivo');
select pg_temp.check(not (select resolved from public.admin_payment_problems() where provider_payment_id = 'ap-rechazado'), 'listado: sin resolver');
update public.notification_settings set admin_push_enabled = false;
select pg_temp.check(not (select admin_push_enabled from public.notification_settings), 'admin: apaga el push');
reset role;

-- Se regulariza con un débito aprobado posterior: el caso queda resuelto.
insert into public.subscription_payments (user_id, subscription_id, provider, provider_payment_id, status, amount_minor, currency, paid_at)
values ('a7000000-0000-4000-8000-0000000000a7', 'd7000000-0000-4000-8000-0000000000d7', 'mercadopago', 'ap-aprobado', 'approved', 2000000, 'ARS', now());
set role authenticated;
set request.jwt.claim.sub = 'c7000000-0000-4000-8000-0000000000c7';
select pg_temp.check((select resolved from public.admin_payment_problems() where provider_payment_id = 'ap-rechazado'), 'listado: resuelto');
reset role;
rollback;
