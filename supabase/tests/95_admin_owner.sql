-- Rol admin del dueño, Premium sin suscripción, "ver como usuario" y panel solo para el admin.
begin;
create function pg_temp.check(p_ok boolean, p_label text) returns void language plpgsql as $$
begin
  if not coalesce(p_ok, false) then raise exception 'Falló: %', p_label; end if;
end; $$;
create function pg_temp.expect_error(p_sql text, p_label text) returns void language plpgsql as $$
begin
  begin execute p_sql; exception when others then return; end;
  raise exception 'Se esperaba un error y no ocurrió: %', p_label;
end; $$;
grant execute on all functions in schema pg_temp to anon, authenticated;

-- Correo del dueño: el alta sin confirmar NO da admin; al confirmar, sí.
delete from auth.users where lower(email) = 'alejorodriguezaguirrepf@gmail.com';
insert into auth.users (id, email) values ('aaaa0000-0000-4000-8000-00000000000a', 'AlejoRodriguezAguirrePF@gmail.com');
select pg_temp.check((select role from public.profiles where id = 'aaaa0000-0000-4000-8000-00000000000a') = 'user', 'sin confirmar: user');
update auth.users set email_confirmed_at = now() where id = 'aaaa0000-0000-4000-8000-00000000000a';
select pg_temp.check((select role from public.profiles where id = 'aaaa0000-0000-4000-8000-00000000000a') = 'admin', 'al confirmar: admin');

-- Otro correo confirmado no recibe nada.
insert into auth.users (id, email, email_confirmed_at) values ('bbbb0000-0000-4000-8000-00000000000b', 'comun@test.local', now());
select pg_temp.check((select role from public.profiles where id = 'bbbb0000-0000-4000-8000-00000000000b') = 'user', 'otro correo: user');

-- Usuario común: no se da admin, no ve el panel ni los correos, no lee datos de otros.
set role authenticated;
set request.jwt.claim.sub = 'bbbb0000-0000-4000-8000-00000000000b';
select pg_temp.expect_error($$update public.profiles set role = 'admin' where id = 'bbbb0000-0000-4000-8000-00000000000b'$$, 'autoasignarse admin');
select pg_temp.check((select role from public.profiles where id = 'bbbb0000-0000-4000-8000-00000000000b') = 'user', 'sigue siendo user');
select pg_temp.expect_error($$select public.admin_dashboard()$$, 'panel para usuario común');
select pg_temp.expect_error($$select * from public.admin_users('')$$, 'listado para usuario común');
select pg_temp.check((select count(*) from public.admin_emails) = 0, 'no ve los correos de admin');
select pg_temp.check((select count(*) from public.profiles where id <> 'bbbb0000-0000-4000-8000-00000000000b') = 0, 'no ve otros perfiles');
select pg_temp.check(not public.has_premium('bbbb0000-0000-4000-8000-00000000000b'), 'sin Premium');
select pg_temp.check((select max(week) from public.library_days where plan_id = 'plan-07') = 1, 'usuario común: solo la muestra gratis');
-- El encabezado de "ver como" no da nada a un usuario común.
select set_config('request.headers', '{"x-r360-view-as": "premium"}', true);
select pg_temp.check(not public.has_premium('bbbb0000-0000-4000-8000-00000000000b'), 'el encabezado no da Premium');
select pg_temp.check(not public.is_admin(), 'el encabezado no da admin');
select set_config('request.headers', '', true);

-- Admin: Premium sin suscripción ni cobro, panel y listado con correo.
set request.jwt.claim.sub = 'aaaa0000-0000-4000-8000-00000000000a';
select pg_temp.check(public.is_admin(), 'es admin');
select pg_temp.check(public.has_premium('aaaa0000-0000-4000-8000-00000000000a'), 'admin con Premium');
select pg_temp.check(public.can_use_feature('hydration'), 'funciones Premium');
select pg_temp.check((select count(*) from public.subscriptions where user_id = 'aaaa0000-0000-4000-8000-00000000000a') = 0, 'sin suscripción creada');
select pg_temp.check((public.admin_dashboard() ->> 'users_total')::int >= 2, 'panel: usuarios');
select pg_temp.check((select email from public.admin_users('comun@') limit 1) = 'comun@test.local', 'listado: búsqueda por correo');
select pg_temp.check((select plan from public.admin_users('comun@') limit 1) = 'Gratis', 'listado: plan');
-- Todas las semanas de todos los planes (de todas las versiones), sin inscripción ni suscripción.
select pg_temp.check(
  (select count(*) from (select distinct content_version, plan_id, week from public.library_days) x)
  = (select count(*) from public.library_weeks), 'admin: todas las semanas de todos los planes');
select pg_temp.check((select count(*) from public.library_days where content_version = '2026.10.1' and plan_id = 'plan-07' and week = 12) = 7, 'admin: semana 12 de plan-07');

-- Ver como usuario sin suscripción: deja de ser admin y de tener Premium.
select set_config('request.headers', '{"x-r360-view-as": "free"}', true);
select pg_temp.check(not public.is_admin(), 'vista sin suscripción: no admin');
select pg_temp.check(not public.is_staff(), 'vista sin suscripción: no staff');
select pg_temp.check(not public.has_premium('aaaa0000-0000-4000-8000-00000000000a'), 'vista sin suscripción: sin Premium');
select pg_temp.expect_error($$select public.admin_dashboard()$$, 'vista: sin panel');
select pg_temp.check((select max(week) from public.library_days where plan_id = 'plan-07') = 1, 'vista sin suscripción: solo la muestra gratis');
-- Ver como usuario con suscripción: Premium, pero no admin.
select set_config('request.headers', '{"x-r360-view-as": "premium"}', true);
select pg_temp.check(not public.is_admin(), 'vista con suscripción: no admin');
select pg_temp.check(public.has_premium('aaaa0000-0000-4000-8000-00000000000a'), 'vista con suscripción: Premium');
-- Como un suscriptor sin plan empezado: en el catálogo, solo la muestra gratis.
select pg_temp.check((select max(week) from public.library_days where plan_id = 'plan-07') = 1, 'vista con suscripción sin inscripción: muestra gratis');
select set_config('request.headers', '', true);
reset role;
rollback;
