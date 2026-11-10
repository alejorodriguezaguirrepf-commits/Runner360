-- Reversión manual de 20261110000400_heart_rate.sql (con autorización): borra las mediciones de pulsaciones.
begin;
drop table if exists public.heart_rate_measurements;
commit;
