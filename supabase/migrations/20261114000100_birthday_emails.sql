-- Correo de cumpleaños: el día del cumpleaños (según la fecha de nacimiento del perfil) cada persona
-- recibe una felicitación. Respeta la misma baja que los correos de motivación (Perfil → Correos o el
-- link del correo). Solo agrega un tipo de envío y una función: no toca datos.

-- Nuevo tipo de envío.
alter table public.email_sends drop constraint email_sends_kind_check;
alter table public.email_sends add constraint email_sends_kind_check check (kind in ('invite', 'encourage', 'birthday'));
comment on table public.email_sends is 'Correos enviados: invitación semanal, aliento quincenal y cumpleaños.';

-- Quienes cumplen años en p_today (correo confirmado y sin baja). Quien nació un 29 de febrero recibe el
-- saludo el 28 en los años que no son bisiestos. Uno por año. Solo para el servidor (service_role).
create or replace function public.email_birthday_candidates(p_today date)
returns table (user_id uuid, email text, display_name text, unsubscribe_token uuid)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, u.email::text, p.display_name, ep.unsubscribe_token
  from public.profiles p
  join auth.users u on u.id = p.id
  join public.email_preferences ep on ep.user_id = p.id
  where u.email is not null
    and u.email_confirmed_at is not null
    and ep.motivational
    and p.birth_date is not null
    and p.birth_date < p_today
    and (
      (extract(month from p.birth_date) = extract(month from p_today) and extract(day from p.birth_date) = extract(day from p_today))
      or (
        extract(month from p.birth_date) = 2 and extract(day from p.birth_date) = 29
        and extract(month from p_today) = 2 and extract(day from p_today) = 28
        and not (extract(year from p_today)::int % 4 = 0 and (extract(year from p_today)::int % 100 <> 0 or extract(year from p_today)::int % 400 = 0))
      )
    )
    and not exists (
      select 1 from public.email_sends s where s.user_id = p.id and s.kind = 'birthday' and s.sent_on > p_today - 300
    );
$$;
revoke execute on function public.email_birthday_candidates(date) from public, anon, authenticated;
grant execute on function public.email_birthday_candidates(date) to service_role;
