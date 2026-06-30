import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarDays, Users, TrendingUp, Clock, HandCoins, PackageX } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { CitaConRelaciones } from '../types'
import { hora, money, hoyISO, fechaLarga } from '../lib/format'
import { useNegocio } from '../lib/negocio'
import Cargando from '../components/Cargando'

interface Stats {
  clientes: number
  citasHoy: number
  ventasHoy: number
  porCobrar: number
  stockBajo: number
}

const SELECT = `*,
  cliente:clientes(id,nombre,telefono),
  empleado:empleados(id,nombre,color),
  servicio:servicios(id,nombre,precio,duracion_min)`

export default function Dashboard() {
  const { negocio } = useNegocio()
  const [stats, setStats] = useState<Stats>({ clientes: 0, citasHoy: 0, ventasHoy: 0, porCobrar: 0, stockBajo: 0 })
  const [agenda, setAgenda] = useState<CitaConRelaciones[]>([])
  const [loading, setLoading] = useState(true)
  const hoy = hoyISO()

  useEffect(() => {
    ;(async () => {
      const [cl, citas, factHoy, pend, arts] = await Promise.all([
        supabase.from('clientes').select('id', { count: 'exact', head: true }),
        supabase.from('citas').select(SELECT).eq('fecha', hoy).order('hora_inicio'),
        supabase.from('facturas').select('total,estado').eq('fecha', hoy),
        supabase.from('facturas').select('total').eq('estado', 'PENDIENTE'),
        supabase.from('articulos').select('stock,stock_min').eq('activo', true),
      ])
      const lista = (citas.data as CitaConRelaciones[]) ?? []
      const ventasHoy = (factHoy.data ?? [])
        .filter((f: any) => f.estado === 'PAGADA')
        .reduce((s: number, f: any) => s + Number(f.total), 0)
      const porCobrar = (pend.data ?? []).reduce((s: number, f: any) => s + Number(f.total), 0)
      const stockBajo = (arts.data ?? []).filter((a: any) => Number(a.stock) <= Number(a.stock_min)).length
      setStats({
        clientes: cl.count ?? 0,
        citasHoy: lista.length,
        ventasHoy,
        porCobrar,
        stockBajo,
      })
      setAgenda(lista)
      setLoading(false)
    })()
  }, [hoy])

  const tarjetas = [
    { label: 'Ventas de hoy', valor: money(stats.ventasHoy), icon: TrendingUp, to: '/caja', color: 'text-emerald-600 bg-emerald-50' },
    { label: 'Por cobrar', valor: money(stats.porCobrar), icon: HandCoins, to: '/caja', color: 'text-amber-600 bg-amber-50' },
    { label: 'Citas hoy', valor: stats.citasHoy, icon: CalendarDays, to: '/citas', color: 'text-brand-600 bg-brand-50' },
    { label: 'Clientes', valor: stats.clientes, icon: Users, to: '/clientes', color: 'text-sky-600 bg-sky-50' },
    { label: 'Existencia baja', valor: stats.stockBajo, icon: PackageX, to: '/articulos', color: stats.stockBajo > 0 ? 'text-rose-600 bg-rose-50' : 'text-slate-500 bg-slate-100' },
  ]

  return (
    <div>
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-gradient-to-br from-[#15060f] via-brand-800 to-brand-600 px-7 py-8 text-white ring-1 ring-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.14),0_24px_48px_-14px_rgba(236,72,153,0.55)]">
        <div>
          <p className="text-sm uppercase tracking-[0.25em] text-gold-400">{negocio.nombre}</p>
          <h1 className="mt-1 font-display text-3xl font-bold">Bienvenida 💅</h1>
          <p className="mt-2 text-brand-100">{fechaLarga(hoy)}</p>
        </div>
        <div className="text-sm text-brand-100">
          <p>📍 {negocio.direccion}</p>
          <p>📱 {negocio.whatsapp}</p>
          <p>📷 {negocio.instagram}</p>
        </div>
      </div>

      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {tarjetas.map((t) => (
          <Link key={t.label} to={t.to} className="card">
            <div className={`mb-3 inline-flex h-11 w-11 items-center justify-center rounded-xl ring-1 ring-black/5 shadow-[inset_0_1px_0_rgba(255,255,255,0.7),0_8px_16px_-6px_rgba(236,72,153,0.3)] ${t.color}`}>
              <t.icon size={20} />
            </div>
            <p className="text-2xl font-bold text-slate-800">{loading ? '…' : t.valor}</p>
            <p className="text-sm text-slate-500">{t.label}</p>
          </Link>
        ))}
      </div>

      {stats.stockBajo > 0 && (
        <Link to="/articulos" className="mb-6 flex items-center gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-5 py-3 text-sm text-rose-700 ring-1 ring-rose-100 transition hover:bg-rose-100">
          <PackageX size={20} />
          <span><strong>{stats.stockBajo}</strong> artículo(s) con existencia baja (en o por debajo de su mínimo). Toca para revisar el inventario.</span>
        </Link>
      )}

      <div className="card">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-lg font-bold text-slate-800">Agenda de hoy</h2>
          <Link to="/citas" className="text-sm font-semibold text-brand-600 hover:underline">Ver todo →</Link>
        </div>
        {loading ? (
          <Cargando />
        ) : agenda.length === 0 ? (
          <p className="py-6 text-center text-slate-600">No hay citas agendadas para hoy.</p>
        ) : (
          <ul className="divide-y divide-slate-50">
            {agenda.map((c) => (
              <li key={c.id} className="flex items-center gap-4 py-3">
                <span className="flex items-center gap-1 text-sm font-semibold text-brand-600">
                  <Clock size={14} /> {hora(c.hora_inicio)}
                </span>
                <div className="flex-1">
                  <p className="font-medium text-slate-800">{c.cliente?.nombre ?? 'Cliente'}</p>
                  <p className="text-xs text-slate-600">{c.servicio?.nombre}</p>
                </div>
                <span className="text-sm font-semibold text-slate-700">{money(c.precio)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
