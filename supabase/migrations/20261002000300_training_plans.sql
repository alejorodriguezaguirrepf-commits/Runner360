-- RUNNER 360 — Planes de entrenamiento versionados, inscripciones y calendario individual.
-- Una versión publicada o archivada es inmutable: los cambios se hacen clonando una nueva versión.

create type public.plan_version_status as enum ('draft', 'in_review', 'published', 'archived');
create type public.session_type as enum ('easy_run', 'long_run', 'intervals', 'tempo', 'recovery', 'rest', 'strength', 'test');
create type public.intensity_level as enum ('very_low', 'low', 'moderate', 'high', 'very_high');
create type public.user_plan_status as enum ('active', 'completed', 'cancelled');
create type public.calendar_status as enum ('pending', 'completed', 'modified', 'skipped');

-- ---------------------------------------------------------------------------
-- Catálogo
-- ---------------------------------------------------------------------------
create table public.training_plans (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]{3,80}$'),
  distance public.distance_code not null,
  level public.runner_level not null,
  name text not null check (char_length(name) between 1 and 120),
  description text not null default '',
  is_premium boolean not null default true,
  archived_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index training_plans_distance_level_idx on public.training_plans (distance, level);
create trigger training_plans_set_updated_at before update on public.training_plans
for each row execute function public.set_updated_at();

create table public.training_plan_versions (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.training_plans (id) on delete restrict,
  version_number integer not null check (version_number >= 1),
  status public.plan_version_status not null default 'draft',
  is_demo boolean not null default false,
  name text not null check (char_length(name) between 1 and 120),
  objective text not null default '',
  duration_weeks smallint not null check (duration_weeks between 1 and 24),
  sessions_per_week smallint not null check (sessions_per_week between 1 and 7),
  entry_requirements jsonb not null default '{}'::jsonb,
  progression_rules jsonb not null default '{}'::jsonb,
  start_week_rules jsonb not null default '[]'::jsonb,
  change_notes text not null default '',
  validated_by uuid references public.profiles (id) on delete set null,
  validated_at timestamptz,
  validation_notes text not null default '',
  published_by uuid references public.profiles (id) on delete set null,
  published_at timestamptz,
  archived_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint plan_versions_number_unique unique (plan_id, version_number),
  constraint plan_versions_validation_pair check ((validated_by is null) = (validated_at is null))
);
create unique index plan_versions_one_published on public.training_plan_versions (plan_id) where status = 'published';
create index plan_versions_status_idx on public.training_plan_versions (status);
create trigger training_plan_versions_set_updated_at before update on public.training_plan_versions
for each row execute function public.set_updated_at();

create table public.training_plan_weeks (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references public.training_plan_versions (id) on delete cascade,
  week_number smallint not null check (week_number between 1 and 24),
  focus text not null default '',
  notes text not null default '',
  constraint plan_weeks_unique unique (version_id, week_number)
);

create table public.training_sessions (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references public.training_plan_versions (id) on delete cascade,
  week_id uuid not null references public.training_plan_weeks (id) on delete cascade,
  week_number smallint not null check (week_number between 1 and 24),
  session_number smallint not null check (session_number between 1 and 7),
  session_type public.session_type not null,
  title text not null check (char_length(title) between 1 and 120),
  objective text not null default '',
  distance_m integer check (distance_m > 0 and distance_m <= 100000),
  duration_s integer check (duration_s > 0 and duration_s <= 21600),
  intensity public.intensity_level not null,
  rpe_min smallint check (rpe_min between 1 and 10),
  rpe_max smallint check (rpe_max between 1 and 10),
  warmup text not null default '',
  main_set text not null default '',
  cooldown text not null default '',
  notes text not null default '',
  progression_criteria text not null default '',
  stop_criteria text not null default '',
  constraint sessions_unique unique (version_id, week_number, session_number),
  constraint sessions_volume check (session_type = 'rest' or distance_m is not null or duration_s is not null),
  constraint sessions_rpe_order check (rpe_min is null or rpe_max is null or rpe_min <= rpe_max)
);
create index training_sessions_week_idx on public.training_sessions (week_id);

create table public.training_session_exercises (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.training_sessions (id) on delete cascade,
  position smallint not null check (position >= 1),
  name text not null check (char_length(name) between 1 and 120),
  sets smallint check (sets between 1 and 20),
  reps smallint check (reps between 1 and 200),
  duration_s integer check (duration_s between 1 and 3600),
  rest_s integer check (rest_s between 0 and 1800),
  notes text not null default '',
  constraint exercises_position_unique unique (session_id, position)
);

create table public.training_plan_schedule_variants (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references public.training_plan_versions (id) on delete cascade,
  code text not null check (char_length(code) between 1 and 40),
  label text not null check (char_length(label) between 1 and 120),
  weekdays smallint[] not null
    check (cardinality(weekdays) between 1 and 7 and weekdays <@ array[1,2,3,4,5,6,7]::smallint[]),
  priority smallint not null default 0,
  constraint variants_code_unique unique (version_id, code)
);
comment on table public.training_plan_schedule_variants is 'Distribuciones semanales aprobadas: weekdays[i] es el día ISO de la sesión i+1.';

-- ---------------------------------------------------------------------------
-- Inscripciones y calendario individual
-- ---------------------------------------------------------------------------
create table public.user_training_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  plan_version_id uuid not null references public.training_plan_versions (id) on delete restrict,
  variant_id uuid not null references public.training_plan_schedule_variants (id) on delete restrict,
  start_date date not null check (extract(isodow from start_date) = 1),
  start_week smallint not null check (start_week >= 1),
  race_date date,
  status public.user_plan_status not null default 'active',
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index user_training_plans_one_active on public.user_training_plans (user_id) where status = 'active';
create index user_training_plans_version_idx on public.user_training_plans (plan_version_id);
create trigger user_training_plans_set_updated_at before update on public.user_training_plans
for each row execute function public.set_updated_at();

create table public.user_training_calendar (
  id uuid primary key default gen_random_uuid(),
  user_plan_id uuid not null references public.user_training_plans (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  session_id uuid not null references public.training_sessions (id) on delete restrict,
  week_number smallint not null,
  session_number smallint not null,
  scheduled_date date not null,
  status public.calendar_status not null default 'pending',
  updated_at timestamptz not null default now(),
  constraint calendar_unique unique (user_plan_id, week_number, session_number)
);
create index user_training_calendar_user_date_idx on public.user_training_calendar (user_id, scheduled_date);
create trigger user_training_calendar_set_updated_at before update on public.user_training_calendar
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Funciones de acceso
-- ---------------------------------------------------------------------------
create or replace function public.can_read_plan_content(p_version uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_staff()
    or exists (
      select 1
      from public.training_plan_versions v
      join public.training_plans p on p.id = v.plan_id
      where v.id = p_version
        and v.status = 'published'
        and (not p.is_premium or public.has_premium((select auth.uid())))
    )
    or exists (
      select 1 from public.user_training_plans up
      where up.plan_version_id = p_version and up.user_id = (select auth.uid())
    );
$$;

-- ---------------------------------------------------------------------------
-- Inmutabilidad y ciclo de vida
-- ---------------------------------------------------------------------------
create or replace function public.guard_plan_child()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_version uuid;
  v_status public.plan_version_status;
begin
  if tg_table_name = 'training_session_exercises' then
    select s.version_id into v_version from public.training_sessions s
    where s.id = coalesce(new.session_id, old.session_id);
  else
    v_version := coalesce(new.version_id, old.version_id);
  end if;
  select v.status into v_status from public.training_plan_versions v where v.id = v_version;
  -- v_status nulo: la versión se está borrando en cascada (solo posible en borradores).
  if v_status is not null and v_status <> 'draft' then
    raise exception 'La versión del plan no es editable (estado: %). Creá una nueva versión.', v_status
      using errcode = '55000';
  end if;
  return coalesce(new, old);
end;
$$;

create trigger guard_weeks before insert or update or delete on public.training_plan_weeks
for each row execute function public.guard_plan_child();
create trigger guard_sessions before insert or update or delete on public.training_sessions
for each row execute function public.guard_plan_child();
create trigger guard_exercises before insert or update or delete on public.training_session_exercises
for each row execute function public.guard_plan_child();
create trigger guard_variants before insert or update or delete on public.training_plan_schedule_variants
for each row execute function public.guard_plan_child();

create or replace function public.guard_plan_version()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_weeks integer;
  v_sessions integer;
  v_incomplete integer;
  v_variants integer;
  v_validator_ok boolean;
begin
  if tg_op = 'DELETE' then
    if old.status <> 'draft' then
      raise exception 'Solo se pueden eliminar versiones en borrador' using errcode = '55000';
    end if;
    return old;
  end if;

  if tg_op = 'INSERT' then
    if new.status not in ('draft') and (select auth.uid()) is not null then
      raise exception 'Las versiones nuevas se crean como borrador' using errcode = '55000';
    end if;
    return new;
  end if;

  -- UPDATE
  if old.status in ('published', 'archived') then
    if (to_jsonb(new) - array['status', 'archived_at', 'updated_at'])
       <> (to_jsonb(old) - array['status', 'archived_at', 'updated_at']) then
      raise exception 'Una versión publicada o archivada es inmutable. Creá una nueva versión.' using errcode = '55000';
    end if;
  end if;

  if new.status is distinct from old.status then
    if not (
      (old.status = 'draft' and new.status = 'in_review') or
      (old.status = 'in_review' and new.status in ('draft', 'published')) or
      (old.status = 'published' and new.status = 'archived')
    ) then
      raise exception 'Transición de estado no permitida: % -> %', old.status, new.status using errcode = '55000';
    end if;

    if new.status = 'draft' then
      new.validated_by := null;
      new.validated_at := null;
    end if;

    if new.status = 'archived' then
      new.archived_at := now();
    end if;

    if new.status = 'published' then
      if (select auth.uid()) is not null and not public.is_admin() then
        raise exception 'Solo un administrador puede publicar planes' using errcode = '42501';
      end if;
      if not new.is_demo then
        select coalesce(p.can_validate_plans, false) into v_validator_ok
        from public.profiles p where p.id = new.validated_by;
        if new.validated_by is null or not coalesce(v_validator_ok, false) then
          raise exception 'Falta la validación profesional registrada' using errcode = '55000';
        end if;
      end if;
      if new.duration_weeks < 8 or new.duration_weeks > 24 then
        raise exception 'La duración debe estar entre 8 y 24 semanas' using errcode = '55000';
      end if;
      select count(*) into v_weeks from public.training_plan_weeks w where w.version_id = new.id;
      select count(*) into v_sessions from public.training_sessions s where s.version_id = new.id;
      select count(*) into v_incomplete from public.training_sessions s
        where s.version_id = new.id and s.session_type <> 'rest'
          and (btrim(s.main_set) = '' or btrim(s.stop_criteria) = '');
      select count(*) into v_variants from public.training_plan_schedule_variants sv
        where sv.version_id = new.id and cardinality(sv.weekdays) = new.sessions_per_week;
      if v_weeks <> new.duration_weeks
         or v_sessions <> new.duration_weeks * new.sessions_per_week
         or v_incomplete > 0
         or v_variants = 0 then
        raise exception 'La versión no cumple los criterios mínimos de publicación (semanas %, sesiones %, incompletas %, variantes %)',
          v_weeks, v_sessions, v_incomplete, v_variants using errcode = '55000';
      end if;
      new.published_at := now();
      new.published_by := (select auth.uid());
    end if;
  end if;
  return new;
end;
$$;

create trigger guard_plan_versions before insert or update or delete on public.training_plan_versions
for each row execute function public.guard_plan_version();

create or replace function public.audit_plan_version_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status is distinct from old.status then
    perform public.write_audit_log('plan_version.' || new.status::text, 'training_plan_version', new.id::text,
      jsonb_build_object('from', old.status, 'to', new.status, 'version_number', new.version_number));
  end if;
  return new;
end;
$$;
create trigger audit_plan_versions after update on public.training_plan_versions
for each row execute function public.audit_plan_version_status();

-- Firma de validación profesional (admin o entrenador habilitado). Solo en revisión.
create or replace function public.sign_off_plan_version(p_version uuid, p_notes text default '')
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if not exists (select 1 from public.profiles where id = v_uid and can_validate_plans and role in ('admin', 'coach')) then
    raise exception 'No tenés permiso para validar planes' using errcode = '42501';
  end if;
  update public.training_plan_versions
     set validated_by = v_uid, validated_at = now(), validation_notes = coalesce(p_notes, '')
   where id = p_version and status = 'in_review';
  if not found then
    raise exception 'La versión debe estar en revisión para validarse' using errcode = '55000';
  end if;
  perform public.write_audit_log('plan_version.signed_off', 'training_plan_version', p_version::text, '{}'::jsonb);
end;
$$;

-- Publica una versión y archiva la publicada anterior del mismo plan, en una transacción.
create or replace function public.publish_plan_version(p_version uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_plan uuid;
begin
  if not public.is_admin() then
    raise exception 'Solo un administrador puede publicar planes' using errcode = '42501';
  end if;
  select plan_id into v_plan from public.training_plan_versions where id = p_version and status = 'in_review';
  if v_plan is null then
    raise exception 'Solo se publican versiones en revisión' using errcode = '55000';
  end if;
  update public.training_plan_versions set status = 'archived'
   where plan_id = v_plan and status = 'published';
  update public.training_plan_versions set status = 'published' where id = p_version;
end;
$$;

-- Crea un nuevo borrador copiando por completo una versión existente.
create or replace function public.clone_plan_version(p_version uuid, p_change_notes text default '')
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_new uuid;
  v_src public.training_plan_versions%rowtype;
begin
  if not public.is_admin() then
    raise exception 'Solo un administrador puede crear versiones' using errcode = '42501';
  end if;
  select * into v_src from public.training_plan_versions where id = p_version;
  if not found then raise exception 'Versión inexistente' using errcode = 'P0002'; end if;

  insert into public.training_plan_versions (
    plan_id, version_number, status, is_demo, name, objective, duration_weeks, sessions_per_week,
    entry_requirements, progression_rules, start_week_rules, change_notes, created_by)
  select v_src.plan_id, max(version_number) + 1, 'draft', v_src.is_demo, v_src.name, v_src.objective,
         v_src.duration_weeks, v_src.sessions_per_week, v_src.entry_requirements, v_src.progression_rules,
         v_src.start_week_rules, coalesce(p_change_notes, ''), (select auth.uid())
  from public.training_plan_versions where plan_id = v_src.plan_id
  returning id into v_new;

  insert into public.training_plan_weeks (version_id, week_number, focus, notes)
  select v_new, week_number, focus, notes from public.training_plan_weeks where version_id = p_version;

  insert into public.training_sessions (
    version_id, week_id, week_number, session_number, session_type, title, objective, distance_m, duration_s,
    intensity, rpe_min, rpe_max, warmup, main_set, cooldown, notes, progression_criteria, stop_criteria)
  select v_new, nw.id, s.week_number, s.session_number, s.session_type, s.title, s.objective, s.distance_m,
         s.duration_s, s.intensity, s.rpe_min, s.rpe_max, s.warmup, s.main_set, s.cooldown, s.notes,
         s.progression_criteria, s.stop_criteria
  from public.training_sessions s
  join public.training_plan_weeks nw on nw.version_id = v_new and nw.week_number = s.week_number
  where s.version_id = p_version;

  insert into public.training_session_exercises (session_id, position, name, sets, reps, duration_s, rest_s, notes)
  select ns.id, e.position, e.name, e.sets, e.reps, e.duration_s, e.rest_s, e.notes
  from public.training_session_exercises e
  join public.training_sessions os on os.id = e.session_id and os.version_id = p_version
  join public.training_sessions ns on ns.version_id = v_new
       and ns.week_number = os.week_number and ns.session_number = os.session_number;

  insert into public.training_plan_schedule_variants (version_id, code, label, weekdays, priority)
  select v_new, code, label, weekdays, priority from public.training_plan_schedule_variants where version_id = p_version;

  perform public.write_audit_log('plan_version.cloned', 'training_plan_version', v_new::text,
    jsonb_build_object('source', p_version));
  return v_new;
end;
$$;

revoke execute on function public.sign_off_plan_version(uuid, text) from public, anon;
revoke execute on function public.publish_plan_version(uuid) from public, anon;
revoke execute on function public.clone_plan_version(uuid, text) from public, anon;

-- Integridad de inscripciones y calendario.
create or replace function public.guard_user_plan()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if not exists (select 1 from public.training_plan_versions v where v.id = new.plan_version_id and v.status = 'published') then
      raise exception 'Solo podés inscribirte en planes publicados' using errcode = '55000';
    end if;
    if not exists (select 1 from public.training_plan_schedule_variants sv
                   where sv.id = new.variant_id and sv.version_id = new.plan_version_id) then
      raise exception 'La variante no pertenece a la versión del plan' using errcode = '55000';
    end if;
    return new;
  end if;
  -- UPDATE por el titular: solo puede cambiar el estado.
  if (select auth.uid()) is not null and not public.is_admin() then
    if (to_jsonb(new) - array['status', 'ended_at', 'updated_at']) <> (to_jsonb(old) - array['status', 'ended_at', 'updated_at']) then
      raise exception 'Solo se puede modificar el estado de la inscripción' using errcode = '42501';
    end if;
    if old.status <> 'active' then
      raise exception 'La inscripción ya está cerrada' using errcode = '55000';
    end if;
  end if;
  if new.status <> 'active' and old.status = 'active' then
    new.ended_at := now();
  end if;
  return new;
end;
$$;
create trigger guard_user_training_plans before insert or update on public.user_training_plans
for each row execute function public.guard_user_plan();

create or replace function public.guard_calendar_entry()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if not exists (
      select 1 from public.user_training_plans up
      join public.training_sessions s on s.version_id = up.plan_version_id
      where up.id = new.user_plan_id and up.user_id = new.user_id
        and s.id = new.session_id and s.week_number = new.week_number and s.session_number = new.session_number
    ) then
      raise exception 'La sesión no corresponde a la inscripción' using errcode = '55000';
    end if;
    return new;
  end if;
  if (select auth.uid()) is not null and not public.is_admin() then
    if (to_jsonb(new) - array['status', 'updated_at']) <> (to_jsonb(old) - array['status', 'updated_at']) then
      raise exception 'Solo se puede modificar el estado de la sesión del calendario' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;
create trigger guard_user_training_calendar before insert or update on public.user_training_calendar
for each row execute function public.guard_calendar_entry();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.training_plans enable row level security;
alter table public.training_plan_versions enable row level security;
alter table public.training_plan_weeks enable row level security;
alter table public.training_sessions enable row level security;
alter table public.training_session_exercises enable row level security;
alter table public.training_plan_schedule_variants enable row level security;
alter table public.user_training_plans enable row level security;
alter table public.user_training_calendar enable row level security;

-- Catálogo: metadatos visibles para usuarios autenticados cuando hay una versión publicada.
create policy plans_read on public.training_plans for select to authenticated
  using (public.is_staff() or exists (
    select 1 from public.training_plan_versions v where v.plan_id = training_plans.id and v.status = 'published'));
create policy plans_admin_write on public.training_plans for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy versions_read on public.training_plan_versions for select to authenticated
  using (status = 'published' or public.is_staff() or exists (
    select 1 from public.user_training_plans up
    where up.plan_version_id = training_plan_versions.id and up.user_id = (select auth.uid())));
create policy versions_admin_write on public.training_plan_versions for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Contenido: requiere acceso (plan gratuito, Premium vigente o inscripción previa).
create policy weeks_read on public.training_plan_weeks for select to authenticated
  using (public.can_read_plan_content(version_id));
create policy weeks_admin_write on public.training_plan_weeks for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy sessions_read on public.training_sessions for select to authenticated
  using (public.can_read_plan_content(version_id));
create policy sessions_admin_write on public.training_sessions for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy exercises_read on public.training_session_exercises for select to authenticated
  using (exists (select 1 from public.training_sessions s where s.id = training_session_exercises.session_id and public.can_read_plan_content(s.version_id)));
create policy exercises_admin_write on public.training_session_exercises for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy variants_read on public.training_plan_schedule_variants for select to authenticated
  using (public.can_read_plan_content(version_id));
create policy variants_admin_write on public.training_plan_schedule_variants for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy user_plans_select on public.user_training_plans for select to authenticated
  using (user_id = (select auth.uid()) or public.is_staff());
create policy user_plans_insert_own on public.user_training_plans for insert to authenticated
  with check (user_id = (select auth.uid()) and public.can_read_plan_content(plan_version_id));
create policy user_plans_update_own on public.user_training_plans for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy calendar_select on public.user_training_calendar for select to authenticated
  using (user_id = (select auth.uid()) or public.is_staff());
create policy calendar_insert_own on public.user_training_calendar for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy calendar_update_own on public.user_training_calendar for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
