-- Stock automático: función para ajustar inventario y vínculo de compras a artículos

create or replace function public.ajustar_stock(p_articulo uuid, p_delta numeric)
returns void
language sql
security definer
set search_path = public
as $$
  update public.articulos
  set stock = stock + p_delta, updated_at = now()
  where id = p_articulo;
$$;

grant execute on function public.ajustar_stock(uuid, numeric) to authenticated;

alter table public.compras
  add column if not exists articulo_id uuid references public.articulos(id) on delete set null,
  add column if not exists cantidad numeric;
