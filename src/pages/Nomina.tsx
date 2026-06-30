import { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2, Users, Printer, ClipboardList, Download } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { Empleado, PagoEmpleado, TipoPagoEmpleado } from '../types'
import { money, fechaCorta, fechaHora, hoyISO, codigoFactura, conPrefijo } from '../lib/format'
import { METODOS_PAGO } from '../lib/constants'
import { pctComisionServicio, comisionLinea, rangosSeSolapan } from '../lib/comisiones'
import { imprimirTabla, descargarCSV } from '../lib/reportes'
import { useAuth } from '../lib/auth'
import { useNegocio } from '../lib/negocio'
import PageHeader from '../components/PageHeader'
import Cargando from '../components/Cargando'
import Modal from '../components/Modal'
import Paginacion, { usePaginacion } from '../components/Paginacion'

interface ReciboPago { empleado: string; tipo: string; periodo: string; monto: number; metodo: string; fecha: string; hora: string }

const tipos: TipoPagoEmpleado[] = ['SALARIO', 'COMISION', 'ADELANTO', 'BONO']

const tipoBadge: Record<TipoPagoEmpleado, string> = {
  SALARIO: 'bg-sky-50 text-sky-700',
  COMISION: 'bg-emerald-50 text-emerald-700',
  ADELANTO: 'bg-amber-50 text-amber-700',
  BONO: 'bg-fuchsia-50 text-fuchsia-700',
}

const vacio = {
  empleado_id: '',
  fecha: hoyISO(),
  periodo: '',
  tipo: 'SALARIO' as TipoPagoEmpleado,
  monto: 0,
  metodo_pago: 'Efectivo',
  notas: '',
}

export default function Nomina() {
  const { negocio } = useNegocio()
  const { puedeAccion } = useAuth()
  const puedeCambiarFecha = puedeAccion('nomina.cambiar_fecha')
  const [recibo, setRecibo] = useState<ReciboPago | null>(null)
  const [items, setItems] = useState<PagoEmpleado[]>([])
  const [empleados, setEmpleados] = useState<Empleado[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState(vacio)
  const [saving, setSaving] = useState(false)

  // Resumen de comisión: servicios realizados por el empleado en un rango
  const [comDesde, setComDesde] = useState(hoyISO().slice(0, 7) + '-01')
  const [comHasta, setComHasta] = useState(hoyISO())
  const [comItems, setComItems] = useState<any[]>([])
  const [comLoading, setComLoading] = useState(false)
  // Comisiones ya pagadas a este empleado (para avisar si el periodo se solapa)
  const [comPagadas, setComPagadas] = useState<PagoEmpleado[]>([])

  // Ventana: historial de servicios realizados por empleado y rango (incentivos/comisiones)
  const [histOpen, setHistOpen] = useState(false)
  const [histEmpleado, setHistEmpleado] = useState('')
  const [histDesde, setHistDesde] = useState(hoyISO().slice(0, 7) + '-01')
  const [histHasta, setHistHasta] = useState(hoyISO())
  const [histItems, setHistItems] = useState<any[]>([])
  const [histLoading, setHistLoading] = useState(false)

  async function cargar() {
    setLoading(true)
    const { data } = await supabase.from('pagos_empleados').select('*').order('fecha', { ascending: false })
    setItems(data ?? [])
    setLoading(false)
  }

  async function cargarEmpleados() {
    const { data } = await supabase.from('empleados').select('*').order('nombre')
    setEmpleados(data ?? [])
  }

  useEffect(() => {
    cargar()
    cargarEmpleados()
  }, [])

  // Carga los SERVICIOS realizados por el empleado (facturas pagadas) en el rango.
  // Solo servicios pagan comisión; los productos quedan fuera.
  useEffect(() => {
    if (!open || !form.empleado_id) {
      setComItems([])
      setComPagadas([])
      return
    }
    let cancel = false
    ;(async () => {
      setComLoading(true)
      const [items, pagadas] = await Promise.all([
        supabase
          .from('factura_items')
          .select('descripcion,cantidad,importe,servicio_id, servicios(comision_pct), facturas!inner(numero,tipo_venta,serie,fecha,estado)')
          .eq('empleado_id', form.empleado_id)
          .is('articulo_id', null)
          .eq('facturas.estado', 'PAGADA')
          .gte('facturas.fecha', comDesde)
          .lte('facturas.fecha', comHasta)
          .order('fecha', { foreignTable: 'facturas', ascending: true }),
        supabase
          .from('pagos_empleados')
          .select('*')
          .eq('empleado_id', form.empleado_id)
          .eq('tipo', 'COMISION')
          .not('comision_desde', 'is', null),
      ])
      if (!cancel) {
        setComItems(items.data ?? [])
        setComPagadas((pagadas.data ?? []) as PagoEmpleado[])
        setComLoading(false)
      }
    })()
    return () => {
      cancel = true
    }
  }, [open, form.empleado_id, comDesde, comHasta])

  // Historial de servicios realizados (ventana independiente)
  useEffect(() => {
    if (!histOpen || !histEmpleado) { setHistItems([]); return }
    let cancel = false
    ;(async () => {
      setHistLoading(true)
      const { data } = await supabase
        .from('factura_items')
        .select('descripcion,cantidad,importe,servicio_id, servicios(comision_pct), facturas!inner(numero,tipo_venta,serie,fecha,estado)')
        .eq('empleado_id', histEmpleado)
        .is('articulo_id', null)
        .eq('facturas.estado', 'PAGADA')
        .gte('facturas.fecha', histDesde)
        .lte('facturas.fecha', histHasta)
        .order('fecha', { foreignTable: 'facturas', ascending: true })
      if (!cancel) { setHistItems(data ?? []); setHistLoading(false) }
    })()
    return () => { cancel = true }
  }, [histOpen, histEmpleado, histDesde, histHasta])

  const empSel = empleados.find((e) => e.id === form.empleado_id)
  const empPct = Number(empSel?.comision_pct ?? 0)
  // % por línea: el del servicio si lo tiene, si no el del empleado
  const lineaPct = (it: any) => pctComisionServicio(it.servicios?.comision_pct, empPct)
  const comTotal = comItems.reduce((s, it) => s + Number(it.importe), 0)
  const comMonto = comItems.reduce((s, it) => s + comisionLinea(it.importe, lineaPct(it)), 0)
  // Pagos de comisión cuyo periodo se solapa con el rango elegido (sin contar el que se está editando)
  const comSolapadas = comPagadas.filter((p) => p.id !== editId && rangosSeSolapan(comDesde, comHasta, p.comision_desde, p.comision_hasta))

  // Derivados del historial de servicios
  const histEmp = empleados.find((e) => e.id === histEmpleado)
  const histPct = Number(histEmp?.comision_pct ?? 0)
  const histLineaPct = (it: any) => pctComisionServicio(it.servicios?.comision_pct, histPct)
  const histVendido = histItems.reduce((s, it) => s + Number(it.importe), 0)
  const histComision = histItems.reduce((s, it) => s + comisionLinea(it.importe, histLineaPct(it)), 0)
  function histFilas() {
    return histItems.map((it) => [
      fechaCorta(it.facturas?.fecha),
      it.facturas ? codigoFactura(it.facturas) : '',
      `${it.descripcion}${it.cantidad > 1 ? ` ×${it.cantidad}` : ''}`,
      money(it.importe),
      `${histLineaPct(it)}%`,
      money(comisionLinea(it.importe, histLineaPct(it))),
    ])
  }
  function imprimirHist() {
    imprimirTabla({
      negocio,
      titulo: 'Servicios realizados',
      subtitulo: `${histEmp?.nombre ?? ''} · ${fechaCorta(histDesde)} a ${fechaCorta(histHasta)} · % empleado: ${histPct}%`,
      columnas: [
        { label: 'Fecha' }, { label: 'Factura' }, { label: 'Servicio' },
        { label: 'Importe', align: 'right' }, { label: '%', align: 'right' }, { label: 'Comisión', align: 'right' },
      ],
      filas: histFilas(),
      pie: [`${histItems.length} servicio(s)`, '', '', money(histVendido), '', money(histComision)],
    })
  }
  function exportarHist() {
    descargarCSV(`servicios_${(histEmp?.nombre ?? 'empleado').replace(/\s+/g, '_')}_${histDesde}_a_${histHasta}`,
      ['Fecha', 'Factura', 'Servicio', 'Importe', '%', 'Comisión'], histFilas())
  }

  const totalMes = items
    .filter((p) => p.fecha.slice(0, 7) === hoyISO().slice(0, 7))
    .reduce((s, p) => s + Number(p.monto), 0)

  const pag = usePaginacion(items, 10)

  function abrirNuevo() {
    setEditId(null)
    setForm(vacio)
    setOpen(true)
  }

  function abrirEditar(p: PagoEmpleado) {
    setEditId(p.id)
    setForm({
      empleado_id: p.empleado_id ?? '',
      fecha: p.fecha,
      periodo: p.periodo ?? '',
      tipo: p.tipo,
      monto: Number(p.monto),
      metodo_pago: p.metodo_pago ?? 'Efectivo',
      notas: p.notas ?? '',
    })
    // Si es comisión con periodo guardado, recupéralo para no sobrescribirlo al guardar
    if (p.comision_desde) setComDesde(p.comision_desde)
    if (p.comision_hasta) setComHasta(p.comision_hasta)
    setOpen(true)
  }

  async function guardar(imprimir = false) {
    if (!form.empleado_id) return alert('Selecciona un empleado')
    if (form.monto <= 0) return alert('El monto debe ser mayor que 0')
    setSaving(true)
    const emp = empleados.find((e) => e.id === form.empleado_id)
    const payload = {
      empleado_id: form.empleado_id,
      empleado_nombre: emp?.nombre ?? null,
      // Sin permiso de administración un pago nuevo siempre lleva la fecha de hoy.
      fecha: !puedeCambiarFecha && !editId ? hoyISO() : form.fecha,
      periodo: form.periodo || null,
      tipo: form.tipo,
      monto: form.monto,
      metodo_pago: form.metodo_pago,
      notas: form.notas || null,
      // Para comisiones guardamos el periodo cubierto (control de "ya pagado")
      comision_desde: form.tipo === 'COMISION' ? comDesde : null,
      comision_hasta: form.tipo === 'COMISION' ? comHasta : null,
    }
    const { error } = editId
      ? await supabase.from('pagos_empleados').update(payload).eq('id', editId)
      : await supabase.from('pagos_empleados').insert(payload)
    setSaving(false)
    if (error) return alert('Error al guardar: ' + error.message)
    if (imprimir) {
      setRecibo({ empleado: emp?.nombre ?? 'Empleado', tipo: form.tipo, periodo: form.periodo, monto: form.monto, metodo: form.metodo_pago, fecha: form.fecha, hora: new Date().toISOString() })
      setTimeout(() => window.print(), 400)
    }
    setOpen(false)
    cargar()
  }

  async function eliminar(p: PagoEmpleado) {
    if (!confirm('¿Eliminar este pago?')) return
    const { error } = await supabase.from('pagos_empleados').delete().eq('id', p.id)
    if (error) return alert('Error al eliminar: ' + error.message)
    cargar()
  }

  return (
    <div>
      <PageHeader
        title="Pagos a empleados"
        subtitle={`Pagado este mes: ${money(totalMes)}`}
        action={
          <div className="flex flex-wrap gap-2">
            <button className="btn-ghost" onClick={() => setHistOpen(true)}>
              <ClipboardList size={16} /> Servicios realizados
            </button>
            <button className="btn-primary" onClick={abrirNuevo}>
              <Plus size={16} /> Nuevo pago
            </button>
          </div>
        }
      />

      {loading ? (
        <Cargando />
      ) : items.length === 0 ? (
        <div className="card flex flex-col items-center gap-3 py-12 text-center">
          <Users className="text-brand-300" size={40} />
          <p className="text-slate-500">Aún no hay pagos registrados.</p>
        </div>
      ) : (
        <div className="overflow-x-auto panel-3d">
          <table className="min-w-full divide-y divide-slate-100 text-sm">
            <thead className="thead-3d">
              <tr>
                <th className="px-5 py-3">No.</th>
                <th className="px-5 py-3">Fecha</th>
                <th className="px-5 py-3">Empleado</th>
                <th className="px-5 py-3">Tipo</th>
                <th className="px-5 py-3">Periodo</th>
                <th className="px-5 py-3 text-right">Monto</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {pag.visibles.map((p) => (
                <tr key={p.id}>
                  <td className="px-5 py-3"><span className="font-mono font-semibold text-brand-700">{conPrefijo(negocio.prefijo_pago, p.numero)}</span></td>
                  <td className="px-5 py-3 text-slate-600">{fechaCorta(p.fecha)}</td>
                  <td className="px-5 py-3 font-medium text-slate-800">{p.empleado_nombre || '—'}</td>
                  <td className="px-5 py-3"><span className={`badge ${tipoBadge[p.tipo]}`}>{p.tipo}</span></td>
                  <td className="px-5 py-3 text-slate-600">{p.periodo || '—'}</td>
                  <td className="px-5 py-3 text-right font-semibold text-slate-800">{money(p.monto)}</td>
                  <td className="px-5 py-3">
                    <div className="flex justify-end gap-1">
                      <button onClick={() => abrirEditar(p)} className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 hover:text-brand-600"><Pencil size={16} /></button>
                      <button onClick={() => eliminar(p)} className="rounded-lg p-2 text-slate-600 hover:bg-rose-50 hover:text-rose-600"><Trash2 size={16} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <Paginacion pagina={pag.pagina} totalPaginas={pag.totalPaginas} total={pag.total} desde={pag.desde} pageSize={pag.pageSize} onPagina={pag.setPagina} />
        </div>
      )}

      <Modal
        open={open}
        title={editId ? 'Editar pago' : 'Nuevo pago a empleado'}
        onClose={() => setOpen(false)}
        footer={
          <>
            <button className="btn-ghost" onClick={() => setOpen(false)}>Cancelar</button>
            <button className="btn-ghost" onClick={() => guardar(false)} disabled={saving}>{saving ? 'Guardando…' : 'Guardar'}</button>
            <button className="btn-primary" onClick={() => guardar(true)} disabled={saving}><Printer size={16} /> Guardar e imprimir</button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="label">Empleado</label>
            <select className="input" value={form.empleado_id} onChange={(e) => setForm({ ...form, empleado_id: e.target.value })}>
              <option value="">— Selecciona —</option>
              {empleados.map((e) => <option key={e.id} value={e.id}>{e.nombre} ({e.puesto})</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Tipo</label>
              <select className="input" value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value as TipoPagoEmpleado })}>
                {tipos.map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Monto (RD$)</label>
              <input type="number" min={0} step={50} className="input" value={form.monto || ''} onChange={(e) => setForm({ ...form, monto: Number(e.target.value) })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Fecha</label>
              <input
                type="date"
                className={`input ${!puedeCambiarFecha ? 'cursor-not-allowed bg-slate-100 text-slate-500' : ''}`}
                value={form.fecha}
                onChange={(e) => setForm({ ...form, fecha: e.target.value })}
                disabled={!puedeCambiarFecha}
                title={!puedeCambiarFecha ? 'La fecha es la de hoy. Solo administración puede cambiarla.' : undefined}
              />
              {!puedeCambiarFecha && <p className="mt-1 text-xs text-slate-500">Fecha de hoy. Solo administración puede cambiarla.</p>}
            </div>
            <div>
              <label className="label">Periodo</label>
              <input className="input" value={form.periodo} onChange={(e) => setForm({ ...form, periodo: e.target.value })} placeholder="Ej: 1ra quincena junio" />
            </div>
          </div>
          {form.empleado_id && (
            <div className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-3">
              <div className="mb-2 flex items-center justify-between">
                <label className="label !mb-0">Servicios realizados (para comisión)</label>
                <span className="text-xs text-slate-500">% empleado: {empPct}%</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-xs text-slate-600">Desde</span>
                  <input type="date" className="input" value={comDesde} onChange={(e) => setComDesde(e.target.value)} />
                </div>
                <div>
                  <span className="text-xs text-slate-600">Hasta</span>
                  <input type="date" className="input" value={comHasta} onChange={(e) => setComHasta(e.target.value)} />
                </div>
              </div>

              {comSolapadas.length > 0 && (
                <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  ⚠️ Ya registraste comisión a este empleado que cubre parte de este periodo:
                  {comSolapadas.map((p) => (
                    <span key={p.id} className="ml-1 font-semibold">
                      {fechaCorta(p.comision_desde!)}–{fechaCorta(p.comision_hasta!)} ({money(p.monto)})
                    </span>
                  ))}
                  . Revisa para no pagar dos veces.
                </div>
              )}

              {comLoading ? (
                <p className="mt-2 text-sm text-slate-500">Calculando…</p>
              ) : comItems.length === 0 ? (
                <p className="mt-2 text-sm text-slate-500">No realizó servicios pagados en este rango.</p>
              ) : (
                <>
                  <div className="mt-2 max-h-40 overflow-y-auto rounded-lg bg-white/70">
                    <table className="w-full text-xs">
                      <tbody className="divide-y divide-slate-100">
                        {comItems.map((it, idx) => (
                          <tr key={idx}>
                            <td className="px-2 py-1 text-slate-600">{fechaCorta(it.facturas?.fecha)} · {it.facturas ? codigoFactura(it.facturas) : ''}</td>
                            <td className="px-2 py-1 text-slate-700">{it.descripcion}{it.cantidad > 1 ? ` ×${it.cantidad}` : ''}</td>
                            <td className="px-2 py-1 text-right text-slate-500">{lineaPct(it)}%</td>
                            <td className="px-2 py-1 text-right font-medium text-slate-700">{money(it.importe)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="mt-2 space-y-0.5 text-sm">
                    <div className="flex justify-between text-slate-600"><span>{comItems.length} servicio(s) · ventas</span><span>{money(comTotal)}</span></div>
                    <div className="flex justify-between font-semibold text-emerald-700"><span>Comisión a pagar</span><span>{money(comMonto)}</span></div>
                  </div>
                  <button
                    className="btn-ghost mt-2 w-full"
                    onClick={() => setForm((f) => ({ ...f, tipo: 'COMISION', monto: comMonto, periodo: f.periodo || `${comDesde} a ${comHasta}` }))}
                  >
                    Usar comisión como monto ({money(comMonto)})
                  </button>
                  <p className="mt-1 text-xs text-slate-600">Para un incentivo/bono extra, cambia el tipo a BONO y ajusta el monto.</p>
                </>
              )}
            </div>
          )}

          <div>
            <label className="label">Método de pago</label>
            <select className="input" value={form.metodo_pago} onChange={(e) => setForm({ ...form, metodo_pago: e.target.value })}>
              {METODOS_PAGO.map((m) => <option key={m}>{m}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Notas</label>
            <textarea className="input" rows={2} value={form.notas} onChange={(e) => setForm({ ...form, notas: e.target.value })} />
          </div>
        </div>
      </Modal>

      {/* HISTORIAL DE SERVICIOS REALIZADOS POR EMPLEADO */}
      <Modal open={histOpen} title="Servicios realizados por empleado" onClose={() => setHistOpen(false)}>
        <div className="space-y-4">
          <div>
            <label className="label">Empleado</label>
            <select className="input" value={histEmpleado} onChange={(e) => setHistEmpleado(e.target.value)}>
              <option value="">— Selecciona —</option>
              {empleados.map((e) => <option key={e.id} value={e.id}>{e.nombre} ({e.puesto})</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Desde</label>
              <input type="date" className="input" value={histDesde} onChange={(e) => setHistDesde(e.target.value)} />
            </div>
            <div>
              <label className="label">Hasta</label>
              <input type="date" className="input" value={histHasta} onChange={(e) => setHistHasta(e.target.value)} />
            </div>
          </div>

          {!histEmpleado ? (
            <p className="py-6 text-center text-slate-500">Selecciona un empleado para ver sus servicios.</p>
          ) : histLoading ? (
            <p className="py-6 text-center text-slate-500">Cargando…</p>
          ) : histItems.length === 0 ? (
            <p className="py-6 text-center text-slate-500">No realizó servicios pagados en este rango.</p>
          ) : (
            <>
              <p className="text-xs text-slate-600">% comisión del empleado: <b>{histPct}%</b> (cada renglón usa el % del servicio si lo tiene)</p>
              <div className="max-h-72 overflow-x-auto overflow-y-auto panel-3d">
                <table className="min-w-full text-sm">
                  <thead className="thead-3d">
                    <tr>
                      <th className="px-3 py-2 text-left">Fecha</th>
                      <th className="px-3 py-2 text-left">Factura</th>
                      <th className="px-3 py-2 text-left">Servicio</th>
                      <th className="px-3 py-2 text-right">Importe</th>
                      <th className="px-3 py-2 text-right">%</th>
                      <th className="px-3 py-2 text-right">Comisión</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {histItems.map((it, idx) => (
                      <tr key={idx}>
                        <td className="px-3 py-2 text-slate-600">{fechaCorta(it.facturas?.fecha)}</td>
                        <td className="px-3 py-2 font-mono text-xs text-slate-600">{it.facturas ? codigoFactura(it.facturas) : ''}</td>
                        <td className="px-3 py-2 text-slate-700">{it.descripcion}{it.cantidad > 1 ? ` ×${it.cantidad}` : ''}</td>
                        <td className="px-3 py-2 text-right text-slate-700">{money(it.importe)}</td>
                        <td className="px-3 py-2 text-right text-slate-500">{histLineaPct(it)}%</td>
                        <td className="px-3 py-2 text-right font-medium text-emerald-700">{money(comisionLinea(it.importe, histLineaPct(it)))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="grid gap-2 rounded-xl bg-emerald-50/60 p-3 text-sm sm:grid-cols-2">
                <div className="flex justify-between"><span className="text-slate-600">{histItems.length} servicio(s) · vendido</span><span className="font-semibold text-slate-800">{money(histVendido)}</span></div>
                <div className="flex justify-between"><span className="text-slate-600">Comisión total</span><span className="font-bold text-emerald-700">{money(histComision)}</span></div>
              </div>
              <div className="flex flex-wrap gap-2">
                <button className="btn-ghost" onClick={exportarHist}><Download size={16} /> Exportar (CSV)</button>
                <button className="btn-primary" onClick={imprimirHist}><Printer size={16} /> Imprimir / PDF</button>
              </div>
            </>
          )}
        </div>
      </Modal>

      {/* RECIBO DE PAGO A EMPLEADO (imprimible) */}
      <Modal open={!!recibo} title="Recibo de pago" onClose={() => setRecibo(null)}>
        {recibo && (
          <div className="space-y-3">
            <div id="recibo-pago" className="print-area space-y-2 rounded-xl border border-slate-100 p-3 text-sm">
              <div className="text-center">
                <img src={`${import.meta.env.BASE_URL}${negocio.logo}`} alt={negocio.nombre} className="mx-auto mb-1 h-14 rounded-lg bg-black object-contain" />
                <p className="font-display text-base font-bold text-brand-800">{negocio.nombre}</p>
                {negocio.rnc && <p className="text-xs text-slate-500">RNC: {negocio.rnc}</p>}
                <p className="mt-1 text-xs font-semibold text-slate-600">RECIBO DE PAGO</p>
                <p className="text-xs text-slate-600">{fechaHora(recibo.hora)}</p>
              </div>
              <p className="text-slate-600"><span className="font-medium">Empleado:</span> {recibo.empleado}</p>
              <p className="text-slate-600"><span className="font-medium">Concepto:</span> {recibo.tipo}{recibo.periodo ? ` · ${recibo.periodo}` : ''}</p>
              <div className="space-y-0.5 border-t pt-1">
                <div className="flex justify-between text-base font-bold text-slate-800"><span>Monto pagado</span><span>{money(recibo.monto)}</span></div>
                <div className="flex justify-between text-slate-600"><span>Método</span><span>{recibo.metodo}</span></div>
                <div className="flex justify-between text-slate-600"><span>Fecha</span><span>{fechaCorta(recibo.fecha)}</span></div>
              </div>
              <div className="mt-6 grid grid-cols-2 gap-4 text-center text-xs text-slate-500">
                <div className="border-t border-slate-300 pt-1">Firma empleado</div>
                <div className="border-t border-slate-300 pt-1">Firma autoriza</div>
              </div>
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
