-- DELUXE BEAUTY CENTER - Roles, perfiles y control de acceso (RBAC)

create table public.roles (
  key text primary key,
  nombre text not null,
  permisos jsonb not null default '[]'::jsonb,
  es_admin boolean not null default false,
  protegido boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_roles_updated before update on public.roles
  for each row execute function public.set_updated_at();

create table public.perfiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nombre text,
  email text,
  rol_key text references public.roles(key) on delete set null,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_perfiles_updated before update on public.perfiles
  for each row execute function public.set_updated_at();

create or replace function public.es_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists(
    select 1 from public.perfiles p
    join public.roles r on r.key = p.rol_key
    where p.id = auth.uid() and p.activo and r.es_admin
  );
$$;

insert into public.roles (key, nombre, permisos, es_admin, protegido) values
  ('admin', 'Administrador',
   '["panel","citas","clientes","servicios","empleados","facturacion","compras","gastos","nomina","contabilidad","configuracion"]'::jsonb,
   true, true),
  ('recepcion', 'Recepción',
   '["panel","citas","clientes","servicios","facturacion"]'::jsonb, false, false),
  ('contabilidad', 'Contabilidad',
   '["panel","facturacion","compras","gastos","nomina","contabilidad"]'::jsonb, false, false),
  ('estilista', 'Estilista',
   '["panel","citas","clientes"]'::jsonb, false, false);

insert into public.perfiles (id, nombre, email, rol_key, activo)
select id, 'Administrador', email, 'admin', true
from auth.users where email = 'sterlinr08@gmail.com'
on conflict (id) do update set rol_key = 'admin', activo = true;

alter table public.roles enable row level security;
alter table public.perfiles enable row level security;

create policy "leer_roles" on public.roles for select to authenticated using (true);
create policy "admin_modifica_roles" on public.roles for all to authenticated
  using (public.es_admin()) with check (public.es_admin());

create policy "leer_perfil_propio_o_admin" on public.perfiles for select to authenticated
  using (id = auth.uid() or public.es_admin());
create policy "admin_gestiona_perfiles" on public.perfiles for all to authenticated
  using (public.es_admin()) with check (public.es_admin());
