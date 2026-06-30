-- DELUXE BEAUTY CENTER - Esquema inicial del sistema de salón de belleza

create extension if not exists "pgcrypto";

-- Trigger genérico para updated_at
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ===================== EMPLEADOS / STAFF =====================
create table public.empleados (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  puesto text not null default 'Estilista',
  telefono text,
  email text,
  especialidad text,
  color text default '#d946ef',
  comision_pct numeric not null default 0,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_empleados_updated before update on public.empleados
  for each row execute function public.set_updated_at();

-- ===================== SERVICIOS Y PRECIOS =====================
create table public.servicios (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  categoria text not null default 'General',
  descripcion text,
  duracion_min integer not null default 30,
  precio numeric not null default 0,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_servicios_updated before update on public.servicios
  for each row execute function public.set_updated_at();

-- ===================== CLIENTES =====================
create table public.clientes (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  telefono text,
  email text,
  fecha_nacimiento date,
  notas text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_clientes_updated before update on public.clientes
  for each row execute function public.set_updated_at();

-- ===================== CITAS / AGENDA =====================
create table public.citas (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid references public.clientes(id) on delete set null,
  empleado_id uuid references public.empleados(id) on delete set null,
  servicio_id uuid references public.servicios(id) on delete set null,
  fecha date not null,
  hora_inicio time not null,
  hora_fin time,
  estado text not null default 'PENDIENTE'
    check (estado in ('PENDIENTE','CONFIRMADA','COMPLETADA','CANCELADA')),
  precio numeric not null default 0,
  notas text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_citas_updated before update on public.citas
  for each row execute function public.set_updated_at();

create index idx_citas_fecha on public.citas(fecha);
create index idx_citas_empleado on public.citas(empleado_id);
create index idx_citas_cliente on public.citas(cliente_id);

-- ===================== RLS =====================
-- App de inicio sin autenticación: se habilita RLS con políticas abiertas
-- para la clave anónima. Endurecer cuando se agregue Supabase Auth.
alter table public.empleados enable row level security;
alter table public.servicios enable row level security;
alter table public.clientes  enable row level security;
alter table public.citas     enable row level security;

create policy "acceso_publico_empleados" on public.empleados for all using (true) with check (true);
create policy "acceso_publico_servicios" on public.servicios for all using (true) with check (true);
create policy "acceso_publico_clientes"  on public.clientes  for all using (true) with check (true);
create policy "acceso_publico_citas"     on public.citas     for all using (true) with check (true);
