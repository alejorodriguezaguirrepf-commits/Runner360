-- RUNNER 360 · Migración 5: hidratación y competencias.

create type public.beverage_type as enum ('water', 'sports_drink', 'electrolytes', 'gel', 'other');
create type public.hydration_context as enum ('daily', 'training', 'competition');
create type public.competition_status as enum ('planned', 'completed', 'dns', 'dnf');

create table public.competitions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 2 and 120),
  distance_m int not null check (distance_m between 100 and 250000),
  race_date date not null,
  location text check (char_length(location) <= 120),
  -- Tiempo objetivo: una META del usuario, nunca una predicción.
  target_time_s int check (target_time_s between 60 and 172800),
  user_plan_id uuid,
  status public.competition_status not null default 'planned',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  foreign key (user_plan_id, user_id) references public.user_training_plans (id, user_id) on delete set null (user_plan_id)
);
create index competitions_user_date_idx on public.competitions (user_id, race_date);
create trigger competitions_updated_at before update on public.competitions
  for each row execute function public.set_updated_at();

-- Resultado REAL (oficial o informado por el usuario). Distinto del objetivo.
create table public.competition_results (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null unique,
  user_id uuid not null,
  finish_time_s int not null check (finish_time_s between 60 and 172800),
  notes text check (char_length(notes) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (competition_id, user_id) references public.competitions (id, user_id) on delete cascade
);
create trigger competition_results_updated_at before update on public.competition_results
  for each row execute function public.set_updated_at();

create table public.competition_result_splits (
  id uuid primary key default gen_random_uuid(),
  result_id uuid not null references public.competition_results (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  split_index int not null check (split_index between 1 and 200),
  distance_m int not null check (distance_m between 1 and 100000),
  duration_s int not null check (duration_s between 1 and 86400),
  unique (result_id, split_index)
);

-- Al registrar un resultado, la competencia pasa a "completed".
create or replace function public.mark_competition_completed()
returns trigger language plpgsql set search_path = '' as $$
begin
  update public.competitions set status = 'completed' where id = new.competition_id and status <> 'completed';
  return new;
end $$;
create trigger competition_results_complete after insert on public.competition_results
  for each row execute function public.mark_competition_completed();

-- Marcas personales: mejor resultado real por distancia exacta. security_invoker → respeta RLS.
create view public.personal_bests with (security_invoker = true) as
select distinct on (c.user_id, c.distance_m)
  c.user_id, c.distance_m, r.finish_time_s, c.race_date, c.name, c.id as competition_id
from public.competition_results r
join public.competitions c on c.id = r.competition_id
order by c.user_id, c.distance_m, r.finish_time_s asc, c.race_date asc;

create table public.hydration_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  logged_at timestamptz not null,
  beverage_type public.beverage_type not null,
  volume_ml int check (volume_ml between 1 and 5000),
  units smallint check (units between 1 and 20),
  context public.hydration_context not null default 'daily',
  workout_log_id uuid references public.workout_logs (id) on delete set null,
  competition_id uuid,
  notes text check (char_length(notes) <= 300),
  created_at timestamptz not null default now(),
  check (volume_ml is not null or units is not null),
  foreign key (competition_id, user_id) references public.competitions (id, user_id) on delete set null (competition_id)
);
create index hydration_logs_user_time_idx on public.hydration_logs (user_id, logged_at desc);

create table public.hydration_reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  label text not null check (char_length(label) between 1 and 60),
  time_of_day time not null,
  weekdays smallint[] not null check (cardinality(weekdays) between 1 and 7 and weekdays <@ array[1,2,3,4,5,6,7]::smallint[]),
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index hydration_reminders_user_idx on public.hydration_reminders (user_id);
create trigger hydration_reminders_updated_at before update on public.hydration_reminders
  for each row execute function public.set_updated_at();

-- RLS: solo el titular. La escritura requiere la funcionalidad habilitada por su suscripción.
alter table public.competitions enable row level security;
alter table public.competition_results enable row level security;
alter table public.competition_result_splits enable row level security;
alter table public.hydration_logs enable row level security;
alter table public.hydration_reminders enable row level security;

create policy competitions_select on public.competitions for select to authenticated using (user_id = (select auth.uid()));
create policy competitions_write on public.competitions for insert to authenticated
  with check (user_id = (select auth.uid()) and (select public.has_feature('competitions')));
create policy competitions_update on public.competitions for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()) and (select public.has_feature('competitions')));
create policy competitions_delete on public.competitions for delete to authenticated using (user_id = (select auth.uid()));

create policy competition_results_select on public.competition_results for select to authenticated using (user_id = (select auth.uid()));
create policy competition_results_insert on public.competition_results for insert to authenticated
  with check (user_id = (select auth.uid()) and (select public.has_feature('competitions')));
create policy competition_results_update on public.competition_results for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy competition_results_delete on public.competition_results for delete to authenticated using (user_id = (select auth.uid()));

create policy competition_result_splits_own on public.competition_result_splits for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid())
    and exists (select 1 from public.competition_results r where r.id = result_id and r.user_id = (select auth.uid())));

create policy hydration_logs_select on public.hydration_logs for select to authenticated using (user_id = (select auth.uid()));
create policy hydration_logs_insert on public.hydration_logs for insert to authenticated
  with check (user_id = (select auth.uid()) and (select public.has_feature('hydration')));
create policy hydration_logs_delete on public.hydration_logs for delete to authenticated using (user_id = (select auth.uid()));

create policy hydration_reminders_select on public.hydration_reminders for select to authenticated using (user_id = (select auth.uid()));
create policy hydration_reminders_write on public.hydration_reminders for insert to authenticated
  with check (user_id = (select auth.uid()) and (select public.has_feature('hydration')));
create policy hydration_reminders_update on public.hydration_reminders for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy hydration_reminders_delete on public.hydration_reminders for delete to authenticated using (user_id = (select auth.uid()));

grant select, insert, update, delete on public.competitions, public.competition_results,
  public.competition_result_splits, public.hydration_logs, public.hydration_reminders to authenticated;
grant select on public.personal_bests to authenticated;
