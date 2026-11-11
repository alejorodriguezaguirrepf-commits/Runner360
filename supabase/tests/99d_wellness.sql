-- Wellness diario: solo con consentimiento de salud, uno por día, score = suma, lo ve la persona y el equipo.
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
  ('ad300000-0000-4000-8000-0000000000a3', 'wellness-uno@test.local', now()),
  ('bd300000-0000-4000-8000-0000000000b3', 'wellness-dos@test.local', now()),
  ('cd300000-0000-4000-8000-0000000000c3', 'wellness-profe@test.local', now());
update public.profiles set role = 'coach' where id = 'cd300000-0000-4000-8000-0000000000c3';

set role authenticated;
set request.jwt.claim.sub = 'ad300000-0000-4000-8000-0000000000a3';
select pg_temp.expect_error(
  $$insert into public.wellness_checkins (check_date, sleep, energy, soreness, stress, mood) values (current_date, 4, 4, 3, 4, 5)$$,
  'sin consentimiento de salud no se guarda');
insert into public.user_consents (user_id, consent_type, document_version, granted)
  values ('ad300000-0000-4000-8000-0000000000a3', 'health_data', '2026-10', true);
insert into public.wellness_checkins (check_date, sleep, energy, soreness, stress, mood) values (current_date, 4, 4, 3, 4, 5);
select pg_temp.check((select score from public.wellness_checkins) = 20, 'score = suma de los 5 ítems');
select pg_temp.check((select user_id from public.wellness_checkins) = 'ad300000-0000-4000-8000-0000000000a3', 'queda a nombre de quien responde');
select pg_temp.expect_error(
  $$insert into public.wellness_checkins (check_date, sleep, energy, soreness, stress, mood) values (current_date, 4, 4, 3, 4, 5)$$,
  'uno por día');
update public.wellness_checkins set sleep = 2 where check_date = current_date;
select pg_temp.check((select score from public.wellness_checkins) = 18, 'se puede corregir y el score se recalcula');
select pg_temp.expect_error($$insert into public.wellness_checkins (check_date, sleep, energy, soreness, stress, mood) values (current_date - 1, 6, 4, 3, 4, 5)$$, 'fuera de rango');
select pg_temp.expect_error($$insert into public.wellness_checkins (check_date, sleep, energy, soreness, stress, mood) values (current_date + 5, 3, 3, 3, 3, 3)$$, 'fecha futura');
select pg_temp.expect_error($$insert into public.wellness_checkins (check_date, sleep, energy, soreness, stress, mood, score) values (current_date - 2, 3, 3, 3, 3, 3, 25)$$, 'no se puede escribir el score');
select pg_temp.expect_error(
  $$insert into public.wellness_checkins (user_id, check_date, sleep, energy, soreness, stress, mood) values ('bd300000-0000-4000-8000-0000000000b3', current_date, 3, 3, 3, 3, 3)$$,
  'a nombre de otra persona');

set request.jwt.claim.sub = 'bd300000-0000-4000-8000-0000000000b3';
select pg_temp.check((select count(*) from public.wellness_checkins) = 0, 'otro deportista no lo ve');
update public.wellness_checkins set sleep = 5;
delete from public.wellness_checkins;

set request.jwt.claim.sub = 'cd300000-0000-4000-8000-0000000000c3';
select pg_temp.check((select count(*) from public.wellness_checkins) = 1, 'el entrenador lo ve');
update public.wellness_checkins set sleep = 5;
delete from public.wellness_checkins;
reset role;
select pg_temp.check((select sleep from public.wellness_checkins) = 2, 'nadie más lo cambia ni lo borra');

set role anon;
select pg_temp.expect_error($$select * from public.wellness_checkins$$, 'anónimo: sin acceso');
reset role;

delete from auth.users where id = 'ad300000-0000-4000-8000-0000000000a3';
select pg_temp.check((select count(*) from public.wellness_checkins) = 0, 'cuenta borrada: sin cuestionarios');

rollback;
