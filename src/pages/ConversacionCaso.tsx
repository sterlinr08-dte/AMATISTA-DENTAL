import { useEffect, useState } from 'react'
import { MessagesSquare } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { ChatUsuario } from '../lib/chat'
import HiloMensajes from '../components/chat/HiloMensajes'
import TareaModal from '../components/TareaModal'
import Cargando from '../components/Cargando'

// Pestaña "Conversación del Caso" dentro de la ficha del paciente (Fase 3).
// Todo el equipo autorizado comenta sobre el paciente; el historial queda guardado.
export default function ConversacionCaso({ pacienteFijo }: { pacienteFijo?: string } = {}) {
  const { perfil } = useAuth()
  const miId = perfil?.id ?? ''
  const [convId, setConvId] = useState<string | null>(null)
  const [usuarios, setUsuarios] = useState<Record<string, ChatUsuario>>({})
  const [error, setError] = useState<string | null>(null)
  const [tareaTitulo, setTareaTitulo] = useState<string | null>(null)

  useEffect(() => {
    if (!pacienteFijo || !perfil) return
    let vivo = true
    setConvId(null); setError(null)
    ;(async () => {
      const [{ data: us }, { data: conv, error: e }] = await Promise.all([
        supabase.rpc('chat_usuarios'),
        supabase.rpc('chat_conversacion_paciente', { p_cliente: pacienteFijo }),
      ])
      if (!vivo) return
      const mapa: Record<string, ChatUsuario> = {}
      ;((us as ChatUsuario[]) ?? []).forEach((u) => { mapa[u.id] = u })
      mapa[perfil.id] = { id: perfil.id, nombre: perfil.nombre, username: perfil.username, rol_key: perfil.rol_key }
      setUsuarios(mapa)
      if (e) setError(e.message)
      else setConvId(conv as string)
    })()
    return () => { vivo = false }
  }, [pacienteFijo, perfil])

  if (!pacienteFijo) return <p className="card text-sm text-slate-500">Selecciona un paciente.</p>
  if (error) return <p className="card text-sm text-rose-600">No se pudo abrir la conversación: {error}</p>
  if (!convId) return <Cargando />

  return (
    <div>
      <div className="mb-3 flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800 ring-1 ring-amber-100">
        <MessagesSquare size={16} />
        <span>Conversación del equipo sobre este paciente. Todo queda registrado de forma permanente.</span>
      </div>
      <HiloMensajes conversacionId={convId} miId={miId} usuarios={usuarios} alto="h-[62vh]"
        onCrearTarea={(t) => setTareaTitulo(t ?? '')} />
      <TareaModal open={tareaTitulo !== null} tituloInicial={tareaTitulo ?? ''}
        contexto={{ conversacion_id: convId, cliente_id: pacienteFijo }} onClose={() => setTareaTitulo(null)} />
    </div>
  )
}
