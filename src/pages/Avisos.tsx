import { useEffect, useState } from 'react'
import { Plus, Pin, PinOff, Pencil, Trash2, Megaphone, EyeOff, Eye } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { fechaCorta, hoyISO } from '../lib/format'
import { Aviso, NivelAviso, NIVELES_AVISO, avisoVigente, ordenarAvisos } from '../lib/avisos'
import PageHeader from '../components/PageHeader'
import Cargando from '../components/Cargando'
import Modal from '../components/Modal'

export default function Avisos() {
  const { perfil } = useAuth()
  const admin = !!perfil?.es_admin
  const [items, setItems] = useState<Aviso[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [editando, setEditando] = useState<Aviso | null>(null)
  const [form, setForm] = useState<{ titulo: string; cuerpo: string; nivel: NivelAviso; fijado: boolean; expira: string }>({ titulo: '', cuerpo: '', nivel: 'info', fijado: false, expira: '' })
  const [saving, setSaving] = useState(false)
  const hoy = hoyISO()

  async function cargar() {
    const { data } = await supabase.from('avisos').select('*').order('created_at', { ascending: false })
    setItems((data as Aviso[]) ?? [])
    setLoading(false)
  }
  useEffect(() => {
    cargar()
    const canal = supabase.channel('avisos-page')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'avisos' }, () => cargar())
      .subscribe()
    return () => { supabase.removeChannel(canal) }
  }, [])

  function nuevo() { setEditando(null); setForm({ titulo: '', cuerpo: '', nivel: 'info', fijado: false, expira: '' }); setOpen(true) }
  function editar(a: Aviso) { setEditando(a); setForm({ titulo: a.titulo, cuerpo: a.cuerpo ?? '', nivel: a.nivel, fijado: a.fijado, expira: a.expira ?? '' }); setOpen(true) }

  async function guardar() {
    if (!form.titulo.trim()) return alert('Escribe el título del aviso.')
    setSaving(true)
    const payload = { titulo: form.titulo.trim(), cuerpo: form.cuerpo.trim() || null, nivel: form.nivel, fijado: form.fijado, expira: form.expira || null }
    const { error } = editando
      ? await supabase.from('avisos').update(payload).eq('id', editando.id)
      : await supabase.from('avisos').insert({ ...payload, creado_por: perfil?.id })
    setSaving(false)
    if (error) return alert('No se pudo guardar: ' + error.message)
    setOpen(false); cargar()
  }
  async function togglePin(a: Aviso) { await supabase.from('avisos').update({ fijado: !a.fijado }).eq('id', a.id) }
  async function toggleActivo(a: Aviso) { await supabase.from('avisos').update({ activo: !a.activo }).eq('id', a.id) }
  async function eliminar(a: Aviso) { if (confirm('¿Eliminar este aviso?')) await supabase.from('avisos').delete().eq('id', a.id) }

  const ordenados = [...items].sort(ordenarAvisos)

  return (
    <div>
      <PageHeader
        title="Avisos institucionales"
        subtitle={admin ? 'Publica anuncios para todo el equipo' : 'Anuncios de la clínica'}
        action={admin ? <button className="btn-primary" onClick={nuevo}><Plus size={16} /> Nuevo aviso</button> : undefined}
      />

      {loading ? (
        <Cargando />
      ) : ordenados.length === 0 ? (
        <div className="card flex flex-col items-center gap-3 py-12 text-center">
          <Megaphone className="text-brand-300" size={40} />
          <p className="text-slate-500">No hay avisos publicados.</p>
          {admin && <button className="btn-primary" onClick={nuevo}><Plus size={16} /> Publicar el primero</button>}
        </div>
      ) : (
        <div className="space-y-3">
          {ordenados.map((a) => {
            const n = NIVELES_AVISO[a.nivel]
            const vigente = avisoVigente(a, hoy)
            return (
              <div key={a.id} className={`rounded-2xl border px-5 py-4 ${n.card} ${!vigente ? 'opacity-60' : ''}`}>
                <div className="flex items-start gap-3">
                  <span className="text-xl">{n.emoji}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-bold text-slate-800">{a.fijado && '📌 '}{a.titulo}</p>
                      <span className={`badge ${n.badge}`}>{n.label}</span>
                      {!a.activo && <span className="badge bg-slate-200 text-slate-600">Archivado</span>}
                      {a.expira && <span className={`text-[11px] ${!vigente ? 'text-rose-600' : 'text-slate-400'}`}>· vence {fechaCorta(a.expira)}</span>}
                    </div>
                    {a.cuerpo && <p className="mt-1 whitespace-pre-wrap text-sm text-slate-600">{a.cuerpo}</p>}
                    <p className="mt-1 text-[11px] text-slate-400">Publicado {fechaCorta(a.created_at)}</p>
                  </div>
                  {admin && (
                    <div className="flex shrink-0 items-center gap-1">
                      <button onClick={() => togglePin(a)} title={a.fijado ? 'Desfijar' : 'Fijar arriba'} className="rounded-lg p-1.5 text-slate-500 hover:bg-white/70">{a.fijado ? <PinOff size={15} /> : <Pin size={15} />}</button>
                      <button onClick={() => toggleActivo(a)} title={a.activo ? 'Archivar' : 'Reactivar'} className="rounded-lg p-1.5 text-slate-500 hover:bg-white/70">{a.activo ? <EyeOff size={15} /> : <Eye size={15} />}</button>
                      <button onClick={() => editar(a)} title="Editar" className="rounded-lg p-1.5 text-slate-500 hover:bg-white/70"><Pencil size={15} /></button>
                      <button onClick={() => eliminar(a)} title="Eliminar" className="rounded-lg p-1.5 text-slate-500 hover:bg-rose-50 hover:text-rose-600"><Trash2 size={15} /></button>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <Modal open={open} title={editando ? 'Editar aviso' : 'Nuevo aviso'} onClose={() => setOpen(false)}
        footer={<><button className="btn-ghost" onClick={() => setOpen(false)}>Cancelar</button><button className="btn-primary" onClick={guardar} disabled={saving}>{saving ? 'Guardando…' : editando ? 'Guardar' : 'Publicar'}</button></>}>
        <div className="space-y-4">
          <div>
            <label className="label">Título</label>
            <input className="input" value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} placeholder="Ej. Reunión de personal el viernes" autoFocus />
          </div>
          <div>
            <label className="label">Mensaje</label>
            <textarea className="input min-h-[90px]" value={form.cuerpo} onChange={(e) => setForm({ ...form, cuerpo: e.target.value })} placeholder="Detalle del anuncio…" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Nivel</label>
              <div className="flex gap-2">
                {(Object.keys(NIVELES_AVISO) as NivelAviso[]).map((k) => (
                  <button key={k} type="button" onClick={() => setForm({ ...form, nivel: k })}
                    className={`flex-1 rounded-xl border-2 px-2 py-2 text-xs font-semibold transition ${form.nivel === k ? 'border-brand-400 bg-brand-50 text-brand-700' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}>
                    {NIVELES_AVISO[k].emoji} {NIVELES_AVISO[k].label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="label">Vence (opcional)</label>
              <input type="date" className="input" value={form.expira} onChange={(e) => setForm({ ...form, expira: e.target.value })} />
            </div>
          </div>
          <label className="flex cursor-pointer items-center gap-2.5">
            <input type="checkbox" checked={form.fijado} onChange={(e) => setForm({ ...form, fijado: e.target.checked })} className="h-4 w-4 accent-amber-500" />
            <span className="text-sm text-slate-700">📌 Fijar arriba (destacado)</span>
          </label>
        </div>
      </Modal>
    </div>
  )
}
