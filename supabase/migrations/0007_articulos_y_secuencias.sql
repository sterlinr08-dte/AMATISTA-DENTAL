-- DELUXE BEAUTY CENTER - Artículos (inventario) y secuencias

create sequence if not exists public.articulo_codigo_seq start 1;

create table public.articulos (
  id uuid primary key default gen_random_uuid(),
  codigo integer not null default nextval('public.articulo_codigo_seq'),
  nombre text not null,
  categoria text not null default 'General',
  descripcion text,
  precio numeric not null default 0,
  costo numeric not null default 0,
  stock numeric not null default 0,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_articulos_updated before update on public.articulos
  for each row execute function public.set_updated_at();
create index idx_articulos_codigo on public.articulos(codigo);

alter table public.articulos enable row level security;
create policy "auth_articulos" on public.articulos for all to authenticated using (true) with check (true);

-- Número correlativo de compra
create sequence if not exists public.compra_numero_seq start 1;
alter table public.compras add column if not exists numero integer;
alter table public.compras alter column numero set default nextval('public.compra_numero_seq');
update public.compras set numero = nextval('public.compra_numero_seq') where numero is null;

-- Artículo en renglón de factura
alter table public.factura_items
  add column if not exists articulo_id uuid references public.articulos(id) on delete set null;
