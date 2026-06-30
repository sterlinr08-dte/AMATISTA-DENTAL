-- Datos del negocio editables desde Configuración (una sola fila)
create table public.ajustes_negocio (
  id boolean primary key default true check (id),
  nombre text not null default 'DeluXe Beauty Center',
  direccion text not null default '',
  referencia text not null default '',
  telefono text not null default '',
  whatsapp text not null default '',
  instagram text not null default '',
  rnc text not null default '',
  updated_at timestamptz not null default now()
);

alter table public.ajustes_negocio enable row level security;
create policy "auth_ajustes_negocio_sel" on public.ajustes_negocio for select to authenticated using (true);
create policy "auth_ajustes_negocio_upd" on public.ajustes_negocio for update to authenticated using (true) with check (true);
create policy "auth_ajustes_negocio_ins" on public.ajustes_negocio for insert to authenticated with check (true);

insert into public.ajustes_negocio (id, nombre, direccion, referencia, telefono, whatsapp, instagram, rnc)
values (true, 'DeluXe Beauty Center', 'Av. Duarte #180, 2do nivel', 'Frente a Banco Popular', '809-354-4083', '809-354-4083', '@centerdeluxebeauty', '');
