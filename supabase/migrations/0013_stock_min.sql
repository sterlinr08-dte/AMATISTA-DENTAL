-- Stock mínimo por artículo para alertas de inventario bajo
alter table public.articulos
  add column if not exists stock_min numeric not null default 5;
