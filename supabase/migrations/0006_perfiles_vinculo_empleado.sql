-- Vincular el usuario del sistema con un empleado del salón
alter table public.perfiles
  add column if not exists empleado_id uuid references public.empleados(id) on delete set null;
