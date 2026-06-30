-- DELUXE BEAUTY CENTER - Módulo de facturación y contabilidad

-- Secuencia para numeración de facturas
create sequence if not exists public.factura_numero_seq start 1;

-- ===================== FACTURAS =====================
create table public.facturas (
  id uuid primary key default gen_random_uuid(),
  numero integer not null default nextval('public.factura_numero_seq'),
  cliente_id uuid references public.clientes(id) on delete set null,
  cliente_nombre text,
  cita_id uuid references public.citas(id) on delete set null,
  fecha date not null default current_date,
  subtotal numeric not null default 0,
  descuento numeric not null default 0,
  itbis numeric not null default 0,
  total numeric not null default 0,
  estado text not null default 'PENDIENTE'
    check (estado in ('PENDIENTE','PAGADA','ANULADA')),
  metodo_pago text,
  notas text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_facturas_updated before update on public.facturas
  for each row execute function public.set_updated_at();
create index idx_facturas_fecha on public.facturas(fecha);
create index idx_facturas_estado on public.facturas(estado);

-- ===================== RENGLONES DE FACTURA =====================
create table public.factura_items (
  id uuid primary key default gen_random_uuid(),
  factura_id uuid not null references public.facturas(id) on delete cascade,
  servicio_id uuid references public.servicios(id) on delete set null,
  empleado_id uuid references public.empleados(id) on delete set null,
  descripcion text not null,
  cantidad numeric not null default 1,
  precio_unit numeric not null default 0,
  importe numeric not null default 0
);
create index idx_factura_items_factura on public.factura_items(factura_id);

-- ===================== GASTOS =====================
create table public.gastos (
  id uuid primary key default gen_random_uuid(),
  fecha date not null default current_date,
  categoria text not null default 'General',
  concepto text not null,
  beneficiario text,
  monto numeric not null default 0,
  metodo_pago text default 'Efectivo',
  notas text,
  created_at timestamptz not null default now()
);
create index idx_gastos_fecha on public.gastos(fecha);

-- ===================== COMPRAS =====================
create table public.compras (
  id uuid primary key default gen_random_uuid(),
  fecha date not null default current_date,
  proveedor text,
  descripcion text not null,
  categoria text not null default 'Insumos',
  subtotal numeric not null default 0,
  itbis numeric not null default 0,
  total numeric not null default 0,
  metodo_pago text default 'Efectivo',
  notas text,
  created_at timestamptz not null default now()
);
create index idx_compras_fecha on public.compras(fecha);

-- ===================== PAGOS A EMPLEADOS (NÓMINA) =====================
create table public.pagos_empleados (
  id uuid primary key default gen_random_uuid(),
  empleado_id uuid references public.empleados(id) on delete set null,
  empleado_nombre text,
  fecha date not null default current_date,
  periodo text,
  tipo text not null default 'SALARIO'
    check (tipo in ('SALARIO','COMISION','ADELANTO','BONO')),
  monto numeric not null default 0,
  metodo_pago text default 'Efectivo',
  notas text,
  created_at timestamptz not null default now()
);
create index idx_pagos_empleados_fecha on public.pagos_empleados(fecha);
create index idx_pagos_empleados_emp on public.pagos_empleados(empleado_id);

-- ===================== RLS (solo autenticados) =====================
alter table public.facturas        enable row level security;
alter table public.factura_items   enable row level security;
alter table public.gastos          enable row level security;
alter table public.compras         enable row level security;
alter table public.pagos_empleados enable row level security;

create policy "auth_facturas"        on public.facturas        for all to authenticated using (true) with check (true);
create policy "auth_factura_items"   on public.factura_items   for all to authenticated using (true) with check (true);
create policy "auth_gastos"          on public.gastos          for all to authenticated using (true) with check (true);
create policy "auth_compras"         on public.compras         for all to authenticated using (true) with check (true);
create policy "auth_pagos_empleados" on public.pagos_empleados for all to authenticated using (true) with check (true);
