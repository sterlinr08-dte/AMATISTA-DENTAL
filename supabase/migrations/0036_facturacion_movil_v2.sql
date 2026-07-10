-- Rediseño del módulo de facturación móvil: metadatos de descuento (motivo/tipo/%,
-- ya quedan auditados por el trigger genérico de auditoría), datos de crédito
-- (vencimiento/plazo/inicial/observaciones) y detalle de tarjeta/transferencia
-- por línea de pago. Todo nullable/con default para no afectar facturas existentes.

alter table public.facturas
  add column if not exists descuento_motivo text,
  add column if not exists descuento_tipo text not null default 'MONTO' check (descuento_tipo in ('MONTO', 'PORCENTAJE')),
  add column if not exists descuento_porcentaje numeric not null default 0,
  add column if not exists credito_vencimiento date,
  add column if not exists credito_plazo_dias integer,
  add column if not exists credito_inicial numeric not null default 0,
  add column if not exists credito_observaciones text;

alter table public.factura_pagos
  add column if not exists tarjeta_tipo text,
  add column if not exists tarjeta_ultimos4 text,
  add column if not exists tarjeta_autorizacion text,
  add column if not exists tarjeta_terminal text,
  add column if not exists transferencia_banco text,
  add column if not exists transferencia_referencia text,
  add column if not exists transferencia_comprobante text;

alter table public.ajustes_negocio
  add column if not exists descuento_limite_pct numeric not null default 100;
