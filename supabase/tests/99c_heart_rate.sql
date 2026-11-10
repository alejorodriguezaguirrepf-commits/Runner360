-- Pulsaciones: bpm = beats × 10 siempre, solo lecturas de calidad, cada persona las suyas, sin editar.
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
  ('ac200000-0000-4000-8000-0000000000a2', 'pulso-uno@test.local', now()),
  ('bc200000-0000-4000-8000-0000000000b2', 'pulso-dos@test.local', now());
insert into public.workout_logs (id, user_id, workout_date, status, duration_s) values
  ('dc200000-0000-4000-8000-0000000000d1', 'ac200000-0000-4000-8000-0000000000a2', current_date, 'completed', 1800),
  ('dc200000-0000-4000-8000-0000000000d2', 'bc200000-0000-4000-8000-0000000000b2', current_date, 'completed', 1800);

set role authenticated;
set request.jwt.claim.sub = 'ac200000-0000-4000-8000-0000000000a2';
insert into public.heart_rate_measurements (beats, confidence, context) values (8, 0.82, 'reposo');
select pg_temp.check((select bpm from public.heart_rate_measurements) = 80, 'bpm = latidos × 10');
select pg_temp.check((select user_id from public.heart_rate_measurements) = 'ac200000-0000-4000-8000-0000000000a2', 'queda a nombre de quien mide');
insert into public.heart_rate_measurements (beats, confidence, context, run_id) values (15, 0.7, 'post_carrera', 'dc200000-0000-4000-8000-0000000000d1');
select pg_temp.expect_error($$insert into public.heart_rate_measurements (beats, bpm, confidence) values (8, 90, 0.8)$$, 'no se puede escribir bpm');
select pg_temp.expect_error($$insert into public.heart_rate_measurements (beats, confidence) values (8, 0.3)$$, 'baja calidad no se guarda');
select pg_temp.expect_error($$insert into public.heart_rate_measurements (beats, confidence) values (2, 0.9)$$, 'fuera de rango');
select pg_temp.expect_error($$insert into public.heart_rate_measurements (beats, confidence, context) values (8, 0.9, 'otra-cosa')$$, 'contexto inválido');
select pg_temp.expect_error($$insert into public.heart_rate_measurements (beats, confidence, run_id) values (8, 0.9, 'dc200000-0000-4000-8000-0000000000d2')$$, 'carrera de otra persona');
select pg_temp.expect_error($$insert into public.heart_rate_measurements (user_id, beats, confidence) values ('bc200000-0000-4000-8000-0000000000b2', 8, 0.9)$$, 'a nombre de otra persona');
select pg_temp.expect_error($$update public.heart_rate_measurements set beats = 9$$, 'no se editan');
select pg_temp.check((select count(*) from public.heart_rate_measurements) = 2, 've sus 2 mediciones');

set request.jwt.claim.sub = 'bc200000-0000-4000-8000-0000000000b2';
select pg_temp.check((select count(*) from public.heart_rate_measurements) = 0, 'otra persona no las ve');
delete from public.heart_rate_measurements;
reset role;
select pg_temp.check((select count(*) from public.heart_rate_measurements) = 2, 'otra persona no las borra');

set role anon;
select pg_temp.expect_error($$select * from public.heart_rate_measurements$$, 'anónimo: sin acceso');
reset role;

-- Si se borra la carrera, la medición queda sin carrera; si se borra la cuenta, se borran.
delete from public.workout_logs where id = 'dc200000-0000-4000-8000-0000000000d1';
select pg_temp.check((select count(*) from public.heart_rate_measurements where run_id is null) = 2, 'carrera borrada: medición sin carrera');
delete from auth.users where id = 'ac200000-0000-4000-8000-0000000000a2';
select pg_temp.check((select count(*) from public.heart_rate_measurements) = 0, 'cuenta borrada: sin mediciones');

rollback;
