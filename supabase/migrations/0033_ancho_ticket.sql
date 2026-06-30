-- DELUXE BEAUTY CENTER - Ancho del ticket térmico configurable (58mm u 80mm).
-- Se elige en Configuración → Negocio. El front ajusta el @page y el ancho
-- del área imprimible según este valor. 58mm es lo típico de impresoras
-- portátiles tipo "2 Connect".

alter table public.ajustes_negocio
  add column if not exists ancho_ticket integer not null default 58;
