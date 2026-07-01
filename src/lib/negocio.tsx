import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react'
import { supabase } from './supabase'
import { NEGOCIO, PREFIJOS_DEFAULT } from './constants'

export interface Negocio {
  nombre: string
  direccion: string
  referencia: string
  telefono: string
  whatsapp: string
  instagram: string
  rnc: string
  razon_social: string          // razón social fiscal (para comprobantes DGII)
  logo: string
  ancho_ticket: number          // mm del papel térmico (58 u 80)
  auto_imprimir: boolean        // imprimir el recibo automáticamente al cobrar
  // Comprobantes fiscales DGII
  comprobantes_activos: boolean // si se asignan NCF a las facturas
  modo_comprobante: 'tradicional' | 'electronico'
  // Emisor electrónico e-CF
  ecf_proveedor: string
  ecf_api_url: string
  ecf_api_token: string
  ecf_ambiente: 'prueba' | 'produccion'
  ecf_emision_auto: boolean
  // Prefijos configurables de las secuencias
  prefijo_caja: string
  prefijo_gasto: string
  prefijo_pago: string
  prefijo_cita: string
  prefijo_compra: string
  prefijo_cliente: string
  prefijo_proveedor: string
  prefijo_articulo: string
  prefijo_mobiliario: string
}

const DEFAULTS: Negocio = {
  ...NEGOCIO,
  ...PREFIJOS_DEFAULT,
  razon_social: '',
  comprobantes_activos: false,
  modo_comprobante: 'tradicional',
  ecf_proveedor: '',
  ecf_api_url: '',
  ecf_api_token: '',
  ecf_ambiente: 'prueba',
  ecf_emision_auto: false,
}

interface NegocioContextValue {
  negocio: Negocio
  recargarNegocio: () => Promise<void>
}

const NegocioContext = createContext<NegocioContextValue>({
  negocio: DEFAULTS,
  recargarNegocio: async () => {},
})

export function NegocioProvider({ children }: { children: ReactNode }) {
  const [negocio, setNegocio] = useState<Negocio>(DEFAULTS)

  const recargarNegocio = useCallback(async () => {
    const { data } = await supabase.from('ajustes_negocio').select('*').maybeSingle()
    if (data) {
      setNegocio({
        nombre: data.nombre || DEFAULTS.nombre,
        direccion: data.direccion ?? '',
        referencia: data.referencia ?? '',
        telefono: data.telefono ?? '',
        whatsapp: data.whatsapp ?? '',
        instagram: data.instagram ?? '',
        rnc: data.rnc ?? '',
        razon_social: data.razon_social ?? '',
        logo: DEFAULTS.logo,
        ancho_ticket: Number(data.ancho_ticket ?? DEFAULTS.ancho_ticket),
        auto_imprimir: data.auto_imprimir ?? DEFAULTS.auto_imprimir,
        comprobantes_activos: data.comprobantes_activos ?? false,
        modo_comprobante: (data.modo_comprobante === 'electronico' ? 'electronico' : 'tradicional'),
        ecf_proveedor: data.ecf_proveedor ?? '',
        ecf_api_url: data.ecf_api_url ?? '',
        ecf_api_token: data.ecf_api_token ?? '',
        ecf_ambiente: (data.ecf_ambiente === 'produccion' ? 'produccion' : 'prueba'),
        ecf_emision_auto: data.ecf_emision_auto ?? false,
        prefijo_caja: data.prefijo_caja ?? DEFAULTS.prefijo_caja,
        prefijo_gasto: data.prefijo_gasto ?? DEFAULTS.prefijo_gasto,
        prefijo_pago: data.prefijo_pago ?? DEFAULTS.prefijo_pago,
        prefijo_cita: data.prefijo_cita ?? DEFAULTS.prefijo_cita,
        prefijo_compra: data.prefijo_compra ?? DEFAULTS.prefijo_compra,
        prefijo_cliente: data.prefijo_cliente ?? DEFAULTS.prefijo_cliente,
        prefijo_proveedor: data.prefijo_proveedor ?? DEFAULTS.prefijo_proveedor,
        prefijo_articulo: data.prefijo_articulo ?? DEFAULTS.prefijo_articulo,
        prefijo_mobiliario: data.prefijo_mobiliario ?? DEFAULTS.prefijo_mobiliario,
      })
    }
  }, [])

  useEffect(() => {
    recargarNegocio()
  }, [recargarNegocio])

  // Ajusta el ticket térmico al ancho del papel (58mm u 80mm) inyectando CSS de @media print.
  useEffect(() => {
    const ancho = Number(negocio.ancho_ticket) >= 80 ? 72 : 54   // mm imprimibles
    const fuente = Number(negocio.ancho_ticket) >= 80 ? 11 : 10
    let el = document.getElementById('ticket-print-config') as HTMLStyleElement | null
    if (!el) {
      el = document.createElement('style')
      el.id = 'ticket-print-config'
      document.head.appendChild(el)
    }
    el.textContent = `@media print { @page { size: ${ancho}mm auto; margin: 2mm; } .print-area { width: ${ancho}mm !important; font-size: ${fuente}px !important; } }`
  }, [negocio.ancho_ticket])

  return <NegocioContext.Provider value={{ negocio, recargarNegocio }}>{children}</NegocioContext.Provider>
}

export function useNegocio() {
  return useContext(NegocioContext)
}
