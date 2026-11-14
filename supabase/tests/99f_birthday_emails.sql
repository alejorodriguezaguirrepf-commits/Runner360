-- Correo de cumpleaños: quién lo recibe cada día (29 de febrero incluido), baja y uno por año.
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
  ('af500000-0000-4000-8000-0000000000a5', 'cumple-uno@test.local', now()),
  ('bf500000-0000-4000-8000-0000000000b5', 'cumple-bisiesto@test.local', now()),
  ('cf500000-0000-4000-8000-0000000000c5', 'cumple-sin-confirmar@test.local', null),
  ('df500000-0000-4000-8000-0000000000d5', 'cumple-baja@test.local', now()),
  ('ef500000-0000-4000-8000-0000000000e5', 'cumple-otro-dia@test.local', now());
update public.profiles set birth_date = '1990-11-14' where id in ('af500000-0000-4000-8000-0000000000a5', 'cf500000-0000-4000-8000-0000000000c5', 'df500000-0000-4000-8000-0000000000d5');
update public.profiles set birth_date = '1992-02-29' where id = 'bf500000-0000-4000-8000-0000000000b5';
update public.profiles set birth_date = '1990-11-15' where id = 'ef500000-0000-4000-8000-0000000000e5';
update public.email_preferences set motivational = false where user_id = 'df500000-0000-4000-8000-0000000000d5';

set role service_role;
select pg_temp.check((select array_agg(email order by email) from public.email_birthday_candidates('2026-11-14') where email like 'cumple-%') = array['cumple-uno@test.local'],
  'cumpleaños: solo correo confirmado, sin baja y del día');
select pg_temp.check((select count(*) from public.email_birthday_candidates('2027-02-28') where email = 'cumple-bisiesto@test.local') = 1, '29/2: se saluda el 28 en año no bisiesto');
select pg_temp.check((select count(*) from public.email_birthday_candidates('2028-02-28') where email = 'cumple-bisiesto@test.local') = 0, '29/2: en año bisiesto, no el 28');
select pg_temp.check((select count(*) from public.email_birthday_candidates('2028-02-29') where email = 'cumple-bisiesto@test.local') = 1, '29/2: en año bisiesto, el 29');
insert into public.email_sends (user_id, kind, sent_on) values ('af500000-0000-4000-8000-0000000000a5', 'birthday', '2026-11-14');
select pg_temp.check((select count(*) from public.email_birthday_candidates('2026-11-14') where email = 'cumple-uno@test.local') = 0, 'uno por año');
select pg_temp.check((select count(*) from public.email_birthday_candidates('2027-11-14') where email = 'cumple-uno@test.local') = 1, 'al año siguiente, de nuevo');
select pg_temp.expect_error($$insert into public.email_sends (user_id, kind) values ('af500000-0000-4000-8000-0000000000a5', 'otro')$$, 'tipo desconocido');
reset role;

set role authenticated;
set request.jwt.claim.sub = 'af500000-0000-4000-8000-0000000000a5';
select pg_temp.expect_error($$select * from public.email_birthday_candidates('2026-11-14')$$, 'usuario: no ve la lista');
reset role;
set role anon;
select pg_temp.expect_error($$select * from public.email_birthday_candidates('2026-11-14')$$, 'anónimo: no ve la lista');
reset role;

rollback;
