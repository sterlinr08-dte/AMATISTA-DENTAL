-- Endurecer RLS: solo usuarios autenticados pueden acceder
drop policy if exists "acceso_publico_empleados" on public.empleados;
drop policy if exists "acceso_publico_servicios" on public.servicios;
drop policy if exists "acceso_publico_clientes"  on public.clientes;
drop policy if exists "acceso_publico_citas"     on public.citas;

create policy "auth_empleados" on public.empleados for all to authenticated using (true) with check (true);
create policy "auth_servicios" on public.servicios for all to authenticated using (true) with check (true);
create policy "auth_clientes"  on public.clientes  for all to authenticated using (true) with check (true);
create policy "auth_citas"     on public.citas     for all to authenticated using (true) with check (true);
