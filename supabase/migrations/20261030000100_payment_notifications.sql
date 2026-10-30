-- Notificaciones de pagos: avisos al admin (pagos aprobados y rechazados), avisos al usuario cuando
-- falla el débito automático, período de gracia de 5 días y suscripciones push (PWA).
-- Solo agrega tablas, columnas y funciones, y reemplaza has_premium: no borra datos.
-- Reversión: supabase/rollback/20261030000100_payment_notifications.down.sql

-- 1) Motivo del rechazo de cada débito (status_detail de Mercado Pago, p. ej. cc_rejected_insufficient_amount).
alter table public.subscription_payments add column failure_code text;

-- 2) Período de gracia: con un débito rechazado la suscripción pasa a past_due y conserva el acceso
--    hasta grace_until (5 días) mientras Mercado Pago reintenta el cobro.
alter table public.subscriptions add column grace_until timestamptz;
comment on column public.subscriptions.grace_until is 'Fin del período de gracia de un débito rechazado (estado past_due).';

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
        (s.status in ('active', 'trialing') and (s.current_period_end is null or s.current_period_end > now()))
        -- Débito rechazado: acceso hasta el fin de la gracia (o del período, si no hay gracia).
        or (s.status = 'past_due' and coalesce(s.grace_until, s.current_period_end, 'infinity'::timestamptz) > now())
        or (s.status = 'cancelled' and s.current_period_end > now())
      )
  )
  or exists (
    select 1 from public.profiles pr
    where pr.id = p_user and pr.role = 'admin'
      and coalesce(case when p_user = (select auth.uid()) then public.view_as_mode() end, 'premium') = 'premium'
  );
$$;

-- 3) Notificaciones para el admin. Las escribe el servidor (webhook y tarea diaria) con la clave de
--    servicio; dedupe_key evita duplicados aunque Mercado Pago repita el aviso.
create table public.admin_notifications (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('payment_approved', 'payment_failed', 'payment_recovered', 'access_ended')),
  user_id uuid references public.profiles (id) on delete set null,
  subscription_id uuid references public.subscriptions (id) on delete set null,
  title text not null,
  body text not null,
  data jsonb not null default '{}'::jsonb,
  dedupe_key text not null unique,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index admin_notifications_unread_idx on public.admin_notifications (created_at desc) where read_at is null;
create index admin_notifications_kind_idx on public.admin_notifications (kind, created_at desc);
alter table public.admin_notifications enable row level security;
create policy admin_notifications_admin_read on public.admin_notifications for select to authenticated using (public.is_admin());
create policy admin_notifications_admin_update on public.admin_notifications for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
revoke update on public.admin_notifications from authenticated;
grant update (read_at) on public.admin_notifications to authenticated;

-- 4) Avisos al usuario (cartel en la app): débito rechazado, pago regularizado, acceso cortado.
create table public.user_notices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  subscription_id uuid references public.subscriptions (id) on delete set null,
  kind text not null check (kind in ('payment_failed', 'payment_recovered', 'access_ended')),
  message text not null,
  action_url text,
  dedupe_key text not null unique,
  resolved_at timestamptz,
  seen_at timestamptz,
  created_at timestamptz not null default now()
);
create index user_notices_user_idx on public.user_notices (user_id, created_at desc);
alter table public.user_notices enable row level security;
create policy user_notices_own_read on public.user_notices for select to authenticated
  using (user_id = (select auth.uid()) or public.is_staff());
create policy user_notices_own_seen on public.user_notices for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
revoke update on public.user_notices from authenticated;
grant update (seen_at) on public.user_notices to authenticated;

-- 5) Suscripciones push (Web Push) de cada dispositivo.
create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  endpoint text not null unique check (endpoint ~ '^https://'),
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);
create index push_subscriptions_user_idx on public.push_subscriptions (user_id);
alter table public.push_subscriptions enable row level security;
create policy push_subscriptions_own_read on public.push_subscriptions for select to authenticated using (user_id = (select auth.uid()));
create policy push_subscriptions_own_insert on public.push_subscriptions for insert to authenticated with check (user_id = (select auth.uid()));
create policy push_subscriptions_own_delete on public.push_subscriptions for delete to authenticated using (user_id = (select auth.uid()));

-- 6) Canales de aviso al admin (mail y push), activables desde el panel. Una sola fila.
create table public.notification_settings (
  id boolean primary key default true check (id),
  admin_email_enabled boolean not null default true,
  admin_push_enabled boolean not null default true,
  updated_at timestamptz not null default now()
);
insert into public.notification_settings (id) values (true) on conflict do nothing;
alter table public.notification_settings enable row level security;
create policy notification_settings_admin_read on public.notification_settings for select to authenticated using (public.is_admin());
create policy notification_settings_admin_update on public.notification_settings for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- 7) Panel: débitos rechazados de los últimos 90 días y en qué quedó cada caso.
create or replace function public.admin_payment_problems()
returns table (
  payment_id uuid, provider_payment_id text, failed_at timestamptz, failure_code text,
  amount_minor bigint, currency text, user_id uuid, email text, display_name text,
  plan text, subscription_status public.subscription_status, grace_until timestamptz, resolved boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  return query
  select sp.id, sp.provider_payment_id, sp.paid_at, sp.failure_code, sp.amount_minor, sp.currency,
         sp.user_id, u.email::text, pr.display_name, p.name, s.status, s.grace_until,
         exists (select 1 from public.subscription_payments ok
                 where ok.subscription_id = sp.subscription_id and ok.status = 'approved' and ok.paid_at > sp.paid_at)
  from public.subscription_payments sp
  join public.profiles pr on pr.id = sp.user_id
  join auth.users u on u.id = sp.user_id
  left join public.subscriptions s on s.id = sp.subscription_id
  left join public.subscription_products p on p.id = s.product_id
  where sp.status = 'rejected' and sp.paid_at > now() - interval '90 days'
  order by sp.paid_at desc;
end;
$$;
revoke execute on function public.admin_payment_problems() from public, anon;
grant execute on function public.admin_payment_problems() to authenticated;
