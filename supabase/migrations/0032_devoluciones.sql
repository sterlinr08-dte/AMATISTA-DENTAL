-- DELUXE BEAUTY CENTER - Devoluciones / notas de crédito.
-- Una devolución se hace sobre una factura pagada (total o por renglón).
-- Repone el stock de los productos devueltos y registra la salida de dinero.

create table if not exists public.devoluciones (
  id uuid primary key default gen_random_uuid(),
  factura_id uuid not null references public.facturas(id) on delete cascade,
  fecha date not null default current_date,
  monto numeric not null default 0,
  metodo_pago text not null default 'Efectivo',
  motivo text,
  caja_id uuid references public.caja_sesiones(id) on delete set null,
  registrado_por text,
  created_at timestamptz not null default now()
);

create table if not exists public.devolucion_items (
  id uuid primary key default gen_random_uuid(),
  devolucion_id uuid not null references public.devoluciones(id) on delete cascade,
  factura_item_id uuid references public.factura_items(id) on delete set null,
  articulo_id uuid references public.articulos(id) on delete set null,
  descripcion text,
  cantidad numeric not null default 0,
  importe numeric not null default 0
);

create index if not exists idx_devoluciones_factura on public.devoluciones(factura_id);
create index if not exists idx_devolucion_items_dev on public.devolucion_items(devolucion_id);

alter table public.devoluciones enable row level security;
alter table public.devolucion_items enable row level security;
create policy "auth_devoluciones" on public.devoluciones
  for all to authenticated using (true) with check (true);
create policy "auth_devolucion_items" on public.devolucion_items
  for all to authenticated using (true) with check (true);
