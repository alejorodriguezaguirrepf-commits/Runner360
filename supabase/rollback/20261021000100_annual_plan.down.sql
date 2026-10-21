-- Reversión manual de 20261021000100_annual_plan.sql (con autorización).
-- Vuelve a la liberación mes a mes para todos y al panel anterior. No borra suscripciones ni pagos.
begin;
create or replace function public.enrollment_open_weeks(p_enrollment uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select greatest(
    coalesce((select s.free_preview_weeks from public.library_settings s where s.id), 0),
    4 * greatest(
      (select count(*) from public.subscription_payments sp
        where sp.user_id = e.user_id and sp.status = 'approved' and sp.paid_at >= e.created_at - interval '31 days'),
      case when public.has_premium(e.user_id) then greatest(0, current_date - e.start_date) / 28 + 1 else 0 end
    )
  )::integer
  from public.plan_enrollments e
  where e.id = p_enrollment
    and (e.user_id = (select auth.uid()) or public.is_staff());
$$;

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

drop function if exists public.enrollment_in_annual(uuid, timestamptz);
drop function if exists public.annual_access_until(uuid);

update public.subscription_products
set description = 'Acceso completo con facturación anual.',
    features = array['Todo lo incluido en Premium mensual', 'Un único pago anual']
where code = 'premium_yearly';
commit;
