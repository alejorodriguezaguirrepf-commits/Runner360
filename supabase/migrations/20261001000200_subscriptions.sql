-- RUNNER 360 · Migración 2: productos, precios, suscripciones, eventos de pago y control de funcionalidades.
-- Los precios NO están en el código: se administran en subscription_prices.
-- Los pagos se confirman solo en backend (webhooks verificados) usando service_role.

create type public.subscription_tier as enum ('free', 'premium');
create type public.billing_interval as enum ('month', 'year');
create type public.payment_provider as enum ('mercadopago', 'stripe', 'apple_app_store', 'google_play', 'manual');
create type public.subscription_status as enum ('pending', 'trialing', 'active', 'past_due', 'canceled', 'expired');

create table public.subscription_products (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[a-z0-9_]{2,40}$'),
  name text not null check (char_length(name) between 2 and 80),
  description text not null default '',
  tier public.subscription_tier not null,
  -- Lista de claves de funcionalidad habilitadas (ver packages/shared FEATURES).
  features text[] not null default '{}',
  active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger subscription_products_updated_at before update on public.subscription_products
  for each row execute function public.set_updated_at();

create table public.subscription_prices (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.subscription_products (id) on delete restrict,
  currency char(3) not null check (currency in ('ARS', 'USD')),
  amount_minor bigint not null check (amount_minor >= 0),
  billing_interval public.billing_interval not null,
  -- Identificadores del precio/plan en cada proveedor (p. ej. {"mercadopago": "...", "stripe": "price_..."}).
  provider_price_ids jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index subscription_prices_active_uniq
  on public.subscription_prices (product_id, currency, billing_interval) where active;
create trigger subscription_prices_updated_at before update on public.subscription_prices
  for each row execute function public.set_updated_at();

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  product_id uuid not null references public.subscription_products (id) on delete restrict,
  price_id uuid references public.subscription_prices (id) on delete set null,
  provider public.payment_provider not null,
  provider_subscription_id text,
  status public.subscription_status not null default 'pending',
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  canceled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (current_period_end is null or current_period_start is null or current_period_end > current_period_start)
);
create unique index subscriptions_provider_uniq
  on public.subscriptions (provider, provider_subscription_id) where provider_subscription_id is not null;
create index subscriptions_user_idx on public.subscriptions (user_id, status);
create trigger subscriptions_updated_at before update on public.subscriptions
  for each row execute function public.set_updated_at();

create table public.subscription_events (
  id bigint generated always as identity primary key,
  subscription_id uuid not null references public.subscriptions (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  event_type text not null,
  from_status public.subscription_status,
  to_status public.subscription_status,
  payment_event_id uuid,
  created_at timestamptz not null default now()
);
create index subscription_events_sub_idx on public.subscription_events (subscription_id, created_at desc);

-- Historial automático de cambios de estado.
create or replace function public.track_subscription_status()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    insert into public.subscription_events (subscription_id, user_id, event_type, to_status)
    values (new.id, new.user_id, 'created', new.status);
  elsif new.status is distinct from old.status or new.cancel_at_period_end is distinct from old.cancel_at_period_end then
    insert into public.subscription_events (subscription_id, user_id, event_type, from_status, to_status)
    values (new.id, new.user_id,
            case when new.cancel_at_period_end and not old.cancel_at_period_end then 'cancel_requested' else 'status_changed' end,
            old.status, new.status);
  end if;
  return new;
end $$;
create trigger subscriptions_track after insert or update on public.subscriptions
  for each row execute function public.track_subscription_status();

-- Eventos de proveedores de pago. La unicidad (provider, provider_event_id) garantiza idempotencia.
create table public.payment_events (
  id uuid primary key default gen_random_uuid(),
  provider public.payment_provider not null,
  provider_event_id text not null,
  event_type text not null,
  -- Payload recibido (sin datos de tarjeta: los proveedores no los envían y no se solicitan).
  payload jsonb not null,
  signature_verified boolean not null,
  status text not null default 'received' check (status in ('received', 'processed', 'ignored', 'failed')),
  error text,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  unique (provider, provider_event_id)
);
create index payment_events_received_idx on public.payment_events (received_at desc);

-- ¿El usuario autenticado tiene la funcionalidad? Suscripción vigente → features del producto;
-- si no, features del producto gratuito activo.
create or replace function public.has_feature(p_feature text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.subscriptions s
    join public.subscription_products p on p.id = s.product_id
    where s.user_id = (select auth.uid())
      and s.status in ('active', 'trialing')
      and (s.current_period_end is null or s.current_period_end > now())
      and p_feature = any (p.features)
  ) or exists (
    select 1 from public.subscription_products p
    where p.tier = 'free' and p.active and p_feature = any (p.features)
  );
$$;

create or replace function public.my_features()
returns text[] language sql stable security definer set search_path = '' as $$
  select coalesce(array_agg(distinct f order by f), '{}')
  from (
    select unnest(p.features) as f
    from public.subscriptions s join public.subscription_products p on p.id = s.product_id
    where s.user_id = (select auth.uid()) and s.status in ('active', 'trialing')
      and (s.current_period_end is null or s.current_period_end > now())
    union
    select unnest(p.features) from public.subscription_products p where p.tier = 'free' and p.active
  ) x;
$$;

-- Alta manual de suscripción (beta testers, cortesías). Solo administradores. Queda auditada.
create or replace function public.admin_grant_subscription(p_user_id uuid, p_product_code text, p_days int)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_product uuid;
  v_id uuid;
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_days is null or p_days < 1 or p_days > 730 then raise exception 'invalid_days'; end if;
  select id into v_product from public.subscription_products where code = p_product_code and active;
  if v_product is null then raise exception 'product_not_found'; end if;
  insert into public.subscriptions (user_id, product_id, provider, status, current_period_start, current_period_end)
  values (p_user_id, v_product, 'manual', 'active', now(), now() + make_interval(days => p_days))
  returning id into v_id;
  perform public.log_audit('grant_subscription', 'subscriptions', v_id::text,
    jsonb_build_object('user_id', p_user_id, 'product', p_product_code, 'days', p_days));
  return v_id;
end $$;

create or replace function public.admin_cancel_subscription(p_subscription_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  update public.subscriptions set status = 'canceled', canceled_at = now()
  where id = p_subscription_id and provider = 'manual';
  if not found then raise exception 'only_manual_subscriptions_can_be_canceled_here'; end if;
  perform public.log_audit('cancel_subscription', 'subscriptions', p_subscription_id::text, '{}'::jsonb);
end $$;

-- RLS
alter table public.subscription_products enable row level security;
alter table public.subscription_prices enable row level security;
alter table public.subscriptions enable row level security;
alter table public.subscription_events enable row level security;
alter table public.payment_events enable row level security;

create policy products_public_read on public.subscription_products for select to anon, authenticated
  using (active or (select public.is_admin()));
create policy products_admin_write on public.subscription_products for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

create policy prices_public_read on public.subscription_prices for select to anon, authenticated
  using (active or (select public.is_admin()));
create policy prices_admin_write on public.subscription_prices for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- Los usuarios solo leen sus suscripciones. Ningún usuario escribe: solo service_role (webhooks) o RPC de admin.
create policy subscriptions_select on public.subscriptions for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));
create policy subscription_events_select on public.subscription_events for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));
create policy payment_events_admin_select on public.payment_events for select to authenticated
  using ((select public.is_admin()));

create trigger subscription_products_audit after insert or update or delete on public.subscription_products
  for each row execute function public.audit_row_change();
create trigger subscription_prices_audit after insert or update or delete on public.subscription_prices
  for each row execute function public.audit_row_change();

grant select on public.subscription_products, public.subscription_prices to anon, authenticated;
grant insert, update, delete on public.subscription_products, public.subscription_prices to authenticated;
grant select on public.subscriptions, public.subscription_events, public.payment_events to authenticated;
grant execute on function public.has_feature(text), public.my_features() to authenticated;
revoke execute on function public.admin_grant_subscription(uuid, text, int), public.admin_cancel_subscription(uuid) from public, anon;
grant execute on function public.admin_grant_subscription(uuid, text, int), public.admin_cancel_subscription(uuid) to authenticated;
