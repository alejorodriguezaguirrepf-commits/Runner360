-- Pago desde el correo: cada persona tiene un código de pago propio (distinto del de baja) para que la
-- invitación semanal lleve directo a pagar en Mercado Pago sin iniciar sesión. El código solo permite
-- empezar el pago de su propia suscripción. Solo agrega una columna y devuelve el código en la lista de
-- destinatarios: no toca datos.

alter table public.email_preferences add column pay_token uuid not null unique default gen_random_uuid();
comment on column public.email_preferences.pay_token is 'Código del link de pago de los correos (empieza el pago de la propia suscripción).';

drop function if exists public.email_campaign_candidates();
create function public.email_campaign_candidates()
returns table (user_id uuid, email text, display_name text, premium boolean, last_invite date, last_encourage date, unsubscribe_token uuid, pay_token uuid)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, u.email::text, p.display_name, public.has_premium(p.id),
         (select max(s.sent_on) from public.email_sends s where s.user_id = p.id and s.kind = 'invite'),
         (select max(s.sent_on) from public.email_sends s where s.user_id = p.id and s.kind = 'encourage'),
         ep.unsubscribe_token, ep.pay_token
  from public.profiles p
  join auth.users u on u.id = p.id
  join public.email_preferences ep on ep.user_id = p.id
  where u.email is not null
    and u.email_confirmed_at is not null
    and p.role <> 'admin'
    and p.created_at < now() - interval '2 days'
    and ep.motivational;
$$;
revoke execute on function public.email_campaign_candidates() from public, anon, authenticated;
grant execute on function public.email_campaign_candidates() to service_role;
