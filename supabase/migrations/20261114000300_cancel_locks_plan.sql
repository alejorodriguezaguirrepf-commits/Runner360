-- 1) La semana gratis queda fija en 1: ya no se puede cambiar desde el panel ni desde la API.
-- 2) Si la persona cancela su suscripción por su cuenta (o se reintegra el pago), al terminar el período que ya
--    pagó se bloquea el plan completo: lo que falta y lo que ya hizo (también la semana gratis). Vuelve a
--    abrirse si se suscribe de nuevo. Si la suscripción termina por débitos rechazados, sigue la regla de
--    siempre (lo pagado queda liberado), y el anual que termina conserva su plan. El historial de
--    entrenamientos no se toca.
-- Solo cambia una configuración (que ya vale 1) y reemplaza funciones: no borra datos.

update public.library_settings set free_preview_weeks = 1 where free_preview_weeks <> 1;
alter table public.library_settings add constraint library_settings_one_free_week check (free_preview_weeks = 1);
comment on column public.library_settings.free_preview_weeks is 'Semanas gratis de cualquier plan sin suscripción: fija en 1.';

-- ¿La persona canceló por su cuenta y ya terminó lo que pagó? Mira la última suscripción con pago
-- (no las asignadas a mano ni los pagos que nunca se hicieron) y solo si hoy no tiene acceso pago.
create or replace function public.plan_locked_by_cancellation(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_user is not null and not public.has_premium(p_user) and coalesce((
    -- Cancelada (por la persona, o un pago reintegrado), o la mensual con la renovación cancelada.
    -- El anual no se renueva solo: que termine no es una cancelación.
    select (s.status = 'cancelled' or (s.cancel_at_period_end and p.billing_interval = 'month')) and s.current_period_end <= now()
    from public.subscriptions s
    join public.subscription_products p on p.id = s.product_id
    where s.user_id = p_user and s.provider <> 'manual' and s.status <> 'pending' and s.current_period_end is not null
    order by s.created_at desc
    limit 1
  ), false);
$$;
revoke execute on function public.plan_locked_by_cancellation(uuid) from public, anon, authenticated;

-- Semanas liberadas: con la cancelación terminada, ninguna; si no, la regla de siempre.
create or replace function public.enrollment_open_weeks(p_enrollment uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when public.plan_locked_by_cancellation(e.user_id) then 0
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

-- Lectura de los días: la semana gratis tampoco se ve con la cancelación terminada.
create or replace function public.library_day_is_open(p_version text, p_plan text, p_week smallint)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (p_week <= coalesce((select s.free_preview_weeks from public.library_settings s where s.id), 0)
          and not public.plan_locked_by_cancellation((select auth.uid())))
      or public.is_staff()
      or coalesce((select not f.requires_premium from public.app_features f where f.key = 'plan_library'), false)
      or exists (
        select 1 from public.plan_enrollments e
        where e.user_id = (select auth.uid()) and e.content_version = p_version and e.plan_id = p_plan
          and public.enrollment_open_weeks(e.id) >= p_week
      );
$$;
grant execute on function public.library_day_is_open(text, text, smallint) to anon, authenticated, service_role;

-- Para la app: si el plan de la persona quedó bloqueado por su cancelación (para avisarle por qué).
create or replace function public.my_plan_locked_by_cancellation()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.plan_locked_by_cancellation((select auth.uid()));
$$;
revoke execute on function public.my_plan_locked_by_cancellation() from public, anon;
grant execute on function public.my_plan_locked_by_cancellation() to authenticated;
