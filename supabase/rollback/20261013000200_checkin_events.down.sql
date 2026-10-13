-- Reversión de 20261013000200_checkin_events.sql.
-- Falla si ya hay pausas/reanudaciones en la misma semana que una revisión (habría que resolverlas a mano).
begin;
drop index if exists public.weekly_checkins_one_review_per_week;
alter table public.weekly_checkins add constraint weekly_checkins_enrollment_id_week_start_key unique (enrollment_id, week_start);
do $$
begin
  if to_regclass('runner360_meta.schema_migrations') is not null then
    delete from runner360_meta.schema_migrations where version = '20261013000200';
  end if;
end $$;
commit;
