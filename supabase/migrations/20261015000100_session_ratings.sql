-- Valoración de cada entrenamiento del plan ("¿Cómo te fue?"): 1 = muy mal … 5 = excelente, con una
-- nota opcional. Una por día de entrenamiento de la inscripción; queda registrada como historial.
-- Solo agrega una tabla: no modifica ni borra datos existentes.
create table public.session_ratings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  enrollment_id uuid not null references public.plan_enrollments (id) on delete cascade,
  workout_date date not null,
  plan_week smallint not null check (plan_week between 1 and 60),
  plan_day_index smallint not null check (plan_day_index between 0 and 6),
  rating smallint not null check (rating between 1 and 5),
  note text check (note is null or char_length(note) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint session_ratings_one_per_day unique (enrollment_id, workout_date)
);
alter table public.session_ratings enable row level security;
comment on table public.session_ratings is 'Valoración del corredor de cada entrenamiento del plan (1–5) con nota opcional.';
create index session_ratings_user_idx on public.session_ratings (user_id, workout_date desc);
create trigger session_ratings_set_updated_at before update on public.session_ratings
for each row execute function public.set_updated_at();

create policy session_ratings_select on public.session_ratings for select to authenticated
  using (user_id = (select auth.uid()) or public.is_staff());
create policy session_ratings_insert_own on public.session_ratings for insert to authenticated
  with check (user_id = (select auth.uid()) and exists (
    select 1 from public.plan_enrollments e
    where e.id = session_ratings.enrollment_id and e.user_id = (select auth.uid())));
create policy session_ratings_update_own on public.session_ratings for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and exists (
    select 1 from public.plan_enrollments e
    where e.id = session_ratings.enrollment_id and e.user_id = (select auth.uid())));
create policy session_ratings_delete_own on public.session_ratings for delete to authenticated
  using (user_id = (select auth.uid()));
