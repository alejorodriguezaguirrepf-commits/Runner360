-- RUNNER 360 — Paso 1 de 2: estructura, seguridad y configuración inicial
-- GENERADO por scripts/build-cloud-setup.mjs. No editar a mano.
-- Pegar completo en Supabase → SQL Editor → New query → Run, en un proyecto NUEVO (vacío).

-- ===== supabase/migrations/20261002000100_core.sql =====
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


-- ===== supabase/migrations/20261002000200_runner_profile_and_billing.sql =====
-- RUNNER 360 — Perfil deportivo, datos de salud (sensibles) y suscripciones.

-- ---------------------------------------------------------------------------
-- Perfil deportivo
-- ---------------------------------------------------------------------------
create table public.training_profiles (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  target_distance public.distance_code not null,
  level public.runner_level not null,
  experience public.running_experience not null,
  weekly_km numeric(5, 1) not null check (weekly_km between 0 and 300),
  available_weekdays smallint[] not null
    check (cardinality(available_weekdays) between 1 and 7 and available_weekdays <@ array[1,2,3,4,5,6,7]::smallint[]),
  recent_mark_distance_m integer check (recent_mark_distance_m between 400 and 100000),
  recent_mark_time_s integer check (recent_mark_time_s between 60 and 86400),
  recent_mark_date date,
  goal public.training_goal not null,
  race_date date,
  preferences jsonb not null default '{}'::jsonb,
  readiness public.readiness_status not null default 'ok',
  readiness_reasons text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint training_profiles_mark_pair check ((recent_mark_distance_m is null) = (recent_mark_time_s is null))
);
comment on table public.training_profiles is 'Cuestionario deportivo del onboarding. Solo lo ve el titular y el staff.';

create trigger training_profiles_set_updated_at
before update on public.training_profiles
for each row execute function public.set_updated_at();

alter table public.training_profiles enable row level security;
create policy tp_select on public.training_profiles
  for select to authenticated using (user_id = (select auth.uid()) or public.is_staff());
create policy tp_insert_own on public.training_profiles
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy tp_update_own on public.training_profiles
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Antecedentes de salud declarados (dato sensible: Ley 25.326, art. 2 y 7)
-- Acceso exclusivo del titular. Requiere consentimiento 'health_data' vigente.
-- ---------------------------------------------------------------------------
create table public.health_screenings (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  flags text[] not null default '{}'
    check (flags <@ array['medical_restriction','cardiovascular_or_respiratory_condition',
                          'chest_pain_or_fainting','recent_injury','pregnancy_or_postpartum','other']::text[]),
  notes text check (char_length(notes) <= 500),
  updated_at timestamptz not null default now()
);
comment on table public.health_screenings is 'Antecedentes autodeclarados. No se usan para diagnóstico. Solo el titular accede.';

create trigger health_screenings_set_updated_at
before update on public.health_screenings
for each row execute function public.set_updated_at();

alter table public.health_screenings enable row level security;
create policy hs_select_own on public.health_screenings
  for select to authenticated using (user_id = (select auth.uid()));
create policy hs_insert_own on public.health_screenings
  for insert to authenticated
  with check (user_id = (select auth.uid()) and public.has_consent((select auth.uid()), 'health_data'));
create policy hs_update_own on public.health_screenings
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and public.has_consent((select auth.uid()), 'health_data'));
create policy hs_delete_own on public.health_screenings
  for delete to authenticated using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Productos, precios y suscripciones
-- ---------------------------------------------------------------------------
create type public.subscription_tier as enum ('free', 'premium');
create type public.billing_interval as enum ('month', 'year');
create type public.payment_provider as enum ('mercadopago', 'stripe', 'apple', 'google', 'manual');
create type public.subscription_status as enum ('pending', 'trialing', 'active', 'past_due', 'cancelled', 'expired');

create table public.subscription_products (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[a-z0-9_]{2,40}$'),
  name text not null check (char_length(name) between 1 and 80),
  description text not null default '',
  tier public.subscription_tier not null,
  billing_interval public.billing_interval,
  features text[] not null default '{}',
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint products_interval_for_paid check (tier = 'free' or billing_interval is not null)
);

create trigger subscription_products_set_updated_at
before update on public.subscription_products
for each row execute function public.set_updated_at();

create table public.product_prices (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.subscription_products (id) on delete restrict,
  currency char(3) not null check (currency ~ '^[A-Z]{3}$'),
  amount_minor bigint not null check (amount_minor >= 0),
  provider public.payment_provider,
  provider_price_id text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on column public.product_prices.amount_minor is 'Importe en unidades menores (centavos). Nunca usar float para dinero.';
-- Un único precio activo por producto, moneda y proveedor (NULL = precio de lista general). Requiere PostgreSQL 15+.
create unique index product_prices_one_active
  on public.product_prices (product_id, currency, provider) nulls not distinct where active;

create trigger product_prices_set_updated_at
before update on public.product_prices
for each row execute function public.set_updated_at();

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  product_id uuid not null references public.subscription_products (id) on delete restrict,
  price_id uuid references public.product_prices (id) on delete set null,
  provider public.payment_provider not null,
  provider_subscription_id text,
  status public.subscription_status not null default 'pending',
  started_at timestamptz,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint subscriptions_provider_ref unique (provider, provider_subscription_id),
  constraint subscriptions_period check (current_period_end is null or current_period_start is null or current_period_end > current_period_start)
);
create index subscriptions_user_idx on public.subscriptions (user_id, status);

create trigger subscriptions_set_updated_at
before update on public.subscriptions
for each row execute function public.set_updated_at();

create table public.subscription_events (
  id bigint generated always as identity primary key,
  subscription_id uuid not null references public.subscriptions (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  from_status public.subscription_status,
  to_status public.subscription_status not null,
  source text not null default 'system',
  created_at timestamptz not null default now()
);
create index subscription_events_sub_idx on public.subscription_events (subscription_id, created_at);

create or replace function public.log_subscription_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' or new.status is distinct from old.status then
    insert into public.subscription_events (subscription_id, user_id, from_status, to_status, source)
    values (new.id, new.user_id, case when tg_op = 'UPDATE' then old.status end, new.status,
            coalesce(current_setting('app.subscription_event_source', true), new.provider::text));
  end if;
  return new;
end;
$$;

create trigger subscriptions_log_event
after insert or update on public.subscriptions
for each row execute function public.log_subscription_event();

-- Eventos crudos de proveedores de pago. Idempotencia por (provider, provider_event_id).
create table public.payment_events (
  id uuid primary key default gen_random_uuid(),
  provider public.payment_provider not null,
  provider_event_id text not null,
  event_type text not null,
  signature_valid boolean not null,
  payload jsonb not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  processing_error text,
  constraint payment_events_idempotency unique (provider, provider_event_id)
);
comment on table public.payment_events is 'Webhooks recibidos. Nunca contiene datos completos de tarjetas. Solo escribe el servidor (service_role).';

-- Acceso Premium vigente: activo, en prueba o cancelado pero dentro del período pago.
create or replace function public.has_premium(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.subscriptions s
    join public.subscription_products p on p.id = s.product_id
    where s.user_id = p_user
      and p.tier = 'premium'
      and (
        (s.status in ('active', 'trialing', 'past_due') and (s.current_period_end is null or s.current_period_end > now()))
        or (s.status = 'cancelled' and s.current_period_end > now())
      )
  );
$$;

alter table public.subscription_products enable row level security;
alter table public.product_prices enable row level security;
alter table public.subscriptions enable row level security;
alter table public.subscription_events enable row level security;
alter table public.payment_events enable row level security;

create policy products_public_read on public.subscription_products
  for select to anon, authenticated using (active or public.is_admin());
create policy products_admin_write on public.subscription_products
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy prices_public_read on public.product_prices
  for select to anon, authenticated using (active or public.is_admin());
create policy prices_admin_write on public.product_prices
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy subscriptions_select on public.subscriptions
  for select to authenticated using (user_id = (select auth.uid()) or public.is_admin());
create policy subscriptions_admin_write on public.subscriptions
  for all to authenticated using (public.is_admin()) with check (public.is_admin() and provider = 'manual');

create policy sub_events_select on public.subscription_events
  for select to authenticated using (user_id = (select auth.uid()) or public.is_admin());

create policy payment_events_admin_read on public.payment_events
  for select to authenticated using (public.is_admin());

create or replace function public.audit_price_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.write_audit_log('price.' || lower(tg_op), 'product_price',
    coalesce(new.id, old.id)::text,
    jsonb_build_object('currency', coalesce(new.currency, old.currency),
                       'amount_minor', coalesce(new.amount_minor, old.amount_minor),
                       'active', coalesce(new.active, old.active)));
  return coalesce(new, old);
end;
$$;

create trigger product_prices_audit
after insert or update or delete on public.product_prices
for each row execute function public.audit_price_change();


-- ===== supabase/migrations/20261002000300_training_plans.sql =====
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


-- ===== supabase/migrations/20261002000400_activity_and_content.sql =====
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


-- ===== supabase/migrations/20261002000500_premium_features.sql =====
-- RUNNER 360 — Funcionalidades Premium configurables desde administración, con control en backend.

create table public.app_features (
  key text primary key check (key ~ '^[a-z_]{2,40}$'),
  label text not null check (char_length(label) between 1 and 80),
  requires_premium boolean not null default true,
  updated_at timestamptz not null default now()
);
comment on table public.app_features is 'Qué funciones requieren Premium. Editable por administradores; se aplica en RLS.';

create trigger app_features_set_updated_at before update on public.app_features
for each row execute function public.set_updated_at();

alter table public.app_features enable row level security;
create policy features_read on public.app_features for select to anon, authenticated using (true);
create policy features_admin_write on public.app_features for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

insert into public.app_features (key, label, requires_premium) values
  ('hydration', 'Hidratación', true),
  ('competitions', 'Competencias', true),
  ('advanced_stats', 'Estadísticas avanzadas', true);

create or replace function public.can_use_feature(p_feature text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_staff()
      or coalesce((select not f.requires_premium from public.app_features f where f.key = p_feature), false)
      or public.has_premium((select auth.uid()));
$$;

-- Escritura de módulos Premium: además de ser el titular, la función debe estar habilitada.
-- La lectura y el borrado de datos propios se mantienen siempre (derecho de acceso y supresión).
drop policy hydration_logs_own on public.hydration_logs;
create policy hydration_logs_select_own on public.hydration_logs for select to authenticated
  using (user_id = (select auth.uid()));
create policy hydration_logs_delete_own on public.hydration_logs for delete to authenticated
  using (user_id = (select auth.uid()));
create policy hydration_logs_insert_own on public.hydration_logs for insert to authenticated
  with check (user_id = (select auth.uid()) and public.can_use_feature('hydration'));
create policy hydration_logs_update_own on public.hydration_logs for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()) and public.can_use_feature('hydration'));

drop policy hydration_reminders_own on public.hydration_reminders;
create policy hydration_reminders_select_own on public.hydration_reminders for select to authenticated
  using (user_id = (select auth.uid()));
create policy hydration_reminders_delete_own on public.hydration_reminders for delete to authenticated
  using (user_id = (select auth.uid()));
create policy hydration_reminders_insert_own on public.hydration_reminders for insert to authenticated
  with check (user_id = (select auth.uid()) and public.can_use_feature('hydration'));
create policy hydration_reminders_update_own on public.hydration_reminders for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()) and public.can_use_feature('hydration'));

drop policy competitions_own on public.competitions;
create policy competitions_select_own on public.competitions for select to authenticated
  using (user_id = (select auth.uid()));
create policy competitions_delete_own on public.competitions for delete to authenticated
  using (user_id = (select auth.uid()));
create policy competitions_insert_own on public.competitions for insert to authenticated
  with check (user_id = (select auth.uid()) and public.can_use_feature('competitions'));
create policy competitions_update_own on public.competitions for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()) and public.can_use_feature('competitions'));


-- ===== supabase/seed/10_products.sql =====
-- Catálogo inicial de productos y precios (configuración, no datos de usuarios).
-- Los precios se administran desde /admin/productos; estos valores son solo el punto de partida.
-- Precio de referencia inicial: USD 7,99/mes. El precio anual y en ARS quedan pendientes de definición
-- (sin precio activo, la interfaz muestra "a definir").
begin;

insert into public.subscription_products (id, code, name, description, tier, billing_interval, features, sort_order)
values
  ('00000000-0000-4000-8000-000000000001', 'free', 'Free', 'Para empezar a entrenar y registrar tu actividad.', 'free', null,
   array['Perfil del corredor', 'Registro básico de entrenamientos', 'Contenido introductorio', 'Plan gratuito o de demostración'], 0),
  ('00000000-0000-4000-8000-000000000002', 'premium_monthly', 'Premium mensual', 'Acceso completo con facturación mensual.', 'premium', 'month',
   array['Planes publicados incluidos en la suscripción', 'Calendario de entrenamiento', 'Historial y estadísticas avanzadas', 'Hidratación y competencias'], 1),
  ('00000000-0000-4000-8000-000000000003', 'premium_yearly', 'Premium anual', 'Acceso completo con facturación anual.', 'premium', 'year',
   array['Todo lo incluido en Premium mensual', 'Un único pago anual'], 2)
on conflict (id) do nothing;

insert into public.product_prices (id, product_id, currency, amount_minor, provider, active)
values ('00000000-0000-4000-8000-000000000101', '00000000-0000-4000-8000-000000000002', 'USD', 799, null, true)
on conflict (id) do nothing;

commit;


-- ===== supabase/seed/30_educational_content.sql =====
-- Contenido educativo inicial. Orientativo y general: NO reemplaza el consejo de un profesional.
-- reviewed_by queda en NULL: la interfaz lo muestra como "Pendiente de revisión profesional".
begin;

insert into public.educational_contents (id, slug, title, summary, body, category, is_premium, status, published_at)
values
(
  '00000000-0000-4000-8000-000000000201', 'hidratacion-basica', 'Hidratación: principios generales',
  'Por qué no existe una cantidad única de agua para todas las personas y qué señales tener en cuenta.',
  $md$Las necesidades de líquidos varían mucho entre personas. Dependen del tamaño corporal, la intensidad y duración del ejercicio, la temperatura, la humedad, la ropa y la tasa de sudoración de cada uno. Por eso RUNNER 360 no indica una cantidad universal.

**Algunas pautas generales:**

- Llegar al entrenamiento habiendo bebido con normalidad durante el día.
- En sesiones cortas y frescas, muchas personas no necesitan beber durante el ejercicio.
- En sesiones largas o con calor, planificá cómo vas a acceder a líquidos.
- Beber en exceso también puede ser riesgoso. Evitá forzarte a tomar grandes volúmenes.

**Consultá a un profesional** si entrenás con calor extremo, tenés una enfermedad, tomás medicación que afecte el balance de líquidos o tuviste síntomas como mareos, confusión, calambres intensos o dolor de cabeza persistente.

La app registra lo que vos cargás. No mide tu estado de hidratación.$md$,
  'hydration', false, 'published', now()
),
(
  '00000000-0000-4000-8000-000000000202', 'calor-y-sesiones-largas', 'Calor y sesiones largas',
  'Recaudos generales para entrenar con temperaturas altas.',
  $md$Con calor, el esfuerzo percibido sube a igual ritmo. Algunas medidas generales:

- Elegí horarios más frescos (temprano o al atardecer).
- Ajustá el ritmo por sensación de esfuerzo (RPE), no por el reloj.
- Usá ropa liviana y protección solar.
- En sesiones prolongadas, considerá bebidas con electrolitos según la indicación de tu profesional.

**Suspendé la actividad** ante mareos, confusión, náuseas, piel fría y húmeda o ausencia de sudor con calor intenso, y buscá asistencia.$md$,
  'hydration', false, 'published', now()
),
(
  '00000000-0000-4000-8000-000000000203', 'que-es-el-rpe', 'Qué es el RPE (esfuerzo percibido)',
  'Cómo usar la escala de 1 a 10 para regular la intensidad.',
  $md$El RPE (por sus siglas en inglés, *Rating of Perceived Exertion*) es una escala de 1 a 10 para describir cuán exigente sentís un esfuerzo.

- **1–2:** muy suave, podrías sostenerlo mucho tiempo.
- **3–4:** suave, podés conversar con frases completas.
- **5–6:** moderado, hablás con frases cortas.
- **7–8:** exigente, solo podés decir algunas palabras.
- **9–10:** máximo o casi máximo.

Los planes indican un rango de RPE objetivo. Si un día te sentís peor de lo habitual, priorizá el rango de esfuerzo antes que el ritmo.$md$,
  'training', false, 'published', now()
)
on conflict (id) do nothing;

commit;
