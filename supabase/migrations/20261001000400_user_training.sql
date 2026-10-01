-- RUNNER 360 · Migración 4: perfil deportivo, salud (restringido), planes asignados, calendario y registros.

create table public.training_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  target_distance public.race_distance not null,
  level public.runner_level not null,
  experience_months int not null check (experience_months between 0 and 720),
  weekly_distance_m int not null check (weekly_distance_m between 0 and 300000),
  available_days smallint[] not null check (
    cardinality(available_days) between 1 and 7 and available_days <@ array[1,2,3,4,5,6,7]::smallint[]),
  recent_race_distance_m int check (recent_race_distance_m between 1000 and 100000),
  recent_race_time_s int check (recent_race_time_s between 180 and 86400),
  goal public.training_goal not null,
  race_date date,
  preferences text check (char_length(preferences) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((recent_race_distance_m is null) = (recent_race_time_s is null))
);
create trigger training_profiles_updated_at before update on public.training_profiles
  for each row execute function public.set_updated_at();

-- Datos de salud: tabla separada, acceso EXCLUSIVO del titular (ni administradores ni entrenadores),
-- y solo con consentimiento expreso vigente.
create table public.training_health_info (
  user_id uuid primary key references auth.users (id) on delete cascade,
  has_recent_injury boolean not null default false,
  has_medical_condition boolean not null default false,
  notes text check (char_length(notes) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger training_health_info_updated_at before update on public.training_health_info
  for each row execute function public.set_updated_at();

create table public.user_training_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  plan_version_id uuid not null references public.training_plan_versions (id) on delete restrict,
  start_date date not null check (extract(isodow from start_date) = 1),
  start_week int not null check (start_week >= 1),
  schedule_variant_id text not null,
  weekday_pattern smallint[] not null,
  race_date date,
  status public.user_plan_status not null default 'active',
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);
create unique index user_training_plans_one_active on public.user_training_plans (user_id) where status = 'active';
create index user_training_plans_user_idx on public.user_training_plans (user_id, created_at desc);
create trigger user_training_plans_updated_at before update on public.user_training_plans
  for each row execute function public.set_updated_at();

create table public.user_training_calendar (
  id uuid primary key default gen_random_uuid(),
  user_plan_id uuid not null,
  user_id uuid not null,
  session_id uuid not null references public.training_sessions (id) on delete restrict,
  week_number int not null check (week_number >= 1),
  scheduled_date date not null,
  created_at timestamptz not null default now(),
  unique (id, user_id),
  unique (user_plan_id, session_id),
  -- FK compuesta: la entrada pertenece al mismo usuario que el plan asignado.
  foreign key (user_plan_id, user_id) references public.user_training_plans (id, user_id) on delete cascade
);
create index user_training_calendar_user_date_idx on public.user_training_calendar (user_id, scheduled_date);

-- La sesión debe pertenecer a la versión del plan asignado.
create or replace function public.enforce_calendar_session()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not exists (
    select 1 from public.user_training_plans u
    join public.training_sessions s on s.plan_version_id = u.plan_version_id
    where u.id = new.user_plan_id and s.id = new.session_id
  ) then
    raise exception 'La sesión no pertenece al plan asignado' using errcode = '23514';
  end if;
  return new;
end $$;
create trigger user_training_calendar_session before insert or update on public.user_training_calendar
  for each row execute function public.enforce_calendar_session();

create table public.workout_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  started_at timestamptz not null,
  distance_m int not null default 0 check (distance_m between 0 and 400000),
  duration_s int not null default 0 check (duration_s between 0 and 172800),
  -- Ritmo derivado (s/km); null si no hay distancia o duración. Nunca se divide por cero.
  avg_pace_s_per_km numeric(8, 2) generated always as (
    case when distance_m > 0 and duration_s > 0 then round(duration_s * 1000.0 / distance_m, 2) end
  ) stored,
  avg_hr smallint check (avg_hr between 30 and 250),
  max_hr smallint check (max_hr between 30 and 250),
  elevation_gain_m int check (elevation_gain_m between 0 and 10000),
  rpe smallint check (rpe between 1 and 10),
  notes text check (char_length(notes) <= 1000),
  status public.workout_status not null,
  calendar_entry_id uuid,
  source text not null default 'manual' check (source in ('manual', 'import', 'device')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status = 'skipped' or duration_s > 0),
  check (avg_hr is null or max_hr is null or max_hr >= avg_hr),
  check (started_at < now() + interval '1 day'),
  foreign key (calendar_entry_id, user_id) references public.user_training_calendar (id, user_id) on delete set null (calendar_entry_id)
);
create unique index workout_logs_calendar_uniq on public.workout_logs (calendar_entry_id) where calendar_entry_id is not null;
create index workout_logs_user_started_idx on public.workout_logs (user_id, started_at desc);
create trigger workout_logs_updated_at before update on public.workout_logs
  for each row execute function public.set_updated_at();

create table public.workout_splits (
  id uuid primary key default gen_random_uuid(),
  workout_id uuid not null references public.workout_logs (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  split_index int not null check (split_index between 1 and 200),
  distance_m int not null check (distance_m between 1 and 100000),
  duration_s int not null check (duration_s between 1 and 86400),
  unique (workout_id, split_index)
);

-- ---------- Visibilidad del detalle de planes ----------
create or replace function public.can_view_plan_version(p_version_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.is_staff()
    or exists (
      select 1 from public.training_plan_versions v
      where v.id = p_version_id and v.status = 'published'
        and (not v.requires_premium or public.has_feature('premium_plans'))
    )
    or exists (
      select 1 from public.user_training_plans u
      where u.plan_version_id = p_version_id and u.user_id = (select auth.uid())
    );
$$;

create policy training_plan_weeks_read on public.training_plan_weeks for select to authenticated
  using ((select public.can_view_plan_version(plan_version_id)));
create policy training_sessions_read on public.training_sessions for select to authenticated
  using ((select public.can_view_plan_version(plan_version_id)));
create policy training_session_exercises_read on public.training_session_exercises for select to authenticated
  using (exists (select 1 from public.training_sessions s where s.id = session_id));

-- Versiones asignadas al usuario siguen visibles aunque luego se archiven.
-- Se usan funciones SECURITY DEFINER para evitar recursión entre políticas.
create or replace function public.is_assigned_version(p_version_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.user_training_plans u
                 where u.plan_version_id = p_version_id and u.user_id = (select auth.uid()));
$$;

create or replace function public.is_assigned_plan(p_plan_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.user_training_plans u
                 join public.training_plan_versions v on v.id = u.plan_version_id
                 where v.plan_id = p_plan_id and u.user_id = (select auth.uid()));
$$;

-- ¿Puede el usuario actual iniciar esta versión? (publicada y, si es Premium, con acceso Premium)
create or replace function public.is_version_assignable(p_version_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.training_plan_versions v
                 where v.id = p_version_id and v.status = 'published'
                   and (not v.requires_premium or public.has_feature('premium_plans')));
$$;

create policy training_plan_versions_assigned_read on public.training_plan_versions for select to authenticated
  using ((select public.is_assigned_version(id)));
create policy training_plans_assigned_read on public.training_plans for select to authenticated
  using ((select public.is_assigned_plan(id)));

-- ---------- Inicio de plan (transaccional) ----------
-- Invocado por el servidor (Next.js) con la sesión del usuario, después de que el motor de
-- entrenamiento generó el calendario. Corre con los permisos del usuario (SECURITY INVOKER):
-- RLS verifica propiedad, versión publicada y acceso Premium.
create or replace function public.start_training_plan(
  p_plan_version_id uuid,
  p_start_date date,
  p_start_week int,
  p_schedule_variant_id text,
  p_weekday_pattern smallint[],
  p_race_date date,
  p_entries jsonb
) returns uuid language plpgsql security invoker set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_id uuid;
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  if jsonb_typeof(p_entries) <> 'array' or jsonb_array_length(p_entries) = 0 then
    raise exception 'empty_calendar';
  end if;
  update public.user_training_plans set status = 'abandoned', ended_at = now()
  where user_id = v_uid and status = 'active';
  insert into public.user_training_plans
    (user_id, plan_version_id, start_date, start_week, schedule_variant_id, weekday_pattern, race_date)
  values (v_uid, p_plan_version_id, p_start_date, p_start_week, p_schedule_variant_id, p_weekday_pattern, p_race_date)
  returning id into v_id;
  insert into public.user_training_calendar (user_plan_id, user_id, session_id, week_number, scheduled_date)
  select v_id, v_uid, (e ->> 'sessionId')::uuid, (e ->> 'weekNumber')::int, (e ->> 'scheduledDate')::date
  from jsonb_array_elements(p_entries) e;
  return v_id;
end $$;

-- ---------- RLS de datos del usuario ----------
alter table public.training_profiles enable row level security;
alter table public.training_health_info enable row level security;
alter table public.user_training_plans enable row level security;
alter table public.user_training_calendar enable row level security;
alter table public.workout_logs enable row level security;
alter table public.workout_splits enable row level security;

create policy training_profiles_own on public.training_profiles for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy training_profiles_admin_read on public.training_profiles for select to authenticated
  using ((select public.is_admin()));

create policy training_health_info_own_select on public.training_health_info for select to authenticated
  using (user_id = (select auth.uid()));
create policy training_health_info_own_delete on public.training_health_info for delete to authenticated
  using (user_id = (select auth.uid()));
create policy training_health_info_own_insert on public.training_health_info for insert to authenticated
  with check (user_id = (select auth.uid()) and (select public.has_consent('health_data')));
create policy training_health_info_own_update on public.training_health_info for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()) and (select public.has_consent('health_data')));

create policy user_training_plans_select on public.user_training_plans for select to authenticated
  using (user_id = (select auth.uid()));
create policy user_training_plans_insert on public.user_training_plans for insert to authenticated
  with check (user_id = (select auth.uid()) and (select public.is_version_assignable(plan_version_id)));
create policy user_training_plans_update on public.user_training_plans for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy user_training_calendar_select on public.user_training_calendar for select to authenticated
  using (user_id = (select auth.uid()));
create policy user_training_calendar_insert on public.user_training_calendar for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy workout_logs_own on public.workout_logs for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy workout_splits_own on public.workout_splits for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid())
    and exists (select 1 from public.workout_logs w where w.id = workout_id and w.user_id = (select auth.uid())));

grant select, insert, update, delete on public.training_profiles, public.training_health_info,
  public.workout_logs, public.workout_splits to authenticated;
grant select, insert on public.user_training_plans, public.user_training_calendar to authenticated;
grant update (status, ended_at) on public.user_training_plans to authenticated;
grant execute on function public.start_training_plan(uuid, date, int, text, smallint[], date, jsonb),
  public.can_view_plan_version(uuid), public.is_assigned_version(uuid), public.is_assigned_plan(uuid),
  public.is_version_assignable(uuid) to authenticated;
