-- Panel de administración: quién compró una suscripción y cuándo se le debitó.
-- Solo lectura y solo para administradores. No cambia ninguna tabla ni dato.

-- Una fila por usuario con suscripción (la más reciente): plan, origen (Mercado Pago o asignada a
-- mano), estado, próximo vencimiento y resumen de los débitos aprobados.
create or replace function public.admin_subscribers()
returns table (
  user_id uuid, email text, display_name text,
  subscription_id uuid, plan text, billing_interval text, provider public.payment_provider,
  status public.subscription_status, started_at timestamptz, current_period_end timestamptz,
  cancel_at_period_end boolean, grace_until timestamptz, subscribed_at timestamptz,
  approved_count bigint, total_paid_minor bigint, paid_currency text,
  last_paid_at timestamptz, last_paid_minor bigint
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
  select x.* from (
    select distinct on (s.user_id)
           s.user_id as uid, u.email::text as mail, p.display_name as dname,
           s.id as sid, pr.name as plan_name, pr.billing_interval::text as interval_code, s.provider as prov,
           s.status as sstatus, s.started_at as started, s.current_period_end as period_end,
           s.cancel_at_period_end as cancels, s.grace_until as grace, s.created_at as subscribed,
           coalesce(pay.approved_count, 0) as approved, pay.total_minor as total, pay.currency as cur,
           last.paid_at as last_paid, last.amount_minor as last_amount
    from public.subscriptions s
    join public.profiles p on p.id = s.user_id
    join auth.users u on u.id = s.user_id
    join public.subscription_products pr on pr.id = s.product_id
    left join lateral (
      -- Total solo si todos los débitos son de la misma moneda (si no, sumarlos no tiene sentido).
      select count(*) as approved_count,
             case when count(distinct sp.currency) <= 1 then sum(sp.amount_minor)::bigint end as total_minor,
             min(sp.currency) as currency
      from public.subscription_payments sp
      where sp.user_id = s.user_id and sp.status = 'approved'
    ) pay on true
    left join lateral (
      select sp.paid_at, sp.amount_minor
      from public.subscription_payments sp
      where sp.user_id = s.user_id and sp.status = 'approved'
      order by sp.paid_at desc limit 1
    ) last on true
    order by s.user_id, s.created_at desc
  ) x
  order by coalesce(x.last_paid, x.subscribed) desc;
end;
$$;
revoke execute on function public.admin_subscribers() from public, anon;
grant execute on function public.admin_subscribers() to authenticated;

-- Débitos (aprobados, rechazados, pendientes y devueltos) con el correo de cada usuario, del más
-- nuevo al más viejo. Con p_user_id, solo los de esa persona.
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
  join public.profiles p on p.id = sp.user_id
  join auth.users u on u.id = sp.user_id
  where p_user_id is null or sp.user_id = p_user_id
  order by sp.paid_at desc
  limit least(greatest(p_limit, 1), 200) offset greatest(p_offset, 0);
end;
$$;
revoke execute on function public.admin_debits(uuid, integer, integer) from public, anon;
grant execute on function public.admin_debits(uuid, integer, integer) to authenticated;
