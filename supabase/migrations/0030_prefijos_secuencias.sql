-- DELUXE BEAUTY CENTER - Prefijos configurables para las secuencias.
-- Se guardan en ajustes_negocio (editables desde Configuración → Prefijos).
-- El front muestra el número como PREFIJO + 4 dígitos (ej. CJ0001).
-- Si un prefijo queda vacío, esa secuencia se muestra solo con el número.

alter table public.ajustes_negocio add column if not exists prefijo_caja       text not null default 'CJ';
alter table public.ajustes_negocio add column if not exists prefijo_gasto      text not null default 'GA';
alter table public.ajustes_negocio add column if not exists prefijo_pago       text not null default 'NM';
alter table public.ajustes_negocio add column if not exists prefijo_cita       text not null default 'CI';
alter table public.ajustes_negocio add column if not exists prefijo_compra     text not null default 'CM';
alter table public.ajustes_negocio add column if not exists prefijo_cliente    text not null default 'CL';
alter table public.ajustes_negocio add column if not exists prefijo_proveedor  text not null default 'PR';
alter table public.ajustes_negocio add column if not exists prefijo_articulo   text not null default 'AR';
