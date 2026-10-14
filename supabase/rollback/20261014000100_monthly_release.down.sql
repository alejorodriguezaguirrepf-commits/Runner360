-- Reversión de 20261014000100_monthly_release.sql.
-- Vuelve a la regla anterior (Premium ve todas las semanas). Borra el registro de débitos: exportarlo antes si hace falta.
begin;
alter policy library_days_read on public.library_days using (public.library_week_is_open(week));
drop function if exists public.library_day_is_open(text, text, smallint);
drop function if exists public.enrollment_open_weeks(uuid);
drop table if exists public.subscription_payments;
update public.app_features set label = 'Biblioteca de planes (semanas completas)' where key = 'plan_library';
do $$
begin
  if to_regclass('runner360_meta.schema_migrations') is not null then
    delete from runner360_meta.schema_migrations where version = '20261014000100';
  end if;
end $$;
commit;
