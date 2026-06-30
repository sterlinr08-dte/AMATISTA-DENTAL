import { useEffect, useMemo, useState } from 'react'
import { Boxes, ClipboardList, Receipt, ShoppingCart, Wallet, HandCoins, FileSpreadsheet, Printer } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { Articulo, Compra, Factura, Empleado, PagoEmpleado } from '../types'
import { money, fechaCorta, fechaHora, hoyISO, codigoArticulo, codigoFactura } from '../lib/format'
import { useNegocio } from '../lib/negocio'
import { useAuth } from '../lib/auth'
import { descargarCSV, imprimirTabla } from '../lib/reportes'
import { pctComisionServicio, comisionLinea, rangosSeSolapan } from '../lib/comisiones'
import PageHeader from '../components/PageHeader'
import Cargando from '../components/Cargando'
import Modal from '../components/Modal'

type Tab = 'inventario' | 'fisico' | 'ventas' | 'compras' | 'cuadres' | 'comisiones'

const tabs: { key: Tab; label: string; icon: typeof Boxes; rango: boolean }[] = [
  { key: 'inventario', label: 'Inventario', icon: Boxes, rango: false },
  { key: 'fisico', label: 'Inventario físico', icon: ClipboardList, rango: false },
  { key: 'ventas', label: 'Ventas', icon: Receipt, rango: true },
  { key: 'compras', label: 'Compras', icon: ShoppingCart, rango: true },
  { key: 'cuadres', label: 'Cuadres de caja', icon: Wallet, rango: true },
  { key: 'comisiones', label: 'Comisiones', icon: HandCoins, rango: true },
]

// Fila agregada de comisión por empleado
interface ComFila {
  empleado: string
  servicios: number
  ventas: number
  comision: number
  pagado: number
  porPagar: number
}

export default function Reportes() {
  const { negocio } = useNegocio()
  const { puedeAccion, perfil } = useAuth()
  const puedeAjustar = puedeAccion('caja.ajustar_cuadre')
  const [tab, setTab] = useState<Tab>('inventario')
  // Ajuste de un cuadre cerrado (administración/gerente)
  const [ajuste, setAjuste] = useState<any | null>(null)
  const [ajContado, setAjContado] = useState(0)
  const [ajNota, setAjNota] = useState('')
  const [savingAj, setSavingAj] = useState(false)
  const [desde, setDesde] = useState(hoyISO().slice(0, 8) + '01')
  const [hasta, setHasta] = useState(hoyISO())
  const [loading, setLoading] = useState(false)

  const [articulos, setArticulos] = useState<Articulo[]>([])
  const [facturas, setFacturas] = useState<Factura[]>([])
  const [compras, setCompras] = useState<Compra[]>([])
  const [cuadres, setCuadres] = useState<any[]>([])
  const [comisiones, setComisiones] = useState<ComFila[]>([])

  useEffect(() => {
    let cancel = false
    ;(async () => {
      setLoading(true)
      if (tab === 'inventario' || tab === 'fisico') {
        const { data } = await supabase.from('articulos').select('*').order('codigo')
        if (!cancel) setArticulos(data ?? [])
      } else if (tab === 'ventas') {
        const { data } = await supabase.from('facturas').select('*').gte('fecha', desde).lte('fecha', hasta).order('numero')
        if (!cancel) setFacturas(data ?? [])
      } else if (tab === 'compras') {
        const { data } = await supabase.from('compras').select('*').gte('fecha', desde).lte('fecha', hasta).order('numero')
        if (!cancel) setCompras(data ?? [])
      } else if (tab === 'cuadres') {
        const { data } = await supabase.from('caja_sesiones').select('*').eq('estado', 'CERRADA').order('cerrada_at', { ascending: false })
        const enRango = (data ?? []).filter((s: any) => {
          const d = (s.cerrada_at ?? '').slice(0, 10)
          return d >= desde && d <= hasta
        })
        if (!cancel) setCuadres(enRango)
      } else if (tab === 'comisiones') {
        // Solo servicios pagados, con su % propio o el del empleado; más las comisiones ya pagadas.
        const [emp, items, pagos] = await Promise.all([
          supabase.from('empleados').select('id,nombre,comision_pct').order('nombre'),
          supabase
            .from('factura_items')
            .select('importe,empleado_id, servicios(comision_pct), facturas!inner(fecha,estado)')
            .not('empleado_id', 'is', null)
            .is('articulo_id', null)
            .eq('facturas.estado', 'PAGADA')
            .gte('facturas.fecha', desde)
            .lte('facturas.fecha', hasta),
          supabase
            .from('pagos_empleados')
            .select('empleado_id,monto,comision_desde,comision_hasta')
            .eq('tipo', 'COMISION')
            .not('comision_desde', 'is', null),
        ])
        const empleadosL = (emp.data ?? []) as Pick<Empleado, 'id' | 'nombre' | 'comision_pct'>[]
        const acc = new Map<string, ComFila & { id: string }>()
        for (const e of empleadosL) acc.set(e.id, { id: e.id, empleado: e.nombre, servicios: 0, ventas: 0, comision: 0, pagado: 0, porPagar: 0 })
        for (const it of (items.data ?? []) as any[]) {
          const e = empleadosL.find((x) => x.id === it.empleado_id)
          const row = acc.get(it.empleado_id)
          if (!e || !row) continue
          const pct = pctComisionServicio(it.servicios?.comision_pct, e.comision_pct)
          row.servicios += 1
          row.ventas += Number(it.importe)
          row.comision += comisionLinea(it.importe, pct)
        }
        for (const p of (pagos.data ?? []) as Pick<PagoEmpleado, 'empleado_id' | 'monto' | 'comision_desde' | 'comision_hasta'>[]) {
          if (!p.empleado_id) continue
          const row = acc.get(p.empleado_id)
          if (row && rangosSeSolapan(desde, hasta, p.comision_desde, p.comision_hasta)) row.pagado += Number(p.monto)
        }
        const filas = [...acc.values()]
          .map((r) => ({ ...r, porPagar: r.comision - r.pagado }))
          .filter((r) => r.servicios > 0 || r.pagado > 0)
          .sort((a, b) => b.comision - a.comision)
        if (!cancel) setComisiones(filas)
      }
      if (!cancel) setLoading(false)
    })()
    return () => {
      cancel = true
    }
  }, [tab, desde, hasta])

  function abrirAjuste(s: any) {
    setAjuste(s)
    setAjContado(Number(s.monto_contado ?? 0))
    setAjNota('')
  }

  async function guardarAjuste() {
    if (!ajuste) return
    setSavingAj(true)
    const esperado = Number(ajuste.monto_contado ?? 0) - Number(ajuste.diferencia ?? 0)
    const nuevaDif = ajContado - esperado
    const quien = perfil?.nombre || perfil?.username || 'administración'
    const fechaTxt = new Date().toLocaleDateString('es-DO')
    const nota = `${ajuste.notas ? ajuste.notas + ' · ' : ''}Ajuste ${fechaTxt} por ${quien}: ${ajNota || 'corrección de cuadre'}`
    const { error } = await supabase.from('caja_sesiones').update({ monto_contado: ajContado, diferencia: nuevaDif, notas: nota }).eq('id', ajuste.id)
    setSavingAj(false)
    if (error) return alert('Error al ajustar: ' + error.message)
    setAjuste(null)
    const { data } = await supabase.from('caja_sesiones').select('*').eq('estado', 'CERRADA').order('cerrada_at', { ascending: false })
    const enRango = (data ?? []).filter((s: any) => {
      const d = (s.cerrada_at ?? '').slice(0, 10)
      return d >= desde && d <= hasta
    })
    setCuadres(enRango)
  }

  const periodo = `Del ${fechaCorta(desde)} al ${fechaCorta(hasta)}`

  // Construye la definición de cada reporte (mismas columnas/filas para pantalla, Excel y PDF)
  const rep = useMemo(() => {
    if (tab === 'inventario') {
      const filas = articulos.map((a) => {
        const valor = Number(a.stock) * Number(a.costo)
        return {
          ver: [`${codigoArticulo(a.codigo)}`, a.nombre, a.categoria, a.stock, money(a.costo), money(a.precio), money(valor)],
          csv: [codigoArticulo(a.codigo), a.nombre, a.categoria, Number(a.stock), Number(a.costo), Number(a.precio), valor],
        }
      })
      const totalValor = articulos.reduce((s, a) => s + Number(a.stock) * Number(a.costo), 0)
      const totalUnidades = articulos.reduce((s, a) => s + Number(a.stock), 0)
      return {
        titulo: 'Reporte de inventario (valorizado)',
        subtitulo: `${articulos.length} artículo(s) · ${totalUnidades} unidades · Valor: ${money(totalValor)}`,
        columnas: [
          { label: 'Código' }, { label: 'Artículo' }, { label: 'Categoría' },
          { label: 'Existencia', align: 'right' as const }, { label: 'Costo', align: 'right' as const },
          { label: 'Precio', align: 'right' as const }, { label: 'Valor', align: 'right' as const },
        ],
        filas,
        pie: ['', '', 'TOTALES', totalUnidades, '', '', money(totalValor)] as (string | number)[],
        pieCsv: ['', '', 'TOTALES', totalUnidades, '', '', totalValor] as (string | number)[],
        orientacion: 'portrait' as const,
      }
    }
    if (tab === 'fisico') {
      const filas = articulos.map((a) => ({
        ver: [`${codigoArticulo(a.codigo)}`, a.nombre, a.categoria, a.stock, '', ''],
        csv: [codigoArticulo(a.codigo), a.nombre, a.categoria, Number(a.stock), '', ''],
      }))
      return {
        titulo: 'Hoja de inventario físico (conteo)',
        subtitulo: `${articulos.length} artículo(s) · Anota el conteo físico y la diferencia se calcula al final`,
        columnas: [
          { label: 'Código' }, { label: 'Artículo' }, { label: 'Categoría' },
          { label: 'Existencia sistema', align: 'right' as const },
          { label: 'Conteo físico', align: 'center' as const },
          { label: 'Diferencia', align: 'center' as const },
        ],
        filas,
        pie: undefined,
        pieCsv: undefined,
        orientacion: 'portrait' as const,
      }
    }
    if (tab === 'ventas') {
      const filas = facturas.map((f) => ({
        ver: [codigoFactura(f), fechaCorta(f.fecha), f.cliente_nombre || 'Cliente', f.tipo_venta === 'CREDITO' ? 'Crédito' : 'Contado', f.estado, money(f.total)],
        csv: [codigoFactura(f), f.fecha, f.cliente_nombre || 'Cliente', f.tipo_venta === 'CREDITO' ? 'Crédito' : 'Contado', f.estado, Number(f.total)],
      }))
      const total = facturas.reduce((s, f) => s + Number(f.total), 0)
      const pagadas = facturas.filter((f) => f.estado === 'PAGADA').reduce((s, f) => s + Number(f.total), 0)
      const pendientes = facturas.filter((f) => f.estado === 'PENDIENTE').reduce((s, f) => s + Number(f.total), 0)
      return {
        titulo: 'Reporte de ventas',
        subtitulo: `${periodo} · ${facturas.length} factura(s) · Pagado: ${money(pagadas)} · Pendiente: ${money(pendientes)}`,
        columnas: [
          { label: 'Factura' }, { label: 'Fecha' }, { label: 'Cliente' },
          { label: 'Tipo' }, { label: 'Estado' }, { label: 'Total', align: 'right' as const },
        ],
        filas,
        pie: ['', '', '', '', 'TOTAL', money(total)] as (string | number)[],
        pieCsv: ['', '', '', '', 'TOTAL', total] as (string | number)[],
        orientacion: 'portrait' as const,
      }
    }
    if (tab === 'compras') {
      const filas = compras.map((c) => ({
        ver: [`${c.numero}`, fechaCorta(c.fecha), c.proveedor || '—', c.categoria, c.tipo_pago === 'CREDITO' ? 'Crédito' : 'Contado', money(c.total)],
        csv: [c.numero, c.fecha, c.proveedor || '', c.categoria, c.tipo_pago === 'CREDITO' ? 'Crédito' : 'Contado', Number(c.total)],
      }))
      const total = compras.reduce((s, c) => s + Number(c.total), 0)
      return {
        titulo: 'Reporte de compras',
        subtitulo: `${periodo} · ${compras.length} compra(s) · Total: ${money(total)}`,
        columnas: [
          { label: 'No.' }, { label: 'Fecha' }, { label: 'Proveedor' },
          { label: 'Categoría' }, { label: 'Pago' }, { label: 'Total', align: 'right' as const },
        ],
        filas,
        pie: ['', '', '', '', 'TOTAL', money(total)] as (string | number)[],
        pieCsv: ['', '', '', '', 'TOTAL', total] as (string | number)[],
        orientacion: 'portrait' as const,
      }
    }
    if (tab === 'comisiones') {
      const filas = comisiones.map((c) => ({
        ver: [c.empleado, c.servicios, money(c.ventas), money(c.comision), money(c.pagado), money(c.porPagar)],
        csv: [c.empleado, c.servicios, Number(c.ventas), Number(c.comision), Number(c.pagado), Number(c.porPagar)],
      }))
      const tServicios = comisiones.reduce((s, c) => s + c.servicios, 0)
      const tVentas = comisiones.reduce((s, c) => s + c.ventas, 0)
      const tComision = comisiones.reduce((s, c) => s + c.comision, 0)
      const tPagado = comisiones.reduce((s, c) => s + c.pagado, 0)
      const tPorPagar = comisiones.reduce((s, c) => s + c.porPagar, 0)
      return {
        titulo: 'Reporte de comisiones por empleado',
        subtitulo: `${periodo} · ${comisiones.length} empleado(s) · Comisión generada: ${money(tComision)} · Por pagar: ${money(tPorPagar)}`,
        columnas: [
          { label: 'Empleado' },
          { label: 'Servicios', align: 'right' as const },
          { label: 'Ventas (servicios)', align: 'right' as const },
          { label: 'Comisión generada', align: 'right' as const },
          { label: 'Pagado', align: 'right' as const },
          { label: 'Por pagar', align: 'right' as const },
        ],
        filas,
        pie: ['TOTALES', tServicios, money(tVentas), money(tComision), money(tPagado), money(tPorPagar)] as (string | number)[],
        pieCsv: ['TOTALES', tServicios, tVentas, tComision, tPagado, tPorPagar] as (string | number)[],
        orientacion: 'portrait' as const,
      }
    }
    // cuadres
    const filas = cuadres.map((s) => {
      const esperado = s.monto_contado != null && s.diferencia != null ? Number(s.monto_contado) - Number(s.diferencia) : null
      const dif = Number(s.diferencia ?? 0)
      const estado = dif === 0 ? 'Cuadrada' : dif > 0 ? 'Sobrante' : 'Faltante'
      return {
        ver: [`${s.numero}`, fechaHora(s.cerrada_at), s.cerrada_por || '—', money(s.monto_inicial), esperado != null ? money(esperado) : '—', money(s.monto_contado), `${estado} ${dif !== 0 ? money(Math.abs(dif)) : ''}`, s.notas || ''],
        csv: [s.numero, fechaHora(s.cerrada_at), s.cerrada_por || '', Number(s.monto_inicial), esperado ?? '', Number(s.monto_contado ?? 0), dif, s.notas || ''],
      }
    })
    const totalDif = cuadres.reduce((s, x) => s + Number(x.diferencia ?? 0), 0)
    return {
      titulo: 'Reporte de cuadres de caja',
      subtitulo: `${periodo} · ${cuadres.length} cierre(s) · Diferencia acumulada: ${money(totalDif)}`,
      columnas: [
        { label: 'No.' }, { label: 'Cerrada' }, { label: 'Cerró' },
        { label: 'Inicial', align: 'right' as const }, { label: 'Esperado', align: 'right' as const },
        { label: 'Contado', align: 'right' as const }, { label: 'Resultado', align: 'right' as const },
        { label: 'Notas / Ajustes' },
      ],
      filas,
      pie: undefined,
      pieCsv: undefined,
      orientacion: 'landscape' as const,
    }
  }, [tab, articulos, facturas, compras, cuadres, comisiones, periodo])

  function exportarExcel() {
    const enc = rep.columnas.map((c) => c.label)
    const filasCsv = rep.filas.map((f) => f.csv)
    if (rep.pieCsv) filasCsv.push(rep.pieCsv)
    descargarCSV(rep.titulo, enc, filasCsv)
  }

  function exportarPDF() {
    imprimirTabla({
      negocio,
      titulo: rep.titulo,
      subtitulo: rep.subtitulo,
      columnas: rep.columnas,
      filas: rep.filas.map((f) => f.ver),
      pie: rep.pie,
      orientacion: rep.orientacion,
    })
  }

  const tabActual = tabs.find((t) => t.key === tab)!

  return (
    <div>
      <PageHeader title="Reportes" subtitle="Inventario, ventas, compras, cuadres y comisiones" />

      <div className="mb-4 flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)} className={tab === t.key ? 'btn-primary' : 'btn-ghost'}>
            <t.icon size={16} /> {t.label}
          </button>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap items-end gap-3">
        {tabActual.rango && (
          <>
            <div>
              <label className="label">Desde</label>
              <input type="date" className="input" value={desde} onChange={(e) => setDesde(e.target.value)} />
            </div>
            <div>
              <label className="label">Hasta</label>
              <input type="date" className="input" value={hasta} onChange={(e) => setHasta(e.target.value)} />
            </div>
          </>
        )}
        <div className="ml-auto flex gap-2">
          <button className="btn-ghost" onClick={exportarExcel}><FileSpreadsheet size={16} /> Excel</button>
          <button className="btn-primary" onClick={exportarPDF}><Printer size={16} /> Imprimir / PDF</button>
        </div>
      </div>

      <div className="card">
        <h2 className="font-display text-lg font-bold text-slate-800">{rep.titulo}</h2>
        <p className="mb-3 text-sm text-slate-600">{rep.subtitulo}</p>
        {loading ? (
          <Cargando />
        ) : rep.filas.length === 0 ? (
          <p className="py-8 text-center text-slate-600">Sin datos para este reporte.</p>
        ) : (
          <div className="max-h-[60vh] overflow-auto rounded-xl border border-slate-100">
            <table className="min-w-full divide-y divide-slate-100 text-sm">
              <thead className="sticky top-0 bg-slate-50 text-left text-xs uppercase text-slate-500">
                <tr>
                  {rep.columnas.map((c, i) => (
                    <th key={i} className={`px-4 py-2 ${c.align === 'right' ? 'text-right' : c.align === 'center' ? 'text-center' : ''}`}>{c.label}</th>
                  ))}
                  {tab === 'cuadres' && puedeAjustar && <th className="px-4 py-2 text-right">Ajustar</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {rep.filas.map((f, ri) => (
                  <tr key={ri}>
                    {f.ver.map((v, ci) => (
                      <td key={ci} className={`px-4 py-2 ${rep.columnas[ci]?.align === 'right' ? 'text-right' : rep.columnas[ci]?.align === 'center' ? 'text-center text-slate-500' : 'text-slate-700'}`}>
                        {v === '' && rep.columnas[ci]?.align === 'center' ? '—' : v}
                      </td>
                    ))}
                    {tab === 'cuadres' && puedeAjustar && (
                      <td className="px-4 py-2 text-right">
                        <button onClick={() => abrirAjuste(cuadres[ri])} className="rounded-lg bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-700 hover:bg-brand-100">Ajustar</button>
                      </td>
                    )}
                  </tr>
                ))}
                {rep.pie && (
                  <tr className="bg-slate-50 font-bold text-slate-800">
                    {rep.pie.map((v, ci) => (
                      <td key={ci} className={`px-4 py-2 ${rep.columnas[ci]?.align === 'right' ? 'text-right' : ''}`}>{v}</td>
                    ))}
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* AJUSTE DE CUADRE (administración / gerente) */}
      <Modal
        open={!!ajuste}
        title={`Ajustar cuadre · Caja ${ajuste?.numero ?? ''}`}
        onClose={() => setAjuste(null)}
        footer={
          <>
            <button className="btn-ghost" onClick={() => setAjuste(null)}>Cancelar</button>
            <button className="btn-primary" onClick={guardarAjuste} disabled={savingAj}>{savingAj ? 'Guardando…' : 'Guardar ajuste'}</button>
          </>
        }
      >
        {ajuste && (() => {
          const esperado = Number(ajuste.monto_contado ?? 0) - Number(ajuste.diferencia ?? 0)
          const nuevaDif = ajContado - esperado
          return (
            <div className="space-y-4">
              <div className="rounded-xl bg-slate-50 p-3 text-sm">
                <div className="flex justify-between text-slate-600"><span>Efectivo esperado</span><span>{money(esperado)}</span></div>
                <div className="flex justify-between text-slate-600"><span>Contado al cerrar</span><span>{money(ajuste.monto_contado)}</span></div>
                <div className="flex justify-between text-slate-600"><span>Diferencia registrada</span><span className={Number(ajuste.diferencia) < 0 ? 'text-rose-600' : Number(ajuste.diferencia) > 0 ? 'text-sky-600' : 'text-emerald-600'}>{money(ajuste.diferencia)}</span></div>
              </div>
              <div>
                <label className="label">Efectivo contado corregido (RD$)</label>
                <input type="number" min={0} step={50} className="input" value={ajContado || ''} onChange={(e) => setAjContado(Number(e.target.value))} />
                <button type="button" className="mt-1 text-xs font-semibold text-brand-600 hover:underline" onClick={() => setAjContado(esperado)}>Dejar cuadrada ({money(esperado)})</button>
              </div>
              <div className={`rounded-xl p-3 text-center text-sm font-semibold ${Math.abs(nuevaDif) < 0.01 ? 'bg-emerald-50 text-emerald-700' : nuevaDif > 0 ? 'bg-sky-50 text-sky-700' : 'bg-rose-50 text-rose-700'}`}>
                {Math.abs(nuevaDif) < 0.01 ? 'Quedará cuadrada ✓' : nuevaDif > 0 ? `Sobrante: ${money(nuevaDif)}` : `Faltante: ${money(Math.abs(nuevaDif))}`}
              </div>
              <div>
                <label className="label">Motivo del ajuste</label>
                <textarea className="input" rows={2} value={ajNota} onChange={(e) => setAjNota(e.target.value)} placeholder="Ej: se encontró el faltante, error de conteo…" />
              </div>
            </div>
          )
        })()}
      </Modal>
    </div>
  )
}
