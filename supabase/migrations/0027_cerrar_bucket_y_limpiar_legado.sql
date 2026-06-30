-- DELUXE BEAUTY CENTER - A4 + limpieza: cerrar bucket público y eliminar funciones legado del proyecto seguro
-- La app del salón NO usa Supabase Storage; estos objetos son herencia del proyecto anterior.

-- 1) Quitar acceso anónimo/público al bucket 'comprobantes' (los archivos NO se borran).
drop policy if exists "Subir comprobantes anon" on storage.objects;
drop policy if exists "Ver comprobantes anon"   on storage.objects;
drop policy if exists "Subir comprobantes"      on storage.objects;
drop policy if exists "Ver comprobantes"        on storage.objects;

-- Hacer privado el bucket (deja de servir URLs públicas / listado abierto).
update storage.buckets set public = false where id = 'comprobantes';

-- 2) Eliminar funciones legado (facturación automática del seguro: NCF, asientos, primas).
drop function if exists public.crear_factura_auto_tx(uuid, text, text, uuid, text, integer, integer, numeric, numeric, numeric, numeric, text, date, numeric);
drop function if exists public.run_auto_facturacion();
