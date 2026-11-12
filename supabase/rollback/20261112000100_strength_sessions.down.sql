-- Reversión manual de 20261112000100_strength_sessions.sql (con autorización). Antes hay que borrar la
-- versión 2026.13 de la biblioteca (sus ejercicios usan estas columnas).
begin;
alter table public.library_strength_exercises drop column if exists pattern, drop column if exists session;
commit;
