-- DELUXE BEAUTY CENTER - Rendimiento/seguridad menor (bloque bajo riesgo)
-- Índices en llaves foráneas sin cubrir (mejora joins/borrados en cascada)
create index if not exists idx_caja_mov_factura on public.caja_movimientos(factura_id);
create index if not exists idx_cita_servicios_empleado on public.cita_servicios(empleado_id);
create index if not exists idx_cita_servicios_servicio on public.cita_servicios(servicio_id);
create index if not exists idx_citas_servicio on public.citas(servicio_id);
create index if not exists idx_compra_items_articulo on public.compra_items(articulo_id);
create index if not exists idx_compras_articulo on public.compras(articulo_id);
create index if not exists idx_factura_abonos_caja on public.factura_abonos(caja_id);
create index if not exists idx_factura_items_articulo on public.factura_items(articulo_id);
create index if not exists idx_factura_items_empleado on public.factura_items(empleado_id);
create index if not exists idx_factura_items_servicio on public.factura_items(servicio_id);
create index if not exists idx_facturas_caja on public.facturas(caja_id);
create index if not exists idx_facturas_cita on public.facturas(cita_id);
create index if not exists idx_facturas_cliente on public.facturas(cliente_id);
create index if not exists idx_perfiles_empleado on public.perfiles(empleado_id);
create index if not exists idx_perfiles_rol on public.perfiles(rol_key);

-- Fijar search_path en funciones (recomendación de seguridad de Supabase)
alter function public.set_updated_at() set search_path = public;
alter function public.set_factura_serie() set search_path = public;
alter function public.get_user_effective_permissions(uuid) set search_path = public;
