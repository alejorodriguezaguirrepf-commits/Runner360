-- Rol de administrador del dueño, acceso Premium sin suscripción, "ver como usuario" y panel.
-- Reversión: supabase/rollback/20261018000200_admin_owner_and_dashboard.down.sql
--
-- 1) Correos con derecho a administrador. Solo se leen desde la base (RLS sin políticas: nadie
--    los ve por la API). El rol se otorga al CONFIRMAR el correo, nunca con el alta sola.
create table public.admin_emails (
  email text primary key check (email = lower(email) and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  created_at timestamptz not null default now()
);
comment on table public.admin_emails is 'Correos que reciben el rol admin al confirmarse. Sin acceso desde la API.';
alter table public.admin_emails enable row level security;

insert into public.admin_emails (email) values ('alejorodriguezaguirrepf@gmail.com') on conflict do nothing;

create or replace function public.grant_owner_admin()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.email_confirmed_at is not null
     and exists (select 1 from public.admin_emails a where a.email = lower(new.email)) then
    update public.profiles set role = 'admin' where id = new.id and role <> 'admin';
  end if;
  return new;
end;
$$;
revoke execute on function public.grant_owner_admin() from public, anon, authenticated;

-- Corre después de on_auth_user_created (orden alfabético), así el perfil ya existe.
create trigger on_auth_user_owner_admin
after insert or update of email_confirmed_at on auth.users
for each row execute function public.grant_owner_admin();

-- Cuentas que ya existen y están confirmadas.
update public.profiles p set role = 'admin'
from auth.users u
where u.id = p.id and u.email_confirmed_at is not null and p.role <> 'admin'
  and exists (select 1 from public.admin_emails a where a.email = lower(u.email));

-- 2) "Ver como usuario": el servidor manda el encabezado x-r360-view-as (free | premium) cuando el
--    admin activa la vista. Solo puede QUITAR permisos (nunca darlos), así que no hace falta
--    confiar en quién lo manda.
create or replace function public.view_as_mode()
returns text
language sql
stable
set search_path = ''
as $$
  select nullif(coalesce(nullif(current_setting('request.headers', true), ''), '{}')::json ->> 'x-r360-view-as', '');
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.view_as_mode() is null
     and exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin');
$$;

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid())
      and (p.role = 'coach' or (p.role = 'admin' and public.view_as_mode() is null))
  );
$$;

-- 3) El admin tiene Premium sin suscripción ni cobro (salvo que esté viendo la app "sin suscripción").
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
  )
  or exists (
    select 1 from public.profiles pr
    where pr.id = p_user and pr.role = 'admin'
      and coalesce(case when p_user = (select auth.uid()) then public.view_as_mode() end, 'premium') = 'premium'
  );
$$;

-- 4) Panel: métricas agregadas (solo admin). Cortes por día y mes en hora argentina.
create or replace function public.admin_dashboard()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  tz constant text := 'America/Argentina/Buenos_Aires';
  this_month date := date_trunc('month', now() at time zone tz)::date;
begin
  if not public.is_admin() then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'users_total', (select count(*) from public.profiles),
    'users_this_week', (select count(*) from public.profiles where (created_at at time zone tz)::date >= date_trunc('week', now() at time zone tz)::date),
    'users_this_month', (select count(*) from public.profiles where (created_at at time zone tz)::date >= this_month),
    'users_by_week', (
      select coalesce(jsonb_agg(jsonb_build_object('week', w::date, 'count',
        (select count(*) from public.profiles p where date_trunc('week', p.created_at at time zone tz) = w)) order by w), '[]')
      from generate_series(date_trunc('week', now() at time zone tz) - interval '7 weeks', date_trunc('week', now() at time zone tz), interval '1 week') w),
    'users_by_month', (
      select coalesce(jsonb_agg(jsonb_build_object('month', m::date, 'count',
        (select count(*) from public.profiles p where date_trunc('month', p.created_at at time zone tz) = m)) order by m), '[]')
      from generate_series(this_month - interval '5 months', this_month, interval '1 month') m),
    'subs', (
      select jsonb_build_object(
        'active', count(*) filter (where s.status in ('active', 'trialing', 'past_due') and (s.current_period_end is null or s.current_period_end > now())),
        'cancelled', count(*) filter (where s.status = 'cancelled'),
        'expired', count(*) filter (where s.status = 'expired' or (s.status in ('active', 'trialing', 'past_due') and s.current_period_end <= now())),
        'pending', count(*) filter (where s.status = 'pending'))
      from public.subscriptions s where s.provider <> 'manual'),
    'subs_by_plan', (
      select coalesce(jsonb_agg(jsonb_build_object('plan', x.name, 'active', x.n) order by x.name), '[]')
      from (select p.name, count(s.id) filter (
              where s.status in ('active', 'trialing', 'past_due') and (s.current_period_end is null or s.current_period_end > now())) as n
            from public.subscription_products p
            left join public.subscriptions s on s.product_id = p.id and s.provider <> 'manual'
            where p.tier = 'premium' group by p.name) x),
    'revenue_by_month', (
      select coalesce(jsonb_agg(jsonb_build_object('month', r.month, 'currency', r.currency, 'amount_minor', r.amount) order by r.month, r.currency), '[]')
      from (select date_trunc('month', sp.paid_at at time zone tz)::date as month, coalesce(sp.currency, '—') as currency, sum(coalesce(sp.amount_minor, 0)) as amount
            from public.subscription_payments sp where sp.status = 'approved' group by 1, 2) r),
    'payments_count', (select count(*) from public.subscription_payments),
    'payment_events_count', (select count(*) from public.payment_events),
    'payment_events_failed', (select count(*) from public.payment_events where processing_error is not null),
    'distances', (
      select coalesce(jsonb_agg(jsonb_build_object('distance', d.target_distance, 'count', d.n) order by d.n desc), '[]')
      from (select target_distance, count(*) as n from public.training_profiles group by target_distance) d),
    'calculator', jsonb_build_object(
      'users', (select count(*) from public.user_pace_tests),
      'last_30d', (select count(*) from public.user_pace_tests where updated_at > now() - interval '30 days'))
  );
end;
$$;
revoke execute on function public.admin_dashboard() from public, anon;
grant execute on function public.admin_dashboard() to authenticated;

-- 5) Listado de usuarios con correo (el correo vive en auth.users; solo lo ve el admin).
create or replace function public.admin_users(p_query text default '', p_limit integer default 25, p_offset integer default 0)
returns table (
  id uuid, email text, display_name text, role public.app_role, created_at timestamptz,
  target_distance public.distance_code, plan text, subscription_status text, total_count bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  q text := '%' || replace(replace(lower(coalesce(trim(p_query), '')), '%', ''), '_', '') || '%';
begin
  if not public.is_admin() then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  return query
  select p.id, u.email::text, p.display_name, p.role, p.created_at, tp.target_distance,
         coalesce(s.plan, 'Gratis') as plan, s.status as subscription_status,
         count(*) over () as total_count
  from public.profiles p
  join auth.users u on u.id = p.id
  left join public.training_profiles tp on tp.user_id = p.id
  left join lateral (
    select pr.name as plan,
           case
             when x.status in ('active', 'trialing', 'past_due') and (x.current_period_end is null or x.current_period_end > now()) then 'activa'
             when x.status = 'cancelled' and x.current_period_end > now() then 'cancelada (con acceso)'
             when x.status = 'cancelled' then 'cancelada'
             when x.status = 'pending' then 'pendiente'
             else 'vencida'
           end as status
    from public.subscriptions x join public.subscription_products pr on pr.id = x.product_id
    where x.user_id = p.id order by x.created_at desc limit 1
  ) s on true
  where lower(u.email) like q or lower(coalesce(p.display_name, '')) like q
  order by p.created_at desc
  limit least(greatest(p_limit, 1), 100) offset greatest(p_offset, 0);
end;
$$;
revoke execute on function public.admin_users(text, integer, integer) from public, anon;
grant execute on function public.admin_users(text, integer, integer) to authenticated;
