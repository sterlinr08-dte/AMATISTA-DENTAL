-- Códigos de artículo a 4 dígitos empezando en 0000.
-- La secuencia puede empezar en 0 (instalaciones nuevas) y se muestra con padStart(4,'0').
alter sequence public.articulo_codigo_seq minvalue 0;

-- Renumerar artículos existentes para que empiecen en 0 (0000, 0001, …)
with ordered as (
  select id, (row_number() over (order by codigo, created_at) - 1) as nuevo
  from public.articulos
)
update public.articulos a
set codigo = o.nuevo
from ordered o
where a.id = o.id;

-- El siguiente código nace después del último (o en 0 si no hay artículos)
select setval(
  'public.articulo_codigo_seq',
  (select coalesce(max(codigo), -1) + 1 from public.articulos),
  false
);
