-- Categorías gestionables desde Configuración (para artículos y servicios)
create table public.categorias (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  tipo text not null default 'articulo' check (tipo in ('articulo','servicio')),
  created_at timestamptz not null default now(),
  unique (nombre, tipo)
);

alter table public.categorias enable row level security;
create policy "auth_categorias" on public.categorias for all to authenticated using (true) with check (true);

insert into public.categorias (nombre, tipo) values
  ('Cabello','articulo'),('Uñas','articulo'),('Facial','articulo'),('Maquillaje','articulo'),
  ('Bebidas','articulo'),('Cafetería','articulo'),('General','articulo'),('Otros','articulo'),
  ('Cabello','servicio'),('Uñas','servicio'),('Facial','servicio'),('Maquillaje','servicio'),
  ('Depilación','servicio'),('General','servicio')
on conflict (nombre, tipo) do nothing;
