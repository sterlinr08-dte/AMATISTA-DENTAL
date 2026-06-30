import { useEffect, useState } from 'react'
import { Wallet, ArrowDownCircle, ArrowUpCircle, Lock, Unlock, Receipt, HandCoins, Printer, Banknote, CreditCard, ArrowLeftRight, MoreHorizontal, CheckCircle2, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { CajaSesion, CajaMovimiento, Factura, FacturaItem, FacturaPago } from '../types'
import { money, fechaHora, codigoFactura, conPrefijo } from '../lib/format'
import { METODOS_PAGO } from '../lib/constants'
import { useAuth } from '../lib/auth'
import { useNegocio } from '../lib/negocio'
import PageHeader from '../components/PageHeader'
import Cargando from '../components/Cargando'
import Modal from '../components/Modal'

// Denominaciones de pesos dominicanos (billetes y monedas) para el arqueo
const DENOMS = [2000, 1000, 500, 200, 100, 50, 25, 10, 5, 1]

// Iconos por método de pago para el cobro
const METODO_ICONO: Record<string, typeof Banknote> = {
  Efectivo: Banknote,
  Tarjeta: CreditCard,
  Transferencia: ArrowLeftRight,
  PayPal: Wallet,
  Otro: MoreHorizontal,
}

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
  const puedeCobrar = puedeAccion('facturas.cobrar')
  const puedeCerrarDescuadre = puedeAccion('caja.cerrar_descuadre')
  const puedeVerDescuadre = puedeAccion('caja.ver_descuadre')

  const [sesion, setSesion] = useState<CajaSesion | null>(null)
  const [movs, setMovs] = useState<CajaMovimiento[]>([])
  const [pendientes, setPendientes] = useState<Factura[]>([])
  const [cobros, setCobros] = useState<Factura[]>([])
  const [pagosSesion, setPagosSesion] = useState<FacturaPago[]>([])
  const [abonosSesion, setAbonosSesion] = useState<LineaCobro[]>([])  // abonos de crédito de esta caja
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // modales
  const [abrirOpen, setAbrirOpen] = useState(false)
  const [movOpen, setMovOpen] = useState(false)
  const [cerrarOpen, setCerrarOpen] = useState(false)
  const [cobrarFactura, setCobrarFactura] = useState<Factura | null>(null)
  const [cobroItems, setCobroItems] = useState<FacturaItem[]>([])
  const [metodoCobro, setMetodoCobro] = useState('Efectivo')   // método del abono (crédito)
  const [pagos, setPagos] = useState<{ metodo: string; monto: number }[]>([{ metodo: 'Efectivo', monto: 0 }])  // pago dividido (contado)
  const [efectivoRecibido, setEfectivoRecibido] = useState(0)
  const [cobroAbonado, setCobroAbonado] = useState(0)   // abonos previos (crédito)
  const [abonoCredito, setAbonoCredito] = useState(0)   // monto a abonar ahora (crédito)
  const [cobroOk, setCobroOk] = useState(false)
  const [cobroHora, setCobroHora] = useState('')

  // comprobante de cierre
  const [verCierre, setVerCierre] = useState<CajaSesion | null>(null)
  const [cierreCobros, setCierreCobros] = useState<Factura[]>([])
  const [cierreMovs, setCierreMovs] = useState<CajaMovimiento[]>([])
  const [pagosCierre, setPagosCierre] = useState<LineaCobro[]>([])

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

    // Facturas pendientes de cobro
    const { data: pend } = await supabase
      .from('facturas')
      .select('*')
      .eq('estado', 'PENDIENTE')
      .order('numero', { ascending: false })
    setPendientes(pend ?? [])
    setLoading(false)
  }

  useEffect(() => {
    cargar()
  }, [])

  // Auto-impresión del recibo al cobrar (Configuración → Impresora). Con el modo
  // de impresión directa de Chrome, sale solo; si no, abre el diálogo de impresión.
  useEffect(() => {
    if (cobroOk && negocio.auto_imprimir) {
      const t = setTimeout(() => window.print(), 400)
      return () => clearTimeout(t)
    }
  }, [cobroOk, negocio.auto_imprimir])

  const entradas = movs.filter((m) => m.tipo === 'ENTRADA').reduce((s, m) => s + Number(m.monto), 0)
  const salidas = movs.filter((m) => m.tipo === 'SALIDA').reduce((s, m) => s + Number(m.monto), 0)
  // Cobros del día agrupados por método de pago: pagos de contado + abonos de crédito
  const cobrosLineas: LineaCobro[] = [...pagosSesion, ...abonosSesion]
  const porMetodo = desgloseDePagos(cobrosLineas)
  const totalCobrado = cobros.reduce((s, f) => s + Number(f.total), 0)
  const cobrosOtros = cobrosLineas.filter((p) => (p.metodo ?? 'Efectivo') !== 'Efectivo').reduce((s, p) => s + Number(p.monto), 0)

  // Derivados del cobro en curso (mini-POS)
  const esCredito = cobrarFactura?.tipo_venta === 'CREDITO'
  const cobroFull = Number(cobrarFactura?.total ?? 0)
  const cobroSaldoPrevio = Math.max(0, cobroFull - cobroAbonado)
  // Monto a pagar AHORA: en crédito es el abono; en contado es el total completo
  const cobroTotal = esCredito ? abonoCredito : cobroFull
  // Pago dividido (contado): suma de las líneas y porción en efectivo
  const pagosSuma = pagos.reduce((s, p) => s + Number(p.monto || 0), 0)
  const pagoEfectivo = pagos.filter((p) => p.metodo === 'Efectivo').reduce((s, p) => s + Number(p.monto || 0), 0)
  // En crédito el abono usa un solo método; en contado se usan las líneas de `pagos`.
  const cobroEsEfectivo = esCredito ? metodoCobro === 'Efectivo' : pagoEfectivo > 0
  const efectivoAPagar = esCredito ? (cobroEsEfectivo ? cobroTotal : 0) : pagoEfectivo
  const cobroCambio = efectivoRecibido - efectivoAPagar
  const cobroPuede = esCredito
    ? (cobroTotal > 0 &&
       (!cobroEsEfectivo || efectivoRecibido >= cobroTotal) &&
       cobroTotal <= cobroSaldoPrevio + 0.01)
    : (cobroFull > 0 &&
       Math.abs(pagosSuma - cobroFull) < 0.01 &&
       pagos.every((p) => Number(p.monto) > 0) &&
       (pagoEfectivo <= 0 || efectivoRecibido >= pagoEfectivo))

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

  // Pago dividido (contado): agregar/editar/quitar líneas de método
  function agregarPago() {
    const restante = Math.max(0, cobroFull - pagosSuma)
    const usados = pagos.map((p) => p.metodo)
    const metodo = METODOS_PAGO.find((m) => !usados.includes(m)) ?? 'Tarjeta'
    setPagos((prev) => [...prev, { metodo, monto: restante }])
  }
  function setPagoLinea(i: number, patch: Partial<{ metodo: string; monto: number }>) {
    setPagos((prev) => prev.map((p, idx) => (idx === i ? { ...p, ...patch } : p)))
  }
  function quitarPago(i: number) {
    setPagos((prev) => prev.filter((_, idx) => idx !== i))
  }

  async function iniciarCobro(f: Factura) {
    setCobrarFactura(f)
    setMetodoCobro('Efectivo')
    // Contado: arranca con una sola línea (Efectivo = total). La cajera puede dividir.
    setPagos([{ metodo: 'Efectivo', monto: Number(f.total) }])
    setEfectivoRecibido(0)
    setCobroOk(false)
    setCobroItems([])
    setCobroAbonado(0)
    setAbonoCredito(0)
    const { data } = await supabase.from('factura_items').select('*').eq('factura_id', f.id)
    setCobroItems(data ?? [])
    // Si es a crédito, traer los abonos previos para calcular el saldo
    if (f.tipo_venta === 'CREDITO') {
      const { data: ab } = await supabase.from('factura_abonos').select('monto').eq('factura_id', f.id)
      const abonado = (ab ?? []).reduce((s, a) => s + Number((a as any).monto), 0)
      setCobroAbonado(abonado)
      setAbonoCredito(Math.max(0, Number(f.total) - abonado))
    }
  }

  async function confirmarCobro() {
    if (!cobrarFactura || !sesion) return
    setSaving(true)

    if (esCredito) {
      // VENTA A CRÉDITO: registrar un abono (parcial o total)
      const monto = abonoCredito
      const { error: ea } = await supabase.from('factura_abonos').insert({
        factura_id: cobrarFactura.id,
        monto,
        metodo_pago: metodoCobro,
        caja_id: sesion.id,
        registrado_por: usuario,
      })
      if (ea) {
        setSaving(false)
        return alert('Error al registrar el abono: ' + ea.message)
      }
      // Si el abono salda la deuda, marcar la factura como PAGADA
      if (cobroSaldoPrevio - monto <= 0.01) {
        await supabase.from('facturas').update({ estado: 'PAGADA', metodo_pago: metodoCobro, caja_id: sesion.id }).eq('id', cobrarFactura.id)
      }
      if (metodoCobro === 'Efectivo') {
        const { error: em } = await supabase.from('caja_movimientos').insert({
          caja_id: sesion.id,
          tipo: 'ENTRADA',
          concepto: `Abono ${codigoFactura(cobrarFactura)} · ${cobrarFactura.cliente_nombre ?? 'Cliente'}`,
          monto,
          factura_id: cobrarFactura.id,
        })
        if (em) { setSaving(false); return alert('Abono guardado, pero falló el registro en caja: ' + em.message) }
      }
    } else {
      // VENTA DE CONTADO: cobro total con uno o varios métodos (pago dividido)
      const lineas = pagos.filter((p) => Number(p.monto) > 0)
      const metodoFactura = lineas.length === 1 ? lineas[0].metodo : 'Mixto'
      const { error: e1 } = await supabase
        .from('facturas')
        .update({ estado: 'PAGADA', metodo_pago: metodoFactura, caja_id: sesion.id })
        .eq('id', cobrarFactura.id)
      if (e1) {
        setSaving(false)
        return alert('Error al cobrar: ' + e1.message)
      }
      // Guardar el desglose de pagos (una línea por método)
      const { error: ep } = await supabase.from('factura_pagos').insert(
        lineas.map((p) => ({
          factura_id: cobrarFactura.id,
          metodo: p.metodo,
          monto: Number(p.monto),
          caja_id: sesion.id,
          registrado_por: usuario,
        })),
      )
      if (ep) { setSaving(false); return alert('Factura cobrada, pero falló el desglose de pagos: ' + ep.message) }
      // La parte en EFECTIVO entra a la caja (para el arqueo)
      if (pagoEfectivo > 0) {
        const { error: em } = await supabase.from('caja_movimientos').insert({
          caja_id: sesion.id,
          tipo: 'ENTRADA',
          concepto: `Factura ${codigoFactura(cobrarFactura)} · ${cobrarFactura.cliente_nombre ?? 'Cliente'}`,
          monto: pagoEfectivo,
          factura_id: cobrarFactura.id,
        })
        if (em) { setSaving(false); return alert('Factura cobrada, pero falló el registro en caja: ' + em.message) }
      }
    }
    setSaving(false)
    setCobroHora(new Date().toISOString())
    setCobroOk(true) // muestra confirmación animada + recibo imprimible
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

      {loading ? (
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
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
            {puedeVerDescuadre && (
              <div className="card bg-gradient-to-br from-brand-600 to-brand-500 !ring-brand-400/30">
                <p className="text-sm text-white/80">Efectivo esperado</p>
                <p className="mt-1 text-2xl font-bold text-white">{money(esperado)}</p>
              </div>
            )}
          </div>

          <p className="text-xs text-slate-600">
            Caja {conPrefijo(negocio.prefijo_caja, sesion.numero)} · abierta por {sesion.abierta_por} · {fechaHora(sesion.abierta_at)}
          </p>

          {/* Resumen de cobros por método de pago */}
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
              <p className="py-3 text-center text-slate-600">Aún no se ha cobrado ninguna factura en esta caja.</p>
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

          {/* Facturas por cobrar */}
          {puedeCobrar && (
            <div className="panel-3d p-5">
              <h2 className="mb-4 flex items-center gap-2 font-display text-lg font-bold text-slate-800">
                <Receipt size={18} /> Facturas por cobrar
                {pendientes.length > 0 && <span className="badge bg-amber-50 text-amber-700">{pendientes.length}</span>}
              </h2>
              {pendientes.length === 0 ? (
                <p className="py-4 text-center text-slate-600">No hay facturas pendientes de cobro.</p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {pendientes.map((f) => (
                    <li key={f.id} className="flex items-center gap-3 py-3">
                      <span className="font-mono font-semibold text-slate-500">{codigoFactura(f)}</span>
                      <div className="flex-1">
                        <p className="flex items-center gap-2 font-medium text-slate-800">
                          {f.cliente_nombre ?? 'Cliente'}
                          {f.tipo_venta === 'CREDITO' && <span className="badge bg-amber-50 text-amber-700">Crédito</span>}
                        </p>
                        <p className="text-xs text-slate-600">{fechaHora(f.created_at)}</p>
                      </div>
                      <span className="font-semibold text-slate-800">{money(f.total)}</span>
                      <button className="btn-primary !px-3 !py-1.5 text-xs" onClick={() => iniciarCobro(f)}>
                        <HandCoins size={14} /> {f.tipo_venta === 'CREDITO' ? 'Abonar' : 'Cobrar'}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

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

      {/* Modal cobrar factura (mini-POS) */}
      <Modal
        open={!!cobrarFactura}
        title={cobroOk ? 'Cobro realizado' : `Cobrar factura ${cobrarFactura ? codigoFactura(cobrarFactura) : ''}`}
        onClose={() => setCobrarFactura(null)}
        footer={
          cobroOk ? null : (
            <>
              <button className="btn-ghost" onClick={() => setCobrarFactura(null)}>Cancelar</button>
              <button className="btn-primary" onClick={confirmarCobro} disabled={saving || !cobroPuede}>
                {saving ? 'Guardando…' : `${esCredito ? 'Abonar' : 'Cobrar'} ${money(cobroTotal)}`}
              </button>
            </>
          )
        }
      >
        {cobroOk ? (
          <div className="space-y-4">
            <div className="flex flex-col items-center gap-1 text-center">
              <CheckCircle2 className="animate-pop text-emerald-500" size={64} />
              <p className="text-lg font-bold text-slate-800">¡Cobro registrado!</p>
            </div>

            {/* Recibo imprimible */}
            <div id="recibo-print" className="print-area space-y-2 rounded-xl border border-slate-100 p-3 text-sm">
              <div className="text-center">
                <img src={`${import.meta.env.BASE_URL}${negocio.logo}`} alt={negocio.nombre} className="mx-auto mb-1 h-14 rounded-lg bg-white object-contain" />
                <p className="font-display text-base font-bold text-brand-800">{negocio.nombre}</p>
                {negocio.rnc && <p className="text-xs text-slate-500">RNC: {negocio.rnc}</p>}
                <p className="text-xs text-slate-500">Tel/WhatsApp: {negocio.telefono}</p>
                <p className="mt-1 text-xs font-semibold text-slate-600">RECIBO DE PAGO</p>
                <p className="text-xs text-slate-600">Factura {cobrarFactura ? codigoFactura(cobrarFactura) : ''} · {fechaHora(cobroHora)}</p>
              </div>
              <p className="text-slate-600"><span className="font-medium">Cliente:</span> {cobrarFactura?.cliente_nombre ?? 'Cliente'}</p>
              <table className="w-full">
                <tbody>
                  {cobroItems.map((it) => (
                    <tr key={it.id} className="border-b border-slate-50 text-slate-600">
                      <td className="py-1">{it.cantidad}× {it.descripcion}</td>
                      <td className="py-1 text-right">{money(it.importe)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="space-y-0.5 border-t pt-1">
                <div className="flex justify-between text-base font-bold text-slate-800"><span>{esCredito ? 'Abono' : 'Total'}</span><span>{money(cobroTotal)}</span></div>
                {esCredito && (cobroSaldoPrevio - cobroTotal) > 0.01 && (
                  <div className="flex justify-between font-semibold text-rose-600"><span>Saldo pendiente</span><span>{money(cobroSaldoPrevio - cobroTotal)}</span></div>
                )}
                {esCredito ? (
                  <div className="flex justify-between text-slate-600"><span>Método</span><span>{metodoCobro}</span></div>
                ) : (
                  pagos.filter((p) => Number(p.monto) > 0).map((p, i) => (
                    <div key={i} className="flex justify-between text-slate-600"><span>{p.metodo}</span><span>{money(p.monto)}</span></div>
                  ))
                )}
                {cobroEsEfectivo && (
                  <>
                    <div className="flex justify-between text-slate-600"><span>Efectivo recibido</span><span>{money(efectivoRecibido)}</span></div>
                    <div className="flex justify-between font-semibold text-amber-700"><span>Devuelta / cambio</span><span>{money(Math.max(0, cobroCambio))}</span></div>
                  </>
                )}
              </div>
              <p className="text-xs text-slate-600">Atendido por: {usuario}</p>
              <div className="border-t pt-1 text-center text-xs text-slate-500">
                <p>{negocio.direccion} · {negocio.referencia}</p>
                <p>WhatsApp {negocio.whatsapp} · {negocio.instagram}</p>
              </div>
              <p className="text-center text-xs font-medium text-brand-600">¡Gracias por su preferencia! 💕</p>
            </div>

            <div className="flex gap-2 no-print">
              <button className="btn-ghost flex-1" onClick={() => setCobrarFactura(null)}>Cerrar</button>
              <button className="btn-primary flex-1" onClick={() => window.print()}>
                <Printer size={16} /> Imprimir recibo
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Cliente + renglones */}
            <div className="rounded-xl bg-slate-50 p-3">
              <p className="mb-1 text-sm font-semibold text-slate-700">{cobrarFactura?.cliente_nombre ?? 'Cliente'}</p>
              <ul className="max-h-32 space-y-0.5 overflow-y-auto text-sm">
                {cobroItems.map((it) => (
                  <li key={it.id} className="flex justify-between text-slate-600">
                    <span className="truncate pr-2">{it.cantidad}× {it.descripcion}</span>
                    <span className="shrink-0">{money(it.importe)}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Venta a crédito: saldo + monto a abonar */}
            {esCredito && (
              <div className="space-y-2 rounded-xl border border-amber-200 bg-amber-50/60 p-3 text-sm">
                <div className="flex justify-between text-slate-600"><span>Total factura</span><span>{money(cobroFull)}</span></div>
                {cobroAbonado > 0 && <div className="flex justify-between text-slate-600"><span>Abonado antes</span><span className="text-emerald-600">{money(cobroAbonado)}</span></div>}
                <div className="flex justify-between font-semibold text-slate-800"><span>Saldo pendiente</span><span>{money(cobroSaldoPrevio)}</span></div>
                <label className="label !mb-0 pt-1">Monto a abonar ahora</label>
                <input type="number" min={0} step={50} className="input" value={abonoCredito || ''} onChange={(e) => setAbonoCredito(Number(e.target.value))} />
                <button type="button" className="text-xs font-semibold text-brand-600 hover:underline" onClick={() => setAbonoCredito(cobroSaldoPrevio)}>Pagar todo el saldo ({money(cobroSaldoPrevio)})</button>
              </div>
            )}

            {/* Total grande (monto a pagar ahora) */}
            <div className="rounded-2xl bg-gradient-to-br from-brand-600 to-brand-500 px-5 py-4 text-center text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.2),0_14px_30px_-12px_rgba(201,162,39,0.6)]">
              <p className="text-xs uppercase tracking-widest text-white/80">{esCredito ? 'A pagar ahora' : 'Total a cobrar'}</p>
              <p className="text-3xl font-extrabold">{money(cobroTotal)}</p>
            </div>

            {/* Crédito: un solo método para el abono (botones) */}
            {esCredito && (
              <div>
                <label className="label">Método de pago</label>
                <div className="grid grid-cols-3 gap-2">
                  {METODOS_PAGO.map((m) => {
                    const Icon = METODO_ICONO[m] ?? MoreHorizontal
                    const activo = metodoCobro === m
                    return (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setMetodoCobro(m)}
                        className={`flex flex-col items-center gap-1 rounded-xl border px-2 py-3 text-xs font-semibold transition ${
                          activo
                            ? 'border-brand-400 bg-brand-50 text-brand-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.7),0_6px_14px_-4px_rgba(201,162,39,0.35)]'
                            : 'border-slate-200 bg-white text-slate-500 hover:border-pink-200'
                        }`}
                      >
                        <Icon size={20} />
                        {m}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Contado: pago dividido (uno o varios métodos) */}
            {!esCredito && (
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <label className="label !mb-0">Método de pago</label>
                  <button type="button" onClick={agregarPago} className="text-xs font-semibold text-brand-600 hover:underline">+ Dividir / agregar método</button>
                </div>
                <div className="space-y-2">
                  {pagos.map((p, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <select className="input flex-1" value={p.metodo} onChange={(e) => setPagoLinea(i, { metodo: e.target.value })}>
                        {METODOS_PAGO.map((m) => <option key={m}>{m}</option>)}
                      </select>
                      <input type="number" min={0} step={50} className="input w-32" value={p.monto || ''} onChange={(e) => setPagoLinea(i, { monto: Number(e.target.value) })} />
                      {pagos.length > 1 && (
                        <button type="button" onClick={() => quitarPago(i)} className="rounded-lg p-2 text-slate-500 hover:bg-rose-50 hover:text-rose-600"><X size={16} /></button>
                      )}
                    </div>
                  ))}
                </div>
                <div className={`mt-2 flex items-center justify-between rounded-lg px-3 py-2 text-sm font-bold ${Math.abs(pagosSuma - cobroFull) < 0.01 ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                  <span>Pagado {money(pagosSuma)} de {money(cobroFull)}</span>
                  <span>{Math.abs(pagosSuma - cobroFull) < 0.01 ? 'Cuadra ✓' : pagosSuma < cobroFull ? `Falta ${money(cobroFull - pagosSuma)}` : `Sobra ${money(pagosSuma - cobroFull)}`}</span>
                </div>
              </div>
            )}

            {/* Calculadora de cambio (solo efectivo) */}
            {cobroEsEfectivo ? (
              <div className="space-y-2 rounded-xl border border-pink-100 bg-pink-50/40 p-3">
                <div className="flex items-center justify-between">
                  <label className="label !mb-0">Efectivo recibido</label>
                  {!esCredito && pagos.length > 1 && <span className="text-xs text-slate-600">A pagar en efectivo: {money(efectivoAPagar)}</span>}
                </div>
                <input
                  type="number"
                  min={0}
                  step={50}
                  className="input"
                  value={efectivoRecibido || ''}
                  onChange={(e) => setEfectivoRecibido(Number(e.target.value))}
                />
                <div className="flex flex-wrap gap-1.5">
                  <button type="button" onClick={() => setEfectivoRecibido(efectivoAPagar)} className="rounded-lg bg-white px-2.5 py-1 text-xs font-semibold text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50">Exacto</button>
                  {[100, 200, 500, 1000, 2000].filter((v) => v > efectivoAPagar).map((v) => (
                    <button key={v} type="button" onClick={() => setEfectivoRecibido(v)} className="rounded-lg bg-white px-2.5 py-1 text-xs font-semibold text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50">{money(v)}</button>
                  ))}
                </div>
                <div className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm font-bold ${cobroCambio < 0 ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}`}>
                  <span>{cobroCambio < 0 ? 'Falta' : 'Devuelta / cambio'}</span>
                  <span>{money(Math.abs(cobroCambio))}</span>
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-600">
                Pago no en efectivo: se marca la factura como pagada y se registra en esta caja, sin afectar el efectivo del arqueo.
              </p>
            )}
          </div>
        )}
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
            </div>
          )
        })()}
      </Modal>
    </div>
  )
}
