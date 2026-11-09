-- Runnie pasa a ser parte de la suscripción: 30 mensajes por día con suscripción (o plan anual) y
-- 0 sin suscripción. Además, con tope 0 no se registra ningún mensaje (antes, el primer mensaje
-- del día entraba aunque el tope fuera 0).

create or replace function public.runnie_daily_limit()
returns integer language sql stable security definer set search_path = '' as $$
  select case when public.has_premium((select auth.uid())) then 30 else 0 end;
$$;

create or replace function public.runnie_take_message()
returns integer language plpgsql volatile security definer set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
  lim integer;
  used integer;
begin
  if uid is null then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  lim := public.runnie_daily_limit();
  if lim <= 0 then
    return -1;
  end if;
  insert into public.runnie_usage as u (user_id, day, messages)
  values (uid, public.runnie_today(), 1)
  on conflict (user_id, day) do update set messages = u.messages + 1 where u.messages < lim
  returning u.messages into used;
  if used is null then
    return -1;
  end if;
  return lim - used;
end;
$$;
