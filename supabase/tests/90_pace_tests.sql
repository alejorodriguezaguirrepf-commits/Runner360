-- Test de la calculadora: cada uno ve y guarda solo el suyo; valores imposibles se rechazan.
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

insert into auth.users (id, email) values
  ('d9d9d9d9-0000-4000-8000-0000000000d9', 'test-a@test.local'),
  ('e9e9e9e9-0000-4000-8000-0000000000e9', 'test-b@test.local');

set role authenticated;
set request.jwt.claim.sub = 'd9d9d9d9-0000-4000-8000-0000000000d9';
insert into public.user_pace_tests (user_id, distance_m, time_s) values ('d9d9d9d9-0000-4000-8000-0000000000d9', 2400, 720);
update public.user_pace_tests set time_s = 700 where user_id = 'd9d9d9d9-0000-4000-8000-0000000000d9';
select pg_temp.check((select time_s from public.user_pace_tests) = 700, 'actualiza su test');
select pg_temp.expect_error($$insert into public.user_pace_tests (user_id, distance_m, time_s) values ('e9e9e9e9-0000-4000-8000-0000000000e9', 2400, 720)$$, 'guardar el test de otro');
select pg_temp.expect_error($$update public.user_pace_tests set distance_m = 2400, time_s = 60$$, 'ritmo imposible (25 s/km)');

set request.jwt.claim.sub = 'e9e9e9e9-0000-4000-8000-0000000000e9';
select pg_temp.check((select count(*) from public.user_pace_tests) = 0, 'no ve el test de otro');
update public.user_pace_tests set time_s = 600;
reset role;
select pg_temp.check((select time_s from public.user_pace_tests where user_id = 'd9d9d9d9-0000-4000-8000-0000000000d9') = 700, 'otro no lo modifica');

set role anon;
select pg_temp.check((select count(*) from public.user_pace_tests) = 0, 'anon no ve tests');
reset role;
rollback;
