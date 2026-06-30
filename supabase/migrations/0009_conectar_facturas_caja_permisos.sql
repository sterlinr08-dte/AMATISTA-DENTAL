-- DELUXE BEAUTY CENTER - Conectar facturas con caja + permisos de funciones

-- Vínculo factura <-> caja
alter table public.facturas
  add column if not exists caja_id uuid references public.caja_sesiones(id) on delete set null;

alter table public.caja_movimientos
  add column if not exists factura_id uuid references public.facturas(id) on delete set null;

-- Semilla de permisos de funciones para roles existentes (permisos es jsonb).
-- Recepción y Contabilidad pueden operar la caja y cobrar facturas.
update public.roles
set permisos = (
  select jsonb_agg(distinct e)
  from jsonb_array_elements_text(
    permisos || '["caja","caja.abrir","caja.movimiento","facturas.cobrar"]'::jsonb
  ) as e
)
where key in ('recepcion', 'contabilidad');
