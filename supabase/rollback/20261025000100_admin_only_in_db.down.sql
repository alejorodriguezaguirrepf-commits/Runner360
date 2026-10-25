-- Reversión manual de 20261025000100_admin_only_in_db.sql (con autorización).
-- Vuelve a la regla "admin al confirmar el correo del dueño" y al control de roles anterior.
-- ATENCIÓN: con el registro sin confirmación por correo, esa regla da admin a quien se registre con
-- ese correo. Revertir solo si la confirmación por correo vuelve a estar activa.
begin;
create table if not exists public.admin_emails (
  email text primary key check (email = lower(email) and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  created_at timestamptz not null default now()
);
comment on table public.admin_emails is 'Correos que reciben el rol admin al confirmarse. Sin acceso desde la API.';
alter table public.admin_emails enable row level security;
insert into public.admin_emails (email) values ('alejorodriguezaguirrepf@gmail.com') on conflict do nothing;

create or replace function public.grant_owner_admin()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.email_confirmed_at is not null
     and exists (select 1 from public.admin_emails a where a.email = lower(new.email)) then
    update public.profiles set role = 'admin' where id = new.id and role <> 'admin';
  end if;
  return new;
end;
$$;
revoke execute on function public.grant_owner_admin() from public, anon, authenticated;
create trigger on_auth_user_owner_admin
after insert or update of email_confirmed_at on auth.users
for each row execute function public.grant_owner_admin();

create or replace function public.guard_profile_privileges()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if (new.role is distinct from old.role or new.can_validate_plans is distinct from old.can_validate_plans) then
    if (select auth.uid()) is not null and not public.is_admin() then
      raise exception 'No autorizado para modificar roles o permisos' using errcode = '42501';
    end if;
    if new.id = (select auth.uid()) and new.role <> 'admin' and old.role = 'admin' then
      raise exception 'Un administrador no puede quitarse su propio rol' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;
commit;
