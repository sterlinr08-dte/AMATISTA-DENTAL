-- DELUXE BEAUTY CENTER - Código de cliente (secuencia automática, se muestra a 4 dígitos)
create sequence if not exists public.cliente_codigo_seq start 1;
alter table public.clientes add column if not exists codigo integer;
alter table public.clientes alter column codigo set default nextval('public.cliente_codigo_seq');

-- Asigna código a los clientes existentes por orden de creación
do $$
declare r record;
begin
  for r in select id from public.clientes where codigo is null order by created_at loop
    update public.clientes set codigo = nextval('public.cliente_codigo_seq') where id = r.id;
  end loop;
end $$;
