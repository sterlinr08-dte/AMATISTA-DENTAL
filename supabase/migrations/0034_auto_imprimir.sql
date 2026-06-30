-- DELUXE BEAUTY CENTER - Auto-impresión del recibo al cobrar.
-- Si está activo (y se usa el modo de impresión directa de Chrome), al registrar
-- un cobro el recibo se imprime solo, sin tocar "Imprimir".

alter table public.ajustes_negocio
  add column if not exists auto_imprimir boolean not null default true;
