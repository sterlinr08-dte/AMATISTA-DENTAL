import { useEffect, useRef, useState } from 'react'
import { supabase } from './supabase'
import { useAuth } from './auth'

// Cada instancia del hook usa un canal Realtime propio (evita colisiones de
// topic cuando el badge se muestra en varios sitios a la vez).
let seq = 0

// Total de mensajes de chat sin leer del usuario actual.
// Se refresca con Realtime (nuevos mensajes) y al marcar leído.
export function useChatNoLeidos(): number {
  const { perfil, puede } = useAuth()
  const [n, setN] = useState(0)
  const idRef = useRef(++seq)

  useEffect(() => {
    if (!perfil?.id || !puede('chat')) { setN(0); return }
    let vivo = true
    const refrescar = async () => {
      const { data } = await supabase.rpc('chat_no_leidos_total')
      if (vivo) setN(Number(data ?? 0))
    }
    refrescar()
    const canal = supabase.channel(`chat-badge-${idRef.current}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_mensajes' }, refrescar)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'chat_participantes' }, refrescar)
      .subscribe()
    const onFocus = () => refrescar()
    window.addEventListener('focus', onFocus)
    return () => { vivo = false; window.removeEventListener('focus', onFocus); supabase.removeChannel(canal) }
  }, [perfil?.id, puede])

  return n
}
