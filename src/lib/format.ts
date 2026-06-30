// Utilidades de formato (moneda RD$, fechas y horas)

export function money(value: number | null | undefined): string {
  const n = Number(value ?? 0)
  return new Intl.NumberFormat('es-DO', {
    style: 'currency',
    currency: 'DOP',
    minimumFractionDigits: 2,
  }).format(n)
}

export function fechaLarga(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  return date.toLocaleDateString('es-DO', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

export function fechaCorta(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  return date.toLocaleDateString('es-DO', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function hora(h: string | null): string {
  if (!h) return ''
  const [hh, mm] = h.split(':')
  let hour = parseInt(hh, 10)
  const ampm = hour >= 12 ? 'PM' : 'AM'
  hour = hour % 12 || 12
  return `${hour}:${mm} ${ampm}`
}

export function fechaHora(ts: string | null): string {
  if (!ts) return ''
  return new Date(ts).toLocaleString('es-DO', {
    day: '2-digit',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

export function hoyISO(): string {
  const d = new Date()
  const off = d.getTimezoneOffset()
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 10)
}

// Código de artículo a 4 dígitos con ceros a la izquierda: 0000, 0001, …
export function codigoArticulo(n: number | null | undefined): string {
  return String(n ?? 0).padStart(4, '0')
}

// Código de cliente a 4 dígitos con ceros a la izquierda: 0001, 0002, …
export function codigoCliente(n: number | null | undefined): string {
  return String(n ?? 0).padStart(4, '0')
}

// Correlativo genérico a 4 dígitos (gastos, nómina, citas, proveedores): 0001, 0002, …
export function codigo4(n: number | null | undefined): string {
  return String(n ?? 0).padStart(4, '0')
}

// Número con prefijo configurable: PREFIJO + 4 dígitos (ej. CJ0001).
// Si el prefijo está vacío, devuelve solo el número (0001).
export function conPrefijo(prefijo: string | null | undefined, n: number | null | undefined): string {
  const num = String(n ?? 0).padStart(4, '0')
  const p = (prefijo ?? '').trim()
  return p ? `${p}${num}` : num
}

// Código de factura: secuencia INDEPENDIENTE por tipo de venta (serie), a 6 dígitos.
//   contado -> CO000001, CO000002, ...   (cuenta aparte)
//   crédito -> CR000001, CR000002, ...   (cuenta aparte)
// Se usa `serie` (correlativo por tipo, lo asigna la base); `numero` queda como
// respaldo por si alguna factura antigua no tuviera serie.
export function codigoFactura(f: { tipo_venta?: string | null; serie?: number | null; numero?: number | null }): string {
  const prefijo = f.tipo_venta === 'CREDITO' ? 'CR' : 'CO'
  const n = f.serie ?? f.numero ?? 0
  return `${prefijo}${String(n).padStart(6, '0')}`
}
