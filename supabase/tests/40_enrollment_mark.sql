-- Marca reciente en la inscripción: completa o vacía.
begin;
create function pg_temp.expect_error(p_sql text, p_label text) returns void language plpgsql as $$
begin
  begin execute p_sql; exception when others then return; end;
  raise exception 'Se esperaba un error y no ocurrió: %', p_label;
end; $$;
insert into auth.users (id, email) values ('c3c3c3c3-0000-4000-8000-0000000000c3', 'mark@test.local');
select pg_temp.expect_error($$insert into public.plan_enrollments (user_id, content_version, plan_id, start_date, race_date, mark_distance_m)
  values ('c3c3c3c3-0000-4000-8000-0000000000c3', '2026.10', 'plan-01', '2026-10-19', '2026-11-15', 10000)$$, 'marca incompleta');
insert into public.plan_enrollments (user_id, content_version, plan_id, start_date, race_date, mark_distance_m, mark_time_s, mark_date)
values ('c3c3c3c3-0000-4000-8000-0000000000c3', '2026.10', 'plan-01', '2026-10-19', '2026-11-15', 10000, 3000, '2026-10-01');
update public.plan_enrollments set mark_distance_m = 5000, mark_time_s = 1500, mark_date = '2026-10-05' where user_id = 'c3c3c3c3-0000-4000-8000-0000000000c3';
rollback;
