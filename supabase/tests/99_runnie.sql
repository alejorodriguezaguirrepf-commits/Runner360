-- Runnie: el cupo diario de la base quedó sin uso (Runnie responde dentro de la app, gratis para todos); se prueba igual mientras exista.
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
  ('a9000000-0000-4000-8000-0000000000a9', 'runnie-gratis@test.local', now()),
  ('b9000000-0000-4000-8000-0000000000b9', 'runnie-premium@test.local', now());
insert into public.subscriptions (user_id, product_id, provider, status, started_at, current_period_start, current_period_end)
values ('b9000000-0000-4000-8000-0000000000b9', '00000000-0000-4000-8000-000000000002', 'manual', 'active', now(), now(), now() + interval '30 days');

-- Sin sesión: no puede usar a Runnie.
set role anon;
select pg_temp.expect_error($$select public.runnie_take_message()$$, 'anónimo: sin cupo');
reset role;

set role authenticated;
-- Sin suscripción: Runnie no está incluido (tope 0) y no se registra nada.
set request.jwt.claim.sub = 'a9000000-0000-4000-8000-0000000000a9';
select pg_temp.check(public.runnie_daily_limit() = 0, 'gratis: tope 0');
select pg_temp.check(public.runnie_remaining() = 0, 'gratis: sin mensajes');
select pg_temp.check(public.runnie_take_message() = -1, 'gratis: mensaje rechazado');
select pg_temp.check((select count(*) from public.runnie_usage) = 0, 'gratis: no se registra nada');
-- No puede reponerse el cupo ni escribir el conteo a mano.
select pg_temp.expect_error($$select public.runnie_give_back('a9000000-0000-4000-8000-0000000000a9')$$, 'usuario: no repone el cupo');
select pg_temp.expect_error($$insert into public.runnie_usage (user_id, day, messages) values ('a9000000-0000-4000-8000-0000000000a9', current_date, 0)$$, 'usuario: no inserta conteos');

-- Con suscripción: 30 por día, y no ve el conteo de otra persona.
set request.jwt.claim.sub = 'b9000000-0000-4000-8000-0000000000b9';
select pg_temp.check(public.runnie_daily_limit() = 30, 'suscripción: tope 30');
select pg_temp.check(public.runnie_take_message() = 29, 'suscripción: quedan 29');
select pg_temp.check(public.runnie_take_message() = 28, 'suscripción: quedan 28');
select pg_temp.check((select count(*) from public.runnie_usage) = 1, 'suscripción: solo ve su conteo');
update public.runnie_usage set messages = 0;
select pg_temp.check((select messages from public.runnie_usage) = 2, 'suscripción: no edita el conteo');
-- Con el tope lleno, se rechaza.
reset role;
update public.runnie_usage set messages = 30 where user_id = 'b9000000-0000-4000-8000-0000000000b9';
set role authenticated;
set request.jwt.claim.sub = 'b9000000-0000-4000-8000-0000000000b9';
select pg_temp.check(public.runnie_take_message() = -1, 'suscripción: mensaje 31 rechazado');
reset role;

-- El servidor devuelve el mensaje cuando Runnie no pudo responder.
set role service_role;
select public.runnie_give_back('b9000000-0000-4000-8000-0000000000b9');
reset role;
set role authenticated;
set request.jwt.claim.sub = 'b9000000-0000-4000-8000-0000000000b9';
select pg_temp.check(public.runnie_remaining() = 1, 'devuelto: queda 1');

-- Runnie es gratis: figura una vez en el plan gratis y ya no entre los beneficios pagos.
select pg_temp.check((select count(*) from unnest((select features from public.subscription_products where code = 'free')) f where f like 'Runnie%') = 1, 'beneficio: Runnie en el plan gratis');
select pg_temp.check((select count(*) from unnest((select features from public.subscription_products where code = 'premium_monthly')) f where f like 'Runnie%') = 0, 'beneficio: Runnie ya no es pago');

rollback;
