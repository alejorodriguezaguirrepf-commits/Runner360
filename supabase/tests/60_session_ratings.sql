-- Valoraciones de entrenamientos: una por día, solo propias, rango 1–5.
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
  ('f6f6f6f6-0000-4000-8000-0000000000f6', 'sr-a@test.local'),
  ('a7a7a7a7-0000-4000-8000-0000000000a7', 'sr-b@test.local');
insert into public.plan_enrollments (id, user_id, content_version, plan_id, start_date, race_date)
values ('e6e6e6e6-0000-4000-8000-0000000000e6', 'f6f6f6f6-0000-4000-8000-0000000000f6', '2026.11', 'plan-01', '2026-10-19', '2026-11-15');

set role authenticated;
set request.jwt.claim.sub = 'f6f6f6f6-0000-4000-8000-0000000000f6';
insert into public.session_ratings (user_id, enrollment_id, workout_date, plan_week, plan_day_index, rating, note)
values ('f6f6f6f6-0000-4000-8000-0000000000f6', 'e6e6e6e6-0000-4000-8000-0000000000e6', '2026-10-20', 1, 1, 4, 'Bien, piernas livianas');
select pg_temp.expect_error($$insert into public.session_ratings (user_id, enrollment_id, workout_date, plan_week, plan_day_index, rating)
  values ('f6f6f6f6-0000-4000-8000-0000000000f6', 'e6e6e6e6-0000-4000-8000-0000000000e6', '2026-10-20', 1, 1, 2)$$, 'dos valoraciones el mismo día');
select pg_temp.expect_error($$insert into public.session_ratings (user_id, enrollment_id, workout_date, plan_week, plan_day_index, rating)
  values ('f6f6f6f6-0000-4000-8000-0000000000f6', 'e6e6e6e6-0000-4000-8000-0000000000e6', '2026-10-22', 1, 3, 6)$$, 'valoración fuera de rango');
update public.session_ratings set rating = 5 where workout_date = '2026-10-20';
select pg_temp.check((select rating from public.session_ratings where workout_date = '2026-10-20') = 5, 'se puede cambiar la valoración');

-- Otra persona no ve ni valora en una inscripción ajena.
set request.jwt.claim.sub = 'a7a7a7a7-0000-4000-8000-0000000000a7';
select pg_temp.check((select count(*) from public.session_ratings) = 0, 'no ve valoraciones ajenas');
select pg_temp.expect_error($$insert into public.session_ratings (user_id, enrollment_id, workout_date, plan_week, plan_day_index, rating)
  values ('a7a7a7a7-0000-4000-8000-0000000000a7', 'e6e6e6e6-0000-4000-8000-0000000000e6', '2026-10-22', 1, 3, 3)$$, 'valorar en inscripción ajena');
update public.session_ratings set rating = 1;
reset role;
select pg_temp.check((select rating from public.session_ratings where workout_date = '2026-10-20') = 5, 'no modifica valoraciones ajenas');
rollback;
