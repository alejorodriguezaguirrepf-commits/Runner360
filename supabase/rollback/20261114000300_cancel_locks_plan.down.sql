-- Reversión manual de 20261114000300_cancel_locks_plan.sql (con autorización).
alter table public.library_settings drop constraint if exists library_settings_one_free_week;
-- enrollment_open_weeks: volver a aplicar la versión de 20261021000100_annual_plan.sql.
-- library_day_is_open: volver a aplicar la versión de 20261014000100_monthly_release.sql.
drop function if exists public.plan_locked_by_cancellation(uuid);
drop function if exists public.my_plan_locked_by_cancellation();
