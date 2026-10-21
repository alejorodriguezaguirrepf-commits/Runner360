-- Plan anual: pago único por 12 meses (sin renovación automática), cobrado en pesos.
-- Durante su vigencia, cualquier plan de la biblioteca se ve COMPLETO desde el inicio y se puede
-- renovar o cambiar sin volver a pagar. Al vencer, no se generan planes completos nuevos (vuelve la
-- muestra gratuita), pero se conserva el historial y el plan que se empezó con el anual.
-- Solo agrega y reemplaza funciones y actualiza textos del producto anual: no borra datos.
-- Reversión: supabase/rollback/20261021000100_annual_plan.down.sql

-- 1) Textos del producto anual (precio de lista sin cambios: USD 180).
update public.subscription_products
set description = 'Un único pago por 12 meses, sin renovación automática.',
    features = array[
      'Todo lo incluido en Premium mensual',
      'Cualquier plan completo desde el primer día',
      'Renovás o cambiás de plan sin volver a pagar',
      'Te avisamos 15 días antes de que venza'
    ]
where code = 'premium_yearly';

-- 2) Hasta cuándo tiene acceso anual una persona (null si no tiene). Encadena compras: una renovación
--    anticipada empieza cuando termina la anterior.
create or replace function public.annual_access_until(p_user uuid)
returns timestamptz
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when exists (
      select 1 from public.subscriptions s join public.subscription_products p on p.id = s.product_id
      where s.user_id = p_user and p.tier = 'premium' and p.billing_interval = 'year'
        and s.status in ('active', 'trialing', 'past_due', 'cancelled')
        and coalesce(s.current_period_start, s.started_at, s.created_at) <= now() and s.current_period_end > now()
    )
    then (
      select max(s.current_period_end) from public.subscriptions s join public.subscription_products p on p.id = s.product_id
      where s.user_id = p_user and p.tier = 'premium' and p.billing_interval = 'year'
        and s.status in ('active', 'trialing', 'past_due', 'cancelled') and s.current_period_end > now()
    )
  end
  where p_user = (select auth.uid()) or public.is_staff() or (select auth.uid()) is null;
$$;
revoke execute on function public.annual_access_until(uuid) from public, anon;
grant execute on function public.annual_access_until(uuid) to authenticated, service_role;

-- 3) ¿La inscripción se hizo con el plan anual vigente? (período del anual que contiene su alta).
create or replace function public.enrollment_in_annual(p_user uuid, p_created timestamptz)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.subscriptions s join public.subscription_products p on p.id = s.product_id
    where s.user_id = p_user and p.tier = 'premium' and p.billing_interval = 'year'
      and s.status in ('active', 'trialing', 'past_due', 'cancelled', 'expired')
      and s.current_period_end is not null
      and coalesce(s.current_period_start, s.started_at, s.created_at) <= p_created
      and p_created < s.current_period_end
  );
$$;
revoke execute on function public.enrollment_in_annual(uuid, timestamptz) from public, anon, authenticated;

-- 4) Semanas liberadas: con el anual, el plan completo. Si no, la regla mensual de siempre.
create or replace function public.enrollment_open_weeks(p_enrollment uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when public.enrollment_in_annual(e.user_id, e.created_at) then
      coalesce((select lp.duration_weeks from public.library_plans lp where lp.content_version = e.content_version and lp.id = e.plan_id), 0)
    else greatest(
      coalesce((select s.free_preview_weeks from public.library_settings s where s.id), 0),
      4 * greatest(
        (select count(*) from public.subscription_payments sp
          where sp.user_id = e.user_id and sp.status = 'approved' and sp.paid_at >= e.created_at - interval '31 days'),
        case when public.has_premium(e.user_id) then greatest(0, current_date - e.start_date) / 28 + 1 else 0 end
      )
    )
  end::integer
  from public.plan_enrollments e
  where e.id = p_enrollment
    and (e.user_id = (select auth.uid()) or public.is_staff());
$$;

-- 5) Panel: suscriptores e ingresos separados entre mensual y anual.
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
      from (select coalesce(p.billing_interval::text, 'month') as billing_interval, coalesce(sp.currency, '—') as currency,
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
