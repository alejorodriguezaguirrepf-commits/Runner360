-- Reversión manual de 20261018000200_admin_owner_and_dashboard.sql (con autorización).
-- Vuelve a las funciones anteriores (sin "ver como usuario" ni Premium del admin). No quita el rol
-- admin ya otorgado: para eso, update public.profiles set role = 'user' where ... (a mano).
begin;
drop function if exists public.admin_users(text, integer, integer);
drop function if exists public.admin_dashboard();
drop trigger if exists on_auth_user_owner_admin on auth.users;
drop function if exists public.grant_owner_admin();
drop table if exists public.admin_emails;
create or replace function public.is_admin() returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin');
$$;
create or replace function public.is_staff() returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role in ('admin', 'coach'));
$$;
create or replace function public.has_premium(p_user uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.subscriptions s join public.subscription_products p on p.id = s.product_id
    where s.user_id = p_user and p.tier = 'premium'
      and ((s.status in ('active', 'trialing', 'past_due') and (s.current_period_end is null or s.current_period_end > now()))
           or (s.status = 'cancelled' and s.current_period_end > now())));
$$;
drop function if exists public.view_as_mode();
commit;
