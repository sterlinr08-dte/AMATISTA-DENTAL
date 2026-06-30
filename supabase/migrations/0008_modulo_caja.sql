-- DELUXE BEAUTY CENTER - Módulo de Caja

create sequence if not exists public.caja_numero_seq start 1;

create table public.caja_sesiones (
  id uuid primary key default gen_random_uuid(),
  numero integer not null default nextval('public.caja_numero_seq'),
  abierta_at timestamptz not null default now(),
  cerrada_at timestamptz,
  monto_inicial numeric not null default 0,
  monto_contado numeric,
  diferencia numeric,
  estado text not null default 'ABIERTA' check (estado in ('ABIERTA','CERRADA')),
  abierta_por text,
  cerrada_por text,
  notas text,
  created_at timestamptz not null default now()
);
create index idx_caja_estado on public.caja_sesiones(estado);

create table public.caja_movimientos (
  id uuid primary key default gen_random_uuid(),
  caja_id uuid not null references public.caja_sesiones(id) on delete cascade,
  tipo text not null check (tipo in ('ENTRADA','SALIDA')),
  concepto text not null,
  monto numeric not null default 0,
  created_at timestamptz not null default now()
);
create index idx_caja_mov_caja on public.caja_movimientos(caja_id);

alter table public.caja_sesiones enable row level security;
alter table public.caja_movimientos enable row level security;
create policy "auth_caja_sesiones" on public.caja_sesiones for all to authenticated using (true) with check (true);
create policy "auth_caja_movimientos" on public.caja_movimientos for all to authenticated using (true) with check (true);
