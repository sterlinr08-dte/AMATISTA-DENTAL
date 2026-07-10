import { useEffect, useState, ReactNode } from 'react'
import QRCode from 'qrcode'
import { Factura, FacturaItem } from '../types'
import { Negocio } from '../lib/negocio'
import { money, fechaCorta, codigoFactura, codigoCliente } from '../lib/format'

interface Props {
  factura: Factura
  items: FacturaItem[]
  negocio: Negocio
  clienteCodigo?: number | null
  clienteTelefono?: string | null
  devuelto?: number
}

// Separador punteado elegante.
function Sep() {
  return <div className="my-2 border-t border-dashed border-black/60" />
}
// Título de sección.
function Titulo({ children }: { children: ReactNode }) {
  return <p className="text-center text-[11px] font-extrabold uppercase tracking-[0.18em] text-slate-800">{children}</p>
}
// Fila etiqueta : valor.
function Fila({ k, v }: { k: string; v: ReactNode }) {
  return (
    <div className="flex gap-2 leading-tight">
      <span className="shrink-0 text-slate-500">{k}:</span>
      <span className="min-w-0 flex-1 break-words font-semibold text-slate-800">{v}</span>
    </div>
  )
}

// Ticket térmico premium (80 mm). Se imprime dentro de un contenedor .print-area.
export default function TicketFactura({ factura, items, negocio, clienteCodigo, clienteTelefono, devuelto = 0 }: Props) {
  const [qr, setQr] = useState('')

  useEffect(() => {
    const d = (negocio.whatsapp || '').replace(/\D/g, '')
    const url = d ? `https://wa.me/${d.length === 10 ? '1' + d : d}` : (negocio.instagram || '')
    if (!url) { setQr(''); return }
    let vivo = true
    QRCode.toDataURL(url, { margin: 1, width: 180 }).then((u) => { if (vivo) setQr(u) }).catch(() => { if (vivo) setQr('') })
    return () => { vivo = false }
  }, [negocio.whatsapp, negocio.instagram])

  const hora = factura.created_at
    ? new Date(factura.created_at).toLocaleTimeString('es-DO', { hour: 'numeric', minute: '2-digit', hour12: true })
    : ''
  const tipo = factura.tipo_venta === 'CREDITO' ? 'Crédito' : 'Contado'
  const pendiente = factura.tipo_venta === 'CREDITO' && factura.estado !== 'PAGADA'

  return (
    <div className="mx-auto text-[11px] leading-snug text-slate-800" style={{ maxWidth: '72mm' }}>
      {/* ===== ENCABEZADO ===== */}
      <div className="text-center">
        <img src={`${import.meta.env.BASE_URL}${negocio.logo}`} alt="" className="mx-auto mb-1 h-16 object-contain" />
        <p className="text-[17px] font-extrabold uppercase leading-none tracking-wide text-slate-900">{negocio.nombre}</p>
        {negocio.rnc && <p className="mt-1 text-[11px]">RNC: {negocio.rnc}</p>}
        {negocio.direccion && <p className="text-[11px] leading-tight">{negocio.direccion}</p>}
        {negocio.referencia && <p className="text-[11px] leading-tight">{negocio.referencia}</p>}
        <p className="text-[11px] leading-tight">
          {negocio.telefono && <>Tel: {negocio.telefono}</>}
          {negocio.telefono && negocio.whatsapp && ' · '}
          {negocio.whatsapp && <>WhatsApp: {negocio.whatsapp}</>}
        </p>
      </div>

      <Sep />

      {/* ===== FACTURA ===== */}
      <Titulo>Factura</Titulo>
      <div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-0.5">
        <Fila k="No." v={codigoFactura(factura)} />
        <Fila k="Fecha" v={fechaCorta(factura.fecha)} />
        {hora && <Fila k="Hora" v={hora} />}
        <Fila k="Tipo" v={tipo} />
        {factura.ncf && <div className="col-span-2"><Fila k="NCF" v={factura.ncf} /></div>}
        <Fila k="Estado" v={factura.estado} />
        <Fila k="Pago" v={factura.metodo_pago} />
      </div>

      <Sep />

      {/* ===== CLIENTE ===== */}
      <Titulo>Cliente</Titulo>
      <div className="mt-1 space-y-0.5">
        {clienteCodigo != null && <Fila k="Código" v={codigoCliente(clienteCodigo)} />}
        <Fila k="Nombre" v={factura.cliente_nombre || '—'} />
        {clienteTelefono && <Fila k="Teléfono" v={clienteTelefono} />}
        {factura.comprador_rnc && <Fila k="RNC" v={factura.comprador_rnc} />}
      </div>

      <Sep />

      {/* ===== DETALLE ===== */}
      <Titulo>Detalle</Titulo>
      <table className="mt-1 w-full">
        <thead>
          <tr className="border-b border-black/70 text-slate-500">
            <th className="py-0.5 text-left font-semibold">Descripción</th>
            <th className="py-0.5 text-center font-semibold">Cant.</th>
            <th className="py-0.5 text-right font-semibold">Importe</th>
          </tr>
        </thead>
        <tbody>
          {items.map((it) => (
            <tr key={it.id} className="align-top">
              <td className="py-0.5 pr-1">
                {it.descripcion}
                {(it as any).empleado?.nombre && <span className="block text-[10px] text-slate-500">por {(it as any).empleado.nombre}</span>}
              </td>
              <td className="py-0.5 text-center">{it.cantidad}</td>
              <td className="py-0.5 text-right font-semibold">{money(it.importe)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-1 border-t border-dashed border-black/60 pt-1" />

      {/* ===== RESUMEN ===== */}
      <div className="space-y-0.5">
        <div className="flex justify-between"><span className="text-slate-500">Subtotal</span><span className="font-semibold">{money(factura.subtotal)}</span></div>
        {factura.descuento > 0 && <div className="flex justify-between"><span className="text-slate-500">Descuento</span><span className="font-semibold">- {money(factura.descuento)}</span></div>}
        {factura.itbis > 0 && <div className="flex justify-between"><span className="text-slate-500">ITBIS</span><span className="font-semibold">{money(factura.itbis)}</span></div>}
        {devuelto > 0 && <div className="flex justify-between"><span className="text-slate-500">Devuelto</span><span className="font-semibold">- {money(devuelto)}</span></div>}
      </div>

      {/* TOTAL resaltado */}
      <div className="mt-1.5 flex items-center justify-between border-y-2 border-black py-1.5">
        <span className="text-[15px] font-extrabold tracking-wide">TOTAL</span>
        <span className="text-[16px] font-extrabold">{money(factura.total)}</span>
      </div>

      <Sep />

      {/* ===== FORMA DE PAGO ===== */}
      <Titulo>Forma de pago</Titulo>
      <p className="mt-1 text-center font-semibold">{factura.metodo_pago || '—'}</p>

      {pendiente && (
        <>
          <Sep />
          <Titulo>Saldos</Titulo>
          <div className="mt-1 space-y-0.5">
            <div className="flex justify-between"><span className="text-slate-500">Total</span><span className="font-semibold">{money(factura.total)}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Pendiente</span><span className="font-extrabold">{money(factura.total)}</span></div>
          </div>
        </>
      )}

      {/* Estado destacado */}
      <div className="mx-auto mt-2 rounded-md border-2 border-black px-2 py-1 text-center text-[12px] font-extrabold tracking-wide">
        *** {factura.estado} ***
      </div>

      {/* ===== QR ===== */}
      {qr && (
        <div className="mt-3 text-center">
          <img src={qr} alt="QR" className="mx-auto h-24 w-24" />
          <p className="mt-1 text-[10px] text-slate-500">Escanee para contactarnos</p>
        </div>
      )}

      {/* ===== PIE ===== */}
      <div className="mt-3 text-center leading-snug">
        <p className="font-semibold">¡Gracias por confiar en nosotros!</p>
        <p className="text-[10px] text-slate-500">Conserve este comprobante.</p>
      </div>

      {negocio.instagram && (
        <div className="inv mt-2 rounded-md bg-black py-1 text-center text-[11px] font-bold text-white">
          {negocio.instagram}
        </div>
      )}
    </div>
  )
}
