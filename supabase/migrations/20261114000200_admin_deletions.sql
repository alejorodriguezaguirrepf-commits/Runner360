-- Administración: borrar personas y suscripciones que no están activas.
-- 1) Al borrar una persona, sus débitos quedan guardados sin datos personales (user_id en null) para
--    que los ingresos no cambien; cada débito guarda si fue mensual o anual.
-- 2) Funciones para el panel: qué impide borrar a una persona y borrar una suscripción inactiva; la
--    lista de débitos incluye los de cuentas borradas.
-- No borra datos por sí misma: solo cambia la referencia de los débitos y completa su período.

-- 1) Débitos: período (mensual o anual) propio y persona opcional.
alter table public.subscription_payments add column billing_interval public.billing_interval;
comment on column public.subscription_payments.billing_interval is 'Mensual o anual (del producto de la suscripción): se conserva aunque se borre la suscripción o la persona.';
update public.subscription_payments sp
set billing_interval = p.billing_interval
from public.subscriptions s
join public.subscription_products p on p.id = s.product_id
where s.id = sp.subscription_id and sp.billing_interval is null;

create or replace function public.fill_payment_interval()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.billing_interval is null and new.subscription_id is not null then
    select p.billing_interval into new.billing_interval
    from public.subscriptions s join public.subscription_products p on p.id = s.product_id
    where s.id = new.subscription_id;
  end if;
  return new;
end;
$$;
revoke execute on function public.fill_payment_interval() from public, anon, authenticated;
create trigger subscription_payments_fill_interval before insert or update of subscription_id on public.subscription_payments
for each row execute function public.fill_payment_interval();

alter table public.subscription_payments alter column user_id drop not null;
alter table public.subscription_payments drop constraint subscription_payments_user_id_fkey;
alter table public.subscription_payments add constraint subscription_payments_user_id_fkey
  foreign key (user_id) references public.profiles (id) on delete set null;
comment on column public.subscription_payments.user_id is 'Persona que pagó; null si la cuenta se borró (el débito se conserva sin datos personales).';

-- Ingresos por período: usan el período guardado en el débito.
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
    'subs_by_interval', (
      select coalesce(jsonb_object_agg(x.billing_interval::text, jsonb_build_object('active', x.active, 'expiring_15d', x.expiring, 'ended', x.ended)), '{}')
      from (
        select p.billing_interval,
               count(distinct s.user_id) filter (where s.status in ('active', 'trialing', 'past_due', 'cancelled') and s.current_period_end > now()
                 and (p.billing_interval = 'year' or s.status <> 'cancelled')) as active,
               count(distinct s.user_id) filter (where p.billing_interval = 'year' and s.status in ('active', 'cancelled')
                 and s.current_period_end > now() and s.current_period_end <= now() + interval '15 days') as expiring,
               count(distinct s.user_id) filter (where s.current_period_end <= now() or s.status = 'expired') as ended
        from public.subscriptions s join public.subscription_products p on p.id = s.product_id
        where s.provider <> 'manual' and p.tier = 'premium' and p.billing_interval is not null
        group by p.billing_interval) x),
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
    'revenue_by_interval', (
      select coalesce(jsonb_agg(jsonb_build_object('interval', r.billing_interval, 'currency', r.currency, 'amount_minor', r.amount, 'payments', r.n) order by r.billing_interval, r.currency), '[]')
      from (select coalesce(sp.billing_interval::text, p.billing_interval::text, 'month') as billing_interval, coalesce(sp.currency, '—') as currency,
                   sum(coalesce(sp.amount_minor, 0)) as amount, count(*) as n
            from public.subscription_payments sp
            left join public.subscriptions s on s.id = sp.subscription_id
            left join public.subscription_products p on p.id = s.product_id
            where sp.status = 'approved' group by 1, 2) r),
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


-- 2) Qué impide borrar a una persona (null si se puede). Solo administradores.
create or replace function public.admin_user_deletion_block(p_user uuid)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  r public.app_role;
begin
  if not public.is_admin() then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  if p_user = (select auth.uid()) then return 'self'; end if;
  select role into r from public.profiles where id = p_user;
  if r is null then return 'missing'; end if;
  if r = 'admin' then return 'admin'; end if;
  if public.has_premium(p_user) or public.annual_access_until(p_user) is not null then return 'premium'; end if;
  -- Un débito automático que puede seguir cobrando: primero hay que cancelarlo.
  if exists (select 1 from public.subscriptions s where s.user_id = p_user and s.provider <> 'manual'
             and s.status in ('active', 'trialing', 'past_due')) then return 'subscription'; end if;
  if exists (select 1 from public.subscriptions s where s.user_id = p_user and s.provider <> 'manual'
             and s.status = 'pending' and s.created_at > now() - interval '2 days') then return 'pending'; end if;
  return null;
end;
$$;
revoke execute on function public.admin_user_deletion_block(uuid) from public, anon;
grant execute on function public.admin_user_deletion_block(uuid) to authenticated;

-- Una suscripción se puede borrar si no da acceso ni puede cobrar: cancelada o vencida y terminada,
-- asignada a mano y terminada, o pendiente de pago hace más de 2 días (un pago que nunca se hizo).
create or replace function public.subscription_deletable(p_status public.subscription_status, p_provider public.payment_provider,
  p_period_end timestamptz, p_created_at timestamptz)
returns boolean
language sql
stable
set search_path = ''
as $$
  select (p_status in ('cancelled', 'expired') and (p_period_end is null or p_period_end <= now()))
      or (p_provider = 'manual' and p_period_end is not null and p_period_end <= now())
      or (p_status = 'pending' and p_created_at <= now() - interval '2 days');
$$;

-- Borra una suscripción que no está activa (sus débitos quedan guardados). Solo administradores.
create or replace function public.admin_delete_subscription(p_subscription uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  s public.subscriptions%rowtype;
begin
  if not public.is_admin() then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  select * into s from public.subscriptions where id = p_subscription for update;
  if not found then return 'missing'; end if;
  if not public.subscription_deletable(s.status, s.provider, s.current_period_end, s.created_at) then return 'active'; end if;
  perform public.write_audit_log('subscription.deleted', 'subscription', s.id::text,
    jsonb_build_object('user_id', s.user_id, 'status', s.status, 'provider', s.provider));
  delete from public.subscriptions where id = s.id;
  return 'deleted';
end;
$$;
revoke execute on function public.admin_delete_subscription(uuid) from public, anon;
grant execute on function public.admin_delete_subscription(uuid) to authenticated;

-- Todos los débitos: también los de cuentas borradas (sin correo ni nombre).
create or replace function public.admin_debits(p_user_id uuid default null, p_limit integer default 50, p_offset integer default 0)
returns table (
  payment_id uuid, provider public.payment_provider, provider_payment_id text, status text,
  amount_minor bigint, currency text, paid_at timestamptz, failure_code text,
  user_id uuid, email text, display_name text, total_count bigint
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
  select sp.id, sp.provider, sp.provider_payment_id, sp.status,
         sp.amount_minor, sp.currency, sp.paid_at, sp.failure_code,
         sp.user_id, u.email::text, p.display_name, count(*) over ()
  from public.subscription_payments sp
  left join public.profiles p on p.id = sp.user_id
  left join auth.users u on u.id = sp.user_id
  where p_user_id is null or sp.user_id = p_user_id
  order by sp.paid_at desc
  limit least(greatest(p_limit, 1), 200) offset greatest(p_offset, 0);
end;
$$;
revoke execute on function public.admin_debits(uuid, integer, integer) from public, anon;
grant execute on function public.admin_debits(uuid, integer, integer) to authenticated;
