-- Runnie: cupo diario de mensajes (5 sin suscripción, 30 con suscripción), solo para quien ingresó.
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
-- Sin suscripción: 5 por día.
set request.jwt.claim.sub = 'a9000000-0000-4000-8000-0000000000a9';
select pg_temp.check(public.runnie_daily_limit() = 5, 'gratis: tope 5');
select pg_temp.check(public.runnie_remaining() = 5, 'gratis: 5 disponibles');
select pg_temp.check(public.runnie_take_message() = 4, 'gratis: primer mensaje, quedan 4');
select public.runnie_take_message(), public.runnie_take_message(), public.runnie_take_message();
select pg_temp.check(public.runnie_take_message() = 0, 'gratis: quinto mensaje, quedan 0');
select pg_temp.check(public.runnie_take_message() = -1, 'gratis: sexto mensaje rechazado');
select pg_temp.check(public.runnie_remaining() = 0, 'gratis: sin cupo');
select pg_temp.check((select messages from public.runnie_usage) = 5, 'gratis: ve su conteo (5)');
-- No puede reponerse el cupo ni escribir el conteo a mano.
select pg_temp.expect_error($$select public.runnie_give_back('a9000000-0000-4000-8000-0000000000a9')$$, 'usuario: no repone el cupo');
update public.runnie_usage set messages = 0;
select pg_temp.check((select messages from public.runnie_usage) = 5, 'usuario: no edita el conteo');
select pg_temp.expect_error($$insert into public.runnie_usage (user_id, day, messages) values ('a9000000-0000-4000-8000-0000000000a9', current_date + 1, 0)$$, 'usuario: no inserta conteos');

-- Con suscripción: 30 por día, y no ve el conteo de otra persona.
set request.jwt.claim.sub = 'b9000000-0000-4000-8000-0000000000b9';
select pg_temp.check(public.runnie_daily_limit() = 30, 'suscripción: tope 30');
select pg_temp.check(public.runnie_take_message() = 29, 'suscripción: quedan 29');
select pg_temp.check((select count(*) from public.runnie_usage) = 1, 'suscripción: solo ve su conteo');
reset role;

-- El servidor devuelve el mensaje cuando Runnie no pudo responder.
set role service_role;
select public.runnie_give_back('a9000000-0000-4000-8000-0000000000a9');
reset role;
set role authenticated;
set request.jwt.claim.sub = 'a9000000-0000-4000-8000-0000000000a9';
select pg_temp.check(public.runnie_remaining() = 1, 'devuelto: queda 1');

rollback;
