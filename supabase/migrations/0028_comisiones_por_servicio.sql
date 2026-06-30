-- Comisiones: % por servicio + control de comisión ya pagada
-- DELUXE BEAUTY CENTER

-- 1) % de comisión propio por servicio.
--    Si queda NULL, se usa el % de comisión del empleado (comportamiento actual).
alter table public.servicios
  add column if not exists comision_pct numeric;

alter table public.servicios
  drop constraint if exists servicios_comision_pct_chk;
alter table public.servicios
  add constraint servicios_comision_pct_chk
  check (comision_pct is null or (comision_pct >= 0 and comision_pct <= 100));

-- 2) Rango de fechas que cubre un pago de comisión.
--    Permite avisar si se intenta pagar dos veces el mismo periodo a un empleado.
alter table public.pagos_empleados add column if not exists comision_desde date;
alter table public.pagos_empleados add column if not exists comision_hasta date;

-- Índice para buscar rápido las comisiones ya pagadas de un empleado.
create index if not exists idx_pagos_emp_comision
  on public.pagos_empleados (empleado_id, comision_desde, comision_hasta)
  where tipo = 'COMISION';
