-- Reversión manual de 20261109000400_runnie_solo_suscripcion.sql: vuelve a 5 mensajes por día sin suscripción.
create or replace function public.runnie_daily_limit()
returns integer language sql stable security definer set search_path = '' as $$
  select case when public.has_premium((select auth.uid())) then 30 else 5 end;
$$;
