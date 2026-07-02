// ─────────────────────────────────────────────────────────────────────────────
// Emisión de Comprobantes Fiscales Electrónicos (e-CF · Ley 32-23, DGII RD)
//
// Este módulo es el ÚNICO punto donde se conecta el proveedor de facturación
// electrónica. Todo lo demás del sistema (asignar e-NCF, guardar, imprimir con
// QR) ya está listo. Cuando la DGII apruebe a la clínica y se elija un proveedor:
//
//   1. En Configuración → Comprobantes DGII se cargan: proveedor, URL de su API,
//      token, ambiente (prueba/producción) y se enciende "emisión automática".
//   2. Aquí, en `emitirECF`, se ajusta el `payload` y el `mapeo de la respuesta`
//      al formato EXACTO del proveedor elegido (cada proveedor documenta su API).
//
// Mientras no haya proveedor configurado, `emitirECF` devuelve `pendiente:true`
// y la factura queda con e-NCF asignado pero en estado PENDIENTE de envío.
// ─────────────────────────────────────────────────────────────────────────────

export interface EcfConfig {
  proveedor: string | null
  api_url: string | null
  api_token: string | null
  ambiente: 'prueba' | 'produccion'
  emision_auto: boolean
}

export type EcfEstado = 'PENDIENTE' | 'ENVIADO' | 'ACEPTADO' | 'RECHAZADO' | 'CONDICIONAL'

export interface EcfResultado {
  ok: boolean
  pendiente?: boolean          // true = aún no hay proveedor configurado
  estado: EcfEstado
  codigo_seguridad?: string | null
  track_id?: string | null
  qr_url?: string | null
  fecha_firma?: string | null
  mensaje?: string | null
}

// Datos mínimos que necesita el proveedor para emitir (se arman desde la factura).
export interface EcfFacturaPayload {
  encf: string                 // e-NCF asignado (E31/E32/E34 + 10 dígitos)
  tipo: string                 // E31 | E32 | E34
  rnc_emisor: string
  razon_social_emisor: string
  rnc_comprador?: string | null
  razon_social_comprador?: string | null
  fecha: string                // YYYY-MM-DD
  subtotal: number
  descuento: number
  itbis: number
  total: number
  items: { descripcion: string; cantidad: number; precio: number; importe: number }[]
}

/**
 * Construye la URL de consulta del timbre (la que codifica el QR de la
 * representación impresa). El formato base es el de la DGII; el proveedor suele
 * devolver esta URL ya lista — en ese caso se usa la del proveedor. Este helper
 * queda disponible por si hay que armarla localmente.
 */
export function construirUrlQrECF(p: {
  ambiente: 'prueba' | 'produccion'
  rncEmisor: string
  rncComprador?: string | null
  encf: string
  fechaEmision: string          // dd-mm-yyyy
  montoTotal: number
  fechaFirma?: string | null
  codigoSeguridad: string
}): string {
  const base = p.ambiente === 'produccion'
    ? 'https://ecf.dgii.gov.do/ecf/ConsultaTimbre'
    : 'https://ecf.dgii.gov.do/testecf/ConsultaTimbre'
  const q = new URLSearchParams()
  q.set('RncEmisor', p.rncEmisor)
  if (p.rncComprador) q.set('RncComprador', p.rncComprador)
  q.set('ENCF', p.encf)
  q.set('FechaEmision', p.fechaEmision)
  q.set('MontoTotal', String(p.montoTotal))
  if (p.fechaFirma) q.set('FechaFirma', p.fechaFirma)
  q.set('CodigoSeguridad', p.codigoSeguridad)
  return `${base}?${q.toString()}`
}

/**
 * Emite el e-CF a través del proveedor configurado.
 *
 * HOY: si no hay `api_url`/`api_token`, devuelve `pendiente:true` (no envía nada)
 * y la factura queda PENDIENTE. Así el sistema funciona sin romperse hasta que
 * llegue la aprobación.
 *
 * CUANDO SE APRUEBE: se completa el bloque marcado con TODO usando la
 * documentación del proveedor elegido (payload de envío y lectura de respuesta).
 */
export async function emitirECF(payload: EcfFacturaPayload, config: EcfConfig): Promise<EcfResultado> {
  if (!config.api_url || !config.api_token) {
    return {
      ok: false,
      pendiente: true,
      estado: 'PENDIENTE',
      mensaje: 'e-NCF asignado. Falta configurar el emisor electrónico (proveedor + credenciales) para enviarlo a la DGII.',
    }
  }

  // Timeout para que una API lenta no cuelgue el guardado de la factura.
  const controlador = new AbortController()
  const temporizador = setTimeout(() => controlador.abort(), 20000)
  try {
    // TODO (al aprobar): ajustar `body` y el mapeo de la respuesta al formato
    // exacto del proveedor elegido. La forma real la entrega su documentación.
    const resp = await fetch(config.api_url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.api_token}`,
        'X-Ambiente': config.ambiente,
      },
      body: JSON.stringify(payload),
      signal: controlador.signal,
    })
    const data: any = await resp.json().catch(() => ({}))
    if (!resp.ok) {
      return { ok: false, estado: 'RECHAZADO', mensaje: data?.mensaje || `Error del proveedor (${resp.status})` }
    }
    // Mapeo genérico (se afina con el proveedor real):
    return {
      ok: true,
      estado: (data.estado as EcfEstado) || 'ENVIADO',
      codigo_seguridad: data.codigoSeguridad ?? data.codigo_seguridad ?? null,
      track_id: data.trackId ?? data.track_id ?? null,
      qr_url: data.qrUrl ?? data.qr_url ?? null,
      fecha_firma: data.fechaFirma ?? data.fecha_firma ?? null,
      mensaje: data.mensaje ?? null,
    }
  } catch (e) {
    const msg = (e instanceof Error && e.name === 'AbortError')
      ? 'El emisor e-CF no respondió a tiempo (timeout).'
      : 'No se pudo conectar con el emisor e-CF: ' + (e instanceof Error ? e.message : String(e))
    return { ok: false, estado: 'PENDIENTE', mensaje: msg }
  } finally {
    clearTimeout(temporizador)
  }
}

// Etiquetas legibles para el estado del e-CF.
export const ECF_ESTADO_LABEL: Record<string, { label: string; color: string }> = {
  PENDIENTE: { label: 'Pendiente de envío', color: 'bg-amber-50 text-amber-700' },
  ENVIADO: { label: 'Enviado a la DGII', color: 'bg-blue-50 text-blue-700' },
  ACEPTADO: { label: 'Aceptado por la DGII', color: 'bg-emerald-50 text-emerald-700' },
  CONDICIONAL: { label: 'Aceptado condicional', color: 'bg-teal-50 text-teal-700' },
  RECHAZADO: { label: 'Rechazado por la DGII', color: 'bg-rose-50 text-rose-700' },
}
