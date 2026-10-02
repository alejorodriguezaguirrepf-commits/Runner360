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
