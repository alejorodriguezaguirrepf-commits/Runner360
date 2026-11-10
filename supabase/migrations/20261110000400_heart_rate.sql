-- Pulsaciones medidas con la cámara (fotopletismografía): conteo de 6" × 10.
-- bpm lo calcula la base (beats × 10): nunca puede quedar distinto. Solo se guardan lecturas de
-- calidad suficiente (confidence >= 0,5). Cada persona ve, crea y borra las suyas; no se editan.
-- Nunca se guardan imágenes: el video se procesa en el dispositivo.

create table public.heart_rate_measurements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  beats smallint not null check (beats between 4 and 21),
  bpm smallint generated always as (beats * 10) stored,
  confidence numeric(4, 3) not null check (confidence >= 0.5 and confidence <= 1),
  context text not null default 'reposo' check (context in ('reposo', 'post_carrera', 'otro')),
  run_id uuid references public.workout_logs (id) on delete set null,
  measured_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint heart_rate_measured_not_future check (measured_at <= created_at + interval '5 minutes')
);
comment on table public.heart_rate_measurements is 'Pulsaciones (6" × 10) medidas con la cámara del celular. Estimativo, no es un dato médico.';
create index heart_rate_user_idx on public.heart_rate_measurements (user_id, measured_at desc);
create index heart_rate_run_idx on public.heart_rate_measurements (run_id) where run_id is not null;

alter table public.heart_rate_measurements enable row level security;
create policy heart_rate_own_read on public.heart_rate_measurements for select to authenticated
  using (user_id = (select auth.uid()));
-- Al crear: es propia y, si se asocia a una carrera, la carrera también es propia.
create policy heart_rate_own_insert on public.heart_rate_measurements for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and (run_id is null or exists (select 1 from public.workout_logs w where w.id = run_id and w.user_id = (select auth.uid())))
  );
create policy heart_rate_own_delete on public.heart_rate_measurements for delete to authenticated
  using (user_id = (select auth.uid()));
revoke all on public.heart_rate_measurements from anon;
revoke update on public.heart_rate_measurements from authenticated;
