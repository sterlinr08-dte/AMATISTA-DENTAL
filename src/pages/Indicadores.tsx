import { useEffect, useMemo, useState } from 'react'
import { TrendingUp, Wallet, Receipt, Users, CalendarX, FileCheck2, UserPlus, Award } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { money } from '../lib/format'
import PageHeader from '../components/PageHeader'
import Cargando from '../components/Cargando'

function localISO(d: Date): string {
  const off = d.getTimezoneOffset()
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 10)
}
function inicioMes(): string { const d = new Date(); return localISO(new Date(d.getFullYear(), d.getMonth(), 1)) }
function hoy(): string { return localISO(new Date()) }

interface Datos {
  facturado: number; cobrado: number; nFacturas: number
  citTotal: number; citCompletadas: number; citCanceladas: number
  presPresentados: number; presAprobados: number
  pacientesNuevos: number
  porProfesional: { nombre: string; total: number }[]
  topTratamientos: { nombre: string; total: number; n: number }[]
}

export default function Indicadores() {
  const [desde, setDesde] = useState(inicioMes())
  const [hasta, setHasta] = useState(hoy())
  const [loading, setLoading] = useState(true)
  const [d, setD] = useState<Datos | null>(null)

  function rangoRapido(tipo: 'hoy' | 'mes' | 'mespasado' | 'anio') {
    const n = new Date()
    if (tipo === 'hoy') { setDesde(hoy()); setHasta(hoy()) }
    else if (tipo === 'mes') { setDesde(inicioMes()); setHasta(hoy()) }
    else if (tipo === 'mespasado') {
      setDesde(localISO(new Date(n.getFullYear(), n.getMonth() - 1, 1)))
      setHasta(localISO(new Date(n.getFullYear(), n.getMonth(), 0)))
    } else { setDesde(localISO(new Date(n.getFullYear(), 0, 1))); setHasta(hoy()) }
  }

  async function cargar() {
    setLoading(true)
    const [fac, cit, pres, cls, items] = await Promise.all([
      supabase.from('facturas').select('total, estado').gte('fecha', desde).lte('fecha', hasta),
      supabase.from('citas').select('estado').gte('fecha', desde).lte('fecha', hasta),
      supabase.from('presupuestos').select('estado').gte('fecha', desde).lte('fecha', hasta),
      supabase.from('clientes').select('id, created_at').gte('created_at', desde + 'T00:00:00').lte('created_at', hasta + 'T23:59:59'),
      supabase.from('factura_items').select('importe, descripcion, empleado:empleados(nombre), facturas!inner(fecha,estado)')
        .gte('facturas.fecha', desde).lte('facturas.fecha', hasta).neq('facturas.estado', 'ANULADA'),
    ])

    const facturas = (fac.data ?? []) as any[]
    const noAnul = facturas.filter((f) => f.estado !== 'ANULADA')
    const facturado = noAnul.reduce((s, f) => s + Number(f.total || 0), 0)
    const cobrado = facturas.filter((f) => f.estado === 'PAGADA').reduce((s, f) => s + Number(f.total || 0), 0)

    const citas = (cit.data ?? []) as any[]
    const citCompletadas = citas.filter((c) => c.estado === 'COMPLETADA').length
    const citCanceladas = citas.filter((c) => c.estado === 'CANCELADA').length

    const presu = (pres.data ?? []) as any[]
    const presPresentados = presu.filter((p) => p.estado !== 'BORRADOR').length
    const presAprobados = presu.filter((p) => p.estado === 'APROBADO' || p.estado === 'FACTURADO').length

    const li = (items.data ?? []) as any[]
    const mapaProf: Record<string, number> = {}
    const mapaTrat: Record<string, { total: number; n: number }> = {}
    for (const it of li) {
      const prof = it.empleado?.nombre ?? 'Sin asignar'
      mapaProf[prof] = (mapaProf[prof] ?? 0) + Number(it.importe || 0)
      const t = it.descripcion || 'Otro'
      if (!mapaTrat[t]) mapaTrat[t] = { total: 0, n: 0 }
      mapaTrat[t].total += Number(it.importe || 0); mapaTrat[t].n += 1
    }
    const porProfesional = Object.entries(mapaProf).map(([nombre, total]) => ({ nombre, total })).sort((a, b) => b.total - a.total)
    const topTratamientos = Object.entries(mapaTrat).map(([nombre, v]) => ({ nombre, total: v.total, n: v.n })).sort((a, b) => b.total - a.total).slice(0, 8)

    setD({
      facturado, cobrado, nFacturas: noAnul.length,
      citTotal: citas.length, citCompletadas, citCanceladas,
      presPresentados, presAprobados,
      pacientesNuevos: (cls.data ?? []).length,
      porProfesional, topTratamientos,
    })
    setLoading(false)
  }

  useEffect(() => { cargar() /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [desde, hasta])

  const ticket = d && d.nFacturas > 0 ? d.facturado / d.nFacturas : 0
  const ausentismo = d && d.citTotal > 0 ? (d.citCanceladas / d.citTotal) * 100 : 0
  const conversion = d && d.presPresentados > 0 ? (d.presAprobados / d.presPresentados) * 100 : 0
  const maxProf = useMemo(() => Math.max(1, ...(d?.porProfesional.map((p) => p.total) ?? [1])), [d])
  const maxTrat = useMemo(() => Math.max(1, ...(d?.topTratamientos.map((t) => t.total) ?? [1])), [d])

  return (
    <div>
      <PageHeader title="Indicadores" subtitle="Resumen gerencial del período" />

      {/* Rango de fechas */}
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <button className="btn-ghost" onClick={() => rangoRapido('hoy')}>Hoy</button>
        <button className="btn-ghost" onClick={() => rangoRapido('mes')}>Este mes</button>
        <button className="btn-ghost" onClick={() => rangoRapido('mespasado')}>Mes pasado</button>
        <button className="btn-ghost" onClick={() => rangoRapido('anio')}>Este año</button>
        <span className="mx-1 text-slate-300">|</span>
        <input type="date" className="input w-auto" value={desde} onChange={(e) => setDesde(e.target.value)} />
        <span className="text-slate-400">a</span>
        <input type="date" className="input w-auto" value={hasta} onChange={(e) => setHasta(e.target.value)} />
      </div>

      {loading || !d ? (
        <Cargando />
      ) : (
        <div className="space-y-5">
          {/* KPIs */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            <Kpi icon={<TrendingUp size={18} />} label="Facturado" valor={money(d.facturado)} color="text-emerald-600" />
            <Kpi icon={<Wallet size={18} />} label="Cobrado" valor={money(d.cobrado)} color="text-teal-600" />
            <Kpi icon={<Receipt size={18} />} label="Facturas" valor={String(d.nFacturas)} sub={`Ticket prom. ${money(ticket)}`} />
            <Kpi icon={<UserPlus size={18} />} label="Pacientes nuevos" valor={String(d.pacientesNuevos)} />
            <Kpi icon={<Users size={18} />} label="Citas" valor={String(d.citTotal)} sub={`${d.citCompletadas} completadas`} />
            <Kpi icon={<CalendarX size={18} />} label="Ausentismo" valor={`${ausentismo.toFixed(0)}%`} sub={`${d.citCanceladas} canceladas`} color={ausentismo >= 20 ? 'text-rose-600' : 'text-slate-800'} />
            <Kpi icon={<FileCheck2 size={18} />} label="Conversión presup." valor={`${conversion.toFixed(0)}%`} sub={`${d.presAprobados}/${d.presPresentados} aprobados`} color={conversion >= 50 ? 'text-emerald-600' : 'text-amber-600'} />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {/* Producción por profesional */}
            <div className="card">
              <h3 className="mb-3 flex items-center gap-2 font-display font-bold text-slate-800"><Award size={18} className="text-brand-500" /> Producción por profesional</h3>
              {d.porProfesional.length === 0 ? (
                <p className="py-6 text-center text-sm text-slate-400">Sin datos en el período.</p>
              ) : (
                <div className="space-y-2.5">
                  {d.porProfesional.map((p) => (
                    <div key={p.nombre}>
                      <div className="flex justify-between text-sm"><span className="text-slate-700">{p.nombre}</span><span className="font-semibold text-slate-800">{money(p.total)}</span></div>
                      <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-gradient-to-r from-brand-400 to-brand-600" style={{ width: `${(p.total / maxProf) * 100}%` }} /></div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Top tratamientos */}
            <div className="card">
              <h3 className="mb-3 flex items-center gap-2 font-display font-bold text-slate-800"><TrendingUp size={18} className="text-brand-500" /> Tratamientos más facturados</h3>
              {d.topTratamientos.length === 0 ? (
                <p className="py-6 text-center text-sm text-slate-400">Sin datos en el período.</p>
              ) : (
                <div className="space-y-2.5">
                  {d.topTratamientos.map((t) => (
                    <div key={t.nombre}>
                      <div className="flex justify-between gap-2 text-sm"><span className="truncate text-slate-700">{t.nombre} <span className="text-slate-400">×{t.n}</span></span><span className="shrink-0 font-semibold text-slate-800">{money(t.total)}</span></div>
                      <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-gradient-to-r from-amber-300 to-amber-500" style={{ width: `${(t.total / maxTrat) * 100}%` }} /></div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <p className="text-center text-xs text-slate-400">Los montos excluyen facturas anuladas. “Cobrado” son las facturas marcadas como pagadas.</p>
        </div>
      )}
    </div>
  )
}

function Kpi({ icon, label, valor, sub, color = 'text-slate-800' }: { icon: React.ReactNode; label: string; valor: string; sub?: string; color?: string }) {
  return (
    <div className="card">
      <div className="flex items-center gap-2 text-slate-400">{icon}<span className="text-xs font-semibold uppercase tracking-wide">{label}</span></div>
      <p className={`mt-1.5 text-2xl font-extrabold ${color}`}>{valor}</p>
      {sub && <p className="text-xs text-slate-500">{sub}</p>}
    </div>
  )
}
