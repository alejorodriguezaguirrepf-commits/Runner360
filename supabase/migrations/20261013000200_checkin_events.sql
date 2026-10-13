-- RUNNER 360 — Check-ins: una sola REVISIÓN semanal por semana, pero pausas y reanudaciones libres
-- (p. ej. pausar por dolor y retomar en la misma semana).
-- Reversión: supabase/rollback/20261013000200_checkin_events.down.sql
alter table public.weekly_checkins drop constraint weekly_checkins_enrollment_id_week_start_key;
create unique index weekly_checkins_one_review_per_week on public.weekly_checkins (enrollment_id, week_start)
  where decision not in ('pause', 'resume');
