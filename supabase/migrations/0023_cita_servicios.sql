-- DELUXE BEAUTY CENTER - Varios servicios por cita
create table if not exists public.cita_servicios (
  id uuid primary key default gen_random_uuid(),
  cita_id uuid not null references public.citas(id) on delete cascade,
  servicio_id uuid references public.servicios(id) on delete set null,
  precio numeric not null default 0,
  duracion_min integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists idx_cita_servicios on public.cita_servicios(cita_id);

alter table public.cita_servicios enable row level security;
drop policy if exists "auth_cita_servicios" on public.cita_servicios;
create policy "auth_cita_servicios" on public.cita_servicios
  for all to authenticated using (true) with check (true);
