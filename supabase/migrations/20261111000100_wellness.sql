-- Cuestionario wellness diario (antes de entrenar): sueño, energía, dolor muscular, estrés y ánimo,
-- de 1 (peor) a 5 (mejor). score = suma (5–25) lo calcula la base. Uno por persona y día (se puede
-- corregir). Son datos de salud: solo con consentimiento vigente. Los ve la persona y el equipo
-- (entrenador / admin) para seguir su recuperación. Solo agrega una tabla: no toca datos existentes.

create table public.wellness_checkins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  check_date date not null,
  sleep smallint not null check (sleep between 1 and 5),
  energy smallint not null check (energy between 1 and 5),
  soreness smallint not null check (soreness between 1 and 5),
  stress smallint not null check (stress between 1 and 5),
  mood smallint not null check (mood between 1 and 5),
  score smallint generated always as (sleep + energy + soreness + stress + mood) stored,
  note text check (note is null or char_length(note) <= 300),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint wellness_one_per_day unique (user_id, check_date),
  -- Fecha local de la persona: como mucho un día adelante del UTC del servidor.
  constraint wellness_not_future check (check_date <= (created_at at time zone 'UTC')::date + 1)
);
comment on table public.wellness_checkins is 'Wellness diario (1–5 por ítem, score 5–25). Dato de salud: requiere consentimiento.';
create index wellness_user_date_idx on public.wellness_checkins (user_id, check_date desc);
create index wellness_date_idx on public.wellness_checkins (check_date desc);
create trigger wellness_set_updated_at before update on public.wellness_checkins
for each row execute function public.set_updated_at();

alter table public.wellness_checkins enable row level security;
create policy wellness_select on public.wellness_checkins for select to authenticated
  using (user_id = (select auth.uid()) or public.is_staff());
create policy wellness_insert_own on public.wellness_checkins for insert to authenticated
  with check (user_id = (select auth.uid()) and public.has_consent((select auth.uid()), 'health_data'));
create policy wellness_update_own on public.wellness_checkins for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and public.has_consent((select auth.uid()), 'health_data'));
create policy wellness_delete_own on public.wellness_checkins for delete to authenticated
  using (user_id = (select auth.uid()));
revoke all on public.wellness_checkins from anon;
