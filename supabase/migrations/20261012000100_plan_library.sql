-- RUNNER 360 — Biblioteca de planes de running (18 planes, contenido importado y versionado).
-- Separa el CATÁLOGO (inmutable, clave content_version) del ESTADO DEL USUARIO.
-- Solo agrega objetos nuevos y columnas opcionales en workout_logs.
-- Reversión: supabase/rollback/20261012000100_plan_library.down.sql

-- ===========================================================================
-- Catálogo
-- ===========================================================================
create table public.library_versions (
  content_version text primary key check (content_version ~ '^[0-9A-Za-z.-]{1,40}$'),
  schema_version text not null check (schema_version ~ '^\d+\.\d+\.\d+$'),
  language text not null,
  checksum text not null check (checksum ~ '^[0-9a-f]{64}$'),
  is_current boolean not null default false,
  source jsonb not null,
  model_runner_assumptions jsonb not null,
  category_legend jsonb not null,
  zone_map jsonb not null,
  load_monitoring jsonb not null,
  practical_rules jsonb not null,
  safety jsonb not null,
  individual_adaptation jsonb not null,
  glossary jsonb not null,
  bibliography jsonb not null,
  imported_at timestamptz not null default now()
);
comment on table public.library_versions is 'Una fila por content_version importada. Textos globales tal cual vienen en el JSON.';
create unique index library_versions_one_current on public.library_versions (is_current) where is_current;

create table public.library_intensities (
  content_version text not null references public.library_versions (content_version) on delete cascade,
  position smallint not null check (position >= 1),
  name text not null,
  zone text not null,
  rpe text not null,
  talk_test text not null,
  feel text not null,
  use_for text not null,
  primary key (content_version, name),
  unique (content_version, position)
);

create table public.library_session_types (
  content_version text not null references public.library_versions (content_version) on delete cascade,
  position smallint not null check (position >= 1),
  code text not null,
  name text not null,
  description text not null,
  purpose text not null,
  primary key (content_version, code),
  unique (content_version, position)
);

create table public.library_strength_exercises (
  content_version text not null references public.library_versions (content_version) on delete cascade,
  routine text not null check (routine in ('A', 'B', 'C')),
  position smallint not null check (position >= 1),
  exercise text not null,
  target text not null,
  sets_reps text not null,
  primary key (content_version, routine, position)
);

create table public.library_plans (
  content_version text not null references public.library_versions (content_version) on delete cascade,
  id text not null check (id ~ '^plan-\d{2}$'),
  number smallint not null check (number >= 1),
  chapter smallint not null check (chapter >= 1),
  distance_label text not null,
  distance_km numeric not null check (distance_km > 0),
  level text not null check (level in ('Principiante', 'Intermedio', 'Avanzado')),
  duration_label text not null,
  duration_weeks smallint not null check (duration_weeks between 1 and 60),
  days_per_week smallint not null check (days_per_week between 1 and 7),
  race_week smallint not null check (race_week between 1 and 60),
  title text not null,
  runner_profile text not null,
  entry_requirements jsonb not null,
  min_weekly_km numeric check (min_weekly_km > 0),
  main_goal text not null,
  secondary_goals jsonb not null,
  strength_routine text not null check (strength_routine in ('A', 'B', 'C')),
  weekly_template text not null,
  phases jsonb not null,
  notes jsonb not null,
  validation jsonb not null,
  primary key (content_version, id),
  unique (content_version, number),
  check (race_week <= duration_weeks)
);
-- Filtro del catálogo: distancia → nivel → duración → días.
create index library_plans_filter_idx on public.library_plans (content_version, distance_km, level, duration_weeks, days_per_week);

create table public.library_weeks (
  content_version text not null,
  plan_id text not null,
  week smallint not null check (week between 1 and 60),
  phase text not null,
  week_type text not null,
  week_type_label text not null,
  weekly_goal text not null,
  progression_criterion text not null,
  distance_km_est numeric not null check (distance_km_est >= 0),
  duration_min_est numeric not null check (duration_min_est >= 0),
  running_sessions smallint not null check (running_sessions between 0 and 7),
  strength_sessions smallint not null check (strength_sessions between 0 and 7),
  zone_pct jsonb not null,
  includes_race boolean not null,
  primary key (content_version, plan_id, week),
  foreign key (content_version, plan_id) references public.library_plans (content_version, id) on delete cascade
);

create table public.library_days (
  content_version text not null,
  plan_id text not null,
  week smallint not null,
  day_index smallint not null check (day_index between 0 and 6),
  day_label text not null,
  is_rest boolean not null,
  strength_only boolean not null default false,
  code text,
  session_type text,
  category text check (category in ('rec', 'easy', 'mod', 'thr', 'hard', 'race')),
  short_label text,
  physiological_goal text,
  warmup text,
  main_set text,
  cooldown text,
  duration_min_est numeric check (duration_min_est > 0),
  distance_km_est numeric check (distance_km_est > 0),
  intensity text,
  technical_notes text,
  strength_after boolean,
  is_quality boolean,
  minutes_by_intensity jsonb,
  primary key (content_version, plan_id, week, day_index),
  foreign key (content_version, plan_id, week) references public.library_weeks (content_version, plan_id, week) on delete cascade,
  constraint library_days_shape check (
    case when is_rest then
      code is null and category is null and duration_min_est is null and distance_km_est is null and is_quality is null
    else
      not strength_only and code is not null and session_type is not null and category is not null
      and short_label is not null and physiological_goal is not null and warmup is not null and main_set is not null
      and cooldown is not null and duration_min_est is not null and distance_km_est is not null and intensity is not null
      and technical_notes is not null and strength_after is not null and is_quality is not null and minutes_by_intensity is not null
    end
  )
);

-- El contenido de una versión no se modifica: para cambiarlo se importa una content_version nueva.
-- Lo único editable es qué versión es la vigente (is_current).
create or replace function public.guard_library_immutable()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_table_name = 'library_versions'
     and (to_jsonb(new) - 'is_current') = (to_jsonb(old) - 'is_current') then
    return new;
  end if;
  raise exception 'El contenido de la biblioteca es inmutable: importá una content_version nueva'
    using errcode = '42501';
end;
$$;

create trigger library_versions_immutable before update on public.library_versions
for each row execute function public.guard_library_immutable();
create trigger library_intensities_immutable before update on public.library_intensities
for each row execute function public.guard_library_immutable();
create trigger library_session_types_immutable before update on public.library_session_types
for each row execute function public.guard_library_immutable();
create trigger library_strength_exercises_immutable before update on public.library_strength_exercises
for each row execute function public.guard_library_immutable();
create trigger library_plans_immutable before update on public.library_plans
for each row execute function public.guard_library_immutable();
create trigger library_weeks_immutable before update on public.library_weeks
for each row execute function public.guard_library_immutable();
create trigger library_days_immutable before update on public.library_days
for each row execute function public.guard_library_immutable();

-- ===========================================================================
-- Configuración comercial (no se fija en el código)
-- ===========================================================================
create table public.library_settings (
  id boolean primary key default true check (id),
  free_preview_weeks smallint not null default 1 check (free_preview_weeks between 0 and 60),
  updated_at timestamptz not null default now()
);
comment on table public.library_settings is 'Semanas de cada plan visibles sin Premium. La ficha del plan siempre es pública.';
insert into public.library_settings (id, free_preview_weeks) values (true, 1);
create trigger library_settings_set_updated_at before update on public.library_settings
for each row execute function public.set_updated_at();

insert into public.app_features (key, label, requires_premium)
values ('plan_library', 'Biblioteca de planes (semanas completas)', true)
on conflict (key) do nothing;

-- ¿La semana p_week de los planes se puede ver? Semanas de muestra para todos; el resto según la función Premium.
create or replace function public.library_week_is_open(p_week smallint)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_week <= coalesce((select s.free_preview_weeks from public.library_settings s where s.id), 0)
      or public.can_use_feature('plan_library');
$$;

-- ===========================================================================
-- Estado del usuario
-- ===========================================================================

-- day_map[i + 1] = día de la semana (0 = lunes … 6 = domingo) en el que se hace el día i del plan.
create or replace function public.library_day_map_is_permutation(p_map smallint[])
returns boolean
language sql
immutable
set search_path = ''
as $$
  select cardinality(p_map) = 7
     and coalesce((select array_agg(x order by x) from unnest(p_map) as x), '{}') = array[0,1,2,3,4,5,6]::smallint[];
$$;

-- Problemas de un mapeo de días para un plan: sesiones exigentes en días consecutivos (también entre
-- el domingo y el lunes siguiente) o una competencia movida de su día. Vacío = válido.
create or replace function public.library_day_map_violations(p_version text, p_plan text, p_map smallint[])
returns text[]
language sql
stable
security definer
set search_path = ''
as $$
  with mapped as (
    select d.week, p_map[d.day_index + 1] as weekday, d.day_index, d.category,
           (not d.is_rest and (d.is_quality or d.category in ('thr', 'hard', 'race'))) as demanding
    from public.library_days d
    where d.content_version = p_version and d.plan_id = p_plan
  ), ordered as (
    select m.*, (m.week - 1) * 7 + m.weekday as pos,
           lag(m.demanding) over (order by (m.week - 1) * 7 + m.weekday) as prev_demanding
    from mapped m
  )
  select coalesce(array_agg(distinct v), '{}')
  from (
    select 'consecutive_demanding' as v from ordered o where o.demanding and o.prev_demanding
    union all
    select 'race_moved' from ordered o where o.category = 'race' and o.weekday <> o.day_index
  ) problems;
$$;

create table public.plan_enrollments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  content_version text not null,
  plan_id text not null,
  start_date date not null check (extract(isodow from start_date) = 1),
  race_date date not null check (extract(isodow from race_date) = 7),
  day_map smallint[] not null default array[0,1,2,3,4,5,6]::smallint[]
    check (public.library_day_map_is_permutation(day_map)),
  status text not null default 'active' check (status in ('active', 'paused', 'completed', 'cancelled')),
  paused_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (content_version, plan_id) references public.library_plans (content_version, id) on delete restrict,
  check (race_date > start_date)
);
comment on table public.plan_enrollments is 'Inscripción a un plan de la biblioteca. Conserva la content_version con la que se inscribió.';
-- "Semana actual" y "sesión de hoy": una inscripción vigente por persona.
create unique index plan_enrollments_one_open on public.plan_enrollments (user_id) where status in ('active', 'paused');
create index plan_enrollments_user_idx on public.plan_enrollments (user_id, created_at desc);
create trigger plan_enrollments_set_updated_at before update on public.plan_enrollments
for each row execute function public.set_updated_at();

-- Integridad de la inscripción: plan/versión/titular inmutables, fecha de competencia coherente con la
-- semana RACE y mapeo de días que respete la regla de días exigentes.
create or replace function public.guard_plan_enrollment()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_race_week smallint;
  v_problems text[];
begin
  if tg_op = 'UPDATE' and (new.user_id <> old.user_id or new.content_version <> old.content_version
     or new.plan_id <> old.plan_id or new.start_date <> old.start_date or new.race_date <> old.race_date) then
    raise exception 'No se puede cambiar el plan, la versión ni las fechas de una inscripción' using errcode = '42501';
  end if;
  if tg_op = 'INSERT' then
    select p.race_week into v_race_week from public.library_plans p
     where p.content_version = new.content_version and p.id = new.plan_id;
    if new.race_date <> new.start_date + ((v_race_week - 1) * 7 + 6) then
      raise exception 'La fecha de competencia no coincide con la semana de carrera del plan' using errcode = '23514';
    end if;
    if new.status <> 'active' then
      raise exception 'Una inscripción nueva empieza activa' using errcode = '23514';
    end if;
  end if;
  if tg_op = 'INSERT' or new.day_map is distinct from old.day_map then
    v_problems := public.library_day_map_violations(new.content_version, new.plan_id, new.day_map);
    if cardinality(v_problems) > 0 then
      raise exception 'Mapeo de días inválido: %', array_to_string(v_problems, ', ') using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

create trigger plan_enrollments_guard before insert or update on public.plan_enrollments
for each row execute function public.guard_plan_enrollment();

create table public.weekly_checkins (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references public.plan_enrollments (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  week_start date not null check (extract(isodow from week_start) = 1),
  plan_week smallint not null check (plan_week between 1 and 60),
  criterion_met boolean,
  recommendation text not null check (recommendation in ('advance', 'repeat', 'reduce', 'regress', 'pause')),
  rule_ids text[] not null default '{}',
  decision text not null check (decision in ('advance', 'repeat', 'reduce', 'regress', 'pause', 'resume')),
  next_week_start date check (extract(isodow from next_week_start) = 1),
  next_plan_week smallint check (next_plan_week between 1 and 60),
  created_at timestamptz not null default now(),
  unique (enrollment_id, week_start),
  check ((decision = 'pause') = (next_plan_week is null)),
  check ((decision = 'pause') or next_week_start is not null),
  check (next_week_start is null or next_week_start > week_start or decision = 'resume')
);
comment on table public.weekly_checkins is 'Respuesta al criterio de progresión, lo que recomendó el motor de reglas y lo que decidió la persona.';
create index weekly_checkins_enrollment_idx on public.weekly_checkins (enrollment_id, week_start);

-- Registro post-sesión: columnas opcionales en workout_logs (los registros existentes no cambian).
alter table public.workout_logs
  add column enrollment_id uuid references public.plan_enrollments (id) on delete set null,
  add column plan_week smallint check (plan_week between 1 and 60),
  add column plan_day_index smallint check (plan_day_index between 0 and 6),
  add column pain_score smallint check (pain_score between 0 and 10),
  add column red_flags text[] not null default '{}'
    check (red_flags <@ array['limp', 'bone_pain', 'swelling', 'night_pain']::text[]),
  add column sleep_quality text check (sleep_quality in ('good', 'fair', 'poor')),
  add constraint workout_logs_plan_ref check ((plan_week is null) = (plan_day_index is null));
comment on column public.workout_logs.pain_score is 'Dato de salud (sensible): dolor 0–10. Nunca se escribe en logs.';
comment on column public.workout_logs.red_flags is 'Dato de salud (sensible): señales de alarma (cojera, dolor óseo, hinchazón, dolor nocturno).';
comment on column public.workout_logs.sleep_quality is 'Dato de salud (sensible): calidad del sueño de la noche anterior.';
-- "Semana actual del usuario": registros de una inscripción por fecha.
create index workout_logs_enrollment_idx on public.workout_logs (enrollment_id, workout_date) where enrollment_id is not null;
create unique index workout_logs_one_per_plan_day on public.workout_logs (enrollment_id, workout_date) where enrollment_id is not null;

-- ===========================================================================
-- RLS
-- ===========================================================================
alter table public.library_versions enable row level security;
alter table public.library_intensities enable row level security;
alter table public.library_session_types enable row level security;
alter table public.library_strength_exercises enable row level security;
alter table public.library_plans enable row level security;
alter table public.library_weeks enable row level security;
alter table public.library_days enable row level security;
alter table public.library_settings enable row level security;
alter table public.plan_enrollments enable row level security;
alter table public.weekly_checkins enable row level security;

-- Catálogo: público y de solo lectura (lo escribe únicamente el importador con la conexión de servicio).
create policy library_versions_read on public.library_versions for select to anon, authenticated using (true);
create policy library_intensities_read on public.library_intensities for select to anon, authenticated using (true);
create policy library_session_types_read on public.library_session_types for select to anon, authenticated using (true);
create policy library_strength_read on public.library_strength_exercises for select to anon, authenticated using (true);
create policy library_plans_read on public.library_plans for select to anon, authenticated using (true);
create policy library_weeks_read on public.library_weeks for select to anon, authenticated using (true);
-- El detalle día por día: semanas de muestra para todos; el resto según la función Premium.
create policy library_days_read on public.library_days for select to anon, authenticated
  using (public.library_week_is_open(week));

create policy library_settings_read on public.library_settings for select to anon, authenticated using (true);
create policy library_settings_admin_write on public.library_settings for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy enrollments_select on public.plan_enrollments for select to authenticated
  using (user_id = (select auth.uid()) or public.is_staff());
create policy enrollments_insert_own on public.plan_enrollments for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy enrollments_update_own on public.plan_enrollments for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy enrollments_delete_own on public.plan_enrollments for delete to authenticated
  using (user_id = (select auth.uid()));

create policy checkins_select on public.weekly_checkins for select to authenticated
  using (user_id = (select auth.uid()) or public.is_staff());
create policy checkins_insert_own on public.weekly_checkins for insert to authenticated
  with check (user_id = (select auth.uid()) and exists (
    select 1 from public.plan_enrollments e
    where e.id = weekly_checkins.enrollment_id and e.user_id = (select auth.uid())));
create policy checkins_delete_own on public.weekly_checkins for delete to authenticated
  using (user_id = (select auth.uid()));

-- Registros: además de ser el titular, la inscripción referenciada tiene que ser propia.
drop policy workouts_insert_own on public.workout_logs;
create policy workouts_insert_own on public.workout_logs for insert to authenticated
  with check (user_id = (select auth.uid()) and (enrollment_id is null or exists (
    select 1 from public.plan_enrollments e where e.id = workout_logs.enrollment_id and e.user_id = (select auth.uid()))));
drop policy workouts_update_own on public.workout_logs;
create policy workouts_update_own on public.workout_logs for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and (enrollment_id is null or exists (
    select 1 from public.plan_enrollments e where e.id = workout_logs.enrollment_id and e.user_id = (select auth.uid()))));
