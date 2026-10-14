-- Reversión de 20261015000100_session_ratings.sql. Borra las valoraciones: exportarlas antes si hace falta.
begin;
drop table if exists public.session_ratings;
do $$
begin
  if to_regclass('runner360_meta.schema_migrations') is not null then
    delete from runner360_meta.schema_migrations where version = '20261015000100';
  end if;
end $$;
commit;
