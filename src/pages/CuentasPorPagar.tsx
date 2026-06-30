import { useEffect, useState } from 'react'
import { HandCoins, Wallet, Printer } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { Compra, CompraAbono } from '../types'
import { money, fechaCorta, fechaHora, hoyISO } from '../lib/format'
import { METODOS_PAGO } from '../lib/constants'
import { useAuth } from '../lib/auth'
import { useNegocio } from '../lib/negocio'
import PageHeader from '../components/PageHeader'
import Cargando from '../components/Cargando'
import Modal from '../components/Modal'
import DataTable from '../components/DataTable'

interface FilaPago extends Compra {
  abonado: number
  saldo: number
}

interface ReciboPagoProv {
  compra: FilaPago
  monto: number
  metodo: string
  abonadoAntes: number
  saldoRestante: number
  hora: string
}

export default function CuentasPorPagar() {
  const { perfil, puedeAccion } = useAuth()
  const { negocio } = useNegocio()
  const puedePagar = puedeAccion('pagos_proveedor.registrar')

  const [filas, setFilas] = useState<FilaPago[]>([])
  const [abonosByCompra, setAbonosByCompra] = useState<Record<string, CompraAbono[]>>({})
  const [loading, setLoading] = useState(true)
  const [verSaldadas, setVerSaldadas] = useState(false)

  const [pagoCompra, setPagoCompra] = useState<FilaPago | null>(null)
  const [pagoMonto, setPagoMonto] = useState(0)
  const [pagoMetodo, setPagoMetodo] = useState('Efectivo')
  const [pagoNotas, setPagoNotas] = useState('')
  const [saving, setSaving] = useState(false)
  const [recibo, setRecibo] = useState<ReciboPagoProv | null>(null)

  async function cargar() {
    setLoading(true)
    const { data: comps } = await supabase
      .from('compras')
      .select('*')
      .eq('tipo_pago', 'CREDITO')
      .order('fecha', { ascending: false })
    const lista = (comps ?? []) as Compra[]
    const ids = lista.map((c) => c.id)
    let abonos: CompraAbono[] = []
    if (ids.length) {
      const { data } = await supabase.from('compra_abonos').select('*').in('compra_id', ids).order('created_at')
      abonos = (data ?? []) as CompraAbono[]
    }
    const porCompra: Record<string, CompraAbono[]> = {}
    for (const a of abonos) (porCompra[a.compra_id] ??= []).push(a)
    setAbonosByCompra(porCompra)
    setFilas(
      lista.map((c) => {
        const abonado = (porCompra[c.id] ?? []).reduce((s, a) => s + Number(a.monto), 0)
        return { ...c, abonado, saldo: Math.max(0, Number(c.total) - abonado) }
      }),
    )
    setLoading(false)
  }

  useEffect(() => {
    cargar()
  }, [])

  function abrirPago(c: FilaPago) {
    setPagoCompra(c)
    setPagoMonto(c.saldo)
    setPagoMetodo('Efectivo')
    setPagoNotas('')
  }

  async function guardarPago(imprimir = false) {
    if (!pagoCompra) return
    if (pagoMonto <= 0) return alert('El pago debe ser mayor que 0')
    if (pagoMonto > pagoCompra.saldo + 0.01) return alert(`El pago no puede ser mayor que el saldo (${money(pagoCompra.saldo)})`)
    setSaving(true)
    const { error } = await supabase.from('compra_abonos').insert({
      compra_id: pagoCompra.id,
      fecha: hoyISO(),
      monto: pagoMonto,
      metodo_pago: pagoMetodo,
      registrado_por: perfil?.nombre || perfil?.username || null,
      notas: pagoNotas || null,
    })
    if (error) {
      setSaving(false)
      return alert('Error al registrar el pago: ' + error.message)
    }
    if (imprimir) {
      setRecibo({
        compra: pagoCompra,
        monto: pagoMonto,
        metodo: pagoMetodo,
        abonadoAntes: pagoCompra.abonado,
        saldoRestante: Math.max(0, pagoCompra.saldo - pagoMonto),
        hora: new Date().toISOString(),
      })
      setTimeout(() => window.print(), 400)
    }
    setSaving(false)
    setPagoCompra(null)
    cargar()
  }

  const listaVisible = filas.filter((c) => (verSaldadas ? true : c.saldo > 0.01))
  const totalAdeudado = filas.reduce((s, c) => s + c.saldo, 0)
  const proveedoresConDeuda = new Set(filas.filter((c) => c.saldo > 0.01).map((c) => c.proveedor ?? c.id)).size

  return (
    <div>
      <PageHeader title="Cuentas por pagar" subtitle="Compras a crédito y pagos a proveedores" />

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="card flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-rose-50 text-rose-600"><Wallet size={20} /></div>
          <div>
            <p className="text-xs text-slate-600">Total por pagar</p>
            <p className="text-xl font-bold text-slate-800">{money(totalAdeudado)}</p>
          </div>
        </div>
        <div className="card flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-50 text-amber-600"><HandCoins size={20} /></div>
          <div>
            <p className="text-xs text-slate-600">Proveedores a los que se debe</p>
            <p className="text-xl font-bold text-slate-800">{proveedoresConDeuda}</p>
          </div>
        </div>
      </div>

      {loading ? (
        <Cargando />
      ) : (
        <DataTable
          rows={listaVisible}
          rowKey={(c) => c.id}
          searchText={(c) => `${c.numero} ${c.proveedor ?? ''} ${c.descripcion} ${c.fecha}`}
          searchPlaceholder="Buscar por proveedor, #, descripción o fecha…"
          emptyText={filas.length === 0 ? 'No hay compras a crédito.' : 'No hay cuentas que coincidan.'}
          initialSort={{ index: 2, dir: 'desc' }}
          toolbar={
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input type="checkbox" checked={verSaldadas} onChange={(e) => setVerSaldadas(e.target.checked)} />
              Mostrar también las saldadas
            </label>
          }
          columns={[
            { header: 'No.', cell: (c) => <span className="font-mono font-semibold text-brand-700">{c.numero}</span>, sortValue: (c) => c.numero },
            { header: 'Proveedor', cell: (c) => <span className="font-medium text-slate-800">{c.proveedor || 'Sin proveedor'}</span>, sortValue: (c) => c.proveedor ?? '' },
            { header: 'Descripción', cell: (c) => <span className="text-slate-600">{c.descripcion}</span>, sortValue: (c) => c.descripcion },
            { header: 'Fecha', cell: (c) => <span className="text-slate-500">{fechaCorta(c.fecha)}</span>, sortValue: (c) => c.fecha },
            { header: 'Total', align: 'right', cell: (c) => money(c.total), sortValue: (c) => c.total },
            { header: 'Pagado', align: 'right', cell: (c) => <span className="text-emerald-600">{money(c.abonado)}</span>, sortValue: (c) => c.abonado },
            { header: 'Saldo', align: 'right', cell: (c) => <span className="font-bold text-slate-800">{money(c.saldo)}</span>, sortValue: (c) => c.saldo },
            {
              header: '', align: 'right', cell: (c) =>
                c.saldo > 0.01 ? (
                  puedePagar ? (
                    <button onClick={() => abrirPago(c)} className="rounded-lg bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-700 hover:bg-brand-100">
                      <HandCoins size={13} className="-mt-0.5 mr-0.5 inline" /> Registrar pago
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

      {/* MODAL PAGO A PROVEEDOR */}
      <Modal
        open={!!pagoCompra}
        title={`Registrar pago · Compra ${pagoCompra?.numero ?? ''}`}
        onClose={() => setPagoCompra(null)}
        footer={
          <>
            <button className="btn-ghost" onClick={() => setPagoCompra(null)}>Cancelar</button>
            <button className="btn-ghost" onClick={() => guardarPago(false)} disabled={saving}>{saving ? 'Guardando…' : 'Registrar'}</button>
            <button className="btn-primary" onClick={() => guardarPago(true)} disabled={saving}><Printer size={16} /> Guardar e imprimir</button>
          </>
        }
      >
        {pagoCompra && (
          <div className="space-y-4">
            <div className="rounded-xl bg-slate-50 p-3 text-sm">
              <div className="flex justify-between text-slate-600"><span>Proveedor</span><span className="font-medium text-slate-800">{pagoCompra.proveedor || 'Sin proveedor'}</span></div>
              <div className="flex justify-between text-slate-600"><span>Total</span><span>{money(pagoCompra.total)}</span></div>
              <div className="flex justify-between text-slate-600"><span>Pagado</span><span className="text-emerald-600">{money(pagoCompra.abonado)}</span></div>
              <div className="mt-1 flex justify-between border-t border-slate-200 pt-1 font-bold text-slate-800"><span>Saldo</span><span>{money(pagoCompra.saldo)}</span></div>
            </div>
            <div>
              <label className="label">Monto del pago (RD$)</label>
              <input type="number" min={0} step={50} className="input" value={pagoMonto || ''} onChange={(e) => setPagoMonto(Number(e.target.value))} />
              <button type="button" className="mt-1 text-xs font-semibold text-brand-600 hover:underline" onClick={() => setPagoMonto(pagoCompra.saldo)}>Pagar todo el saldo ({money(pagoCompra.saldo)})</button>
            </div>
            <div>
              <label className="label">Método de pago</label>
              <select className="input" value={pagoMetodo} onChange={(e) => setPagoMetodo(e.target.value)}>
                {METODOS_PAGO.map((m) => <option key={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Notas</label>
              <textarea className="input" rows={2} value={pagoNotas} onChange={(e) => setPagoNotas(e.target.value)} />
            </div>
            {(abonosByCompra[pagoCompra.id]?.length ?? 0) > 0 && (
              <div>
                <p className="label">Pagos anteriores</p>
                <ul className="divide-y divide-slate-100 rounded-xl border border-slate-100 text-sm">
                  {abonosByCompra[pagoCompra.id].map((a) => (
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

      {/* COMPROBANTE DE PAGO A PROVEEDOR (imprimible) */}
      <Modal open={!!recibo} title="Comprobante de pago" onClose={() => setRecibo(null)}>
        {recibo && (
          <div className="space-y-3">
            <div id="recibo-pago-prov" className="print-area space-y-2 rounded-xl border border-slate-100 p-3 text-sm">
              <div className="text-center">
                <img src={`${import.meta.env.BASE_URL}${negocio.logo}`} alt={negocio.nombre} className="mx-auto mb-1 h-14 rounded-lg bg-white object-contain" />
                <p className="font-display text-base font-bold text-brand-800">{negocio.nombre}</p>
                {negocio.rnc && <p className="text-xs text-slate-500">RNC: {negocio.rnc}</p>}
                <p className="mt-1 text-xs font-semibold text-slate-600">COMPROBANTE DE PAGO A PROVEEDOR</p>
                <p className="text-xs text-slate-600">Compra {recibo.compra.numero} · {fechaHora(recibo.hora)}</p>
              </div>
              <p className="text-slate-600"><span className="font-medium">Proveedor:</span> {recibo.compra.proveedor ?? 'Sin proveedor'}</p>
              <p className="text-slate-600"><span className="font-medium">Detalle:</span> {recibo.compra.descripcion}</p>
              <div className="space-y-0.5 border-t pt-1">
                <div className="flex justify-between text-slate-600"><span>Total de la compra</span><span>{money(recibo.compra.total)}</span></div>
                <div className="flex justify-between text-slate-600"><span>Pagado antes</span><span>{money(recibo.abonadoAntes)}</span></div>
                <div className="flex justify-between text-base font-bold text-slate-800"><span>Este pago</span><span>{money(recibo.monto)}</span></div>
                <div className="flex justify-between text-slate-600"><span>Método</span><span>{recibo.metodo}</span></div>
                <div className="flex justify-between font-semibold text-rose-600"><span>Saldo pendiente</span><span>{money(recibo.saldoRestante)}</span></div>
              </div>
              <p className="text-xs text-slate-600">Registrado por: {perfil?.nombre || perfil?.username || '—'}</p>
              <div className="border-t pt-1 text-center text-xs text-slate-500">
                <p>{negocio.direccion} · {negocio.referencia}</p>
              </div>
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
