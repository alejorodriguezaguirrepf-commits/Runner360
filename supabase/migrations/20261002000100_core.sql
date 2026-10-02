-- RUNNER 360 — Núcleo: tipos, utilidades, perfiles, roles, consentimientos y auditoría.
-- Convenciones: distancias en metros (integer), duraciones en segundos (integer),
-- dinero en unidades menores (bigint). Todas las tablas privadas con RLS habilitado.

-- ---------------------------------------------------------------------------
-- Tipos
-- ---------------------------------------------------------------------------
create type public.app_role as enum ('user', 'coach', 'admin');
create type public.distance_code as enum ('5K', '10K', '15K', '21K', '42K');
create type public.runner_level as enum ('beginner', 'intermediate', 'advanced');
create type public.running_experience as enum ('none', 'lt_6m', '6_12m', '1_3y', 'gt_3y');
create type public.training_goal as enum ('complete', 'improve', 'race');
create type public.consent_type as enum ('terms', 'privacy', 'health_data', 'location', 'marketing');
create type public.readiness_status as enum ('ok', 'introductory_phase', 'professional_review');

-- ---------------------------------------------------------------------------
-- Utilidades
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Perfiles
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text check (char_length(display_name) between 1 and 60),
  birth_date date check (birth_date > date '1900-01-01'),
  role public.app_role not null default 'user',
  can_validate_plans boolean not null default false,
  locale text not null default 'es-AR',
  timezone text not null default 'America/Argentina/Buenos_Aires',
  onboarding_completed_at timestamptz,
  deletion_requested_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.profiles is 'Datos básicos de cuenta. 1:1 con auth.users. El rol solo lo modifica un administrador.';

create index profiles_role_idx on public.profiles (role);

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

-- Helpers de autorización. SECURITY DEFINER para evitar recursión de RLS al consultar profiles.
create or replace function public.current_role_name()
returns public.app_role
language sql
stable
security definer
set search_path = ''
as $$
  select p.role from public.profiles p where p.id = (select auth.uid());
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin');
$$;

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role in ('admin', 'coach'));
$$;

-- Alta automática del perfil al registrarse.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    nullif(left(coalesce(new.raw_user_meta_data ->> 'display_name', ''), 60), '')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- Ningún usuario puede elevar su propio rol ni otorgarse permisos de validación.
create or replace function public.guard_profile_privileges()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (new.role is distinct from old.role or new.can_validate_plans is distinct from old.can_validate_plans) then
    -- Las llamadas con service_role (servidor) no tienen auth.uid().
    if (select auth.uid()) is not null and not public.is_admin() then
      raise exception 'No autorizado para modificar roles o permisos' using errcode = '42501';
    end if;
    if new.id = (select auth.uid()) and new.role <> 'admin' and old.role = 'admin' then
      raise exception 'Un administrador no puede quitarse su propio rol' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

create trigger profiles_guard_privileges
before update on public.profiles
for each row execute function public.guard_profile_privileges();

alter table public.profiles enable row level security;

create policy profiles_select_own_or_staff on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or public.is_staff());

create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create policy profiles_update_admin on public.profiles
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- Consentimientos (registro inmutable: se agregan filas, no se editan)
-- ---------------------------------------------------------------------------
create table public.user_consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  consent_type public.consent_type not null,
  document_version text not null check (char_length(document_version) between 1 and 40),
  granted boolean not null,
  created_at timestamptz not null default now()
);
comment on table public.user_consents is 'Historial de consentimientos otorgados/revocados. El último registro por tipo es el vigente.';
create index user_consents_user_type_idx on public.user_consents (user_id, consent_type, created_at desc);

alter table public.user_consents enable row level security;
create policy consents_select_own on public.user_consents
  for select to authenticated using (user_id = (select auth.uid()));
create policy consents_insert_own on public.user_consents
  for insert to authenticated with check (user_id = (select auth.uid()));

create or replace function public.has_consent(p_user uuid, p_type public.consent_type)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select c.granted from public.user_consents c
    where c.user_id = p_user and c.consent_type = p_type
    order by c.created_at desc limit 1
  ), false);
$$;

-- ---------------------------------------------------------------------------
-- Auditoría
-- ---------------------------------------------------------------------------
create table public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles (id) on delete set null,
  action text not null check (char_length(action) between 1 and 80),
  entity_type text not null check (char_length(entity_type) between 1 and 60),
  entity_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
comment on table public.audit_logs is 'Registro de acciones administrativas. Sin datos personales sensibles en metadata.';
create index audit_logs_created_idx on public.audit_logs (created_at desc);
create index audit_logs_entity_idx on public.audit_logs (entity_type, entity_id);

alter table public.audit_logs enable row level security;
create policy audit_select_admin on public.audit_logs
  for select to authenticated using (public.is_admin());
-- Sin políticas de insert/update/delete: solo se escribe mediante write_audit_log().

create or replace function public.write_audit_log(
  p_action text, p_entity_type text, p_entity_id text, p_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values ((select auth.uid()), p_action, p_entity_type, p_entity_id, coalesce(p_metadata, '{}'::jsonb));
end;
$$;
revoke execute on function public.write_audit_log(text, text, text, jsonb) from public, anon;

create or replace function public.audit_profile_privileges()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.role is distinct from old.role or new.can_validate_plans is distinct from old.can_validate_plans then
    perform public.write_audit_log('profile.privileges_changed', 'profile', new.id::text,
      jsonb_build_object('from_role', old.role, 'to_role', new.role,
                         'can_validate_plans', new.can_validate_plans));
  end if;
  return new;
end;
$$;

create trigger profiles_audit_privileges
after update on public.profiles
for each row execute function public.audit_profile_privileges();
