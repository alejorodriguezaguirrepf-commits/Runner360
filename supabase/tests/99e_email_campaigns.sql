-- Correos de motivación: preferencia por persona (alta automática), baja con token, destinatarios y envíos.
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
  ('ae400000-0000-4000-8000-0000000000a4', 'mail-uno@test.local', now()),
  ('be400000-0000-4000-8000-0000000000b4', 'mail-dos@test.local', now()),
  ('ce400000-0000-4000-8000-0000000000c4', 'mail-sin-confirmar@test.local', null);
update public.profiles set created_at = now() - interval '10 days'
  where id in ('ae400000-0000-4000-8000-0000000000a4', 'be400000-0000-4000-8000-0000000000b4', 'ce400000-0000-4000-8000-0000000000c4');

select pg_temp.check((select count(*) from public.email_preferences where user_id in (
  'ae400000-0000-4000-8000-0000000000a4', 'be400000-0000-4000-8000-0000000000b4', 'ce400000-0000-4000-8000-0000000000c4')) = 3, 'preferencia creada sola');

set role service_role;
select pg_temp.check((select count(*) from public.email_campaign_candidates() where email like 'mail-%@test.local') = 2, 'destinatarios: solo correos confirmados');
select pg_temp.check((select premium from public.email_campaign_candidates() where email = 'mail-uno@test.local') = false, 'sin suscripción');
insert into public.email_sends (user_id, kind) values ('ae400000-0000-4000-8000-0000000000a4', 'invite');
select pg_temp.check((select last_invite from public.email_campaign_candidates() where email = 'mail-uno@test.local') = current_date, 'último envío');
select pg_temp.expect_error($$insert into public.email_sends (user_id, kind) values ('ae400000-0000-4000-8000-0000000000a4', 'invite')$$, 'uno por día y tipo');
reset role;

-- La persona: ve y cambia solo su preferencia (no el token); no ve los envíos ni los destinatarios.
set role authenticated;
set request.jwt.claim.sub = 'ae400000-0000-4000-8000-0000000000a4';
select pg_temp.check((select count(*) from public.email_preferences) = 1, 've solo la suya');
update public.email_preferences set motivational = false;
select pg_temp.check((select motivational from public.email_preferences) = false, 'se da de baja desde el perfil');
select pg_temp.expect_error($$update public.email_preferences set unsubscribe_token = gen_random_uuid()$$, 'no cambia el token');
select pg_temp.check((select count(*) from public.email_sends) = 0, 'no ve los envíos');
select pg_temp.expect_error($$select * from public.email_campaign_candidates()$$, 'no ve los destinatarios');
update public.email_preferences set motivational = true;
reset role;

-- Baja con el link (sin sesión).
select set_config('prueba.token', (select unsubscribe_token::text from public.email_preferences where user_id = 'be400000-0000-4000-8000-0000000000b4'), false);
set role anon;
select pg_temp.check(public.email_unsubscribe(current_setting('prueba.token')::uuid) is true, 'baja con token');
select pg_temp.check(public.email_unsubscribe(gen_random_uuid()) is false, 'token inválido');
select pg_temp.expect_error($$select * from public.email_preferences$$, 'anónimo no ve preferencias');
reset role;
select pg_temp.check((select motivational from public.email_preferences where user_id = 'be400000-0000-4000-8000-0000000000b4') = false, 'quedó dado de baja');
set role service_role;
select pg_temp.check((select count(*) from public.email_campaign_candidates() where email = 'mail-dos@test.local') = 0, 'dado de baja: no recibe');
reset role;

rollback;
