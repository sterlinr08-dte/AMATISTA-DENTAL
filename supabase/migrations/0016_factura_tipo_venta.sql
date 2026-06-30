-- DELUXE BEAUTY CENTER - Tipo de venta en facturas (Contado / Crédito)
-- El número que ve el usuario se forma con prefijo + serie a 6 dígitos, con una
-- secuencia INDEPENDIENTE por tipo:
--   contado  -> CO000001, CO000002, ...
--   crédito  -> CR000001, CR000002, ...

alter table public.facturas
  add column if not exists tipo_venta text not null default 'CONTADO';

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'facturas_tipo_venta_check') then
    alter table public.facturas
      add constraint facturas_tipo_venta_check check (tipo_venta in ('CONTADO','CREDITO'));
  end if;
end $$;

create sequence if not exists public.factura_co_seq start 1;
create sequence if not exists public.factura_cr_seq start 1;

alter table public.facturas add column if not exists serie integer;

-- Al crear una factura, asigna la serie del tipo correspondiente
create or replace function public.set_factura_serie()
returns trigger
language plpgsql
as $$
begin
  if new.serie is null then
    if new.tipo_venta = 'CREDITO' then
      new.serie := nextval('public.factura_cr_seq');
    else
      new.serie := nextval('public.factura_co_seq');
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_set_factura_serie on public.facturas;
create trigger trg_set_factura_serie
  before insert on public.facturas
  for each row execute function public.set_factura_serie();

-- Relleno por si existieran facturas previas (serie por orden de número, por tipo)
do $$
declare r record; co int := 0; cr int := 0;
begin
  for r in select id, tipo_venta from public.facturas where serie is null order by numero loop
    if r.tipo_venta = 'CREDITO' then
      cr := cr + 1; update public.facturas set serie = cr where id = r.id;
    else
      co := co + 1; update public.facturas set serie = co where id = r.id;
    end if;
  end loop;
  perform setval('public.factura_co_seq', greatest(co, 1), co > 0);
  perform setval('public.factura_cr_seq', greatest(cr, 1), cr > 0);
end $$;
