import { useEffect, useState } from 'react'
import { ScanLine, Upload, Trash2, Plus, X, Sparkles, Check } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { Cliente, Radiografia, RadiografiaHallazgo } from '../types'
import { fechaCorta, hoyISO } from '../lib/format'
import {
  TIPOS_RADIOGRAFIA, TipoRadiografia, labelTipoRx,
  TIPOS_HALLAZGO, labelHallazgo, colorHallazgo, SEVERIDADES, colorSeveridad,
} from '../lib/radiografias'
import PageHeader from '../components/PageHeader'
import Cargando from '../components/Cargando'
import Modal from '../components/Modal'
import SelectorPaciente from '../components/SelectorPaciente'

const BUCKET = 'pacientes'

type RxConteo = Radiografia & { hallazgos?: { count: number }[] }

export default function Radiografias({ pacienteFijo }: { pacienteFijo?: string } = {}) {
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [pacienteId, setPacienteId] = useState<string>(pacienteFijo ?? '')

  const [radiografias, setRadiografias] = useState<RxConteo[]>([])
  const [urls, setUrls] = useState<Record<string, string>>({})
  const [cargando, setCargando] = useState(false)

  // Modal "Analizar radiografía" (subida)
  const [analizarOpen, setAnalizarOpen] = useState(false)
  const [tipo, setTipo] = useState<TipoRadiografia>('bitewing')
  const [tieneMetales, setTieneMetales] = useState(false)
  const [archivo, setArchivo] = useState<File | null>(null)
  const [subiendo, setSubiendo] = useState(false)

  // Visor + hallazgos
  const [verId, setVerId] = useState<string | null>(null)
  const [hallazgos, setHallazgos] = useState<RadiografiaHallazgo[]>([])
  const [nuevo, setNuevo] = useState({ diente: '', tipo: 'caries', severidad: 'moderada', nota: '' })
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)  // punto marcado sobre la placa
  const [notasRx, setNotasRx] = useState('')

  useEffect(() => {
    supabase.from('clientes').select('*').order('nombre').then(({ data }) => setClientes(data ?? []))
  }, [])
  useEffect(() => { if (pacienteFijo != null) setPacienteId(pacienteFijo) }, [pacienteFijo])

  async function cargar(pid: string) {
    setCargando(true)
    const { data } = await supabase
      .from('radiografias')
      .select('*, hallazgos:radiografia_hallazgos(count)')
      .eq('cliente_id', pid)
      .order('fecha', { ascending: false })
    const rows = (data as RxConteo[]) ?? []
    setRadiografias(rows)
    const mapa: Record<string, string> = {}
    await Promise.all(rows.map(async (r) => {
      const { data: firma } = await supabase.storage.from(BUCKET).createSignedUrl(r.path, 3600)
      if (firma?.signedUrl) mapa[r.id] = firma.signedUrl
    }))
    setUrls(mapa)
    setCargando(false)
  }

  useEffect(() => {
    if (!pacienteId) { setRadiografias([]); setUrls({}); return }
    cargar(pacienteId)
  }, [pacienteId])

  function abrirAnalizar() {
    setTipo('bitewing'); setTieneMetales(false); setArchivo(null)
    setAnalizarOpen(true)
  }

  async function subirRadiografia() {
    if (!pacienteId || !archivo) return
    setSubiendo(true)
    const path = `radiografias/${pacienteId}/${crypto.randomUUID()}-${archivo.name.replace(/\s+/g, '-')}`
    const { error: errUp } = await supabase.storage.from(BUCKET).upload(path, archivo)
    if (errUp) { setSubiendo(false); return alert('Error al subir: ' + errUp.message) }
    const { data, error } = await supabase.from('radiografias').insert({
      cliente_id: pacienteId, tipo, tiene_metales: tieneMetales, path, fecha: hoyISO(),
    }).select().single()
    setSubiendo(false)
    if (error || !data) {
      await supabase.storage.from(BUCKET).remove([path])
      return alert('Error al guardar la radiografía: ' + error?.message)
    }
    setAnalizarOpen(false)
    await cargar(pacienteId)
    abrirVisor(data as Radiografia)
  }

  async function abrirVisor(r: Radiografia) {
    setVerId(r.id)
    setNotasRx(r.notas ?? '')
    setNuevo({ diente: '', tipo: 'caries', severidad: 'moderada', nota: '' })
    setPos(null)
    const { data } = await supabase.from('radiografia_hallazgos').select('*').eq('radiografia_id', r.id).order('created_at')
    setHallazgos((data as RadiografiaHallazgo[]) ?? [])
  }

  async function agregarHallazgo() {
    if (!verId) return
    const { data, error } = await supabase.from('radiografia_hallazgos').insert({
      radiografia_id: verId,
      diente: nuevo.diente.trim() ? Number(nuevo.diente) : null,
      tipo: nuevo.tipo,
      severidad: nuevo.severidad || null,
      nota: nuevo.nota.trim() || null,
      origen: 'manual',
      pos_x: pos ? pos.x : null,
      pos_y: pos ? pos.y : null,
    }).select().single()
    if (error || !data) return alert('Error al agregar el hallazgo: ' + error?.message)
    setHallazgos((prev) => [...prev, data as RadiografiaHallazgo])
    setNuevo({ diente: '', tipo: nuevo.tipo, severidad: 'moderada', nota: '' })
    setPos(null)
    cargar(pacienteId)
  }

  async function eliminarHallazgo(id: string) {
    const { error } = await supabase.from('radiografia_hallazgos').delete().eq('id', id)
    if (error) return alert('Error al eliminar: ' + error.message)
    setHallazgos((prev) => prev.filter((h) => h.id !== id))
    cargar(pacienteId)
  }

  async function guardarNotas() {
    if (!verId) return
    await supabase.from('radiografias').update({ notas: notasRx || null }).eq('id', verId)
    cargar(pacienteId)
  }

  async function eliminarRadiografia(r: Radiografia) {
    if (!confirm('¿Eliminar esta radiografía y sus hallazgos?')) return
    await supabase.storage.from(BUCKET).remove([r.path])
    const { error } = await supabase.from('radiografias').delete().eq('id', r.id)
    if (error) return alert('Error al eliminar: ' + error.message)
    if (verId === r.id) setVerId(null)
    cargar(pacienteId)
  }

  const rxActual = radiografias.find((r) => r.id === verId)

  return (
    <div>
      {!pacienteFijo && (
        <>
          <PageHeader title="Radiografías / Análisis" subtitle="Sube la placa y marca los hallazgos" />
          <div className="card mb-6 max-w-md">
            <label className="label">Paciente</label>
            <SelectorPaciente clientes={clientes} value={pacienteId} onChange={setPacienteId} />
          </div>
        </>
      )}

      {!pacienteId ? (
        <div className="card flex flex-col items-center gap-3 py-12 text-center">
          <ScanLine className="text-brand-300" size={40} />
          <p className="text-slate-500">Selecciona un paciente para ver y analizar sus radiografías.</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-700">{radiografias.length} radiografía(s)</h3>
            <button className="btn-primary" onClick={abrirAnalizar}>
              <ScanLine size={16} /> Analizar radiografía
            </button>
          </div>

          {cargando ? (
            <Cargando />
          ) : radiografias.length === 0 ? (
            <div className="card flex flex-col items-center gap-3 py-12 text-center">
              <ScanLine className="text-brand-300" size={40} />
              <p className="text-slate-500">Aún no hay radiografías. Toca “Analizar radiografía”.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {radiografias.map((r) => {
                const n = r.hallazgos?.[0]?.count ?? 0
                return (
                  <div key={r.id} className="card flex flex-col gap-2">
                    <button onClick={() => abrirVisor(r)} className="flex aspect-video items-center justify-center overflow-hidden rounded-xl bg-slate-900/90 ring-1 ring-slate-200">
                      {urls[r.id] ? <img src={urls[r.id]} alt="Radiografía" className="h-full w-full object-contain" /> : <ScanLine className="text-slate-500" size={30} />}
                    </button>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <span className="badge bg-brand-50 text-brand-700">{labelTipoRx(r.tipo)}</span>
                        <p className="mt-1 text-xs text-slate-500">{fechaCorta(r.fecha)}</p>
                        <p className="mt-0.5 text-xs font-medium text-slate-600">{n} hallazgo(s){r.tiene_metales ? ' · con metales' : ''}</p>
                      </div>
                      <button onClick={() => eliminarRadiografia(r)} className="rounded-lg p-2 text-slate-600 hover:bg-rose-50 hover:text-rose-600" title="Eliminar">
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* MODAL: Analizar radiografía (subida) */}
      <Modal
        open={analizarOpen}
        title="Analizar radiografía"
        onClose={() => setAnalizarOpen(false)}
        footer={
          <>
            <button className="btn-ghost" onClick={() => setAnalizarOpen(false)}>Cancelar</button>
            <button className="btn-primary" onClick={subirRadiografia} disabled={subiendo || !archivo}>
              <Sparkles size={16} /> {subiendo ? 'Subiendo…' : 'Analizar'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <p className="text-sm font-semibold text-slate-800">¿Qué tipo de radiografía vas a analizar?</p>
            <p className="mt-0.5 text-xs text-slate-500">Elige bien el tipo para asegurar un buen análisis.</p>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {TIPOS_RADIOGRAFIA.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => setTipo(t.value)}
                className={`rounded-xl border-2 p-3 text-center transition ${tipo === t.value ? 'border-brand-400 bg-brand-50' : 'border-slate-200 hover:bg-slate-50'}`}
              >
                <div className="text-2xl">{t.icon}</div>
                <div className="mt-1 text-xs font-bold text-slate-800">{t.label}</div>
                <div className="text-[10px] text-slate-500">{t.desc}</div>
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setTieneMetales((v) => !v)}
            className="flex w-full items-center gap-3 rounded-xl border border-slate-200 px-3 py-2.5 text-left"
          >
            <span className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition ${tieneMetales ? 'bg-brand-500' : 'bg-slate-300'}`}>
              <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${tieneMetales ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </span>
            <span className="text-sm text-slate-700">El paciente tiene restauraciones y/o aparatos metálicos</span>
          </button>

          <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50/60 px-4 py-8 text-center hover:bg-slate-50">
            <Upload className="text-brand-400" size={28} />
            <span className="text-sm font-semibold text-slate-700">{archivo ? archivo.name : 'Subir radiografía'}</span>
            <span className="text-xs text-slate-500">Haz clic para seleccionar. Formatos .jpg, .png, .tiff (máx. 5 MB).</span>
            <input type="file" accept="image/*" className="hidden" onChange={(e) => setArchivo(e.target.files?.[0] ?? null)} />
          </label>

          <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
            El análisis automático con IA se activará más adelante. Por ahora subes la placa y marcas los hallazgos a mano.
          </p>
        </div>
      </Modal>

      {/* VISOR + HALLAZGOS */}
      <Modal
        open={!!verId}
        title={rxActual ? `Radiografía · ${labelTipoRx(rxActual.tipo)} · ${fechaCorta(rxActual.fecha)}` : 'Radiografía'}
        onClose={() => setVerId(null)}
      >
        {rxActual && (
          <div className="space-y-4">
            <div className="flex justify-center overflow-hidden rounded-xl bg-slate-900 p-2 ring-1 ring-slate-200">
              {urls[rxActual.id] ? (
                <div className="relative">
                  <img
                    src={urls[rxActual.id]}
                    alt="Radiografía"
                    className="block max-h-[52vh] w-auto max-w-full cursor-crosshair select-none"
                    onClick={(e) => {
                      const r = e.currentTarget.getBoundingClientRect()
                      setPos({
                        x: Math.round(((e.clientX - r.left) / r.width) * 1000) / 10,
                        y: Math.round(((e.clientY - r.top) / r.height) * 1000) / 10,
                      })
                    }}
                  />
                  {/* Marcas de hallazgos ya guardados */}
                  {hallazgos.filter((h) => h.pos_x != null && h.pos_y != null).map((h) => (
                    <span
                      key={h.id}
                      title={`${labelHallazgo(h.tipo)}${h.diente != null ? ' · diente ' + h.diente : ''}`}
                      style={{ left: `${h.pos_x}%`, top: `${h.pos_y}%` }}
                      className={`absolute z-10 -translate-x-1/2 -translate-y-1/2 cursor-help rounded-full border border-white/80 px-1.5 py-0.5 text-[10px] font-bold shadow ${colorHallazgo(h.tipo)}`}
                    >
                      {h.diente ?? '•'}
                    </span>
                  ))}
                  {/* Punto que se está por marcar */}
                  {pos && (
                    <span style={{ left: `${pos.x}%`, top: `${pos.y}%` }} className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-1/2">
                      <span className="block h-4 w-4 animate-ping rounded-full bg-amber-400/80" />
                      <span className="absolute inset-0 m-auto h-2 w-2 rounded-full bg-amber-500 ring-2 ring-white" />
                    </span>
                  )}
                </div>
              ) : (
                <div className="flex h-48 w-full items-center justify-center text-slate-400"><ScanLine size={40} /></div>
              )}
            </div>
            <p className="text-center text-xs text-slate-500">Toca un diente en la placa para ubicar el hallazgo, luego complétalo abajo.</p>

            {/* Botón IA (reservado) */}
            <button type="button" disabled title="Se activará al conectar el proveedor de IA" className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-indigo-200 bg-indigo-50/50 px-3 py-2 text-sm font-semibold text-indigo-400">
              <Sparkles size={16} /> Analizar con IA (próximamente)
            </button>

            {/* Hallazgos */}
            <div>
              <p className="mb-2 text-sm font-semibold text-slate-800">Hallazgos ({hallazgos.length})</p>
              {hallazgos.length === 0 ? (
                <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50/60 px-3 py-4 text-center text-sm text-slate-500">Aún no hay hallazgos. Agrégalos abajo.</p>
              ) : (
                <div className="space-y-1.5">
                  {hallazgos.map((h) => (
                    <div key={h.id} className="flex items-center gap-2 rounded-lg border border-slate-100 bg-white px-3 py-2 text-sm">
                      <span className={`badge ${colorHallazgo(h.tipo)}`}>{labelHallazgo(h.tipo)}</span>
                      {h.diente != null && <span className="font-mono text-xs font-semibold text-slate-600">Diente {h.diente}</span>}
                      {h.severidad && <span className={`badge ${colorSeveridad(h.severidad)}`}>{h.severidad}</span>}
                      {h.pos_x != null && <span title="Marcado en la placa" className="text-xs text-emerald-600">📍</span>}
                      {h.nota && <span className="truncate text-slate-600">{h.nota}</span>}
                      <button onClick={() => eliminarHallazgo(h.id)} className="ml-auto rounded-lg p-1.5 text-slate-500 hover:bg-rose-50 hover:text-rose-600"><X size={15} /></button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Agregar hallazgo */}
            <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Agregar hallazgo</p>
                {pos ? (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600">
                    Ubicado en la placa ✓
                    <button onClick={() => setPos(null)} className="text-slate-400 hover:text-rose-600">(quitar)</button>
                  </span>
                ) : (
                  <span className="text-xs text-slate-400">Sin ubicar (toca la placa)</span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <div className="col-span-2">
                  <span className="text-xs text-slate-600">Tipo</span>
                  <select className="input" value={nuevo.tipo} onChange={(e) => setNuevo({ ...nuevo, tipo: e.target.value })}>
                    {TIPOS_HALLAZGO.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div>
                  <span className="text-xs text-slate-600">Diente (FDI)</span>
                  <input type="number" className="input" value={nuevo.diente} onChange={(e) => setNuevo({ ...nuevo, diente: e.target.value })} placeholder="Ej. 26" />
                </div>
                <div>
                  <span className="text-xs text-slate-600">Severidad</span>
                  <select className="input" value={nuevo.severidad} onChange={(e) => setNuevo({ ...nuevo, severidad: e.target.value })}>
                    {SEVERIDADES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>
              </div>
              <div className="mt-2">
                <input className="input" value={nuevo.nota} onChange={(e) => setNuevo({ ...nuevo, nota: e.target.value })} placeholder="Nota (opcional)" />
              </div>
              <div className="mt-2 flex justify-end">
                <button className="btn-primary" onClick={agregarHallazgo}><Plus size={16} /> Agregar</button>
              </div>
            </div>

            {/* Notas de la radiografía */}
            <div>
              <label className="label">Notas de la radiografía</label>
              <textarea className="input" rows={2} value={notasRx} onChange={(e) => setNotasRx(e.target.value)} onBlur={guardarNotas} placeholder="Impresión diagnóstica general…" />
              <p className="mt-1 flex items-center gap-1 text-xs text-slate-400"><Check size={12} /> Se guarda al salir del campo.</p>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
