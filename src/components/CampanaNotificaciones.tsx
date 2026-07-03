import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { Bell, CheckCheck, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { getConversacionActiva } from '../lib/chatActivo'
import { leerAjustesChat } from '../lib/ajustesChat'
import { Notificacion, iconoTipo, hace } from '../lib/notificaciones'

interface Toast { id: string; icono: string; titulo: string; cuerpo?: string | null; enlace?: string | null }

export default function CampanaNotificaciones() {
  const { perfil } = useAuth()
  const miId = perfil?.id ?? ''
  const navigate = useNavigate()

  const [abierto, setAbierto] = useState(false)
  const [items, setItems] = useState<Notificacion[]>([])
  const [noLeidas, setNoLeidas] = useState(0)
  const [toasts, setToasts] = useState<Toast[]>([])
  const boxRef = useRef<HTMLDivElement>(null)

  async function cargar() {
    const { data } = await supabase.from('notificaciones').select('*').order('created_at', { ascending: false }).limit(30)
    const lista = (data as Notificacion[]) ?? []
    setItems(lista)
    setNoLeidas(lista.filter((n) => !n.leida).length)
  }

  useEffect(() => {
    if (!miId) return
    cargar()
    const canal = supabase.channel('notif-centro')
      // Notificaciones persistentes propias.
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notificaciones', filter: `usuario_id=eq.${miId}` }, (p) => {
        const n = p.new as Notificacion
        setItems((prev) => [n, ...prev].slice(0, 30))
        setNoLeidas((c) => c + 1)
        empujarToast({ id: n.id, icono: n.icono || iconoTipo(n.tipo), titulo: n.titulo, cuerpo: n.cuerpo, enlace: n.enlace })
      })
      // Mensajes de chat (aviso en vivo, aunque estés en otro módulo).
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_mensajes' }, (p) => {
        const m = p.new as { id: string; autor_id: string; conversacion_id: string; texto: string | null; adjunto_tipo: string | null }
        if (m.autor_id === miId) return
        if (getConversacionActiva() === m.conversacion_id) return // ya lo estás viendo
        empujarToast({
          id: 'msg-' + m.id, icono: m.adjunto_tipo ? '📎' : '💬',
          titulo: 'Nuevo mensaje', cuerpo: m.texto ?? (m.adjunto_tipo ? 'Archivo adjunto' : ''),
          enlace: '/chat?c=' + m.conversacion_id,
        })
      })
      .subscribe()
    return () => { supabase.removeChannel(canal) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [miId])

  // Cerrar el panel al hacer clic fuera.
  useEffect(() => {
    if (!abierto) return
    const fn = (e: MouseEvent) => { if (boxRef.current && !boxRef.current.contains(e.target as Node)) setAbierto(false) }
    document.addEventListener('mousedown', fn)
    return () => document.removeEventListener('mousedown', fn)
  }, [abierto])

  function empujarToast(t: Toast) {
    setToasts((prev) => [...prev, t])
    if (leerAjustesChat().sonido) beep()
    setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== t.id)), 6000)
  }

  async function abrirNotif(n: Notificacion) {
    if (!n.leida) { await supabase.from('notificaciones').update({ leida: true }).eq('id', n.id); setNoLeidas((c) => Math.max(0, c - 1)); setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, leida: true } : x))) }
    setAbierto(false)
    if (n.enlace) navigate(n.enlace)
  }

  async function irToast(t: Toast) {
    setToasts((prev) => prev.filter((x) => x.id !== t.id))
    if (t.enlace) navigate(t.enlace)
  }

  async function marcarTodas() {
    await supabase.rpc('marcar_notifs_leidas')
    setItems((prev) => prev.map((x) => ({ ...x, leida: true })))
    setNoLeidas(0)
  }

  return (
    <div className="relative" ref={boxRef}>
      <button onClick={() => setAbierto((v) => !v)} className="relative rounded-lg p-1.5 text-white hover:bg-white/20" aria-label="Notificaciones">
        <Bell size={22} />
        {noLeidas > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white ring-2 ring-[#c9a227]">
            {noLeidas > 9 ? '9+' : noLeidas}
          </span>
        )}
      </button>

      {abierto && (
        <div className="absolute right-0 top-11 z-50 w-80 max-w-[92vw] overflow-hidden rounded-2xl bg-white shadow-[0_24px_60px_-18px_rgba(120,90,10,0.5)] ring-1 ring-amber-100">
          <div className="flex items-center justify-between border-b border-amber-100 px-4 py-2.5">
            <span className="text-sm font-bold text-slate-800">Notificaciones</span>
            {noLeidas > 0 && <button onClick={marcarTodas} className="flex items-center gap-1 text-xs font-semibold text-amber-700 hover:text-amber-800"><CheckCheck size={14} /> Marcar todas</button>}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {items.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-slate-400">No tienes notificaciones.</p>
            ) : (
              items.map((n) => (
                <button key={n.id} onClick={() => abrirNotif(n)} className={`flex w-full items-start gap-3 border-b border-slate-50 px-4 py-3 text-left hover:bg-slate-50 ${!n.leida ? 'bg-amber-50/60' : ''}`}>
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-100 text-base">{n.icono || iconoTipo(n.tipo)}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-800">{n.titulo}</p>
                    {n.cuerpo && <p className="line-clamp-2 text-xs text-slate-500">{n.cuerpo}</p>}
                    <p className="mt-0.5 text-[11px] text-slate-400">{hace(n.created_at)}</p>
                  </div>
                  {!n.leida && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-amber-500" />}
                </button>
              ))
            )}
          </div>
        </div>
      )}

      {/* Toasts (aparecen aunque estés en otro módulo) */}
      {createPortal(
        <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-80 max-w-[92vw] flex-col gap-2">
          {toasts.map((t) => (
            <div key={t.id} onClick={() => irToast(t)} className="pointer-events-auto flex cursor-pointer items-start gap-3 rounded-xl bg-white p-3 shadow-[0_16px_40px_-12px_rgba(120,90,10,0.55)] ring-1 ring-amber-100 animate-modal-panel">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-100 text-lg">{t.icono}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-slate-800">{t.titulo}</p>
                {t.cuerpo && <p className="line-clamp-2 text-xs text-slate-500">{t.cuerpo}</p>}
              </div>
              <button onClick={(e) => { e.stopPropagation(); setToasts((prev) => prev.filter((x) => x.id !== t.id)) }} className="rounded p-0.5 text-slate-400 hover:bg-slate-100"><X size={15} /></button>
            </div>
          ))}
        </div>,
        document.body,
      )}
    </div>
  )
}

// Beep discreto al llegar un aviso (se ignora si el navegador lo bloquea).
function beep() {
  try {
    const AC = (window.AudioContext || (window as any).webkitAudioContext)
    if (!AC) return
    const ctx = new AC()
    const o = ctx.createOscillator(); const g = ctx.createGain()
    o.connect(g); g.connect(ctx.destination)
    o.type = 'sine'; o.frequency.value = 880
    g.gain.setValueAtTime(0.0001, ctx.currentTime)
    g.gain.exponentialRampToValueAtTime(0.06, ctx.currentTime + 0.02)
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.25)
    o.start(); o.stop(ctx.currentTime + 0.26)
    o.onended = () => ctx.close()
  } catch { /* silencio */ }
}
