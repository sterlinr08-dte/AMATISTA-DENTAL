-- DELUXE BEAUTY CENTER - Auditoría: registra automáticamente todos los movimientos
create table if not exists public.auditoria (
  id uuid primary key default gen_random_uuid(),
  fecha timestamptz not null default now(),
  usuario_id uuid,
  usuario text,
  modulo text not null,
  accion text not null,
  descripcion text,
  registro_id uuid,
  datos jsonb
);
create index if not exists idx_auditoria_fecha on public.auditoria(fecha desc);

alter table public.auditoria enable row level security;
drop policy if exists "admin_lee_auditoria" on public.auditoria;
create policy "admin_lee_auditoria" on public.auditoria
  for select to authenticated using (public.es_admin());

-- Función genérica que registra el movimiento (quién, qué tabla, qué acción)
create or replace function public.fn_auditoria()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_nombre text;
  v_accion text;
  v_row jsonb;
  v_desc text;
begin
  select coalesce(p.nombre, p.username) into v_nombre from public.perfiles p where p.id = v_uid;
  if TG_OP = 'INSERT' then v_accion := 'CREÓ'; v_row := to_jsonb(NEW);
  elsif TG_OP = 'UPDATE' then v_accion := 'MODIFICÓ'; v_row := to_jsonb(NEW);
  else v_accion := 'ELIMINÓ'; v_row := to_jsonb(OLD);
  end if;

  v_desc := case TG_TABLE_NAME
    when 'facturas' then 'Factura ' || coalesce(v_row->>'numero','') || ' · ' || coalesce(v_row->>'cliente_nombre','') || ' · ' || coalesce(v_row->>'estado','')
    when 'compras' then 'Compra ' || coalesce(v_row->>'numero','') || ' · ' || coalesce(v_row->>'descripcion','')
    when 'pagos_empleados' then 'Pago a ' || coalesce(v_row->>'empleado_nombre','') || ' · RD$' || coalesce(v_row->>'monto','')
    when 'caja_sesiones' then 'Caja ' || coalesce(v_row->>'numero','') || ' · ' || coalesce(v_row->>'estado','')
    when 'factura_abonos' then 'Abono de cliente · RD$' || coalesce(v_row->>'monto','')
    when 'compra_abonos' then 'Pago a proveedor · RD$' || coalesce(v_row->>'monto','')
    when 'gastos' then 'Gasto ' || coalesce(v_row->>'descripcion','') || ' · RD$' || coalesce(v_row->>'monto','')
    when 'articulos' then 'Artículo ' || coalesce(v_row->>'nombre','')
    when 'clientes' then 'Cliente ' || coalesce(v_row->>'nombre','')
    when 'servicios' then 'Servicio ' || coalesce(v_row->>'nombre','')
    when 'empleados' then 'Empleado ' || coalesce(v_row->>'nombre','')
    when 'proveedores' then 'Proveedor ' || coalesce(v_row->>'nombre','')
    when 'perfiles' then 'Usuario ' || coalesce(v_row->>'username', v_row->>'nombre','')
    else TG_TABLE_NAME
  end;

  insert into public.auditoria(usuario_id, usuario, modulo, accion, descripcion, registro_id, datos)
  values (v_uid, coalesce(v_nombre,'Sistema'), TG_TABLE_NAME, v_accion, v_desc, (v_row->>'id')::uuid, v_row);
  return null;
end;
$$;

-- Adjunta el disparador a las tablas relevantes
do $$
declare t text;
begin
  foreach t in array array['facturas','compras','pagos_empleados','caja_sesiones','factura_abonos','compra_abonos','gastos','articulos','clientes','servicios','empleados','proveedores','perfiles']
  loop
    execute format('drop trigger if exists trg_auditoria on public.%I', t);
    execute format('create trigger trg_auditoria after insert or update or delete on public.%I for each row execute function public.fn_auditoria()', t);
  end loop;
end $$;
