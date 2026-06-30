-- DELUXE BEAUTY CENTER - Roles de caja y control de descuadre

-- CAJERA: cobra facturas y maneja efectivo; NO cierra con descuadre ni anula/elimina.
insert into public.roles (key, nombre, permisos, es_admin, protegido)
values (
  'cajera',
  'Cajera',
  '["panel","facturacion","caja","facturas.cobrar","caja.abrir","caja.movimiento"]'::jsonb,
  false,
  false
)
on conflict (key) do update set permisos = excluded.permisos, nombre = excluded.nombre;

-- SUPERVISOR DE CAJA: controla a la cajera; puede cerrar con descuadre y anular.
insert into public.roles (key, nombre, permisos, es_admin, protegido)
values (
  'supervisor_caja',
  'Supervisor de caja',
  '["panel","facturacion","caja","compras","gastos","contabilidad","facturas.cobrar","facturas.anular","caja.abrir","caja.movimiento","caja.cerrar_descuadre"]'::jsonb,
  false,
  false
)
on conflict (key) do update set permisos = excluded.permisos, nombre = excluded.nombre;

-- Contabilidad también puede cerrar con descuadre (supervisión).
update public.roles
set permisos = (
  select jsonb_agg(distinct e)
  from jsonb_array_elements_text(permisos || '["caja.cerrar_descuadre"]'::jsonb) as e
)
where key = 'contabilidad';
