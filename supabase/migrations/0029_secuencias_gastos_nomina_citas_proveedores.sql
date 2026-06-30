-- DELUXE BEAUTY CENTER - Secuencias (numeración a 4 dígitos) para Gastos,
-- Pagos a empleados (nómina), Citas y Proveedores.
-- En la base se guarda un entero correlativo; el front lo muestra con
-- padStart(4,'0') -> 0001, 0002, 0003, …
-- Los registros existentes se numeran en orden (por fecha y creación).

-- ============================ GASTOS ============================
create sequence if not exists public.gasto_numero_seq start 1;
alter table public.gastos add column if not exists numero integer;
alter table public.gastos alter column numero set default nextval('public.gasto_numero_seq');
with ordenados as (
  select id, row_number() over (order by fecha, created_at) as n
  from public.gastos where numero is null
)
update public.gastos g set numero = o.n from ordenados o where g.id = o.id;
select setval('public.gasto_numero_seq', coalesce((select max(numero) from public.gastos), 0) + 1, false);

-- ===================== PAGOS A EMPLEADOS ========================
create sequence if not exists public.pago_numero_seq start 1;
alter table public.pagos_empleados add column if not exists numero integer;
alter table public.pagos_empleados alter column numero set default nextval('public.pago_numero_seq');
with ordenados as (
  select id, row_number() over (order by fecha, created_at) as n
  from public.pagos_empleados where numero is null
)
update public.pagos_empleados p set numero = o.n from ordenados o where p.id = o.id;
select setval('public.pago_numero_seq', coalesce((select max(numero) from public.pagos_empleados), 0) + 1, false);

-- ============================ CITAS =============================
create sequence if not exists public.cita_numero_seq start 1;
alter table public.citas add column if not exists numero integer;
alter table public.citas alter column numero set default nextval('public.cita_numero_seq');
with ordenados as (
  select id, row_number() over (order by fecha, hora_inicio, created_at) as n
  from public.citas where numero is null
)
update public.citas c set numero = o.n from ordenados o where c.id = o.id;
select setval('public.cita_numero_seq', coalesce((select max(numero) from public.citas), 0) + 1, false);

-- ========================= PROVEEDORES ==========================
create sequence if not exists public.proveedor_codigo_seq start 1;
alter table public.proveedores add column if not exists codigo integer;
alter table public.proveedores alter column codigo set default nextval('public.proveedor_codigo_seq');
with ordenados as (
  select id, row_number() over (order by created_at) as n
  from public.proveedores where codigo is null
)
update public.proveedores pr set codigo = o.n from ordenados o where pr.id = o.id;
select setval('public.proveedor_codigo_seq', coalesce((select max(codigo) from public.proveedores), 0) + 1, false);
