-- Runnie, el asistente de RUNNER 360: cupo diario de mensajes por persona (hora de Argentina).
-- Solo se cuenta cuántos mensajes se enviaron; el texto de las conversaciones no se guarda.
-- Tope: 5 por día sin suscripción, 30 con suscripción (lo decide la base, no el navegador).

create table public.runnie_usage (
  user_id uuid not null references public.profiles (id) on delete cascade,
  day date not null,
  messages integer not null default 0 check (messages >= 0),
  primary key (user_id, day)
);
comment on table public.runnie_usage is 'Mensajes enviados a Runnie por persona y día (solo el conteo, sin contenido).';
alter table public.runnie_usage enable row level security;
-- Cada persona ve su propio conteo. Nadie lo escribe directo: solo las funciones de abajo.
create policy runnie_usage_own_read on public.runnie_usage for select to authenticated using (user_id = (select auth.uid()));

-- Día actual en Argentina (el cupo se renueva a la medianoche de Buenos Aires).
create or replace function public.runnie_today()
returns date language sql stable set search_path = '' as $$
  select (now() at time zone 'America/Argentina/Buenos_Aires')::date;
$$;

-- Tope diario de quien llama: 30 con suscripción (o plan anual), 5 sin suscripción.
create or replace function public.runnie_daily_limit()
returns integer language sql stable security definer set search_path = '' as $$
  select case when public.has_premium((select auth.uid())) then 30 else 5 end;
$$;

-- Mensajes que le quedan hoy a quien llama.
create or replace function public.runnie_remaining()
returns integer language sql stable security definer set search_path = '' as $$
  select greatest(0, public.runnie_daily_limit() - coalesce(
    (select u.messages from public.runnie_usage u where u.user_id = (select auth.uid()) and u.day = public.runnie_today()), 0));
$$;

-- Toma un mensaje del cupo de hoy, de forma atómica. Devuelve cuántos quedan después, o -1 si no quedaban.
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

-- Devuelve el mensaje al cupo cuando Runnie no pudo responder. Solo el servidor (service_role):
-- si la pudiera llamar cada persona, podría reponerse el cupo sin límite.
create or replace function public.runnie_give_back(p_user uuid)
returns void language sql volatile security definer set search_path = '' as $$
  update public.runnie_usage set messages = messages - 1
  where user_id = p_user and day = public.runnie_today() and messages > 0;
$$;

revoke execute on function public.runnie_daily_limit() from public, anon;
revoke execute on function public.runnie_remaining() from public, anon;
revoke execute on function public.runnie_take_message() from public, anon;
revoke execute on function public.runnie_give_back(uuid) from public, anon, authenticated;
grant execute on function public.runnie_daily_limit() to authenticated;
grant execute on function public.runnie_remaining() to authenticated;
grant execute on function public.runnie_take_message() to authenticated;
grant execute on function public.runnie_give_back(uuid) to service_role;
