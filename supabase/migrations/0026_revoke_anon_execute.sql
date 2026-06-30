-- DELUXE BEAUTY CENTER - A2: cerrar ejecución de funciones SECURITY DEFINER a usuarios sin login
-- Las funciones tenían grant a PUBLIC (que incluye a anon). Revocamos PUBLIC y anon,
-- pero CONSERVAMOS authenticated y service_role (la app las usa con sesión iniciada).
-- Los triggers (fn_auditoria) se disparan como dueño de la tabla, no dependen de este grant.

revoke execute on function public.ajustar_stock(uuid, numeric) from public, anon;
revoke execute on function public.es_admin() from public, anon;
revoke execute on function public.auth_tiene(text) from public, anon;
revoke execute on function public.fn_auditoria() from public, anon;
revoke execute on function public.rls_auto_enable() from public, anon;
revoke execute on function public.run_auto_facturacion() from public, anon;

-- Aseguramos que authenticated conserve lo que necesita la app.
grant execute on function public.ajustar_stock(uuid, numeric) to authenticated;
grant execute on function public.es_admin() to authenticated;
grant execute on function public.auth_tiene(text) to authenticated;

-- Funciones que la app NO invoca por RPC: también las cerramos a authenticated.
-- fn_auditoria es un trigger (se dispara como dueño, no necesita grant);
-- rls_auto_enable es utilitaria; run_auto_facturacion es legado (proyecto anterior).
revoke execute on function public.fn_auditoria() from authenticated;
revoke execute on function public.rls_auto_enable() from authenticated;
revoke execute on function public.run_auto_facturacion() from authenticated;
