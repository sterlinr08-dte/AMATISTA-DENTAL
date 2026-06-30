-- DELUXE BEAUTY CENTER - Cuentas por pagar: compras a crédito y abonos a proveedores
alter table public.compras add column if not exists tipo_pago text not null default 'CONTADO';

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'compras_tipo_pago_check') then
    alter table public.compras add constraint compras_tipo_pago_check check (tipo_pago in ('CONTADO','CREDITO'));
  end if;
end $$;

create table if not exists public.compra_abonos (
  id uuid primary key default gen_random_uuid(),
  compra_id uuid not null references public.compras(id) on delete cascade,
  fecha date not null default current_date,
  monto numeric not null check (monto > 0),
  metodo_pago text,
  registrado_por text,
  notas text,
  created_at timestamptz not null default now()
);
create index if not exists idx_compra_abonos on public.compra_abonos(compra_id);

alter table public.compra_abonos enable row level security;
drop policy if exists "auth_compra_abonos" on public.compra_abonos;
create policy "auth_compra_abonos" on public.compra_abonos
  for all to authenticated using (true) with check (true);
