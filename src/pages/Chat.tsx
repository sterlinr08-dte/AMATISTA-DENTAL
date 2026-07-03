import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { MessageSquarePlus, Users, Search, Building2, ArrowLeft, Hash, UserRound, Stethoscope } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import PageHeader from '../components/PageHeader'
import Modal from '../components/Modal'
import HiloMensajes from '../components/chat/HiloMensajes'
import {
  ChatUsuario, ConversacionResumen, DEPARTAMENTOS,
  inicialesChat, colorAvatar, cuandoChat, vistaPrevia, nombreUsuario, nombreDepartamento,
} from '../lib/chat'

type Estado = 'online' | 'ausente' | 'desconectado'

export default function Chat() {
  const { perfil } = useAuth()
  const miId = perfil?.id ?? ''
  const [params, setParams] = useSearchParams()

  const [convs, setConvs] = useState<ConversacionResumen[]>([])
  const [usuarios, setUsuarios] = useState<Record<string, ChatUsuario>>({})
  const [presencia, setPresencia] = useState<Record<string, Estado>>({})
  const [sel, setSel] = useState<string | null>(null)
  const [busca, setBusca] = useState('')
  const [cargando, setCargando] = useState(true)

  const [modalNuevo, setModalNuevo] = useState<null | 'directo' | 'grupo' | 'depto'>(null)

  // --- Datos base ------------------------------------------------------
  const cargarConvs = useCallback(async () => {
    const { data } = await supabase.from('chat_mis_conversaciones').select('*').order('ultimo_mensaje_at', { ascending: false })
    setConvs((data as ConversacionResumen[]) ?? [])
  }, [])

  useEffect(() => {
    async function init() {
      const [{ data: us }] = await Promise.all([supabase.rpc('chat_usuarios')])
      const mapa: Record<string, ChatUsuario> = {}
      ;((us as ChatUsuario[]) ?? []).forEach((u) => { mapa[u.id] = u })
      if (perfil) mapa[perfil.id] = { id: perfil.id, nombre: perfil.nombre, username: perfil.username, rol_key: perfil.rol_key }
      setUsuarios(mapa)
      await cargarConvs()
      setCargando(false)
    }
    init()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [perfil?.id])

  // Abrir por enlace directo /chat?u=<usuario> o ?paciente=<id> o ?c=<conv>
  const abriendoRef = useRef(false)
  useEffect(() => {
    if (!miId || abriendoRef.current) return
    const c = params.get('c'); const u = params.get('u'); const pac = params.get('paciente')
    if (c) { setSel(c); setParams({}, { replace: true }); return }
    if (u) { abriendoRef.current = true; supabase.rpc('chat_abrir_directo', { p_otro: u }).then(({ data }) => { if (data) { setSel(data as string); cargarConvs() } setParams({}, { replace: true }); abriendoRef.current = false }) }
    else if (pac) { abriendoRef.current = true; supabase.rpc('chat_conversacion_paciente', { p_cliente: pac }).then(({ data }) => { if (data) { setSel(data as string); cargarConvs() } setParams({}, { replace: true }); abriendoRef.current = false }) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [miId, params])

  // Realtime: refrescar la lista cuando llega cualquier mensaje mío (RLS lo filtra).
  useEffect(() => {
    if (!miId) return
    const canal = supabase.channel('chat-lista')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_mensajes' }, () => cargarConvs())
      .subscribe()
    return () => { supabase.removeChannel(canal) }
  }, [miId, cargarConvs])

  // Presencia global (en línea / ausente / desconectado).
  useEffect(() => {
    if (!miId) return
    const canal = supabase.channel('presencia', { config: { presence: { key: miId } } })
    const sync = () => {
      const st = canal.presenceState() as Record<string, { estado?: Estado }[]>
      const p: Record<string, Estado> = {}
      for (const k in st) p[k] = (st[k][0]?.estado as Estado) ?? 'online'
      setPresencia(p)
    }
    canal.on('presence', { event: 'sync' }, sync)
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') await canal.track({ estado: document.hidden ? 'ausente' : 'online' })
      })
    const onVis = () => canal.track({ estado: document.hidden ? 'ausente' : 'online' })
    document.addEventListener('visibilitychange', onVis)
    return () => { document.removeEventListener('visibilitychange', onVis); supabase.removeChannel(canal) }
  }, [miId])

  // --- Derivados -------------------------------------------------------
  function estadoDe(id: string | null): Estado { return (id && presencia[id]) || 'desconectado' }

  function tituloConv(c: ConversacionResumen): string {
    if (c.tipo === 'directo') return c.otro_nombre || nombreUsuario(usuarios[c.otro_id ?? '']) || 'Chat'
    if (c.tipo === 'departamento') return nombreDepartamento(c.departamento)
    if (c.tipo === 'paciente') return `Caso: ${c.cliente_nombre ?? 'Paciente'}`
    return c.nombre || 'Grupo'
  }

  const convSel = useMemo(() => convs.find((c) => c.id === sel) ?? null, [convs, sel])
  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase()
    if (!q) return convs
    return convs.filter((c) => tituloConv(c).toLowerCase().includes(q))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [convs, busca, usuarios])

  async function abrirDirecto(otro: string) {
    const { data, error } = await supabase.rpc('chat_abrir_directo', { p_otro: otro })
    if (error) return alert(error.message)
    setModalNuevo(null); await cargarConvs(); setSel(data as string)
  }
  async function abrirDepto(dep: string, nombre: string) {
    const { data, error } = await supabase.rpc('chat_departamento', { p_dep: dep, p_nombre: nombre })
    if (error) return alert(error.message)
    setModalNuevo(null); await cargarConvs(); setSel(data as string)
  }

  const listaUsuarios = useMemo(() => Object.values(usuarios).filter((u) => u.id !== miId), [usuarios, miId])

  return (
    <div>
      <PageHeader title="Chat interno" subtitle="Comunicación del equipo en tiempo real" />

      <div className="flex h-[74vh] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {/* Barra lateral */}
        <div className={`${sel ? 'hidden md:flex' : 'flex'} w-full flex-col border-r border-slate-200 md:w-80`}>
          <div className="flex items-center gap-1.5 border-b border-slate-100 p-2.5">
            <div className="relative flex-1">
              <Search size={15} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar…" className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-8 pr-2 text-sm outline-none focus:border-amber-400" />
            </div>
            <button onClick={() => setModalNuevo('directo')} title="Chat nuevo" className="rounded-lg p-2 text-amber-700 hover:bg-amber-50"><MessageSquarePlus size={19} /></button>
            <button onClick={() => setModalNuevo('grupo')} title="Grupo nuevo" className="rounded-lg p-2 text-amber-700 hover:bg-amber-50"><Users size={19} /></button>
            <button onClick={() => setModalNuevo('depto')} title="Departamentos" className="rounded-lg p-2 text-amber-700 hover:bg-amber-50"><Building2 size={19} /></button>
          </div>

          <div className="flex-1 overflow-y-auto">
            {cargando ? (
              <p className="p-6 text-center text-sm text-slate-400">Cargando…</p>
            ) : filtradas.length === 0 ? (
              <div className="p-6 text-center text-sm text-slate-400">
                {busca ? 'Sin resultados.' : 'Aún no tienes conversaciones.'}
                {!busca && <div className="mt-3"><button onClick={() => setModalNuevo('directo')} className="btn-primary mx-auto">Iniciar un chat</button></div>}
              </div>
            ) : (
              filtradas.map((c) => {
                const titulo = tituloConv(c)
                const activo = c.id === sel
                const estado = c.tipo === 'directo' ? estadoDe(c.otro_id) : null
                return (
                  <button key={c.id} onClick={() => setSel(c.id)} className={`flex w-full items-center gap-2.5 border-b border-slate-50 px-3 py-2.5 text-left transition ${activo ? 'bg-amber-50' : 'hover:bg-slate-50'}`}>
                    <div className="relative shrink-0">
                      <div className="flex h-11 w-11 items-center justify-center rounded-full text-sm font-bold text-white" style={{ background: colorAvatar(c.tipo === 'directo' ? c.otro_id : c.id) }}>
                        {c.tipo === 'directo' ? inicialesChat(titulo) : <IconoTipo tipo={c.tipo} />}
                      </div>
                      {estado && <span className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full ring-2 ring-white ${estado === 'online' ? 'bg-emerald-500' : estado === 'ausente' ? 'bg-amber-400' : 'bg-slate-300'}`} />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1">
                        <p className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-800">{titulo}</p>
                        <span className="shrink-0 text-[10px] text-slate-400">{cuandoChat(c.ultimo_mensaje_at)}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <p className={`min-w-0 flex-1 truncate text-xs ${c.no_leidos > 0 ? 'font-semibold text-slate-700' : 'text-slate-400'}`}>
                          {c.ultimo?.autor_id === miId ? 'Tú: ' : ''}{vistaPrevia(c.ultimo)}
                        </p>
                        {c.no_leidos > 0 && <span className="shrink-0 rounded-full bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold text-white">{c.no_leidos}</span>}
                      </div>
                    </div>
                  </button>
                )
              })
            )}
          </div>
        </div>

        {/* Panel de conversación */}
        <div className={`${sel ? 'flex' : 'hidden md:flex'} min-w-0 flex-1 flex-col`}>
          {!convSel ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center text-slate-400">
              <MessageSquarePlus size={44} className="text-amber-200" />
              <p className="text-sm">Elige una conversación o inicia una nueva.</p>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2.5 border-b border-slate-200 px-3 py-2.5">
                <button onClick={() => setSel(null)} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 md:hidden"><ArrowLeft size={18} /></button>
                <div className="flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold text-white" style={{ background: colorAvatar(convSel.tipo === 'directo' ? convSel.otro_id : convSel.id) }}>
                  {convSel.tipo === 'directo' ? inicialesChat(tituloConv(convSel)) : <IconoTipo tipo={convSel.tipo} />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-slate-800">{tituloConv(convSel)}</p>
                  <p className="truncate text-[11px] text-slate-500">
                    {convSel.tipo === 'directo'
                      ? (estadoDe(convSel.otro_id) === 'online' ? 'En línea' : estadoDe(convSel.otro_id) === 'ausente' ? 'Ausente' : 'Desconectado')
                      : `${convSel.n_participantes} participantes`}
                  </p>
                </div>
              </div>
              <div className="flex-1 p-2 sm:p-3">
                <HiloMensajes conversacionId={convSel.id} miId={miId} usuarios={usuarios} onActividad={cargarConvs} alto="h-full" />
              </div>
            </>
          )}
        </div>
      </div>

      {/* Modales de nueva conversación */}
      <Modal open={modalNuevo === 'directo'} title="Nuevo chat" onClose={() => setModalNuevo(null)}>
        <ListaUsuarios usuarios={listaUsuarios} presencia={presencia} onElegir={abrirDirecto} />
      </Modal>

      <Modal open={modalNuevo === 'depto'} title="Chats por departamento" onClose={() => setModalNuevo(null)}>
        <p className="mb-3 text-sm text-slate-500">Se abre (o crea) el grupo del departamento con todo el personal activo.</p>
        <div className="grid grid-cols-2 gap-2">
          {DEPARTAMENTOS.map((d) => (
            <button key={d.key} onClick={() => abrirDepto(d.key, d.nombre)} className="flex items-center gap-2.5 rounded-xl border border-slate-200 p-3 text-left hover:border-amber-300 hover:bg-amber-50">
              <span className="text-xl">{d.emoji}</span>
              <span className="text-sm font-semibold text-slate-700">{d.nombre}</span>
            </button>
          ))}
        </div>
      </Modal>

      <ModalGrupo open={modalNuevo === 'grupo'} usuarios={listaUsuarios} onClose={() => setModalNuevo(null)}
        onCreado={async (id) => { setModalNuevo(null); await cargarConvs(); setSel(id) }} />
    </div>
  )
}

function IconoTipo({ tipo }: { tipo: string }) {
  if (tipo === 'grupo') return <Users size={18} />
  if (tipo === 'departamento') return <Hash size={18} />
  if (tipo === 'paciente') return <Stethoscope size={18} />
  return <UserRound size={18} />
}

function ListaUsuarios({ usuarios, presencia, onElegir }: { usuarios: ChatUsuario[]; presencia: Record<string, Estado>; onElegir: (id: string) => void }) {
  const [q, setQ] = useState('')
  const vis = usuarios.filter((u) => nombreUsuario(u).toLowerCase().includes(q.toLowerCase()))
  return (
    <div>
      <div className="relative mb-3">
        <Search size={15} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar persona…" className="w-full rounded-lg border border-slate-200 py-2 pl-8 pr-2 text-sm outline-none focus:border-amber-400" autoFocus />
      </div>
      <div className="max-h-80 space-y-1 overflow-y-auto">
        {vis.length === 0 && <p className="py-6 text-center text-sm text-slate-400">Sin usuarios.</p>}
        {vis.map((u) => {
          const est = presencia[u.id] || 'desconectado'
          return (
            <button key={u.id} onClick={() => onElegir(u.id)} className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-slate-50">
              <div className="relative">
                <div className="flex h-10 w-10 items-center justify-center rounded-full text-xs font-bold text-white" style={{ background: colorAvatar(u.id) }}>{inicialesChat(nombreUsuario(u))}</div>
                <span className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full ring-2 ring-white ${est === 'online' ? 'bg-emerald-500' : est === 'ausente' ? 'bg-amber-400' : 'bg-slate-300'}`} />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-800">{nombreUsuario(u)}</p>
                <p className="truncate text-xs text-slate-400">{u.rol_key ?? ''}{u.username ? ` · ${u.username}` : ''}</p>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function ModalGrupo({ open, usuarios, onClose, onCreado }: { open: boolean; usuarios: ChatUsuario[]; onClose: () => void; onCreado: (id: string) => void }) {
  const [nombre, setNombre] = useState('')
  const [sel, setSel] = useState<string[]>([])
  const [guardando, setGuardando] = useState(false)
  useEffect(() => { if (open) { setNombre(''); setSel([]) } }, [open])

  function toggle(id: string) { setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id])) }
  async function crear() {
    if (!nombre.trim()) return alert('Ponle un nombre al grupo.')
    setGuardando(true)
    const { data, error } = await supabase.rpc('chat_crear_grupo', { p_nombre: nombre, p_miembros: sel })
    setGuardando(false)
    if (error) return alert(error.message)
    onCreado(data as string)
  }
  return (
    <Modal open={open} title="Nuevo grupo" onClose={onClose}
      footer={<><button className="btn-ghost" onClick={onClose}>Cancelar</button><button className="btn-primary" onClick={crear} disabled={guardando}>{guardando ? 'Creando…' : 'Crear grupo'}</button></>}>
      <div className="space-y-3">
        <div>
          <label className="label">Nombre del grupo</label>
          <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej. Implante Juan Pérez" className="input" autoFocus />
        </div>
        <div>
          <label className="label">Participantes ({sel.length})</label>
          <div className="max-h-64 space-y-1 overflow-y-auto rounded-xl border border-slate-200 p-1.5">
            {usuarios.map((u) => (
              <label key={u.id} className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-slate-50">
                <input type="checkbox" checked={sel.includes(u.id)} onChange={() => toggle(u.id)} className="h-4 w-4 accent-amber-500" />
                <div className="flex h-8 w-8 items-center justify-center rounded-full text-[10px] font-bold text-white" style={{ background: colorAvatar(u.id) }}>{inicialesChat(nombreUsuario(u))}</div>
                <span className="text-sm text-slate-700">{nombreUsuario(u)}</span>
              </label>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  )
}
