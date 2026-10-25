-- El rol de administrador ya no se otorga por correo: solo se cambia directamente en la base.
-- Con el registro en un paso (sin correo de confirmación) el correo queda verificado en el alta,
-- así que la regla "admin al confirmar el correo del dueño" permitiría obtener admin registrándose.
-- La cuenta admin existente no cambia.
-- Reversión: supabase/rollback/20261025000100_admin_only_in_db.down.sql

-- 1) Fuera la regla por correo y la lista de correos de administrador (solo tenía el del dueño).
drop trigger if exists on_auth_user_owner_admin on auth.users;
drop function if exists public.grant_owner_admin();
drop table if exists public.admin_emails;

-- 2) Ningún pedido desde la app o la API (ni siquiera de un admin o del servidor con la clave de
--    servicio) puede dar ni quitar el rol admin. Solo desde la base (SQL), fuera de la API.
create or replace function public.guard_profile_privileges()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  from_api constant boolean := session_user = 'authenticator'
    or coalesce(current_setting('role', true), 'none') in ('anon', 'authenticated', 'service_role');
begin
  if (new.role is distinct from old.role or new.can_validate_plans is distinct from old.can_validate_plans) then
    -- Las llamadas con service_role (servidor) no tienen auth.uid().
    if (select auth.uid()) is not null and not public.is_admin() then
      raise exception 'No autorizado para modificar roles o permisos' using errcode = '42501';
    end if;
    if new.id = (select auth.uid()) and new.role <> 'admin' and old.role = 'admin' then
      raise exception 'Un administrador no puede quitarse su propio rol' using errcode = '42501';
    end if;
    if new.role is distinct from old.role and 'admin' in (new.role::text, old.role::text) and from_api then
      raise exception 'El rol de administrador solo se cambia directamente en la base' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;
