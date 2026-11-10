-- Ingreso con huella, Face ID o el bloqueo del dispositivo (llaves de acceso / passkeys, WebAuthn).
-- La huella nunca sale del dispositivo: acá se guarda solo la clave PÚBLICA de cada llave, con la
-- que el servidor verifica la firma al ingresar. Las llaves las crea y actualiza solo el servidor
-- (service_role); cada persona ve y borra las suyas.

create table public.passkeys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  credential_id text not null unique check (char_length(credential_id) between 16 and 1024),
  public_key text not null check (char_length(public_key) between 16 and 2048),
  counter bigint not null default 0 check (counter >= 0),
  transports text[] not null default '{}',
  device_name text not null default 'Este dispositivo' check (char_length(device_name) between 1 and 60),
  backed_up boolean not null default false,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);
comment on table public.passkeys is 'Llaves de acceso (huella/Face ID) de cada cuenta: solo la clave pública, nunca datos biométricos.';
create index passkeys_user_idx on public.passkeys (user_id);
alter table public.passkeys enable row level security;
create policy passkeys_own_read on public.passkeys for select to authenticated using (user_id = (select auth.uid()));
create policy passkeys_own_delete on public.passkeys for delete to authenticated using (user_id = (select auth.uid()));

-- Desafíos de un solo uso para registrar una llave o ingresar con ella (vencen a los 5 minutos).
-- Solo el servidor los lee y escribe: sin políticas para usuarios.
create table public.passkey_challenges (
  id uuid primary key default gen_random_uuid(),
  purpose text not null check (purpose in ('register', 'login')),
  user_id uuid references public.profiles (id) on delete cascade,
  challenge text not null,
  expires_at timestamptz not null default now() + interval '5 minutes',
  constraint passkey_challenges_register_user check (purpose = 'login' or user_id is not null)
);
create index passkey_challenges_expires_idx on public.passkey_challenges (expires_at);
alter table public.passkey_challenges enable row level security;
revoke all on public.passkey_challenges from anon, authenticated;
revoke insert, update on public.passkeys from anon, authenticated;
