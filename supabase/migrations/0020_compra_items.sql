-- DELUXE BEAUTY CENTER - Renglones de compra (una compra puede tener varios artículos)
create table if not exists public.compra_items (
  id uuid primary key default gen_random_uuid(),
  compra_id uuid not null references public.compras(id) on delete cascade,
  articulo_id uuid references public.articulos(id) on delete set null,
  descripcion text not null,
  cantidad numeric not null default 1,
  costo_unit numeric not null default 0,
  importe numeric not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists idx_compra_items_compra on public.compra_items(compra_id);

alter table public.compra_items enable row level security;
drop policy if exists "auth_compra_items" on public.compra_items;
create policy "auth_compra_items" on public.compra_items
  for all to authenticated using (true) with check (true);
