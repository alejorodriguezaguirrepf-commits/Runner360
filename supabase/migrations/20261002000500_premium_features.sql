-- RUNNER 360 — Funcionalidades Premium configurables desde administración, con control en backend.

create table public.app_features (
  key text primary key check (key ~ '^[a-z_]{2,40}$'),
  label text not null check (char_length(label) between 1 and 80),
  requires_premium boolean not null default true,
  updated_at timestamptz not null default now()
);
comment on table public.app_features is 'Qué funciones requieren Premium. Editable por administradores; se aplica en RLS.';

create trigger app_features_set_updated_at before update on public.app_features
for each row execute function public.set_updated_at();

alter table public.app_features enable row level security;
create policy features_read on public.app_features for select to anon, authenticated using (true);
create policy features_admin_write on public.app_features for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

insert into public.app_features (key, label, requires_premium) values
  ('hydration', 'Hidratación', true),
  ('competitions', 'Competencias', true),
  ('advanced_stats', 'Estadísticas avanzadas', true);

create or replace function public.can_use_feature(p_feature text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_staff()
      or coalesce((select not f.requires_premium from public.app_features f where f.key = p_feature), false)
      or public.has_premium((select auth.uid()));
$$;

-- Escritura de módulos Premium: además de ser el titular, la función debe estar habilitada.
-- La lectura y el borrado de datos propios se mantienen siempre (derecho de acceso y supresión).
drop policy hydration_logs_own on public.hydration_logs;
create policy hydration_logs_select_own on public.hydration_logs for select to authenticated
  using (user_id = (select auth.uid()));
create policy hydration_logs_delete_own on public.hydration_logs for delete to authenticated
  using (user_id = (select auth.uid()));
create policy hydration_logs_insert_own on public.hydration_logs for insert to authenticated
  with check (user_id = (select auth.uid()) and public.can_use_feature('hydration'));
create policy hydration_logs_update_own on public.hydration_logs for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()) and public.can_use_feature('hydration'));

drop policy hydration_reminders_own on public.hydration_reminders;
create policy hydration_reminders_select_own on public.hydration_reminders for select to authenticated
  using (user_id = (select auth.uid()));
create policy hydration_reminders_delete_own on public.hydration_reminders for delete to authenticated
  using (user_id = (select auth.uid()));
create policy hydration_reminders_insert_own on public.hydration_reminders for insert to authenticated
  with check (user_id = (select auth.uid()) and public.can_use_feature('hydration'));
create policy hydration_reminders_update_own on public.hydration_reminders for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()) and public.can_use_feature('hydration'));

drop policy competitions_own on public.competitions;
create policy competitions_select_own on public.competitions for select to authenticated
  using (user_id = (select auth.uid()));
create policy competitions_delete_own on public.competitions for delete to authenticated
  using (user_id = (select auth.uid()));
create policy competitions_insert_own on public.competitions for insert to authenticated
  with check (user_id = (select auth.uid()) and public.can_use_feature('competitions'));
create policy competitions_update_own on public.competitions for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()) and public.can_use_feature('competitions'));
