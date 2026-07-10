import { useEffect, useState } from 'react'
import { Wallet, ArrowDownCircle, ArrowUpCircle, Lock, Unlock, HandCoins, Printer, User, Clock, History, Eye, MessageSquarePlus } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { CajaSesion, CajaMovimiento, Factura, FacturaPago } from '../types'
import { money, fechaHora, conPrefijo } from '../lib/format'
import { METODOS_PAGO } from '../lib/constants'
import { useAuth } from '../lib/auth'
import { useNegocio } from '../lib/negocio'
import PageHeader from '../components/PageHeader'
import Cargando from '../components/Cargando'
import Modal from '../components/Modal'
import DataTable from '../components/DataTable'

// Denominaciones de pesos dominicanos (billetes y monedas) para el arqueo
const DENOMS = [2000, 1000, 500, 200, 100, 50, 25, 10, 5, 1]

// Línea normalizada para el desglose (vale para pagos de contado y abonos de crédito)
type LineaCobro = { metodo: string; monto: number; factura_id: string }

// Desglose de cobros por método de pago, a partir de las líneas de pago
// (soporta pago dividido: una factura puede tener varios métodos).
function desgloseDePagos(pagos: LineaCobro[]) {
  return METODOS_PAGO.map((m) => {
    const lineas = pagos.filter((p) => (p.metodo ?? 'Efectivo') === m)
    return {
      metodo: m,
      cantidad: new Set(lineas.map((p) => p.factura_id)).size,
      total: lineas.reduce((s, p) => s + Number(p.monto), 0),
    }
  }).filter((x) => x.total > 0)
}

export default function Caja() {
  const { perfil, puedeAccion } = useAuth()
  const { negocio } = useNegocio()
  const usuario = perfil?.nombre || perfil?.username || 'Usuario'
  const puedeAbrir = puedeAccion('caja.abrir')
  const puedeMover = puedeAccion('caja.movimiento')
  const puedeCerrarDescuadre = puedeAccion('caja.cerrar_descuadre')
  const puedeVerDescuadre = puedeAccion('caja.ver_descuadre')
  const puedeAjustarCuadre = puedeAccion('caja.ajustar_cuadre')

  const [tab, setTab] = useState<'actual' | 'historial'>('actual')
  const [sesion, setSesion] = useState<CajaSesion | null>(null)
  const [movs, setMovs] = useState<CajaMovimiento[]>([])
  const [cobros, setCobros] = useState<Factura[]>([])
  const [pagosSesion, setPagosSesion] = useState<FacturaPago[]>([])
  const [abonosSesion, setAbonosSesion] = useState<LineaCobro[]>([])  // abonos de crédito de esta caja
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [, setTick] = useState(0)   // fuerza recalcular "tiempo abierto" cada minuto

  // modales
  const [abrirOpen, setAbrirOpen] = useState(false)
  const [movOpen, setMovOpen] = useState(false)
  const [cerrarOpen, setCerrarOpen] = useState(false)

  // comprobante de cierre (recién cerrado o desde el historial)
  const [verCierre, setVerCierre] = useState<CajaSesion | null>(null)
  const [cierreCobros, setCierreCobros] = useState<Factura[]>([])
  const [cierreMovs, setCierreMovs] = useState<CajaMovimiento[]>([])
  const [pagosCierre, setPagosCierre] = useState<LineaCobro[]>([])
  const [notaCorreccion, setNotaCorreccion] = useState('')
  const [guardandoNota, setGuardandoNota] = useState(false)

  // historial de cajas cerradas
  const [historial, setHistorial] = useState<CajaSesion[]>([])
  const [loadingHist, setLoadingHist] = useState(false)

  // formularios
  const [montoInicial, setMontoInicial] = useState(0)
  const [movTipo, setMovTipo] = useState<'ENTRADA' | 'SALIDA'>('ENTRADA')
  const [movConcepto, setMovConcepto] = useState('')
  const [movMonto, setMovMonto] = useState(0)
  const [conteo, setConteo] = useState<Record<number, number>>({})
  const [cierreNotas, setCierreNotas] = useState('')

  async function cargar() {
    setLoading(true)
    const { data: abierta } = await supabase
      .from('caja_sesiones')
      .select('*')
      .eq('estado', 'ABIERTA')
      .order('abierta_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (abierta) {
      const [{ data: m }, { data: c }, { data: fp }, { data: ab }] = await Promise.all([
        supabase.from('caja_movimientos').select('*').eq('caja_id', abierta.id).order('created_at', { ascending: false }),
        supabase.from('facturas').select('*').eq('caja_id', abierta.id).eq('estado', 'PAGADA'),
        supabase.from('factura_pagos').select('*').eq('caja_id', abierta.id),
        supabase.from('factura_abonos').select('factura_id, monto, metodo_pago').eq('caja_id', abierta.id),
      ])
      setMovs(m ?? [])
      setCobros(c ?? [])
      setPagosSesion(fp ?? [])
      setAbonosSesion((ab ?? []).map((a: any) => ({ metodo: a.metodo_pago ?? 'Efectivo', monto: Number(a.monto), factura_id: a.factura_id })))
    } else {
      setMovs([])
      setCobros([])
      setPagosSesion([])
      setAbonosSesion([])
    }
    setSesion(abierta ?? null)
    setLoading(false)
  }

  // Historial: todas las cajas ya cerradas (para auditoría y arqueos pasados).
  async function cargarHistorial() {
    setLoadingHist(true)
    const { data } = await supabase
      .from('caja_sesiones')
      .select('*')
      .eq('estado', 'CERRADA')
      .order('cerrada_at', { ascending: false })
      .limit(200)
    setHistorial((data as CajaSesion[]) ?? [])
    setLoadingHist(false)
  }

  useEffect(() => {
    cargar()
  }, [])

  useEffect(() => {
    if (tab === 'historial') cargarHistorial()
  }, [tab])

  // Recalcula el "tiempo abierto" cada minuto mientras haya una caja abierta.
  useEffect(() => {
    if (!sesion) return
    const t = setInterval(() => setTick((n) => n + 1), 60000)
    return () => clearInterval(t)
  }, [sesion])

  const entradas = movs.filter((m) => m.tipo === 'ENTRADA').reduce((s, m) => s + Number(m.monto), 0)
  const salidas = movs.filter((m) => m.tipo === 'SALIDA').reduce((s, m) => s + Number(m.monto), 0)
  // Cobros del día agrupados por método de pago: pagos de contado + abonos de crédito
  const cobrosLineas: LineaCobro[] = [...pagosSesion, ...abonosSesion]
  const porMetodo = desgloseDePagos(cobrosLineas)
  const totalCobrado = cobros.reduce((s, f) => s + Number(f.total), 0)
  const cobrosOtros = cobrosLineas.filter((p) => (p.metodo ?? 'Efectivo') !== 'Efectivo').reduce((s, p) => s + Number(p.monto), 0)

  const esperado = (sesion ? Number(sesion.monto_inicial) : 0) + entradas - salidas
  const contado = DENOMS.reduce((s, d) => s + d * (conteo[d] || 0), 0)
  const diferencia = contado - esperado

  async function abrirCaja() {
    setSaving(true)
    const { error } = await supabase.from('caja_sesiones').insert({
      monto_inicial: montoInicial,
      abierta_por: usuario,
      estado: 'ABIERTA',
    })
    setSaving(false)
    if (error) return alert('Error al abrir caja: ' + error.message)
    setAbrirOpen(false)
    setMontoInicial(0)
    cargar()
  }

  function nuevoMov(tipo: 'ENTRADA' | 'SALIDA') {
    setMovTipo(tipo)
    setMovConcepto('')
    setMovMonto(0)
    setMovOpen(true)
  }

  async function guardarMov() {
    if (!movConcepto.trim()) return alert('Escribe el concepto')
    if (movMonto <= 0) return alert('El monto debe ser mayor que 0')
    if (!sesion) return
    setSaving(true)
    const { error } = await supabase.from('caja_movimientos').insert({
      caja_id: sesion.id,
      tipo: movTipo,
      concepto: movConcepto,
      monto: movMonto,
    })
    setSaving(false)
    if (error) return alert('Error al guardar movimiento: ' + error.message)
    setMovOpen(false)
    cargar()
  }

  function abrirCierre() {
    setConteo({})
    setCierreNotas('')
    setCerrarOpen(true)
  }

  // La cajera puede cerrar si SOBRA (o cuadra); si FALTA, solo gerente/administrador.
  const bloqueadoPorDescuadre = diferencia < 0 && !puedeCerrarDescuadre

  async function cerrarCaja() {
    if (!sesion) return
    if (bloqueadoPorDescuadre) {
      return alert(
        puedeVerDescuadre
          ? `Hay un faltante de ${money(Math.abs(diferencia))}. No tienes permiso para cerrar la caja con faltante. Solicita a un gerente o administrador que la cierre.`
          : 'No se puede cerrar la caja: cuenta de nuevo el efectivo o solicita a un gerente o administrador que la cierre.',
      )
    }
    setSaving(true)
    const cerradaAt = new Date().toISOString()
    const detalle = DENOMS.filter((d) => conteo[d]).map((d) => `${conteo[d]}×${d}`).join(', ')
    const notas = [detalle ? `Arqueo: ${detalle}` : '', cierreNotas].filter(Boolean).join(' · ')
    const { error } = await supabase
      .from('caja_sesiones')
      .update({
        estado: 'CERRADA',
        cerrada_at: cerradaAt,
        cerrada_por: usuario,
        monto_contado: contado,
        diferencia: contado - esperado,
        notas: notas || null,
      })
      .eq('id', sesion.id)
    setSaving(false)
    if (error) return alert('Error al cerrar caja: ' + error.message)
    setCerrarOpen(false)
    // Mostrar el comprobante del cierre recién hecho (con opción de imprimir)
    setCierreCobros(cobros)
    setCierreMovs(movs)
    setPagosCierre([...pagosSesion, ...abonosSesion])
    setVerCierre({
      ...sesion,
      estado: 'CERRADA',
      cerrada_at: cerradaAt,
      cerrada_por: usuario,
      monto_contado: contado,
      diferencia: contado - esperado,
      notas: notas || null,
    })
    cargar()
  }

  // Ver el detalle/arqueo de una caja YA cerrada, desde el historial.
  async function verHistorialSesion(s: CajaSesion) {
    const [{ data: m }, { data: c }, { data: fp }, { data: ab }] = await Promise.all([
      supabase.from('caja_movimientos').select('*').eq('caja_id', s.id).order('created_at', { ascending: false }),
      supabase.from('facturas').select('*').eq('caja_id', s.id).eq('estado', 'PAGADA'),
      supabase.from('factura_pagos').select('*').eq('caja_id', s.id),
      supabase.from('factura_abonos').select('factura_id, monto, metodo_pago').eq('caja_id', s.id),
    ])
    setCierreMovs(m ?? [])
    setCierreCobros(c ?? [])
    setPagosCierre([
      ...((fp as FacturaPago[]) ?? []),
      ...((ab ?? []).map((a: any) => ({ metodo: a.metodo_pago ?? 'Efectivo', monto: Number(a.monto), factura_id: a.factura_id }))),
    ])
    setNotaCorreccion(s.notas ?? '')
    setVerCierre(s)
  }

  // Agregar una nota de corrección a un cierre YA guardado (no altera los montos contados).
  async function guardarNotaCorreccion() {
    if (!verCierre) return
    setGuardandoNota(true)
    const { error } = await supabase.from('caja_sesiones').update({ notas: notaCorreccion || null }).eq('id', verCierre.id)
    setGuardandoNota(false)
    if (error) return alert('Error al guardar la nota: ' + error.message)
    setVerCierre({ ...verCierre, notas: notaCorreccion || null })
    setHistorial((prev) => prev.map((h) => (h.id === verCierre.id ? { ...h, notas: notaCorreccion || null } : h)))
  }

  // Texto "abierta hace Xh Ym" (se recalcula cada minuto vía el tick).
  function tiempoAbierto(s: CajaSesion): string {
    const ms = Date.now() - new Date(s.abierta_at).getTime()
    const min = Math.max(0, Math.floor(ms / 60000))
    const h = Math.floor(min / 60)
    const m = min % 60
    return h > 0 ? `${h}h ${m}min` : `${m}min`
  }

  return (
    <div>
      <PageHeader
        title="Caja"
        subtitle="Control de efectivo: apertura, movimientos y cierre"
        action={
          !puedeAbrir ? null : sesion ? (
            <button className="btn-danger" onClick={abrirCierre}>
              <Lock size={16} /> Cerrar caja
            </button>
          ) : (
            <button className="btn-primary" onClick={() => setAbrirOpen(true)}>
              <Unlock size={16} /> Abrir caja
            </button>
          )
        }
      />

      <div className="mb-4 flex gap-2">
        <button onClick={() => setTab('actual')} className={tab === 'actual' ? 'btn-primary' : 'btn-ghost'}>
          <Wallet size={16} /> Caja actual
        </button>
        <button onClick={() => setTab('historial')} className={tab === 'historial' ? 'btn-primary' : 'btn-ghost'}>
          <History size={16} /> Historial
        </button>
      </div>

      {tab === 'actual' && (
        loading ? (
          <Cargando />
        ) : !sesion ? (
          <div className="card flex flex-col items-center gap-3 py-12 text-center">
            <Wallet className="text-brand-300" size={40} />
            <p className="text-slate-500">No hay una caja abierta.</p>
            {puedeAbrir ? (
              <button className="btn-primary" onClick={() => setAbrirOpen(true)}>
                <Unlock size={16} /> Abrir caja
              </button>
            ) : (
              <p className="text-xs text-slate-600">No tienes permiso para abrir la caja.</p>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            {/* Resumen */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="card">
                <p className="text-sm text-slate-500">Fondo inicial</p>
                <p className="mt-1 text-2xl font-bold text-slate-800">{money(sesion.monto_inicial)}</p>
              </div>
              <div className="card">
                <p className="text-sm text-slate-500">Entradas</p>
                <p className="mt-1 text-2xl font-bold text-emerald-600">{money(entradas)}</p>
              </div>
              <div className="card">
                <p className="text-sm text-slate-500">Salidas</p>
                <p className="mt-1 text-2xl font-bold text-rose-600">{money(salidas)}</p>
              </div>
              <div className="card flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-slate-500"><User size={20} /></div>
                <div>
                  <p className="text-sm text-slate-500">Cajero</p>
                  <p className="text-lg font-bold text-slate-800">{sesion.abierta_por}</p>
                </div>
              </div>
              <div className="card flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-slate-500"><Clock size={20} /></div>
                <div>
                  <p className="text-sm text-slate-500">Tiempo abierto</p>
                  <p className="text-lg font-bold text-slate-800">{tiempoAbierto(sesion)}</p>
                </div>
              </div>
              {puedeVerDescuadre && (
                <div className="card bg-gradient-to-br from-brand-600 to-brand-500 !ring-brand-400/30">
                  <p className="text-sm text-white/80">Efectivo esperado</p>
                  <p className="mt-1 text-2xl font-bold text-white">{money(esperado)}</p>
                </div>
              )}
            </div>

            <p className="text-xs text-slate-600">
              Caja {conPrefijo(negocio.prefijo_caja, sesion.numero)} · abierta {fechaHora(sesion.abierta_at)}
            </p>

            {/* Resumen de cobros por método de pago (llegan automáticamente de Facturación / Cuentas por cobrar) */}
            <div className="panel-3d p-5">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="flex items-center gap-2 font-display text-lg font-bold text-slate-800">
                  <HandCoins size={18} /> Cobros de esta caja
                </h2>
                <div className="text-right">
                  <p className="text-xs text-slate-600">{cobros.length} factura(s)</p>
                  <p className="text-lg font-bold text-brand-700">{money(totalCobrado)}</p>
                </div>
              </div>
              {porMetodo.length === 0 ? (
                <p className="py-3 text-center text-slate-600">Aún no se ha cobrado ninguna factura en esta caja. Los cobros se registran desde Facturación o Cuentas por cobrar.</p>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {porMetodo.map((x) => (
                    <div key={x.metodo} className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
                      <div>
                        <p className="text-sm font-medium text-slate-700">{x.metodo}</p>
                        <p className="text-xs text-slate-600">{x.cantidad} factura(s)</p>
                      </div>
                      <p className="font-bold text-slate-800">{money(x.total)}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Movimientos */}
            <div className="panel-3d p-5">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-display text-lg font-bold text-slate-800">Movimientos</h2>
                {puedeMover && (
                  <div className="flex gap-2">
                    <button className="btn-ghost !text-emerald-700" onClick={() => nuevoMov('ENTRADA')}>
                      <ArrowDownCircle size={16} /> Entrada
                    </button>
                    <button className="btn-ghost !text-rose-700" onClick={() => nuevoMov('SALIDA')}>
                      <ArrowUpCircle size={16} /> Salida
                    </button>
                  </div>
                )}
              </div>
              {movs.length === 0 ? (
                <p className="py-6 text-center text-slate-600">Aún no hay movimientos en esta caja.</p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {movs.map((m) => (
                    <li key={m.id} className="flex items-center gap-3 py-3">
                      {m.tipo === 'ENTRADA' ? (
                        <ArrowDownCircle className="text-emerald-500" size={20} />
                      ) : (
                        <ArrowUpCircle className="text-rose-500" size={20} />
                      )}
                      <div className="flex-1">
                        <p className="font-medium text-slate-800">{m.concepto}</p>
                        <p className="text-xs text-slate-600">{fechaHora(m.created_at)}</p>
                      </div>
                      <span className={`font-semibold ${m.tipo === 'ENTRADA' ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {m.tipo === 'ENTRADA' ? '+' : '−'}{money(m.monto)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )
      )}

      {tab === 'historial' && (
        loadingHist ? (
          <Cargando />
        ) : (
          <DataTable
            rows={historial}
            rowKey={(s) => s.id}
            searchText={(s) => `${conPrefijo(negocio.prefijo_caja, s.numero)} ${s.abierta_por} ${s.cerrada_por ?? ''}`}
            searchPlaceholder="Buscar por código o cajero…"
            emptyText="Aún no hay cajas cerradas."
            initialSort={{ index: 1, dir: 'desc' }}
            columns={[
              { header: 'Caja', cell: (s) => <span className="font-mono font-semibold text-slate-700">{conPrefijo(negocio.prefijo_caja, s.numero)}</span>, sortValue: (s) => s.numero ?? 0 },
              { header: 'Apertura', cell: (s) => <span className="text-slate-600">{fechaHora(s.abierta_at)} · {s.abierta_por}</span>, sortValue: (s) => s.abierta_at },
              { header: 'Cierre', cell: (s) => <span className="text-slate-600">{s.cerrada_at ? `${fechaHora(s.cerrada_at)} · ${s.cerrada_por}` : '—'}</span>, sortValue: (s) => s.cerrada_at ?? '' },
              { header: 'Fondo', align: 'right', cell: (s) => money(s.monto_inicial), sortValue: (s) => s.monto_inicial },
              { header: 'Contado', align: 'right', cell: (s) => money(s.monto_contado), sortValue: (s) => s.monto_contado ?? 0 },
              ...(puedeVerDescuadre ? [{
                header: 'Diferencia', align: 'right' as const,
                cell: (s: CajaSesion) => {
                  const d = Number(s.diferencia ?? 0)
                  return <span className={`badge ${d === 0 ? 'bg-emerald-50 text-emerald-700' : d > 0 ? 'bg-sky-50 text-sky-700' : 'bg-rose-50 text-rose-700'}`}>
                    {d === 0 ? 'Cuadrada' : d > 0 ? `Sobrante ${money(d)}` : `Faltante ${money(Math.abs(d))}`}
                  </span>
                },
                sortValue: (s: CajaSesion) => Number(s.diferencia ?? 0),
              }] : []),
              {
                header: '', align: 'right', cell: (s) => (
                  <button title="Ver detalle" onClick={() => verHistorialSesion(s)} className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 hover:text-brand-600">
                    <Eye size={16} />
                  </button>
                ),
              },
            ]}
          />
        )
      )}

      {/* Modal abrir caja */}
      <Modal
        open={abrirOpen}
        title="Abrir caja"
        onClose={() => setAbrirOpen(false)}
        footer={
          <>
            <button className="btn-ghost" onClick={() => setAbrirOpen(false)}>Cancelar</button>
            <button className="btn-primary" onClick={abrirCaja} disabled={saving}>{saving ? 'Abriendo…' : 'Abrir caja'}</button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-500">Indica el efectivo con el que inicia la caja (fondo).</p>
          <div>
            <label className="label">Fondo inicial (RD$)</label>
            <input type="number" min={0} step={100} className="input" value={montoInicial || ''} onChange={(e) => setMontoInicial(Number(e.target.value))} />
          </div>
        </div>
      </Modal>

      {/* Modal movimiento */}
      <Modal
        open={movOpen}
        title={movTipo === 'ENTRADA' ? 'Registrar entrada de efectivo' : 'Registrar salida de efectivo'}
        onClose={() => setMovOpen(false)}
        footer={
          <>
            <button className="btn-ghost" onClick={() => setMovOpen(false)}>Cancelar</button>
            <button className="btn-primary" onClick={guardarMov} disabled={saving}>{saving ? 'Guardando…' : 'Guardar'}</button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="label">Concepto</label>
            <input className="input" value={movConcepto} onChange={(e) => setMovConcepto(e.target.value)} placeholder={movTipo === 'ENTRADA' ? 'Venta en efectivo, abono…' : 'Compra, retiro, propina…'} />
          </div>
          <div>
            <label className="label">Monto (RD$)</label>
            <input type="number" min={0} step={50} className="input" value={movMonto || ''} onChange={(e) => setMovMonto(Number(e.target.value))} />
          </div>
        </div>
      </Modal>

      {/* Modal cerrar caja / arqueo */}
      <Modal
        open={cerrarOpen}
        title="Arqueo y cierre de caja"
        onClose={() => setCerrarOpen(false)}
        footer={
          <>
            <button className="btn-ghost" onClick={() => setCerrarOpen(false)}>Cancelar</button>
            <button className="btn-danger" onClick={cerrarCaja} disabled={saving || bloqueadoPorDescuadre} title={bloqueadoPorDescuadre ? 'No puedes cerrar con descuadre' : ''}>
              {saving ? 'Cerrando…' : 'Cerrar caja'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="rounded-xl bg-slate-50 p-4 text-sm">
            <div className="flex justify-between py-1"><span className="text-slate-500">Fondo inicial</span><span className="font-medium">{money(sesion?.monto_inicial)}</span></div>
            <div className="flex justify-between py-1"><span className="text-slate-500">Entradas</span><span className="font-medium text-emerald-600">+{money(entradas)}</span></div>
            <div className="flex justify-between py-1"><span className="text-slate-500">Salidas</span><span className="font-medium text-rose-600">−{money(salidas)}</span></div>
            {puedeVerDescuadre && (
              <div className="mt-1 flex justify-between border-t border-slate-200 pt-2"><span className="font-semibold text-slate-700">Efectivo esperado</span><span className="font-bold text-slate-900">{money(esperado)}</span></div>
            )}
            {cobrosOtros > 0 && (
              <p className="mt-2 text-xs text-slate-600">Nota: {money(cobrosOtros)} cobrados por tarjeta/transferencia no entran al arqueo de efectivo.</p>
            )}
          </div>
          <div>
            <label className="label">Arqueo de caja — cuenta los billetes y monedas</label>
            <div className="grid grid-cols-2 gap-2">
              {DENOMS.map((d) => (
                <div key={d} className="flex items-center gap-2 rounded-lg bg-slate-50 px-2 py-1.5">
                  <span className="w-16 shrink-0 text-right text-xs font-semibold text-slate-600">RD${d}</span>
                  <span className="text-slate-500">×</span>
                  <input
                    type="number"
                    min={0}
                    className="input !py-1 !px-2 text-sm"
                    value={conteo[d] || ''}
                    onChange={(e) => setConteo({ ...conteo, [d]: Math.max(0, Number(e.target.value)) })}
                  />
                  <span className="w-20 shrink-0 text-right text-xs text-slate-500">{money(d * (conteo[d] || 0))}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="flex justify-between rounded-xl bg-slate-100 px-4 py-2.5 text-sm">
            <span className="font-semibold text-slate-700">Total contado</span>
            <span className="font-bold text-slate-900">{money(contado)}</span>
          </div>
          {puedeVerDescuadre ? (
            <div className={`rounded-xl p-3 text-center text-sm font-semibold ${diferencia === 0 ? 'bg-emerald-50 text-emerald-700' : diferencia > 0 ? 'bg-sky-50 text-sky-700' : 'bg-rose-50 text-rose-700'}`}>
              {diferencia === 0 ? 'Caja cuadrada ✓' : diferencia > 0 ? `Sobrante: ${money(diferencia)}` : `Faltante: ${money(Math.abs(diferencia))}`}
            </div>
          ) : (
            <div className={`rounded-xl p-3 text-center text-sm font-semibold ${bloqueadoPorDescuadre ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'}`}>
              {bloqueadoPorDescuadre ? 'No se puede cerrar. Avisa a un gerente o administrador.' : 'Listo para cerrar ✓'}
            </div>
          )}
          {bloqueadoPorDescuadre && puedeVerDescuadre && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-center text-xs font-medium text-rose-700">
              ⚠️ Hay un faltante. No tienes permiso para cerrar la caja con faltante.
              Pide a un gerente o administrador que la cierre.
            </div>
          )}
          <div>
            <label className="label">Notas (opcional)</label>
            <textarea className="input" rows={2} value={cierreNotas} onChange={(e) => setCierreNotas(e.target.value)} />
          </div>
        </div>
      </Modal>

      {/* Comprobante de cierre (imprimible) */}
      <Modal open={!!verCierre} title={`Cierre de caja ${conPrefijo(negocio.prefijo_caja, verCierre?.numero)}`} onClose={() => setVerCierre(null)}>
        {verCierre && (() => {
          const ent = cierreMovs.filter((m) => m.tipo === 'ENTRADA').reduce((s, m) => s + Number(m.monto), 0)
          const sal = cierreMovs.filter((m) => m.tipo === 'SALIDA').reduce((s, m) => s + Number(m.monto), 0)
          const esp = Number(verCierre.monto_inicial) + ent - sal
          const dif = Number(verCierre.diferencia ?? 0)
          const desg = desgloseDePagos(pagosCierre)
          const totalCob = cierreCobros.reduce((s, f) => s + Number(f.total), 0)
          return (
            <div className="print-area space-y-3">
              <div className="text-center">
                <img src={`${import.meta.env.BASE_URL}${negocio.logo}`} alt={negocio.nombre} className="mx-auto mb-2 h-16 rounded-lg bg-white object-contain" />
                <p className="font-display text-lg font-bold text-brand-800">{negocio.nombre}</p>
                <p className="text-xs font-medium text-slate-600">Comprobante de cierre de caja {conPrefijo(negocio.prefijo_caja, verCierre.numero)}</p>
              </div>
              <div className="text-sm text-slate-600">
                <p><span className="font-medium">Abierta:</span> {fechaHora(verCierre.abierta_at)} · {verCierre.abierta_por}</p>
                <p><span className="font-medium">Cerrada:</span> {fechaHora(verCierre.cerrada_at)} · {verCierre.cerrada_por}</p>
              </div>

              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-600">Cobros por método</p>
                {desg.length === 0 ? (
                  <p className="text-sm text-slate-600">Sin cobros registrados.</p>
                ) : (
                  <table className="w-full text-sm">
                    <tbody>
                      {desg.map((x) => (
                        <tr key={x.metodo} className="border-b border-slate-50">
                          <td className="py-1">{x.metodo}</td>
                          <td className="py-1 text-center text-xs text-slate-600">{x.cantidad}</td>
                          <td className="py-1 text-right">{money(x.total)}</td>
                        </tr>
                      ))}
                      <tr className="font-bold text-slate-800">
                        <td className="py-1">Total cobrado</td>
                        <td></td>
                        <td className="py-1 text-right">{money(totalCob)}</td>
                      </tr>
                    </tbody>
                  </table>
                )}
              </div>

              <div className="space-y-0.5 border-t pt-2 text-sm">
                <div className="flex justify-between text-slate-600"><span>Fondo inicial</span><span>{money(verCierre.monto_inicial)}</span></div>
                <div className="flex justify-between text-slate-600"><span>Entradas de efectivo</span><span>+{money(ent)}</span></div>
                <div className="flex justify-between text-slate-600"><span>Salidas de efectivo</span><span>−{money(sal)}</span></div>
                {puedeVerDescuadre && <div className="flex justify-between font-medium text-slate-700"><span>Efectivo esperado</span><span>{money(esp)}</span></div>}
                <div className="flex justify-between font-medium text-slate-700"><span>Efectivo contado</span><span>{money(verCierre.monto_contado)}</span></div>
                {puedeVerDescuadre && (
                  <div className={`flex justify-between border-t pt-1 text-base font-bold ${dif === 0 ? 'text-emerald-700' : dif > 0 ? 'text-sky-700' : 'text-rose-700'}`}>
                    <span>{dif === 0 ? 'Cuadrada' : dif > 0 ? 'Sobrante' : 'Faltante'}</span>
                    <span>{dif === 0 ? money(0) : money(Math.abs(dif))}</span>
                  </div>
                )}
              </div>

              {verCierre.notas && <p className="text-xs text-slate-500">{verCierre.notas}</p>}

              <button className="btn-primary no-print w-full" onClick={() => window.print()}>
                <Printer size={16} /> Imprimir
              </button>

              {puedeAjustarCuadre && (
                <div className="no-print rounded-xl border border-amber-200 bg-amber-50/50 p-3">
                  <label className="label flex items-center gap-1.5"><MessageSquarePlus size={14} /> Nota de corrección (no cambia los montos contados)</label>
                  <textarea
                    className="input"
                    rows={2}
                    value={notaCorreccion}
                    onChange={(e) => setNotaCorreccion(e.target.value)}
                    placeholder="Ej. Faltante de RD$50 por vuelto mal dado; corregido con el cajero el día siguiente."
                  />
                  <button className="btn-ghost mt-2 w-full" onClick={guardarNotaCorreccion} disabled={guardandoNota}>
                    {guardandoNota ? 'Guardando…' : 'Guardar nota'}
                  </button>
                </div>
              )}
            </div>
          )
        })()}
      </Modal>
    </div>
  )
}
