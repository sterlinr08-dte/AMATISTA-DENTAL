import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Trash2, Pencil, Play, Check, RotateCcw, ClipboardList, CalendarClock, User } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { ChatUsuario, nombreUsuario } from '../lib/chat'
import { Tarea, EstadoTarea, ESTADOS_TAREA } from '../lib/tareas'
import { fechaCorta, hoyISO } from '../lib/format'
import PageHeader from '../components/PageHeader'
import Cargando from '../components/Cargando'
import TareaModal from '../components/TareaModal'

type Filtro = 'mias' | 'creadas' | 'pendientes' | 'completadas' | 'todas'

export default function Tareas() {
  const { perfil } = useAuth()
  const miId = perfil?.id ?? ''
  const [items, setItems] = useState<Tarea[]>([])
  const [usuarios, setUsuarios] = useState<Record<string, ChatUsuario>>({})
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState<Filtro>('mias')
  const [modal, setModal] = useState(false)
  const [editando, setEditando] = useState<Tarea | null>(null)

  async function cargar() {
    const { data } = await supabase.from('tareas').select('*, cliente:clientes(nombre)').order('created_at', { ascending: false })
    setItems((data as Tarea[]) ?? [])
    setLoading(false)
  }
  useEffect(() => {
    supabase.rpc('chat_usuarios').then(({ data }) => {
      const mapa: Record<string, ChatUsuario> = {}
      ;((data as ChatUsuario[]) ?? []).forEach((u) => { mapa[u.id] = u })
      if (perfil) mapa[perfil.id] = { id: perfil.id, nombre: perfil.nombre, username: perfil.username, rol_key: perfil.rol_key }
      setUsuarios(mapa)
    })
    cargar()
    const canal = supabase.channel('tareas-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tareas' }, () => cargar())
      .subscribe()
    return () => { supabase.removeChannel(canal) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [perfil?.id])

  const hoy = hoyISO()
  const visibles = useMemo(() => {
    let l = items
    if (filtro === 'mias') l = items.filter((t) => t.asignado_a === miId && t.estado !== 'completada')
    else if (filtro === 'creadas') l = items.filter((t) => t.creada_por === miId)
    else if (filtro === 'pendientes') l = items.filter((t) => t.estado !== 'completada')
    else if (filtro === 'completadas') l = items.filter((t) => t.estado === 'completada')
    // Orden: por fecha límite (las que tienen, primero), luego recientes.
    return [...l].sort((a, b) => {
      if (a.fecha_limite && b.fecha_limite) return a.fecha_limite.localeCompare(b.fecha_limite)
      if (a.fecha_limite) return -1
      if (b.fecha_limite) return 1
      return b.created_at.localeCompare(a.created_at)
    })
  }, [items, filtro, miId])

  const nMias = items.filter((t) => t.asignado_a === miId && t.estado !== 'completada').length

  async function cambiarEstado(t: Tarea, estado: EstadoTarea) {
    await supabase.from('tareas').update({ estado, completada_at: estado === 'completada' ? new Date().toISOString() : null }).eq('id', t.id)
  }
  async function eliminar(t: Tarea) {
    if (!confirm('¿Eliminar esta tarea?')) return
    await supabase.from('tareas').delete().eq('id', t.id)
  }

  const filtros: [Filtro, string][] = [
    ['mias', `Mías (${nMias})`], ['pendientes', 'Pendientes'], ['creadas', 'Creadas por mí'], ['completadas', 'Completadas'],
  ]
  if (perfil?.es_admin) filtros.push(['todas', 'Todas'])

  return (
    <div>
      <PageHeader
        title="Tareas"
        subtitle={nMias > 0 ? `Tienes ${nMias} tarea(s) pendiente(s)` : 'Asignaciones del equipo'}
        action={<button className="btn-primary" onClick={() => { setEditando(null); setModal(true) }}><Plus size={16} /> Nueva tarea</button>}
      />

      <div className="mb-4 flex flex-wrap gap-2">
        {filtros.map(([k, l]) => (
          <button key={k} onClick={() => setFiltro(k)} className={filtro === k ? 'btn-primary' : 'btn-ghost'}>{l}</button>
        ))}
      </div>

      {loading ? (
        <Cargando />
      ) : visibles.length === 0 ? (
        <div className="card flex flex-col items-center gap-3 py-12 text-center">
          <ClipboardList className="text-brand-300" size={40} />
          <p className="text-slate-500">No hay tareas en esta vista.</p>
          <button className="btn-primary" onClick={() => { setEditando(null); setModal(true) }}><Plus size={16} /> Crear una tarea</button>
        </div>
      ) : (
        <div className="space-y-2.5">
          {visibles.map((t) => {
            const vencida = t.fecha_limite && t.fecha_limite < hoy && t.estado !== 'completada'
            const est = ESTADOS_TAREA[t.estado]
            return (
              <div key={t.id} className="card flex flex-wrap items-center gap-3">
                <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${est.punto}`} />
                <div className="min-w-0 flex-1">
                  <p className={`font-semibold ${t.estado === 'completada' ? 'text-slate-400 line-through' : 'text-slate-800'}`}>{t.titulo}</p>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-500">
                    <span className="inline-flex items-center gap-1"><User size={12} /> {t.asignado_a ? nombreUsuario(usuarios[t.asignado_a]) : 'Sin asignar'}</span>
                    {t.fecha_limite && <span className={`inline-flex items-center gap-1 ${vencida ? 'font-semibold text-rose-600' : ''}`}><CalendarClock size={12} /> {fechaCorta(t.fecha_limite)}{vencida ? ' · vencida' : ''}</span>}
                    {t.cliente?.nombre && <Link to={`/ficha/${t.cliente_id}`} className="inline-flex items-center gap-1 text-amber-700 hover:underline">🦷 {t.cliente.nombre}</Link>}
                    {t.conversacion_id && <Link to={`/chat?c=${t.conversacion_id}`} className="text-amber-700 hover:underline">💬 chat</Link>}
                  </div>
                  {t.descripcion && <p className="mt-1 text-xs text-slate-500">{t.descripcion}</p>}
                </div>
                <span className={`badge ${est.badge}`}>{est.label}</span>
                <div className="flex items-center gap-1">
                  {t.estado === 'pendiente' && <button onClick={() => cambiarEstado(t, 'en_proceso')} title="Empezar" className="rounded-lg p-1.5 text-slate-500 hover:bg-blue-50 hover:text-blue-600"><Play size={16} /></button>}
                  {t.estado !== 'completada' && <button onClick={() => cambiarEstado(t, 'completada')} title="Completar" className="rounded-lg p-1.5 text-slate-500 hover:bg-emerald-50 hover:text-emerald-600"><Check size={16} /></button>}
                  {t.estado === 'completada' && <button onClick={() => cambiarEstado(t, 'pendiente')} title="Reabrir" className="rounded-lg p-1.5 text-slate-500 hover:bg-amber-50 hover:text-amber-600"><RotateCcw size={15} /></button>}
                  <button onClick={() => { setEditando(t); setModal(true) }} title="Editar" className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"><Pencil size={15} /></button>
                  <button onClick={() => eliminar(t)} title="Eliminar" className="rounded-lg p-1.5 text-slate-500 hover:bg-rose-50 hover:text-rose-600"><Trash2 size={15} /></button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <TareaModal open={modal} tarea={editando} onClose={() => setModal(false)} onGuardado={cargar} />
    </div>
  )
}
