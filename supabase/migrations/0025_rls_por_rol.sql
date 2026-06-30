-- DELUXE BEAUTY CENTER - RLS por rol (cierra el acceso total que tenía 'authenticated')
-- Helper: ¿el usuario actual es admin o su rol tiene el permiso/módulo indicado?
create or replace function public.auth_tiene(p text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.perfiles pf
    join public.roles r on r.key = pf.rol_key
    where pf.id = auth.uid() and pf.activo and (r.es_admin or (r.permisos ? p))
  );
$$;
revoke execute on function public.auth_tiene(text) from anon;

-- ===== FACTURAS (facturación o caja; borrar requiere facturas.eliminar) =====
drop policy if exists "auth_facturas" on public.facturas;
create policy facturas_sel on public.facturas for select to authenticated using (auth_tiene('facturacion') or auth_tiene('caja'));
create policy facturas_ins on public.facturas for insert to authenticated with check (auth_tiene('facturacion') or auth_tiene('caja'));
create policy facturas_upd on public.facturas for update to authenticated using (auth_tiene('facturacion') or auth_tiene('caja')) with check (auth_tiene('facturacion') or auth_tiene('caja'));
create policy facturas_del on public.facturas for delete to authenticated using (auth_tiene('facturas.eliminar'));

-- factura_items: igual que facturas
drop policy if exists "auth_factura_items" on public.factura_items;
create policy factura_items_rw on public.factura_items for all to authenticated using (auth_tiene('facturacion') or auth_tiene('caja')) with check (auth_tiene('facturacion') or auth_tiene('caja'));

-- factura_abonos (cobros a crédito): caja o cuentas; borrar admin
drop policy if exists "auth_factura_abonos" on public.factura_abonos;
create policy factura_abonos_sel on public.factura_abonos for select to authenticated using (auth_tiene('caja') or auth_tiene('cuentas'));
create policy factura_abonos_ins on public.factura_abonos for insert to authenticated with check (auth_tiene('caja') or auth_tiene('cuentas'));
create policy factura_abonos_upd on public.factura_abonos for update to authenticated using (auth_tiene('caja') or auth_tiene('cuentas')) with check (auth_tiene('caja') or auth_tiene('cuentas'));
create policy factura_abonos_del on public.factura_abonos for delete to authenticated using (es_admin());

-- ===== CAJA (módulo caja; borrar admin) =====
drop policy if exists "auth_caja_sesiones" on public.caja_sesiones;
create policy caja_sesiones_sel on public.caja_sesiones for select to authenticated using (auth_tiene('caja'));
create policy caja_sesiones_ins on public.caja_sesiones for insert to authenticated with check (auth_tiene('caja'));
create policy caja_sesiones_upd on public.caja_sesiones for update to authenticated using (auth_tiene('caja')) with check (auth_tiene('caja'));
create policy caja_sesiones_del on public.caja_sesiones for delete to authenticated using (es_admin());

drop policy if exists "auth_caja_movimientos" on public.caja_movimientos;
create policy caja_mov_sel on public.caja_movimientos for select to authenticated using (auth_tiene('caja'));
create policy caja_mov_ins on public.caja_movimientos for insert to authenticated with check (auth_tiene('caja'));
create policy caja_mov_upd on public.caja_movimientos for update to authenticated using (auth_tiene('caja')) with check (auth_tiene('caja'));
create policy caja_mov_del on public.caja_movimientos for delete to authenticated using (es_admin());

-- ===== NÓMINA (módulo nomina; borrar admin) =====
drop policy if exists "auth_pagos_empleados" on public.pagos_empleados;
create policy pagos_sel on public.pagos_empleados for select to authenticated using (auth_tiene('nomina'));
create policy pagos_ins on public.pagos_empleados for insert to authenticated with check (auth_tiene('nomina'));
create policy pagos_upd on public.pagos_empleados for update to authenticated using (auth_tiene('nomina')) with check (auth_tiene('nomina'));
create policy pagos_del on public.pagos_empleados for delete to authenticated using (es_admin());

-- ===== COMPRAS (módulo compras; borrar compras.eliminar) =====
drop policy if exists "auth_compras" on public.compras;
create policy compras_sel on public.compras for select to authenticated using (auth_tiene('compras'));
create policy compras_ins on public.compras for insert to authenticated with check (auth_tiene('compras'));
create policy compras_upd on public.compras for update to authenticated using (auth_tiene('compras')) with check (auth_tiene('compras'));
create policy compras_del on public.compras for delete to authenticated using (auth_tiene('compras.eliminar'));

drop policy if exists "auth_compra_items" on public.compra_items;
create policy compra_items_rw on public.compra_items for all to authenticated using (auth_tiene('compras')) with check (auth_tiene('compras'));

drop policy if exists "auth_compra_abonos" on public.compra_abonos;
create policy compra_abonos_sel on public.compra_abonos for select to authenticated using (auth_tiene('compras') or auth_tiene('cuentas_pagar'));
create policy compra_abonos_ins on public.compra_abonos for insert to authenticated with check (auth_tiene('compras') or auth_tiene('cuentas_pagar'));
create policy compra_abonos_upd on public.compra_abonos for update to authenticated using (auth_tiene('compras') or auth_tiene('cuentas_pagar')) with check (auth_tiene('compras') or auth_tiene('cuentas_pagar'));
create policy compra_abonos_del on public.compra_abonos for delete to authenticated using (es_admin());

-- ===== GASTOS (módulo gastos; borrar gastos.eliminar) =====
drop policy if exists "auth_gastos" on public.gastos;
create policy gastos_sel on public.gastos for select to authenticated using (auth_tiene('gastos'));
create policy gastos_ins on public.gastos for insert to authenticated with check (auth_tiene('gastos'));
create policy gastos_upd on public.gastos for update to authenticated using (auth_tiene('gastos')) with check (auth_tiene('gastos'));
create policy gastos_del on public.gastos for delete to authenticated using (auth_tiene('gastos.eliminar'));

-- ===== CITAS (módulo citas; borrar citas.eliminar) =====
drop policy if exists "auth_citas" on public.citas;
create policy citas_sel on public.citas for select to authenticated using (auth_tiene('citas'));
create policy citas_ins on public.citas for insert to authenticated with check (auth_tiene('citas'));
create policy citas_upd on public.citas for update to authenticated using (auth_tiene('citas')) with check (auth_tiene('citas'));
create policy citas_del on public.citas for delete to authenticated using (auth_tiene('citas.eliminar'));

drop policy if exists "auth_cita_servicios" on public.cita_servicios;
create policy cita_servicios_rw on public.cita_servicios for all to authenticated using (auth_tiene('citas')) with check (auth_tiene('citas'));

-- ===== DATOS DE REFERENCIA (lectura: todos; escritura: por módulo) =====
drop policy if exists "auth_clientes" on public.clientes;
create policy clientes_sel on public.clientes for select to authenticated using (true);
create policy clientes_ins on public.clientes for insert to authenticated with check (auth_tiene('clientes') or auth_tiene('facturacion'));
create policy clientes_upd on public.clientes for update to authenticated using (auth_tiene('clientes')) with check (auth_tiene('clientes'));
create policy clientes_del on public.clientes for delete to authenticated using (auth_tiene('clientes.eliminar'));

drop policy if exists "auth_servicios" on public.servicios;
create policy servicios_sel on public.servicios for select to authenticated using (true);
create policy servicios_ins on public.servicios for insert to authenticated with check (auth_tiene('servicios'));
create policy servicios_upd on public.servicios for update to authenticated using (auth_tiene('servicios')) with check (auth_tiene('servicios'));
create policy servicios_del on public.servicios for delete to authenticated using (auth_tiene('servicios.eliminar'));

drop policy if exists "auth_articulos" on public.articulos;
create policy articulos_sel on public.articulos for select to authenticated using (true);
create policy articulos_ins on public.articulos for insert to authenticated with check (auth_tiene('articulos'));
create policy articulos_upd on public.articulos for update to authenticated using (auth_tiene('articulos')) with check (auth_tiene('articulos'));
create policy articulos_del on public.articulos for delete to authenticated using (auth_tiene('articulos.eliminar'));

drop policy if exists "auth_empleados" on public.empleados;
create policy empleados_sel on public.empleados for select to authenticated using (true);
create policy empleados_ins on public.empleados for insert to authenticated with check (auth_tiene('empleados'));
create policy empleados_upd on public.empleados for update to authenticated using (auth_tiene('empleados')) with check (auth_tiene('empleados'));
create policy empleados_del on public.empleados for delete to authenticated using (auth_tiene('empleados'));

drop policy if exists "auth_categorias" on public.categorias;
create policy categorias_sel on public.categorias for select to authenticated using (true);
create policy categorias_rw on public.categorias for all to authenticated using (auth_tiene('configuracion')) with check (auth_tiene('configuracion'));

-- ===== AJUSTES NEGOCIO (lectura todos; escritura configuración) =====
drop policy if exists "auth_ajustes_negocio_ins" on public.ajustes_negocio;
drop policy if exists "auth_ajustes_negocio_upd" on public.ajustes_negocio;
create policy ajustes_ins on public.ajustes_negocio for insert to authenticated with check (auth_tiene('configuracion'));
create policy ajustes_upd on public.ajustes_negocio for update to authenticated using (auth_tiene('configuracion')) with check (auth_tiene('configuracion'));
