-- Reversión manual de 20261111000100_wellness.sql (con autorización): borra los cuestionarios wellness.
begin;
drop table if exists public.wellness_checkins;
commit;
