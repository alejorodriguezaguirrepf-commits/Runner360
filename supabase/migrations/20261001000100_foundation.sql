-- RUNNER 360 · Migración 1: tipos, utilidades, identidad, roles, consentimientos y auditoría.
-- Convenciones: distancias en metros (integer), duraciones en segundos (integer),
-- dinero en unidades menores (bigint), fechas calendario como date, instantes como timestamptz.

create extension if not exists pgcrypto with schema extensions;

-- ===================== Tipos =====================
create type public.app_role as enum ('user', 'coach', 'admin');
create type public.race_distance as enum ('5k', '10k', '15k', '21k', '42k');
create type public.runner_level as enum ('beginner', 'intermediate', 'advanced');
create type public.training_goal as enum ('complete', 'improve_time', 'prepare_race');
create type public.session_type as enum
  ('easy_run', 'long_run', 'intervals', 'tempo', 'recovery', 'rest', 'strength', 'test', 'walk_run');
create type public.intensity_level as enum ('very_easy', 'easy', 'moderate', 'hard', 'very_hard');
create type public.plan_kind as enum ('standard', 'introductory');
create type public.plan_status as enum ('draft', 'in_review', 'approved', 'published', 'archived');
create type public.validation_status as enum ('demo_unvalidated', 'pending_review', 'validated');
create type public.workout_status as enum ('completed', 'modified', 'skipped');
create type public.user_plan_status as enum ('active', 'completed', 'abandoned');
create type public.consent_type as enum ('terms', 'privacy', 'health_data', 'location', 'marketing');

-- ===================== Utilidades =====================
create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ===================== Perfiles =====================
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  display_name text check (char_length(display_name) between 2 and 60),
  birth_date date check (birth_date > date '1900-01-01'),
  timezone text not null default 'America/Argentina/Buenos_Aires',
  locale text not null default 'es-AR',
  onboarding_completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index profiles_email_idx on public.profiles (lower(email));
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- Roles en tabla separada: el usuario no puede modificarlos actualizando su perfil.
create table public.user_roles (
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.app_role not null,
  granted_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (user_id, role)
);

-- Funciones de autorización (SECURITY DEFINER para evitar recursión de RLS; search_path vacío).
create or replace function public.has_role(p_role public.app_role)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.user_roles r where r.user_id = (select auth.uid()) and r.role = p_role
  );
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select public.has_role('admin');
$$;

create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = '' as $$
  select public.has_role('admin') or public.has_role('coach');
$$;

-- Contexto privilegiado: migraciones, seeds y procesos con service_role (nunca un usuario final).
create or replace function public.is_privileged_context()
returns boolean language sql stable set search_path = '' as $$
  select current_user not in ('authenticated', 'anon');
$$;

-- ===================== Auditoría =====================
create table public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users (id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index audit_logs_entity_idx on public.audit_logs (entity_type, entity_id);
create index audit_logs_created_idx on public.audit_logs (created_at desc);

create or replace function public.log_audit(p_action text, p_entity_type text, p_entity_id text, p_metadata jsonb default '{}'::jsonb)
returns void language sql security definer set search_path = '' as $$
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values ((select auth.uid()), p_action, p_entity_type, p_entity_id, coalesce(p_metadata, '{}'::jsonb));
$$;

-- Trigger genérico de auditoría para tablas administrativas. No registra contenido sensible.
create or replace function public.audit_row_change()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_id text;
  v_meta jsonb := '{}'::jsonb;
begin
  if tg_op = 'DELETE' then
    v_id := to_jsonb(old) ->> coalesce(tg_argv[0], 'id');
  else
    v_id := to_jsonb(new) ->> coalesce(tg_argv[0], 'id');
  end if;
  if tg_op = 'UPDATE' and to_jsonb(old) ? 'status' then
    v_meta := jsonb_build_object('from_status', to_jsonb(old) ->> 'status', 'to_status', to_jsonb(new) ->> 'status');
  end if;
  if tg_table_name = 'user_roles' then
    v_meta := jsonb_build_object('role', coalesce(to_jsonb(new) ->> 'role', to_jsonb(old) ->> 'role'),
                                 'user_id', coalesce(to_jsonb(new) ->> 'user_id', to_jsonb(old) ->> 'user_id'));
  end if;
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values ((select auth.uid()), lower(tg_op), tg_table_name, v_id, v_meta);
  return coalesce(new, old);
end $$;

create trigger user_roles_audit after insert or delete on public.user_roles
  for each row execute function public.audit_row_change('user_id');

-- Alta automática de perfil y rol "user" al registrarse en Supabase Auth.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    coalesce(new.email, ''),
    nullif(left(coalesce(new.raw_user_meta_data ->> 'display_name', ''), 60), '')
  );
  insert into public.user_roles (user_id, role) values (new.id, 'user');
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Mantener email sincronizado si cambia en Auth.
create or replace function public.handle_user_email_change()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.email is distinct from old.email then
    update public.profiles set email = coalesce(new.email, '') where id = new.id;
  end if;
  return new;
end $$;

create trigger on_auth_user_email_changed after update of email on auth.users
  for each row execute function public.handle_user_email_change();

-- ===================== Consentimientos (solo agregar, nunca editar) =====================
create table public.user_consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  consent_type public.consent_type not null,
  document_version text not null check (char_length(document_version) between 1 and 40),
  granted boolean not null,
  created_at timestamptz not null default now()
);
create index user_consents_user_idx on public.user_consents (user_id, consent_type, created_at desc);

-- Último estado de cada consentimiento.
create or replace function public.has_consent(p_type public.consent_type)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((
    select c.granted from public.user_consents c
    where c.user_id = (select auth.uid()) and c.consent_type = p_type
    order by c.created_at desc limit 1
  ), false);
$$;

-- ===================== RLS =====================
alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.audit_logs enable row level security;
alter table public.user_consents enable row level security;

create policy profiles_select_own on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (select public.is_admin()));
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy user_roles_select on public.user_roles for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));
create policy user_roles_admin_insert on public.user_roles for insert to authenticated
  with check ((select public.is_admin()));
create policy user_roles_admin_delete on public.user_roles for delete to authenticated
  using ((select public.is_admin()) and not (user_id = (select auth.uid()) and role = 'admin'));

create policy audit_logs_admin_select on public.audit_logs for select to authenticated
  using ((select public.is_admin()));

create policy user_consents_select_own on public.user_consents for select to authenticated
  using (user_id = (select auth.uid()));
create policy user_consents_insert_own on public.user_consents for insert to authenticated
  with check (user_id = (select auth.uid()));

-- ===================== Privilegios explícitos =====================
grant usage on schema public to anon, authenticated;
grant select on public.profiles to authenticated;
-- Solo columnas editables por el propio usuario (email, roles e ids no son editables).
grant update (display_name, birth_date, timezone, onboarding_completed_at) on public.profiles to authenticated;
grant select, insert, delete on public.user_roles to authenticated;
grant select on public.audit_logs to authenticated;
grant select, insert on public.user_consents to authenticated;
grant execute on function public.has_role(public.app_role), public.is_admin(), public.is_staff(),
  public.has_consent(public.consent_type) to authenticated;
-- log_audit solo se invoca desde funciones SECURITY DEFINER del propio esquema.
revoke execute on function public.log_audit(text, text, text, jsonb) from public, anon, authenticated;
