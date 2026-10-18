-- Último test del corredor cargado en la calculadora de ritmos (distancia libre y tiempo).
-- Se usa para precargar la calculadora y como ritmo de referencia para pasar los planes a km.
-- Reversión: supabase/rollback/20261018000100_pace_tests.down.sql
create table public.user_pace_tests (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  distance_m integer not null check (distance_m between 100 and 100000),
  time_s integer not null check (time_s between 10 and 86400),
  updated_at timestamptz not null default now(),
  -- Ritmo posible para una persona: entre 1:30/km y 30:00/km.
  constraint user_pace_tests_plausible check (time_s::numeric * 1000 / distance_m between 90 and 1800)
);
comment on table public.user_pace_tests is 'Último test de la calculadora de ritmos (uno por usuario).';
alter table public.user_pace_tests enable row level security;

create trigger user_pace_tests_set_updated_at before update on public.user_pace_tests
for each row execute function public.set_updated_at();

create policy user_pace_tests_select_own on public.user_pace_tests for select to authenticated
  using (user_id = (select auth.uid()));
create policy user_pace_tests_insert_own on public.user_pace_tests for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy user_pace_tests_update_own on public.user_pace_tests for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy user_pace_tests_delete_own on public.user_pace_tests for delete to authenticated
  using (user_id = (select auth.uid()));
