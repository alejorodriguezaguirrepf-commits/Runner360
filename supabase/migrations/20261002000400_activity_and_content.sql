-- RUNNER 360 — Registros de entrenamiento, hidratación, competencias, contenidos e incidencias.

create type public.workout_status as enum ('completed', 'modified', 'skipped');
create type public.beverage_type as enum ('water', 'sports_drink', 'electrolytes', 'gel', 'other');
create type public.hydration_context as enum ('daily', 'training', 'competition');
create type public.competition_status as enum ('planned', 'completed', 'dns', 'dnf');
create type public.content_category as enum ('hydration', 'training', 'injury_prevention', 'nutrition', 'general');
create type public.content_status as enum ('draft', 'published', 'archived');
create type public.incident_status as enum ('open', 'in_progress', 'resolved');

-- ---------------------------------------------------------------------------
-- Entrenamientos
-- ---------------------------------------------------------------------------
create table public.workout_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  calendar_entry_id uuid references public.user_training_calendar (id) on delete set null,
  workout_date date not null,
  started_at timestamptz,
  status public.workout_status not null default 'completed',
  distance_m integer check (distance_m between 0 and 400000),
  duration_s integer check (duration_s between 1 and 172800),
  avg_pace_s_per_km numeric(8, 2) generated always as (
    case when distance_m > 0 and duration_s > 0 then round(duration_s * 1000.0 / distance_m, 2) end
  ) stored,
  avg_hr smallint check (avg_hr between 30 and 250),
  max_hr smallint check (max_hr between 30 and 250),
  elevation_gain_m integer check (elevation_gain_m between 0 and 10000),
  rpe smallint check (rpe between 1 and 10),
  pain_reported boolean not null default false,
  comments text check (char_length(comments) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint workout_logs_active_requires_duration check (status = 'skipped' or duration_s is not null),
  constraint workout_logs_hr_order check (avg_hr is null or max_hr is null or avg_hr <= max_hr)
);
comment on column public.workout_logs.workout_date is 'Fecha local del entrenamiento según la zona horaria del usuario (para agregados semanales).';
create index workout_logs_user_date_idx on public.workout_logs (user_id, workout_date desc);
create unique index workout_logs_one_per_calendar_entry on public.workout_logs (calendar_entry_id) where calendar_entry_id is not null;

create trigger workout_logs_set_updated_at before update on public.workout_logs
for each row execute function public.set_updated_at();

-- Sincroniza el estado del calendario con el registro asociado.
create or replace function public.sync_calendar_from_workout()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op in ('UPDATE', 'DELETE') and old.calendar_entry_id is not null
     and (tg_op = 'DELETE' or new.calendar_entry_id is distinct from old.calendar_entry_id) then
    update public.user_training_calendar set status = 'pending'
     where id = old.calendar_entry_id and user_id = old.user_id;
  end if;
  if tg_op in ('INSERT', 'UPDATE') and new.calendar_entry_id is not null then
    update public.user_training_calendar set status = new.status::text::public.calendar_status
     where id = new.calendar_entry_id and user_id = new.user_id;
    if not found then
      raise exception 'La sesión planificada no pertenece al usuario' using errcode = '42501';
    end if;
  end if;
  return coalesce(new, old);
end;
$$;

create trigger workout_logs_sync_calendar
after insert or update or delete on public.workout_logs
for each row execute function public.sync_calendar_from_workout();

create table public.workout_splits (
  id uuid primary key default gen_random_uuid(),
  workout_id uuid not null references public.workout_logs (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  split_index smallint not null check (split_index between 1 and 500),
  distance_m integer not null check (distance_m between 1 and 100000),
  duration_s integer not null check (duration_s between 1 and 86400),
  constraint workout_splits_unique unique (workout_id, split_index)
);

alter table public.workout_logs enable row level security;
alter table public.workout_splits enable row level security;

create policy workouts_select on public.workout_logs for select to authenticated
  using (user_id = (select auth.uid()) or public.is_staff());
create policy workouts_insert_own on public.workout_logs for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy workouts_update_own on public.workout_logs for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy workouts_delete_own on public.workout_logs for delete to authenticated
  using (user_id = (select auth.uid()));

create policy splits_select on public.workout_splits for select to authenticated
  using (user_id = (select auth.uid()) or public.is_staff());
create policy splits_write_own on public.workout_splits for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and exists (
    select 1 from public.workout_logs w where w.id = workout_splits.workout_id and w.user_id = (select auth.uid())));

-- ---------------------------------------------------------------------------
-- Competencias
-- ---------------------------------------------------------------------------
create table public.competitions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  distance_code public.distance_code,
  distance_m integer not null check (distance_m between 100 and 400000),
  event_date date not null,
  location text check (char_length(location) <= 120),
  target_time_s integer check (target_time_s between 60 and 172800),
  user_plan_id uuid references public.user_training_plans (id) on delete set null,
  status public.competition_status not null default 'planned',
  notes text check (char_length(notes) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index competitions_user_date_idx on public.competitions (user_id, event_date desc);
create trigger competitions_set_updated_at before update on public.competitions
for each row execute function public.set_updated_at();

create table public.competition_results (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null unique references public.competitions (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  finish_time_s integer not null check (finish_time_s between 60 and 172800),
  is_official boolean not null default false,
  notes text check (char_length(notes) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.competition_results is 'Resultados REALES informados por el usuario. Las estimaciones nunca se guardan aquí.';
create trigger competition_results_set_updated_at before update on public.competition_results
for each row execute function public.set_updated_at();

create table public.competition_splits (
  id uuid primary key default gen_random_uuid(),
  result_id uuid not null references public.competition_results (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  split_index smallint not null check (split_index between 1 and 500),
  cumulative_distance_m integer not null check (cumulative_distance_m between 1 and 400000),
  cumulative_time_s integer not null check (cumulative_time_s between 1 and 172800),
  constraint competition_splits_unique unique (result_id, split_index)
);

alter table public.competitions enable row level security;
alter table public.competition_results enable row level security;
alter table public.competition_splits enable row level security;

create policy competitions_own on public.competitions for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy competitions_staff_read on public.competitions for select to authenticated using (public.is_staff());

create policy results_own on public.competition_results for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and exists (
    select 1 from public.competitions c where c.id = competition_results.competition_id and c.user_id = (select auth.uid())));

create policy comp_splits_own on public.competition_splits for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and exists (
    select 1 from public.competition_results r where r.id = competition_splits.result_id and r.user_id = (select auth.uid())));

-- Marcas personales: mejor resultado real por distancia estándar.
create view public.personal_records
with (security_invoker = true) as
select distinct on (c.user_id, c.distance_code)
  c.user_id, c.distance_code, r.finish_time_s, c.event_date, c.name as competition_name, c.id as competition_id
from public.competitions c
join public.competition_results r on r.competition_id = c.id
where c.distance_code is not null and c.status = 'completed'
order by c.user_id, c.distance_code, r.finish_time_s asc, c.event_date asc;

-- ---------------------------------------------------------------------------
-- Hidratación
-- ---------------------------------------------------------------------------
create table public.hydration_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  log_date date not null,
  logged_at timestamptz not null default now(),
  beverage public.beverage_type not null default 'water',
  context public.hydration_context not null default 'daily',
  volume_ml integer not null check (volume_ml between 0 and 5000),
  carbs_g smallint check (carbs_g between 0 and 200),
  workout_id uuid references public.workout_logs (id) on delete set null,
  competition_id uuid references public.competitions (id) on delete set null,
  notes text check (char_length(notes) <= 300),
  created_at timestamptz not null default now(),
  constraint hydration_volume_required check (volume_ml > 0 or beverage = 'gel')
);
create index hydration_logs_user_date_idx on public.hydration_logs (user_id, log_date desc);

create table public.hydration_reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  label text not null check (char_length(label) between 1 and 60),
  time_of_day time not null,
  weekdays smallint[] not null default '{1,2,3,4,5,6,7}'
    check (cardinality(weekdays) between 1 and 7 and weekdays <@ array[1,2,3,4,5,6,7]::smallint[]),
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index hydration_reminders_user_idx on public.hydration_reminders (user_id);
create trigger hydration_reminders_set_updated_at before update on public.hydration_reminders
for each row execute function public.set_updated_at();

alter table public.hydration_logs enable row level security;
alter table public.hydration_reminders enable row level security;
create policy hydration_logs_own on public.hydration_logs for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy hydration_reminders_own on public.hydration_reminders for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Contenidos educativos
-- ---------------------------------------------------------------------------
create table public.educational_contents (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]{3,80}$'),
  title text not null check (char_length(title) between 1 and 160),
  summary text not null default '',
  body text not null default '',
  category public.content_category not null default 'general',
  is_premium boolean not null default false,
  status public.content_status not null default 'draft',
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  published_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index educational_contents_status_idx on public.educational_contents (status, category);
create trigger educational_contents_set_updated_at before update on public.educational_contents
for each row execute function public.set_updated_at();

alter table public.educational_contents enable row level security;
create policy contents_public_read on public.educational_contents for select to anon, authenticated
  using ((status = 'published' and not is_premium) or public.is_staff());
create policy contents_premium_read on public.educational_contents for select to authenticated
  using (status = 'published' and is_premium and public.has_premium((select auth.uid())));
create policy contents_admin_write on public.educational_contents for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- Incidencias y reportes de error
-- ---------------------------------------------------------------------------
create table public.incident_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete set null,
  category text not null check (category in ('bug', 'content', 'billing', 'other')),
  message text not null check (char_length(message) between 5 and 2000),
  page_path text check (char_length(page_path) <= 200),
  status public.incident_status not null default 'open',
  admin_notes text not null default '',
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
create index incident_reports_status_idx on public.incident_reports (status, created_at desc);

alter table public.incident_reports enable row level security;
create policy incidents_insert_own on public.incident_reports for insert to authenticated
  with check (user_id = (select auth.uid()) and status = 'open' and admin_notes = '');
create policy incidents_select on public.incident_reports for select to authenticated
  using (user_id = (select auth.uid()) or public.is_admin());
create policy incidents_admin_update on public.incident_reports for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- Estadísticas de negocio agregadas (sin datos personales). Solo administradores.
-- ---------------------------------------------------------------------------
create or replace function public.admin_business_stats()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'users_total', (select count(*) from public.profiles),
    'users_onboarded', (select count(*) from public.profiles where onboarding_completed_at is not null),
    'users_last_30d', (select count(*) from public.profiles where created_at > now() - interval '30 days'),
    'premium_active', (select count(distinct user_id) from public.subscriptions s
                        where s.status in ('active', 'trialing') and (s.current_period_end is null or s.current_period_end > now())),
    'active_plans', (select count(*) from public.user_training_plans where status = 'active'),
    'workouts_last_30d', (select count(*) from public.workout_logs where created_at > now() - interval '30 days'),
    'open_incidents', (select count(*) from public.incident_reports where status <> 'resolved'),
    'payment_events_failed', (select count(*) from public.payment_events where processing_error is not null)
  );
end;
$$;
revoke execute on function public.admin_business_stats() from public, anon;
