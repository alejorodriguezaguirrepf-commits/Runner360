-- Reversión manual de 20261114000200_admin_deletions.sql (con autorización). Los débitos de cuentas ya
-- borradas (user_id null) se tienen que borrar antes de volver a exigir la persona.
drop function if exists public.admin_delete_subscription(uuid);
drop function if exists public.subscription_deletable(public.subscription_status, public.payment_provider, timestamptz, timestamptz);
drop function if exists public.admin_user_deletion_block(uuid);
drop trigger if exists subscription_payments_fill_interval on public.subscription_payments;
drop function if exists public.fill_payment_interval();
alter table public.subscription_payments drop constraint subscription_payments_user_id_fkey;
alter table public.subscription_payments add constraint subscription_payments_user_id_fkey
  foreign key (user_id) references public.profiles (id) on delete cascade;
-- alter table public.subscription_payments alter column user_id set not null;  (solo si no quedan débitos anónimos)
alter table public.subscription_payments drop column billing_interval;
-- admin_dashboard: volver a aplicar la versión de 20261021000100_annual_plan.sql.
