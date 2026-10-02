-- Funcionalidades Premium aplicadas en backend.
begin;
create function pg_temp.expect_error(p_sql text, p_label text) returns void language plpgsql as $$
begin
  begin execute p_sql; exception when others then return; end;
  raise exception 'Se esperaba un error y no ocurrió: %', p_label;
end; $$;
grant execute on all functions in schema pg_temp to authenticated;

insert into auth.users (id, email) values
  ('dddddddd-0000-4000-8000-000000000004', 'free@test.local'),
  ('eeeeeeee-0000-4000-8000-000000000005', 'premium@test.local');
insert into public.subscriptions (user_id, product_id, provider, status, current_period_start, current_period_end)
values ('eeeeeeee-0000-4000-8000-000000000005', '00000000-0000-4000-8000-000000000002', 'manual', 'active', now(), now() + interval '30 days');

set role authenticated;
set request.jwt.claim.sub = 'dddddddd-0000-4000-8000-000000000004';
select pg_temp.expect_error($$insert into public.hydration_logs (user_id, log_date, volume_ml) values ('dddddddd-0000-4000-8000-000000000004', current_date, 500)$$, 'free no registra hidratación');
select pg_temp.expect_error($$insert into public.competitions (user_id, name, distance_m, event_date) values ('dddddddd-0000-4000-8000-000000000004', 'x', 10000, current_date)$$, 'free no registra competencias');

set request.jwt.claim.sub = 'eeeeeeee-0000-4000-8000-000000000005';
insert into public.hydration_logs (user_id, log_date, volume_ml) values ('eeeeeeee-0000-4000-8000-000000000005', current_date, 500);
insert into public.competitions (user_id, name, distance_m, distance_code, event_date) values ('eeeeeeee-0000-4000-8000-000000000005', '10K Ciudad', 10000, '10K', current_date);

-- Si el administrador libera la función, el usuario free puede usarla.
reset role;
update public.app_features set requires_premium = false where key = 'hydration';
set role authenticated;
set request.jwt.claim.sub = 'dddddddd-0000-4000-8000-000000000004';
insert into public.hydration_logs (user_id, log_date, volume_ml) values ('dddddddd-0000-4000-8000-000000000004', current_date, 250);
reset role;
rollback;
