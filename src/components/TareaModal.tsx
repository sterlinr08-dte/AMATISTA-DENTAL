import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { ChatUsuario, nombreUsuario } from '../lib/chat'
import { ContextoTarea, EstadoTarea, ESTADOS_TAREA, Tarea } from '../lib/tareas'
import Modal from './Modal'

interface Props {
  open: boolean
  onClose: () => void
  onGuardado?: () => void
  tarea?: Tarea | null          // si viene, es edición
  contexto?: ContextoTarea      // conversación / paciente / tratamiento
  tituloInicial?: string
}

export default function TareaModal({ open, onClose, onGuardado, tarea, contexto, tituloInicial }: Props) {
  const { perfil } = useAuth()
  const [usuarios, setUsuarios] = useState<ChatUsuario[]>([])
  const [titulo, setTitulo] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [asignado, setAsignado] = useState('')
  const [fecha, setFecha] = useState('')
  const [estado, setEstado] = useState<EstadoTarea>('pendiente')
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    if (!open) return
    supabase.rpc('chat_usuarios').then(({ data }) => {
      const otros = (data as ChatUsuario[]) ?? []
      const yo = perfil ? [{ id: perfil.id, nombre: perfil.nombre, username: perfil.username, rol_key: perfil.rol_key }] : []
      setUsuarios([...yo, ...otros])
    })
    setTitulo(tarea?.titulo ?? tituloInicial ?? '')
    setDescripcion(tarea?.descripcion ?? '')
    setAsignado(tarea?.asignado_a ?? '')
    setFecha(tarea?.fecha_limite ?? '')
    setEstado(tarea?.estado ?? 'pendiente')
  }, [open, tarea, tituloInicial, perfil])

  async function guardar() {
    if (!titulo.trim()) return alert('Escribe el título de la tarea.')
    setGuardando(true)
    if (tarea) {
      const patch: Partial<Tarea> = {
        titulo: titulo.trim(), descripcion: descripcion.trim() || null,
        asignado_a: asignado || null, fecha_limite: fecha || null, estado,
        completada_at: estado === 'completada' ? (tarea.completada_at ?? new Date().toISOString()) : null,
      }
      const { error } = await supabase.from('tareas').update(patch).eq('id', tarea.id)
      setGuardando(false)
      if (error) return alert('No se pudo guardar: ' + error.message)
    } else {
      const { error } = await supabase.from('tareas').insert({
        titulo: titulo.trim(), descripcion: descripcion.trim() || null,
        asignado_a: asignado || null, creada_por: perfil?.id, fecha_limite: fecha || null,
        conversacion_id: contexto?.conversacion_id ?? null,
        cliente_id: contexto?.cliente_id ?? null,
        presupuesto_id: contexto?.presupuesto_id ?? null,
      })
      setGuardando(false)
      if (error) return alert('No se pudo crear: ' + error.message)
    }
    onGuardado?.(); onClose()
  }

  return (
    <Modal open={open} title={tarea ? 'Editar tarea' : 'Nueva tarea'} onClose={onClose}
      footer={<><button className="btn-ghost" onClick={onClose}>Cancelar</button><button className="btn-primary" onClick={guardar} disabled={guardando}>{guardando ? 'Guardando…' : tarea ? 'Guardar' : 'Crear tarea'}</button></>}>
      <div className="space-y-4">
        <div>
          <label className="label">Tarea</label>
          <input className="input" value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ej. Preparar guía quirúrgica" autoFocus />
        </div>
        <div>
          <label className="label">Detalle (opcional)</label>
          <textarea className="input min-h-[70px]" value={descripcion} onChange={(e) => setDescripcion(e.target.value)} placeholder="Instrucciones, materiales…" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Asignar a</label>
            <select className="input" value={asignado} onChange={(e) => setAsignado(e.target.value)}>
              <option value="">— Sin asignar —</option>
              {usuarios.map((u) => <option key={u.id} value={u.id}>{nombreUsuario(u)}{u.id === perfil?.id ? ' (yo)' : ''}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Fecha límite</label>
            <input type="date" className="input" value={fecha} onChange={(e) => setFecha(e.target.value)} />
          </div>
        </div>
        {tarea && (
          <div>
            <label className="label">Estado</label>
            <div className="flex gap-2">
              {(Object.keys(ESTADOS_TAREA) as EstadoTarea[]).map((k) => (
                <button key={k} type="button" onClick={() => setEstado(k)}
                  className={`flex-1 rounded-xl border-2 px-3 py-2 text-sm font-semibold transition ${estado === k ? 'border-brand-400 bg-brand-50 text-brand-700' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}>
                  {ESTADOS_TAREA[k].label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}
