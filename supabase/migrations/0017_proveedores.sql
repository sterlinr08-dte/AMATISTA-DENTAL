-- DELUXE BEAUTY CENTER - Proveedores (se crean en Configuración y se eligen en Compras)
create table if not exists public.proveedores (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  telefono text,
  contacto text,
  notas text,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_proveedores_updated on public.proveedores;
create trigger trg_proveedores_updated before update on public.proveedores
  for each row execute function public.set_updated_at();

alter table public.proveedores enable row level security;

create policy "leer_proveedores" on public.proveedores
  for select to authenticated using (true);
create policy "admin_gestiona_proveedores" on public.proveedores
  for all to authenticated using (public.es_admin()) with check (public.es_admin());
