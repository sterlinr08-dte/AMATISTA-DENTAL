-- DELUXE BEAUTY CENTER - Pago dividido / mixto en ventas de contado.
-- Una factura puede cobrarse con varios métodos (ej. parte efectivo, parte tarjeta).
-- Cada línea de pago se guarda aquí; la parte en efectivo entra a la caja.

create table if not exists public.factura_pagos (
  id uuid primary key default gen_random_uuid(),
  factura_id uuid not null references public.facturas(id) on delete cascade,
  metodo text not null default 'Efectivo',
  monto numeric not null default 0,
  caja_id uuid references public.caja_sesiones(id) on delete set null,
  registrado_por text,
  created_at timestamptz not null default now()
);

create index if not exists idx_factura_pagos_factura on public.factura_pagos(factura_id);
create index if not exists idx_factura_pagos_caja on public.factura_pagos(caja_id);

alter table public.factura_pagos enable row level security;
create policy "auth_factura_pagos" on public.factura_pagos
  for all to authenticated using (true) with check (true);
