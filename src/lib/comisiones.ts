// Lógica central de comisiones (se usa en Pagos a empleados y en Reportes).
//
// Reglas del negocio:
//  - Solo los SERVICIOS pagan comisión. Los productos/artículos no.
//  - El % de cada servicio: si el servicio tiene su propio % lo usa; si no, usa el % del empleado.

// ¿Esta línea de factura paga comisión? Pagan los servicios (de catálogo o escritos
// a mano); NO pagan los productos/artículos del inventario.
export function lineaPagaComision(item: { articulo_id?: string | null }): boolean {
  return !item.articulo_id
}

// % de comisión que aplica a una línea de servicio.
// servicioPct: % propio del servicio (null = sin override). empleadoPct: % por defecto del empleado.
export function pctComisionServicio(servicioPct: number | null | undefined, empleadoPct: number | null | undefined): number {
  return servicioPct != null ? Number(servicioPct) : Number(empleadoPct ?? 0)
}

// Comisión (RD$) de una línea, redondeada al peso.
export function comisionLinea(importe: number, pct: number): number {
  return Math.round((Number(importe) * pct) / 100)
}

// ¿Se solapan dos rangos de fechas [aDesde,aHasta] y [bDesde,bHasta]? (formato ISO yyyy-mm-dd)
export function rangosSeSolapan(aDesde: string, aHasta: string, bDesde: string | null, bHasta: string | null): boolean {
  if (!bDesde || !bHasta) return false
  return aDesde <= bHasta && bDesde <= aHasta
}
