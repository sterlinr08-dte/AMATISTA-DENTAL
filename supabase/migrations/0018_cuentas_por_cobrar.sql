-- DELUXE BEAUTY CENTER - Cuentas por cobrar: abonos (pagos parciales) de facturas a crédito
create table if not exists public.factura_abonos (
  id uuid primary key default gen_random_uuid(),
  factura_id uuid not null references public.facturas(id) on delete cascade,
  fecha date not null default current_date,
  monto numeric not null check (monto > 0),
  metodo_pago text,
  caja_id uuid references public.caja_sesiones(id) on delete set null,
  registrado_por text,
  notas text,
  created_at timestamptz not null default now()
);
create index if not exists idx_abonos_factura on public.factura_abonos(factura_id);

alter table public.factura_abonos enable row level security;
drop policy if exists "auth_factura_abonos" on public.factura_abonos;
create policy "auth_factura_abonos" on public.factura_abonos
  for all to authenticated using (true) with check (true);
