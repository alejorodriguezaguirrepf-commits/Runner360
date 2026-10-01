-- RUNNER 360 · Migración 3: planes de entrenamiento versionados.
-- Reglas clave:
-- * Solo las versiones en "draft" pueden editarse (contenido, semanas, sesiones, ejercicios).
-- * Una versión publicada es inmutable: solo puede archivarse. Los usuarios que la tienen asignada
--   conservan su calendario e historial aunque exista una versión nueva.
-- * Publicar exige: plan DEMO marcado como no validado, o validación profesional registrada.

create table public.training_plans (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  kind public.plan_kind not null default 'standard',
  target_distance public.race_distance not null,
  level public.runner_level not null,
  is_demo boolean not null default false,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index training_plans_combo_idx on public.training_plans (target_distance, level, kind);
create trigger training_plans_updated_at before update on public.training_plans
  for each row execute function public.set_updated_at();

create table public.training_plan_versions (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.training_plans (id) on delete restrict,
  version int not null check (version >= 1),
  name text not null check (char_length(name) between 3 and 120),
  status public.plan_status not null default 'draft',
  validation_status public.validation_status not null default 'pending_review',
  duration_weeks int not null check (duration_weeks between 1 and 52),
  sessions_per_week int not null check (sessions_per_week between 1 and 7),
  objective text not null default '',
  entry_requirements jsonb not null default '{}'::jsonb,
  progression_criteria text not null default '',
  reduce_or_stop_criteria text not null default '',
  progression_rules jsonb not null default '{}'::jsonb,
  schedule_variants jsonb not null default '[]'::jsonb check (jsonb_typeof(schedule_variants) = 'array'),
  requires_premium boolean not null default true,
  reviewer_notes text,
  validated_by uuid references auth.users (id) on delete set null,
  approved_at timestamptz,
  published_by uuid references auth.users (id) on delete set null,
  published_at timestamptz,
  archived_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (plan_id, version)
);
create index training_plan_versions_status_idx on public.training_plan_versions (status);
create trigger training_plan_versions_updated_at before update on public.training_plan_versions
  for each row execute function public.set_updated_at();

create table public.training_plan_weeks (
  id uuid primary key default gen_random_uuid(),
  plan_version_id uuid not null references public.training_plan_versions (id) on delete cascade,
  week_number int not null check (week_number between 1 and 52),
  focus text not null default '',
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (plan_version_id, week_number)
);
create trigger training_plan_weeks_updated_at before update on public.training_plan_weeks
  for each row execute function public.set_updated_at();

create table public.training_sessions (
  id uuid primary key default gen_random_uuid(),
  week_id uuid not null references public.training_plan_weeks (id) on delete cascade,
  plan_version_id uuid not null references public.training_plan_versions (id) on delete cascade,
  session_number int not null check (session_number between 1 and 14),
  day_slot int not null check (day_slot between 1 and 7),
  session_type public.session_type not null,
  title text not null check (char_length(title) between 1 and 120),
  objective text not null default '',
  distance_m int check (distance_m > 0 and distance_m <= 100000),
  duration_s int check (duration_s > 0 and duration_s <= 36000),
  intensity public.intensity_level not null,
  rpe_min smallint check (rpe_min between 1 and 10),
  rpe_max smallint check (rpe_max between 1 and 10),
  warmup text not null default '',
  main_set text not null default '',
  cooldown text not null default '',
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (week_id, session_number),
  unique (week_id, day_slot),
  check (rpe_min is null or rpe_max is null or rpe_min <= rpe_max),
  check (session_type = 'rest' or distance_m is not null or duration_s is not null)
);
create index training_sessions_version_idx on public.training_sessions (plan_version_id);
create trigger training_sessions_updated_at before update on public.training_sessions
  for each row execute function public.set_updated_at();

create table public.training_session_exercises (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.training_sessions (id) on delete cascade,
  sort_order int not null check (sort_order >= 1),
  name text not null check (char_length(name) between 1 and 120),
  sets smallint check (sets between 1 and 50),
  reps smallint check (reps between 1 and 500),
  duration_s int check (duration_s between 1 and 36000),
  distance_m int check (distance_m between 1 and 100000),
  rest_s int check (rest_s between 0 and 3600),
  notes text,
  unique (session_id, sort_order)
);

-- ---------- Integridad de versiones ----------
create or replace function public.enforce_plan_version_rules()
returns trigger language plpgsql set search_path = '' as $$
declare
  v_allowed boolean;
begin
  if tg_op = 'DELETE' then
    if old.status <> 'draft' then
      raise exception 'Solo se pueden eliminar versiones en borrador' using errcode = '42501';
    end if;
    return old;
  end if;

  if tg_op = 'INSERT' then
    if new.status <> 'draft' then
      raise exception 'Las versiones nuevas se crean en borrador' using errcode = '42501';
    end if;
    if new.validation_status = 'validated' then
      raise exception 'Una versión nueva no puede nacer validada' using errcode = '42501';
    end if;
    return new;
  end if;

  -- UPDATE: el contenido solo cambia en borrador.
  if old.status <> 'draft' and (
       new.name, new.duration_weeks, new.sessions_per_week, new.objective, new.entry_requirements,
       new.progression_criteria, new.reduce_or_stop_criteria, new.progression_rules, new.schedule_variants,
       new.requires_premium, new.plan_id, new.version
     ) is distinct from (
       old.name, old.duration_weeks, old.sessions_per_week, old.objective, old.entry_requirements,
       old.progression_criteria, old.reduce_or_stop_criteria, old.progression_rules, old.schedule_variants,
       old.requires_premium, old.plan_id, old.version
     ) then
    raise exception 'La versión no está en borrador: creá una nueva versión para modificarla' using errcode = '42501';
  end if;

  if new.status is distinct from old.status then
    v_allowed := case old.status
      when 'draft' then new.status = 'in_review'
      when 'in_review' then new.status in ('draft', 'approved')
      when 'approved' then new.status in ('draft', 'published')
      when 'published' then new.status = 'archived'
      else false end;
    if not v_allowed then
      raise exception 'Transición de estado no permitida: % → %', old.status, new.status using errcode = '42501';
    end if;

    if new.status = 'approved' then
      if not (public.is_staff() or public.is_privileged_context()) then
        raise exception 'Solo un entrenador o administrador puede aprobar' using errcode = '42501';
      end if;
      if new.validation_status = 'validated' then
        new.validated_by := coalesce(new.validated_by, (select auth.uid()));
        new.approved_at := coalesce(new.approved_at, now());
      end if;
    end if;

    if new.status = 'published' then
      if not (public.is_admin() or public.is_privileged_context()) then
        raise exception 'Solo un administrador puede publicar' using errcode = '42501';
      end if;
      if exists (select 1 from public.training_plans p where p.id = new.plan_id and p.is_demo) then
        if new.validation_status <> 'demo_unvalidated' then
          raise exception 'Un plan DEMO debe publicarse identificado como no validado' using errcode = '23514';
        end if;
      elsif new.validation_status <> 'validated' or new.approved_at is null then
        raise exception 'Falta la validación profesional para publicar' using errcode = '23514';
      end if;
      -- Cantidad de semanas y sesiones coherente con lo declarado.
      if (select count(*) from public.training_plan_weeks w where w.plan_version_id = new.id) <> new.duration_weeks then
        raise exception 'La cantidad de semanas cargadas no coincide con la duración' using errcode = '23514';
      end if;
      if exists (
        select 1 from public.training_plan_weeks w
        where w.plan_version_id = new.id
          and (select count(*) from public.training_sessions s where s.week_id = w.id) <> new.sessions_per_week
      ) then
        raise exception 'Hay semanas con una cantidad de sesiones distinta a la declarada' using errcode = '23514';
      end if;
      new.published_at := now();
      new.published_by := (select auth.uid());
    end if;

    if new.status = 'archived' then
      if not (public.is_admin() or public.is_privileged_context()) then
        raise exception 'Solo un administrador puede archivar' using errcode = '42501';
      end if;
      new.archived_at := now();
    end if;

    if new.status = 'draft' then
      -- Volver a borrador invalida la aprobación previa.
      new.approved_at := null;
      new.validated_by := null;
      if new.validation_status = 'validated' then new.validation_status := 'pending_review'; end if;
    end if;
  end if;

  if new.validation_status = 'validated' and old.validation_status <> 'validated' then
    if not (public.is_staff() or public.is_privileged_context()) then
      raise exception 'Solo un entrenador o administrador puede validar' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;

create trigger training_plan_versions_rules before insert or update or delete on public.training_plan_versions
  for each row execute function public.enforce_plan_version_rules();

create or replace function public.assert_version_is_draft(p_version_id uuid)
returns void language plpgsql set search_path = '' as $$
begin
  if not exists (select 1 from public.training_plan_versions v where v.id = p_version_id and v.status = 'draft') then
    raise exception 'La versión del plan no está en borrador' using errcode = '42501';
  end if;
end $$;

create or replace function public.enforce_week_draft()
returns trigger language plpgsql set search_path = '' as $$
begin
  -- Permitir el borrado en cascada al eliminar una versión en borrador.
  if tg_op = 'DELETE' then
    if exists (select 1 from public.training_plan_versions v where v.id = old.plan_version_id and v.status <> 'draft') then
      raise exception 'La versión del plan no está en borrador' using errcode = '42501';
    end if;
    return old;
  end if;
  perform public.assert_version_is_draft(new.plan_version_id);
  if tg_op = 'UPDATE' and new.plan_version_id <> old.plan_version_id then
    raise exception 'No se puede mover una semana entre versiones';
  end if;
  return new;
end $$;
create trigger training_plan_weeks_draft before insert or update or delete on public.training_plan_weeks
  for each row execute function public.enforce_week_draft();

create or replace function public.enforce_session_draft()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    if exists (select 1 from public.training_plan_versions v where v.id = old.plan_version_id and v.status <> 'draft') then
      raise exception 'La versión del plan no está en borrador' using errcode = '42501';
    end if;
    return old;
  end if;
  -- plan_version_id debe coincidir con la versión de la semana (desnormalizado para RLS e índices).
  select w.plan_version_id into new.plan_version_id from public.training_plan_weeks w where w.id = new.week_id;
  perform public.assert_version_is_draft(new.plan_version_id);
  return new;
end $$;
create trigger training_sessions_draft before insert or update or delete on public.training_sessions
  for each row execute function public.enforce_session_draft();

create or replace function public.enforce_exercise_draft()
returns trigger language plpgsql set search_path = '' as $$
declare v_version uuid;
begin
  select s.plan_version_id into v_version from public.training_sessions s
  where s.id = coalesce(new.session_id, old.session_id);
  if v_version is null then
    return coalesce(new, old); -- la sesión se está borrando en cascada
  end if;
  if exists (select 1 from public.training_plan_versions v where v.id = v_version and v.status <> 'draft') then
    raise exception 'La versión del plan no está en borrador' using errcode = '42501';
  end if;
  return coalesce(new, old);
end $$;
create trigger training_session_exercises_draft before insert or update or delete on public.training_session_exercises
  for each row execute function public.enforce_exercise_draft();

create trigger training_plan_versions_audit after insert or update on public.training_plan_versions
  for each row execute function public.audit_row_change();

-- ---------- RLS ----------
alter table public.training_plans enable row level security;
alter table public.training_plan_versions enable row level security;
alter table public.training_plan_weeks enable row level security;
alter table public.training_sessions enable row level security;
alter table public.training_session_exercises enable row level security;

-- Catálogo: cualquier usuario autenticado ve planes y versiones publicadas (metadatos).
create policy training_plans_read on public.training_plans for select to authenticated
  using ((select public.is_staff()) or exists (
    select 1 from public.training_plan_versions v where v.plan_id = training_plans.id and v.status = 'published'));
create policy training_plan_versions_read on public.training_plan_versions for select to authenticated
  using ((select public.is_staff()) or status = 'published');

-- Escritura: solo equipo profesional (entrenador o administrador). Los triggers aplican el resto de las reglas.
create policy training_plans_staff_write on public.training_plans for all to authenticated
  using ((select public.is_staff())) with check ((select public.is_staff()));
create policy training_plan_versions_staff_write on public.training_plan_versions for all to authenticated
  using ((select public.is_staff())) with check ((select public.is_staff()));
create policy training_plan_weeks_staff_write on public.training_plan_weeks for all to authenticated
  using ((select public.is_staff())) with check ((select public.is_staff()));
create policy training_sessions_staff_write on public.training_sessions for all to authenticated
  using ((select public.is_staff())) with check ((select public.is_staff()));
create policy training_session_exercises_staff_write on public.training_session_exercises for all to authenticated
  using ((select public.is_staff())) with check ((select public.is_staff()));

grant select, insert, update, delete on public.training_plans, public.training_plan_versions,
  public.training_plan_weeks, public.training_sessions, public.training_session_exercises to authenticated;
