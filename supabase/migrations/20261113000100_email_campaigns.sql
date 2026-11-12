-- Correos de motivación: cada semana a quienes no tienen suscripción (invitación a suscribirse) y cada
-- 15 días a quienes sí (aliento para seguir entrenando). Cada persona puede darse de baja con el link del
-- correo (sin iniciar sesión) o desde su perfil. Solo agrega tablas y una función: no toca datos.

-- Preferencia y token de baja (uno por persona).
create table public.email_preferences (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  motivational boolean not null default true,
  unsubscribe_token uuid not null unique default gen_random_uuid(),
  updated_at timestamptz not null default now()
);
comment on table public.email_preferences is 'Correos de motivación (opt-out) y token del link de baja.';
create trigger email_preferences_set_updated_at before update on public.email_preferences
for each row execute function public.set_updated_at();
alter table public.email_preferences enable row level security;
create policy email_preferences_own_read on public.email_preferences for select to authenticated
  using (user_id = (select auth.uid()));
create policy email_preferences_own_update on public.email_preferences for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
revoke all on public.email_preferences from anon;
revoke insert, update, delete on public.email_preferences from authenticated;
-- Desde el perfil solo se cambia la preferencia (el token no).
grant update (motivational) on public.email_preferences to authenticated;

-- Fila para cada perfil nuevo y para los que ya existen.
create or replace function public.create_email_preferences()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.email_preferences (user_id) values (new.id) on conflict (user_id) do nothing;
  return new;
end;
$$;
revoke execute on function public.create_email_preferences() from public, anon, authenticated;
create trigger profiles_email_preferences after insert on public.profiles
for each row execute function public.create_email_preferences();
insert into public.email_preferences (user_id) select id from public.profiles on conflict (user_id) do nothing;

-- Registro de envíos (evita duplicados y marca la frecuencia). Solo el servidor lo usa.
create table public.email_sends (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('invite', 'encourage')),
  sent_on date not null default current_date,
  created_at timestamptz not null default now(),
  constraint email_sends_once_per_day unique (user_id, kind, sent_on)
);
comment on table public.email_sends is 'Correos de motivación enviados (invitación semanal y aliento quincenal).';
create index email_sends_user_kind_idx on public.email_sends (user_id, kind, sent_on desc);
alter table public.email_sends enable row level security;
create policy email_sends_staff_read on public.email_sends for select to authenticated using (public.is_admin());
revoke all on public.email_sends from anon;
revoke insert, update, delete on public.email_sends from authenticated;

-- Destinatarios posibles (correo confirmado, cuenta de más de 2 días, sin baja; nunca administradores),
-- con su estado de suscripción y el último envío de cada tipo. Solo para el servidor (service_role).
create or replace function public.email_campaign_candidates()
returns table (user_id uuid, email text, display_name text, premium boolean, last_invite date, last_encourage date, unsubscribe_token uuid)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, u.email::text, p.display_name, public.has_premium(p.id),
         (select max(s.sent_on) from public.email_sends s where s.user_id = p.id and s.kind = 'invite'),
         (select max(s.sent_on) from public.email_sends s where s.user_id = p.id and s.kind = 'encourage'),
         ep.unsubscribe_token
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

-- Baja con el link del correo (sin sesión): solo con el token, que no se puede adivinar.
create or replace function public.email_unsubscribe(p_token uuid)
returns boolean
language sql
security definer
set search_path = ''
as $$
  with u as (
    update public.email_preferences set motivational = false where unsubscribe_token = p_token returning user_id
  )
  select exists (select 1 from u);
$$;
revoke execute on function public.email_unsubscribe(uuid) from public, authenticated;
grant execute on function public.email_unsubscribe(uuid) to anon, authenticated, service_role;
