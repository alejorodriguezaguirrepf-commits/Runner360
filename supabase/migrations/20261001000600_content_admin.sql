-- RUNNER 360 · Migración 6: contenidos educativos, incidencias, solicitudes de baja y funciones administrativas.

create type public.content_status as enum ('draft', 'published', 'archived');

create table public.educational_contents (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title text not null check (char_length(title) between 3 and 140),
  category text not null check (category in ('training', 'hydration', 'nutrition', 'injury_prevention', 'racing', 'general')),
  summary text check (char_length(summary) <= 300),
  body text not null check (char_length(body) <= 50000),
  access_tier public.subscription_tier not null default 'free',
  status public.content_status not null default 'draft',
  author_id uuid references auth.users (id) on delete set null,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index educational_contents_status_idx on public.educational_contents (status, category);
create trigger educational_contents_updated_at before update on public.educational_contents
  for each row execute function public.set_updated_at();
create trigger educational_contents_audit after insert or update or delete on public.educational_contents
  for each row execute function public.audit_row_change();

create table public.incident_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  kind text not null check (kind in ('bug', 'content', 'payment', 'account', 'other')),
  description text not null check (char_length(description) between 10 and 2000),
  status text not null default 'open' check (status in ('open', 'in_progress', 'resolved', 'dismissed')),
  admin_notes text check (char_length(admin_notes) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index incident_reports_status_idx on public.incident_reports (status, created_at desc);
create trigger incident_reports_updated_at before update on public.incident_reports
  for each row execute function public.set_updated_at();

create table public.account_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  reason text check (char_length(reason) <= 500),
  status text not null default 'pending' check (status in ('pending', 'processing', 'completed', 'rejected')),
  created_at timestamptz not null default now(),
  processed_at timestamptz
);
create unique index account_deletion_requests_pending_uniq on public.account_deletion_requests (user_id) where status = 'pending';

alter table public.educational_contents enable row level security;
alter table public.incident_reports enable row level security;
alter table public.account_deletion_requests enable row level security;

create policy educational_contents_read on public.educational_contents for select to anon, authenticated
  using (
    (status = 'published' and access_tier = 'free')
    or (status = 'published' and access_tier = 'premium' and (select public.has_feature('premium_plans')))
    or (select public.is_staff())
  );
create policy educational_contents_staff_write on public.educational_contents for all to authenticated
  using ((select public.is_staff())) with check ((select public.is_staff()));

create policy incident_reports_insert on public.incident_reports for insert to authenticated
  with check (user_id = (select auth.uid()) and status = 'open' and admin_notes is null);
create policy incident_reports_select on public.incident_reports for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));
create policy incident_reports_admin_update on public.incident_reports for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

create policy account_deletion_requests_own on public.account_deletion_requests for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));
create policy account_deletion_requests_insert on public.account_deletion_requests for insert to authenticated
  with check (user_id = (select auth.uid()) and status = 'pending');
create policy account_deletion_requests_admin_update on public.account_deletion_requests for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- Estadísticas agregadas del negocio (sin datos personales). Solo administradores.
create or replace function public.admin_business_stats()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  return jsonb_build_object(
    'users_total', (select count(*) from public.profiles),
    'users_last_30d', (select count(*) from public.profiles where created_at > now() - interval '30 days'),
    'onboarded', (select count(*) from public.profiles where onboarding_completed_at is not null),
    'active_subscriptions', (select count(*) from public.subscriptions where status in ('active', 'trialing')
                               and (current_period_end is null or current_period_end > now())),
    'active_plans', (select count(*) from public.user_training_plans where status = 'active'),
    'workouts_last_30d', (select count(*) from public.workout_logs where started_at > now() - interval '30 days'),
    'published_versions', (select count(*) from public.training_plan_versions where status = 'published'),
    'open_incidents', (select count(*) from public.incident_reports where status = 'open'),
    'pending_deletions', (select count(*) from public.account_deletion_requests where status = 'pending')
  );
end $$;

-- Cambio de rol auditado. Un administrador no puede quitarse su propio rol de administrador.
create or replace function public.admin_set_role(p_user_id uuid, p_role public.app_role, p_grant boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_role = 'user' then raise exception 'El rol usuario es base y no se modifica'; end if;
  if p_grant then
    insert into public.user_roles (user_id, role, granted_by) values (p_user_id, p_role, (select auth.uid()))
    on conflict do nothing;
  else
    if p_user_id = (select auth.uid()) and p_role = 'admin' then
      raise exception 'No podés quitarte tu propio rol de administrador';
    end if;
    delete from public.user_roles where user_id = p_user_id and role = p_role;
  end if;
end $$;

grant select on public.educational_contents to anon, authenticated;
grant insert, update, delete on public.educational_contents to authenticated;
grant select, insert, update on public.incident_reports, public.account_deletion_requests to authenticated;
revoke execute on function public.admin_business_stats(), public.admin_set_role(uuid, public.app_role, boolean) from public, anon;
grant execute on function public.admin_business_stats(), public.admin_set_role(uuid, public.app_role, boolean) to authenticated;
