-- DELUXE BEAUTY CENTER - Inventario de mobiliario y equipos (activos del salón).
-- Registro de bienes físicos: sillas, secadoras, lavacabezas, espejos, equipos,
-- computadoras, etc. NO se venden (no es inventario de productos); es el patrimonio
-- del salón con su estado, ubicación, valor y foto.

create sequence if not exists public.mobiliario_codigo_seq minvalue 0 start 0;

create table public.mobiliario (
  id uuid primary key default gen_random_uuid(),
  codigo integer not null default nextval('public.mobiliario_codigo_seq'),
  nombre text not null,
  categoria text not null default 'Mobiliario',
  cantidad numeric not null default 1,
  estado text not null default 'BUENO' check (estado in ('BUENO','REGULAR','DANADO')),
  ubicacion text not null default '',
  costo numeric not null default 0,
  fecha_compra date,
  proveedor text not null default '',
  serie text not null default '',
  foto_url text,
  notas text,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_mobiliario_updated before update on public.mobiliario
  for each row execute function public.set_updated_at();
create index idx_mobiliario_codigo on public.mobiliario(codigo);

alter table public.mobiliario enable row level security;
create policy "auth_mobiliario" on public.mobiliario for all to authenticated using (true) with check (true);

-- La secuencia arranca en 0 (instalación nueva); el front muestra 4 dígitos (0000, 0001…).
select setval('public.mobiliario_codigo_seq', (select coalesce(max(codigo), -1) + 1 from public.mobiliario), false);

-- Prefijo configurable del código (Configuración → Prefijos). Ej. MB0001.
alter table public.ajustes_negocio add column if not exists prefijo_mobiliario text not null default 'MB';

-- Almacenamiento de fotos del mobiliario (bucket público de solo lectura;
-- subir/editar/borrar requiere sesión).
insert into storage.buckets (id, name, public) values ('mobiliario', 'mobiliario', true)
  on conflict (id) do nothing;

create policy "mobiliario_lectura_publica" on storage.objects
  for select using (bucket_id = 'mobiliario');
create policy "mobiliario_sube_auth" on storage.objects
  for insert to authenticated with check (bucket_id = 'mobiliario');
create policy "mobiliario_actualiza_auth" on storage.objects
  for update to authenticated using (bucket_id = 'mobiliario');
create policy "mobiliario_borra_auth" on storage.objects
  for delete to authenticated using (bucket_id = 'mobiliario');
