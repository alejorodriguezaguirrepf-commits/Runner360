-- Suscripción mensual con débito automático: cada débito aprobado libera un mes (4 semanas) del plan
-- en el que la persona está inscripta. Los planes de 3, 6 o 12 meses se van liberando mes a mes.
-- Sin suscripción se mantiene la muestra gratuita (library_settings.free_preview_weeks).
-- Solo agrega objetos y reemplaza la condición de lectura de library_days: no borra datos.

-- ===========================================================================
-- Débitos de la suscripción (los escribe solo el webhook con la conexión de servicio)
-- ===========================================================================
create table public.subscription_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  subscription_id uuid references public.subscriptions (id) on delete set null,
  provider public.payment_provider not null,
  provider_payment_id text not null,
  status text not null check (status in ('approved', 'pending', 'rejected', 'refunded')),
  amount_minor bigint check (amount_minor is null or amount_minor >= 0),
  currency text check (currency is null or currency ~ '^[A-Z]{3}$'),
  paid_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint subscription_payments_provider_ref unique (provider, provider_payment_id)
);
comment on table public.subscription_payments is 'Cada débito automático de la suscripción. Un débito aprobado libera un mes (4 semanas) del plan en curso.';
create index subscription_payments_user_idx on public.subscription_payments (user_id, paid_at desc);
create index subscription_payments_subscription_idx on public.subscription_payments (subscription_id);
create trigger subscription_payments_set_updated_at before update on public.subscription_payments
for each row execute function public.set_updated_at();

alter table public.subscription_payments enable row level security;
create policy subscription_payments_select on public.subscription_payments for select to authenticated
  using (user_id = (select auth.uid()) or public.is_staff());

-- ===========================================================================
-- Semanas liberadas de una inscripción
-- ===========================================================================
-- max(muestra gratuita, 4 × meses pagos). Meses pagos = el mayor entre:
--  · débitos aprobados desde el mes anterior a la inscripción (el débito vigente al inscribirse cuenta), y
--  · con la suscripción al día, el mes del plan en curso (cubre el primer débito aún no informado y
--    las suscripciones anuales o asignadas a mano, que también se liberan mes a mes).
-- Lo ya pagado queda liberado aunque después se dé de baja la suscripción.
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

-- ¿Se puede ver el detalle de la semana p_week del plan? La muestra gratuita para todos; el resto,
-- según los meses liberados de una inscripción propia a ese plan (o si la función se hizo gratuita).
create or replace function public.library_day_is_open(p_version text, p_plan text, p_week smallint)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_week <= coalesce((select s.free_preview_weeks from public.library_settings s where s.id), 0)
      or public.is_staff()
      or coalesce((select not f.requires_premium from public.app_features f where f.key = 'plan_library'), false)
      or exists (
        select 1 from public.plan_enrollments e
        where e.user_id = (select auth.uid()) and e.content_version = p_version and e.plan_id = p_plan
          and public.enrollment_open_weeks(e.id) >= p_week
      );
$$;

revoke execute on function public.enrollment_open_weeks(uuid) from public, anon;
grant execute on function public.enrollment_open_weeks(uuid) to authenticated, service_role;
grant execute on function public.library_day_is_open(text, text, smallint) to anon, authenticated, service_role;

alter policy library_days_read on public.library_days
  using (public.library_day_is_open(content_version, plan_id, week));

update public.app_features set label = 'Planes de entrenamiento (liberación mensual con la suscripción)' where key = 'plan_library';
