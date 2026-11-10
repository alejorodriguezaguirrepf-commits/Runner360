-- Llaves de acceso: cada persona ve y borra las suyas; solo el servidor las crea; los desafíos son del servidor.
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
  ('aa100000-0000-4000-8000-0000000000a1', 'llave-uno@test.local', now()),
  ('bb100000-0000-4000-8000-0000000000b1', 'llave-dos@test.local', now());

-- El servidor registra una llave por persona.
set role service_role;
insert into public.passkeys (user_id, credential_id, public_key, device_name) values
  ('aa100000-0000-4000-8000-0000000000a1', 'credencial-uno-0000000000', 'clave-publica-uno-000000', 'iPhone (Safari)'),
  ('bb100000-0000-4000-8000-0000000000b1', 'credencial-dos-0000000000', 'clave-publica-dos-000000', 'Android (Chrome)');
insert into public.passkey_challenges (purpose, challenge) values ('login', 'desafio-de-prueba');
select pg_temp.expect_error($$insert into public.passkey_challenges (purpose, challenge) values ('register', 'sin-usuario')$$, 'registrar exige usuario');
select pg_temp.expect_error($$insert into public.passkeys (user_id, credential_id, public_key) values ('bb100000-0000-4000-8000-0000000000b1', 'credencial-uno-0000000000', 'otra-clave-publica-0000')$$, 'credencial repetida');
reset role;

set role authenticated;
set request.jwt.claim.sub = 'aa100000-0000-4000-8000-0000000000a1';
select pg_temp.check((select count(*) from public.passkeys) = 1, 've solo su llave');
select pg_temp.expect_error($$insert into public.passkeys (user_id, credential_id, public_key) values ('aa100000-0000-4000-8000-0000000000a1', 'credencial-propia-0000000', 'clave-publica-propia-000')$$, 'no registra llaves sin el servidor');
select pg_temp.expect_error($$update public.passkeys set counter = 0$$, 'no edita llaves');
select pg_temp.expect_error($$select * from public.passkey_challenges$$, 'no ve desafíos');
-- No puede borrar la llave de otra persona (no la ve), sí la propia.
delete from public.passkeys where credential_id = 'credencial-dos-0000000000';
delete from public.passkeys where credential_id = 'credencial-uno-0000000000';
reset role;
select pg_temp.check((select count(*) from public.passkeys where credential_id like 'credencial-%') = 1, 'borró solo la propia');

set role anon;
select pg_temp.expect_error($$select * from public.passkey_challenges$$, 'anónimo: sin desafíos');
select pg_temp.expect_error($$select * from public.passkeys$$, 'anónimo: sin permiso sobre las llaves');
reset role;

-- Al borrar la cuenta se borran sus llaves.
delete from auth.users where id = 'bb100000-0000-4000-8000-0000000000b1';
select pg_temp.check((select count(*) from public.passkeys where credential_id like 'credencial-%') = 0, 'cuenta borrada: sin llaves');

rollback;
