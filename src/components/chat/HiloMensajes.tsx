import { useEffect, useMemo, useRef, useState } from 'react'
import { Send, Paperclip, Zap, X, Trash2, Pencil, Check, CheckCheck, CornerUpLeft, FileText, ListPlus } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { setConversacionActiva } from '../../lib/chatActivo'
import {
  ChatMensaje, ChatParticipante, ChatUsuario, RESPUESTAS_RAPIDAS,
  inicialesChat, colorAvatar, horaChat, diaChat, detectarMenciones, nombreUsuario,
} from '../../lib/chat'

const BUCKET = 'chat'

interface Props {
  conversacionId: string
  miId: string
  usuarios: Record<string, ChatUsuario>
  onActividad?: () => void
  onCrearTarea?: (tituloInicial?: string) => void
  alto?: string // p.ej. 'h-[70vh]'
}

export default function HiloMensajes({ conversacionId, miId, usuarios, onActividad, onCrearTarea, alto = 'h-[68vh]' }: Props) {
  const [mensajes, setMensajes] = useState<ChatMensaje[]>([])
  const [participantes, setParticipantes] = useState<ChatParticipante[]>([])
  const [cargando, setCargando] = useState(true)
  const [texto, setTexto] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [rapidas, setRapidas] = useState(false)
  const [escribiendo, setEscribiendo] = useState<Record<string, { nombre: string; t: number }>>({})
  const [respondiendo, setRespondiendo] = useState<ChatMensaje | null>(null)
  const [editando, setEditando] = useState<ChatMensaje | null>(null)

  const finRef = useRef<HTMLDivElement>(null)
  const canalRef = useRef<ReturnType<typeof supabase.channel> | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const ultTyping = useRef(0)

  const listaUsuarios = useMemo(() => Object.values(usuarios), [usuarios])

  // --- Carga inicial + realtime ---------------------------------------
  useEffect(() => {
    let vivo = true
    setCargando(true)
    setMensajes([]); setParticipantes([]); setRespondiendo(null); setEditando(null)

    async function cargar() {
      const [{ data: msg }, { data: parts }] = await Promise.all([
        supabase.from('chat_mensajes').select('*').eq('conversacion_id', conversacionId).order('created_at').limit(300),
        supabase.from('chat_participantes').select('*').eq('conversacion_id', conversacionId),
      ])
      if (!vivo) return
      setMensajes((msg as ChatMensaje[]) ?? [])
      setParticipantes((parts as ChatParticipante[]) ?? [])
      setCargando(false)
      marcarLeido()
    }
    cargar()

    const canal = supabase
      .channel(`conv-${conversacionId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_mensajes', filter: `conversacion_id=eq.${conversacionId}` },
        (p) => {
          const m = p.new as ChatMensaje
          setMensajes((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]))
          if (m.autor_id !== miId) marcarLeido()
          onActividad?.()
        })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'chat_mensajes', filter: `conversacion_id=eq.${conversacionId}` },
        (p) => { const m = p.new as ChatMensaje; setMensajes((prev) => prev.map((x) => (x.id === m.id ? m : x))) })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'chat_participantes', filter: `conversacion_id=eq.${conversacionId}` },
        (p) => { const pa = p.new as ChatParticipante; setParticipantes((prev) => prev.map((x) => (x.usuario_id === pa.usuario_id ? pa : x))) })
      .on('broadcast', { event: 'typing' }, ({ payload }) => {
        const { id, nombre } = payload as { id: string; nombre: string }
        if (id === miId) return
        setEscribiendo((prev) => ({ ...prev, [id]: { nombre, t: Date.now() } }))
      })
      .subscribe()
    canalRef.current = canal

    setConversacionActiva(conversacionId)
    return () => { vivo = false; setConversacionActiva(null); supabase.removeChannel(canal) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversacionId, miId])

  // Limpia indicadores "escribiendo…" vencidos.
  useEffect(() => {
    const t = setInterval(() => {
      setEscribiendo((prev) => {
        const ahora = Date.now(); let cambio = false; const n: typeof prev = {}
        for (const k in prev) { if (ahora - prev[k].t < 4000) n[k] = prev[k]; else cambio = true }
        return cambio ? n : prev
      })
    }, 1500)
    return () => clearInterval(t)
  }, [])

  // Autoscroll al final.
  useEffect(() => { finRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [mensajes.length, cargando])

  // Marca la conversación como leída (recibo de lectura por participante).
  async function marcarLeido() {
    await supabase.rpc('chat_marcar_leido', { p_conv: conversacionId })
    onActividad?.()
  }

  // Emite "escribiendo…" (throttle 2s).
  function avisarTyping() {
    const ahora = Date.now()
    if (ahora - ultTyping.current < 2000) return
    ultTyping.current = ahora
    canalRef.current?.send({ type: 'broadcast', event: 'typing', payload: { id: miId, nombre: nombreUsuario(usuarios[miId]) } })
  }

  // --- Envío -----------------------------------------------------------
  async function enviar(cuerpo?: string) {
    const t = (cuerpo ?? texto).trim()
    if (!t || enviando) return
    setEnviando(true)

    if (editando) {
      const { error } = await supabase.from('chat_mensajes')
        .update({ texto: t, editado_at: new Date().toISOString() }).eq('id', editando.id)
      setEnviando(false)
      if (error) return alert('No se pudo editar: ' + error.message)
      setEditando(null); setTexto('')
      return
    }

    const mencionados = detectarMenciones(t, listaUsuarios)
    const { data, error } = await supabase.from('chat_mensajes').insert({
      conversacion_id: conversacionId, autor_id: miId, texto: t,
      responde_a: respondiendo?.id ?? null, mencionados,
    }).select().single()
    setEnviando(false)
    if (error) return alert('No se pudo enviar: ' + error.message)
    if (data) { const m = data as ChatMensaje; setMensajes((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m])); onActividad?.() }
    setTexto(''); setRespondiendo(null); setRapidas(false)
  }

  async function subirAdjunto(file: File) {
    setEnviando(true)
    const path = `${conversacionId}/${Date.now()}-${file.name.replace(/[^\w.\-]/g, '_')}`
    const { error: eUp } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: false })
    if (eUp) { setEnviando(false); return alert('No se pudo subir: ' + eUp.message) }
    const { data, error } = await supabase.from('chat_mensajes').insert({
      conversacion_id: conversacionId, autor_id: miId, texto: null,
      adjunto_url: path, adjunto_nombre: file.name, adjunto_tipo: file.type || 'application/octet-stream',
      responde_a: respondiendo?.id ?? null,
    }).select().single()
    setEnviando(false)
    if (error) return alert('No se pudo enviar el archivo: ' + error.message)
    if (data) { const m = data as ChatMensaje; setMensajes((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m])); onActividad?.() }
    setRespondiendo(null)
  }

  async function borrar(m: ChatMensaje) {
    if (!confirm('¿Eliminar este mensaje? (queda como “mensaje eliminado”)')) return
    await supabase.from('chat_mensajes').update({ eliminado: true, texto: null }).eq('id', m.id)
  }

  // Recibo de lectura de MIS mensajes: leído si todos los demás ya leyeron.
  function estadoMensaje(m: ChatMensaje): 'entregado' | 'leido' {
    const otros = participantes.filter((p) => p.usuario_id !== miId)
    if (otros.length === 0) return 'entregado'
    const todos = otros.every((p) => new Date(p.ultima_lectura).getTime() >= new Date(m.created_at).getTime())
    return todos ? 'leido' : 'entregado'
  }

  const nombresEscribiendo = Object.values(escribiendo).map((e) => e.nombre)

  return (
    <div className={`flex ${alto} flex-col overflow-hidden rounded-xl border border-slate-200 bg-[#faf8f2]`}>
      {/* Mensajes */}
      <div className="flex-1 space-y-1 overflow-y-auto px-3 py-3 sm:px-4">
        {cargando ? (
          <p className="py-10 text-center text-sm text-slate-400">Cargando conversación…</p>
        ) : mensajes.length === 0 ? (
          <p className="py-10 text-center text-sm text-slate-400">No hay mensajes. Escribe el primero 👋</p>
        ) : (
          mensajes.map((m, i) => {
            const prev = mensajes[i - 1]
            const nuevoDia = !prev || new Date(prev.created_at).toDateString() !== new Date(m.created_at).toDateString()
            const mio = m.autor_id === miId
            const autor = usuarios[m.autor_id ?? '']
            const citado = m.responde_a ? mensajes.find((x) => x.id === m.responde_a) : null
            return (
              <div key={m.id}>
                {nuevoDia && (
                  <div className="my-3 flex justify-center">
                    <span className="rounded-full bg-white px-3 py-0.5 text-[11px] font-semibold text-slate-500 shadow-sm ring-1 ring-slate-200">{diaChat(m.created_at)}</span>
                  </div>
                )}
                <div className={`group flex items-end gap-2 ${mio ? 'flex-row-reverse' : ''}`}>
                  {!mio && (
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white" style={{ background: colorAvatar(m.autor_id) }}>
                      {inicialesChat(nombreUsuario(autor))}
                    </div>
                  )}
                  <div className={`relative max-w-[78%] rounded-2xl px-3 py-2 text-sm shadow-sm ${
                    mio ? 'rounded-br-sm bg-[#dcf1e4] text-slate-800' : 'rounded-bl-sm bg-white text-slate-800 ring-1 ring-slate-100'
                  }`}>
                    {!mio && (m.autor_id) && <p className="mb-0.5 text-[11px] font-bold" style={{ color: colorAvatar(m.autor_id) }}>{nombreUsuario(autor)}</p>}
                    {citado && (
                      <div className="mb-1 border-l-2 border-amber-400 bg-black/5 px-2 py-1 text-[11px] text-slate-500">
                        <span className="font-semibold">{nombreUsuario(usuarios[citado.autor_id ?? ''])}: </span>
                        {citado.eliminado ? 'mensaje eliminado' : (citado.texto ?? '📎 archivo')}
                      </div>
                    )}
                    {m.eliminado ? (
                      <p className="italic text-slate-400">Mensaje eliminado</p>
                    ) : (
                      <>
                        {m.adjunto_url && <Adjunto path={m.adjunto_url} tipo={m.adjunto_tipo} nombre={m.adjunto_nombre} />}
                        {m.texto && <p className="whitespace-pre-wrap break-words">{m.texto}</p>}
                      </>
                    )}
                    <div className="mt-0.5 flex items-center justify-end gap-1.5">
                      {/* Iconos de acción (al pasar el cursor), junto a la hora */}
                      {!m.eliminado && (
                        <div className="hidden items-center gap-0.5 group-hover:flex">
                          <button title="Responder" onClick={() => { setRespondiendo(m); setEditando(null) }} className="rounded p-0.5 text-slate-400 hover:text-amber-600"><CornerUpLeft size={14} /></button>
                          {onCrearTarea && m.texto && <button title="Convertir en tarea" onClick={() => onCrearTarea(m.texto ?? '')} className="rounded p-0.5 text-slate-400 hover:text-amber-600"><ListPlus size={14} /></button>}
                          {mio && m.texto && <button title="Editar" onClick={() => { setEditando(m); setTexto(m.texto ?? ''); setRespondiendo(null) }} className="rounded p-0.5 text-slate-400 hover:text-amber-600"><Pencil size={14} /></button>}
                          {mio && <button title="Eliminar" onClick={() => borrar(m)} className="rounded p-0.5 text-slate-400 hover:text-rose-600"><Trash2 size={14} /></button>}
                        </div>
                      )}
                      {m.editado_at && !m.eliminado && <span className="text-[10px] text-slate-400">editado</span>}
                      <span className="text-[10px] text-slate-400">{horaChat(m.created_at)}</span>
                      {mio && !m.eliminado && (
                        estadoMensaje(m) === 'leido'
                          ? <CheckCheck size={13} className="text-sky-500" />
                          : <CheckCheck size={13} className="text-slate-400" />
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )
          })
        )}
        <div ref={finRef} />
      </div>

      {/* Indicador escribiendo */}
      {nombresEscribiendo.length > 0 && (
        <div className="px-4 pb-1 text-[11px] italic text-slate-500">
          {nombresEscribiendo.join(', ')} {nombresEscribiendo.length === 1 ? 'está' : 'están'} escribiendo…
        </div>
      )}

      {/* Respuestas rápidas */}
      {rapidas && (
        <div className="flex flex-wrap gap-1.5 border-t border-slate-200 bg-white px-3 py-2">
          {RESPUESTAS_RAPIDAS.map((r) => (
            <button key={r} onClick={() => enviar(r)} className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800 ring-1 ring-amber-200 hover:bg-amber-100">{r}</button>
          ))}
        </div>
      )}

      {/* Cita de respuesta / edición (estilo WhatsApp) */}
      {(respondiendo || editando) && (
        <div className="border-t border-slate-200 bg-white px-2.5 pt-2">
          <div className="flex items-stretch gap-2 rounded-lg bg-slate-100 py-1.5 pl-2 pr-1">
            <div className="w-1 shrink-0 rounded-full" style={{ background: editando ? '#c9a227' : colorAvatar(respondiendo!.autor_id) }} />
            <div className="min-w-0 flex-1 py-0.5">
              <p className="truncate text-[12px] font-bold" style={{ color: editando ? '#9c7d18' : colorAvatar(respondiendo!.autor_id) }}>
                {editando ? 'Editar mensaje' : nombreUsuario(usuarios[respondiendo!.autor_id ?? ''])}
              </p>
              <p className="truncate text-[12px] text-slate-500">
                {editando ? (editando.texto ?? '') : (respondiendo!.texto ?? '📎 archivo')}
              </p>
            </div>
            <button onClick={() => { setRespondiendo(null); setEditando(null); if (editando) setTexto('') }} className="self-center rounded-full p-1 text-slate-400 hover:bg-slate-200"><X size={16} /></button>
          </div>
        </div>
      )}

      {/* Composer */}
      <div className="flex items-end gap-2 border-t border-slate-200 bg-white px-2.5 py-2">
        <button onClick={() => setRapidas((v) => !v)} title="Respuestas rápidas" className={`shrink-0 rounded-lg p-2 ${rapidas ? 'bg-amber-100 text-amber-700' : 'text-slate-500 hover:bg-slate-100'}`}><Zap size={18} /></button>
        <button onClick={() => fileRef.current?.click()} title="Adjuntar" className="shrink-0 rounded-lg p-2 text-slate-500 hover:bg-slate-100"><Paperclip size={18} /></button>
        {onCrearTarea && <button onClick={() => onCrearTarea('')} title="Crear tarea" className="shrink-0 rounded-lg p-2 text-slate-500 hover:bg-slate-100"><ListPlus size={18} /></button>}
        <input ref={fileRef} type="file" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) subirAdjunto(f); e.target.value = '' }} />
        <textarea
          rows={1}
          value={texto}
          onChange={(e) => { setTexto(e.target.value); avisarTyping() }}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar() } }}
          placeholder="Mensaje"
          className="max-h-32 min-h-[40px] flex-1 resize-none rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
        />
        <button onClick={() => enviar()} disabled={enviando || !texto.trim()} className="shrink-0 rounded-xl bg-gradient-to-b from-[#e6b93c] to-[#c9a227] p-2.5 text-white shadow disabled:opacity-40">
          {editando ? <Check size={18} /> : <Send size={18} />}
        </button>
      </div>
    </div>
  )
}

// Adjunto: resuelve una URL firmada (bucket privado) y muestra vista previa.
function Adjunto({ path, tipo, nombre }: { path: string; tipo: string | null; nombre: string | null }) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    let vivo = true
    supabase.storage.from(BUCKET).createSignedUrl(path, 3600).then(({ data }) => { if (vivo) setUrl(data?.signedUrl ?? null) })
    return () => { vivo = false }
  }, [path])
  const esImg = (tipo ?? '').startsWith('image/')
  if (esImg) {
    return url
      ? <a href={url} target="_blank" rel="noreferrer"><img src={url} alt={nombre ?? ''} className="mb-1 max-h-52 rounded-lg object-cover" /></a>
      : <div className="mb-1 flex h-24 w-40 items-center justify-center rounded-lg bg-slate-100 text-xs text-slate-400">Cargando…</div>
  }
  return (
    <a href={url ?? undefined} target="_blank" rel="noreferrer" className="mb-1 flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200">
      <FileText size={16} /> <span className="truncate">{nombre ?? 'Archivo'}</span>
    </a>
  )
}
