import { useEffect, useState } from 'react'
import { HandCoins, Wallet, Printer } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { Factura, FacturaAbono } from '../types'
import { money, fechaCorta, fechaHora, hoyISO, codigoFactura } from '../lib/format'
import { METODOS_PAGO } from '../lib/constants'
import { useAuth } from '../lib/auth'
import { useNegocio } from '../lib/negocio'
import PageHeader from '../components/PageHeader'
import Cargando from '../components/Cargando'
import Modal from '../components/Modal'
import DataTable from '../components/DataTable'

interface FilaCobro extends Factura {
  abonado: number
  saldo: number
}

interface ReciboAbono {
  factura: FilaCobro
  monto: number
  metodo: string
  abonadoAntes: number
  saldoRestante: number
  hora: string
}

export default function CuentasPorCobrar() {
  const { perfil, puedeAccion } = useAuth()
  const { negocio } = useNegocio()
  const puedeCobrar = puedeAccion('creditos.cobrar')
  const [recibo, setRecibo] = useState<ReciboAbono | null>(null)

  const [filas, setFilas] = useState<FilaCobro[]>([])
  const [abonosByFactura, setAbonosByFactura] = useState<Record<string, FacturaAbono[]>>({})
  const [loading, setLoading] = useState(true)
  const [verSaldadas, setVerSaldadas] = useState(false)

  // modal de abono
  const [abonoFactura, setAbonoFactura] = useState<FilaCobro | null>(null)
  const [abonoMonto, setAbonoMonto] = useState(0)
  const [abonoMetodo, setAbonoMetodo] = useState('Efectivo')
  const [abonoNotas, setAbonoNotas] = useState('')
  const [saving, setSaving] = useState(false)

  async function cargar() {
    setLoading(true)
    const { data: facts } = await supabase
      .from('facturas')
      .select('*')
      .eq('tipo_venta', 'CREDITO')
      .neq('estado', 'ANULADA')
      .order('fecha', { ascending: false })
    const lista = (facts ?? []) as Factura[]
    const ids = lista.map((f) => f.id)
    let abonos: FacturaAbono[] = []
    if (ids.length) {
      const { data } = await supabase.from('factura_abonos').select('*').in('factura_id', ids).order('created_at')
      abonos = (data ?? []) as FacturaAbono[]
    }
    const porFactura: Record<string, FacturaAbono[]> = {}
    for (const a of abonos) (porFactura[a.factura_id] ??= []).push(a)
    setAbonosByFactura(porFactura)
    setFilas(
      lista.map((f) => {
        const abonado = (porFactura[f.id] ?? []).reduce((s, a) => s + Number(a.monto), 0)
        return { ...f, abonado, saldo: Math.max(0, Number(f.total) - abonado) }
      }),
    )
    setLoading(false)
  }

  useEffect(() => {
    cargar()
  }, [])

  function abrirAbono(f: FilaCobro) {
    setAbonoFactura(f)
    setAbonoMonto(f.saldo)
    setAbonoMetodo('Efectivo')
    setAbonoNotas('')
  }

  async function guardarAbono(imprimir = false) {
    if (!abonoFactura) return
    if (abonoMonto <= 0) return alert('El abono debe ser mayor que 0')
    if (abonoMonto > abonoFactura.saldo + 0.01) return alert(`El abono no puede ser mayor que el saldo (${money(abonoFactura.saldo)})`)
    setSaving(true)
    const { error } = await supabase.from('factura_abonos').insert({
      factura_id: abonoFactura.id,
      fecha: hoyISO(),
      monto: abonoMonto,
      metodo_pago: abonoMetodo,
      registrado_por: perfil?.nombre || perfil?.username || null,
      notas: abonoNotas || null,
    })
    if (error) {
      setSaving(false)
      return alert('Error al registrar el abono: ' + error.message)
    }
    // Si el abono salda la deuda, marcar la factura como PAGADA
    const nuevoSaldo = abonoFactura.saldo - abonoMonto
    if (nuevoSaldo <= 0.01) {
      await supabase.from('facturas').update({ estado: 'PAGADA' }).eq('id', abonoFactura.id)
    }
    if (imprimir) {
      setRecibo({
        factura: abonoFactura,
        monto: abonoMonto,
        metodo: abonoMetodo,
        abonadoAntes: abonoFactura.abonado,
        saldoRestante: Math.max(0, nuevoSaldo),
        hora: new Date().toISOString(),
      })
      setTimeout(() => window.print(), 400)
    }
    setSaving(false)
    setAbonoFactura(null)
    cargar()
  }

  const listaVisible = filas.filter((f) => (verSaldadas ? true : f.saldo > 0.01))

  const totalAdeudado = filas.reduce((s, f) => s + f.saldo, 0)
  const clientesConDeuda = new Set(filas.filter((f) => f.saldo > 0.01).map((f) => f.cliente_nombre ?? f.id)).size

  return (
    <div>
      <PageHeader title="Cuentas por cobrar" subtitle="Ventas a crédito y abonos" />

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="card flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-rose-50 text-rose-600"><Wallet size={20} /></div>
          <div>
            <p className="text-xs text-slate-600">Total por cobrar</p>
            <p className="text-xl font-bold text-slate-800">{money(totalAdeudado)}</p>
          </div>
        </div>
        <div className="card flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-50 text-amber-600"><HandCoins size={20} /></div>
          <div>
            <p className="text-xs text-slate-600">Clientes que deben</p>
            <p className="text-xl font-bold text-slate-800">{clientesConDeuda}</p>
          </div>
        </div>
      </div>

      {loading ? (
        <Cargando />
      ) : (
        <DataTable
          rows={listaVisible}
          rowKey={(f) => f.id}
          searchText={(f) => `${codigoFactura(f)} ${f.cliente_nombre ?? ''} ${f.fecha}`}
          searchPlaceholder="Buscar por cliente, código o fecha…"
          emptyText={filas.length === 0 ? 'No hay ventas a crédito.' : 'No hay cuentas que coincidan.'}
          initialSort={{ index: 2, dir: 'desc' }}
          toolbar={
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input type="checkbox" checked={verSaldadas} onChange={(e) => setVerSaldadas(e.target.checked)} />
              Mostrar también las saldadas
            </label>
          }
          columns={[
            { header: 'Factura', cell: (f) => <span className="font-mono font-semibold text-slate-700">{codigoFactura(f)}</span>, sortValue: (f) => f.numero ?? 0 },
            { header: 'Cliente', cell: (f) => <span className="font-medium text-slate-800">{f.cliente_nombre || 'Cliente'}</span>, sortValue: (f) => f.cliente_nombre ?? '' },
            { header: 'Fecha', cell: (f) => <span className="text-slate-500">{fechaCorta(f.fecha)}</span>, sortValue: (f) => f.fecha },
            { header: 'Total', align: 'right', cell: (f) => money(f.total), sortValue: (f) => f.total },
            { header: 'Abonado', align: 'right', cell: (f) => <span className="text-emerald-600">{money(f.abonado)}</span>, sortValue: (f) => f.abonado },
            { header: 'Saldo', align: 'right', cell: (f) => <span className="font-bold text-slate-800">{money(f.saldo)}</span>, sortValue: (f) => f.saldo },
            {
              header: '', align: 'right', cell: (f) =>
                f.saldo > 0.01 ? (
                  puedeCobrar ? (
                    <button onClick={() => abrirAbono(f)} className="rounded-lg bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-700 hover:bg-brand-100">
                      <HandCoins size={13} className="-mt-0.5 mr-0.5 inline" /> Registrar abono
                    </button>
                  ) : (
                    <span className="badge bg-amber-50 text-amber-700">Pendiente</span>
                  )
                ) : (
                  <span className="badge bg-emerald-50 text-emerald-700">Saldada</span>
                ),
            },
          ]}
        />
      )}

      {/* MODAL ABONO */}
      <Modal
        open={!!abonoFactura}
        title={`Registrar abono · ${abonoFactura ? codigoFactura(abonoFactura) : ''}`}
        onClose={() => setAbonoFactura(null)}
        footer={
          <>
            <button className="btn-ghost" onClick={() => setAbonoFactura(null)}>Cancelar</button>
            <button className="btn-ghost" onClick={() => guardarAbono(false)} disabled={saving}>{saving ? 'Guardando…' : 'Registrar'}</button>
            <button className="btn-primary" onClick={() => guardarAbono(true)} disabled={saving}><Printer size={16} /> Guardar e imprimir</button>
          </>
        }
      >
        {abonoFactura && (
          <div className="space-y-4">
            <div className="rounded-xl bg-slate-50 p-3 text-sm">
              <div className="flex justify-between text-slate-600"><span>Cliente</span><span className="font-medium text-slate-800">{abonoFactura.cliente_nombre || 'Cliente'}</span></div>
              <div className="flex justify-between text-slate-600"><span>Total</span><span>{money(abonoFactura.total)}</span></div>
              <div className="flex justify-between text-slate-600"><span>Abonado</span><span className="text-emerald-600">{money(abonoFactura.abonado)}</span></div>
              <div className="mt-1 flex justify-between border-t border-slate-200 pt-1 font-bold text-slate-800"><span>Saldo</span><span>{money(abonoFactura.saldo)}</span></div>
            </div>
            <div>
              <label className="label">Monto del abono (RD$)</label>
              <input type="number" min={0} step={50} className="input" value={abonoMonto || ''} onChange={(e) => setAbonoMonto(Number(e.target.value))} />
              <button type="button" className="mt-1 text-xs font-semibold text-brand-600 hover:underline" onClick={() => setAbonoMonto(abonoFactura.saldo)}>Pagar todo el saldo ({money(abonoFactura.saldo)})</button>
            </div>
            <div>
              <label className="label">Método de pago</label>
              <select className="input" value={abonoMetodo} onChange={(e) => setAbonoMetodo(e.target.value)}>
                {METODOS_PAGO.map((m) => <option key={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Notas</label>
              <textarea className="input" rows={2} value={abonoNotas} onChange={(e) => setAbonoNotas(e.target.value)} />
            </div>
            {(abonosByFactura[abonoFactura.id]?.length ?? 0) > 0 && (
              <div>
                <p className="label">Abonos anteriores</p>
                <ul className="divide-y divide-slate-100 rounded-xl border border-slate-100 text-sm">
                  {abonosByFactura[abonoFactura.id].map((a) => (
                    <li key={a.id} className="flex items-center justify-between px-3 py-2">
                      <span className="text-slate-500">{fechaCorta(a.fecha)} · {a.metodo_pago || '—'}</span>
                      <span className="font-semibold text-slate-700">{money(a.monto)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* COMPROBANTE DE ABONO (imprimible) */}
      <Modal open={!!recibo} title="Recibo de abono" onClose={() => setRecibo(null)}>
        {recibo && (
          <div className="space-y-3">
            <div id="recibo-abono" className="print-area space-y-2 rounded-xl border border-slate-100 p-3 text-sm">
              <div className="text-center">
                <img src={`${import.meta.env.BASE_URL}${negocio.logo}`} alt={negocio.nombre} className="mx-auto mb-1 h-14 rounded-lg bg-black object-contain" />
                <p className="font-display text-base font-bold text-brand-800">{negocio.nombre}</p>
                {negocio.rnc && <p className="text-xs text-slate-500">RNC: {negocio.rnc}</p>}
                <p className="text-xs text-slate-500">Tel/WhatsApp: {negocio.telefono}</p>
                <p className="mt-1 text-xs font-semibold text-slate-600">RECIBO DE ABONO</p>
                <p className="text-xs text-slate-600">Factura {codigoFactura(recibo.factura)} · {fechaHora(recibo.hora)}</p>
              </div>
              <p className="text-slate-600"><span className="font-medium">Cliente:</span> {recibo.factura.cliente_nombre ?? 'Cliente'}</p>
              <div className="space-y-0.5 border-t pt-1">
                <div className="flex justify-between text-slate-600"><span>Total de la factura</span><span>{money(recibo.factura.total)}</span></div>
                <div className="flex justify-between text-slate-600"><span>Abonado antes</span><span>{money(recibo.abonadoAntes)}</span></div>
                <div className="flex justify-between text-base font-bold text-slate-800"><span>Este abono</span><span>{money(recibo.monto)}</span></div>
                <div className="flex justify-between text-slate-600"><span>Método</span><span>{recibo.metodo}</span></div>
                <div className="flex justify-between font-semibold text-rose-600"><span>Saldo pendiente</span><span>{money(recibo.saldoRestante)}</span></div>
              </div>
              <p className="text-xs text-slate-600">Recibido por: {perfil?.nombre || perfil?.username || '—'}</p>
              <div className="border-t pt-1 text-center text-xs text-slate-500">
                <p>{negocio.direccion} · {negocio.referencia}</p>
              </div>
              <p className="text-center text-xs font-medium text-brand-600">¡Gracias por su pago! 💕</p>
            </div>
            <div className="flex gap-2 no-print">
              <button className="btn-ghost flex-1" onClick={() => setRecibo(null)}>Cerrar</button>
              <button className="btn-primary flex-1" onClick={() => window.print()}><Printer size={16} /> Imprimir</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
