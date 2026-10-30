-- Reversión manual de 20261030000100_payment_notifications.sql (con autorización).
-- Borra las notificaciones, los avisos y las suscripciones push guardadas.
begin;
drop function if exists public.admin_payment_problems();
drop table if exists public.notification_settings;
drop table if exists public.push_subscriptions;
drop table if exists public.user_notices;
drop table if exists public.admin_notifications;
create or replace function public.has_premium(p_user uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.subscriptions s join public.subscription_products p on p.id = s.product_id
    where s.user_id = p_user and p.tier = 'premium'
      and ((s.status in ('active', 'trialing', 'past_due') and (s.current_period_end is null or s.current_period_end > now()))
        or (s.status = 'cancelled' and s.current_period_end > now()))
  )
  or exists (
    select 1 from public.profiles pr
    where pr.id = p_user and pr.role = 'admin'
      and coalesce(case when p_user = (select auth.uid()) then public.view_as_mode() end, 'premium') = 'premium'
  );
$$;
alter table public.subscriptions drop column if exists grace_until;
alter table public.subscription_payments drop column if exists failure_code;
commit;
