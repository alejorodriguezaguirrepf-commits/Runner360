-- Reversión manual de 20261109000300_runnie.sql (con autorización). Borra los conteos de mensajes de Runnie.
begin;
drop function if exists public.runnie_give_back(uuid);
drop function if exists public.runnie_take_message();
drop function if exists public.runnie_remaining();
drop function if exists public.runnie_daily_limit();
drop function if exists public.runnie_today();
drop table if exists public.runnie_usage;
commit;
