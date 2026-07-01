import { useEffect, useState } from 'react'
import { Trash2, Save, User } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { Cliente, Servicio, MarcaOdontograma, EstadoDiente } from '../types'
import { codigoCliente } from '../lib/format'
import {
  ARCADA_PERMANENTE_SUP,
  ARCADA_PERMANENTE_INF,
  ARCADA_TEMPORAL_SUP,
  ARCADA_TEMPORAL_INF,
  ESTADOS_DIENTE,
  estadoDienteDef,
} from '../lib/dental'
import PageHeader from '../components/PageHeader'
import Cargando from '../components/Cargando'
import Modal from '../components/Modal'

type Denticion = 'permanente' | 'temporal'

// Caras clínicas tal como se guardan en la tabla `odontograma` (minúsculas),
// con su etiqueta visible en la UI. El orden fija las posiciones en la cruz.
type CaraValor = 'vestibular' | 'palatino' | 'mesial' | 'distal' | 'oclusal'
const CARAS: { valor: CaraValor; label: string }[] = [
  { valor: 'vestibular', label: 'Vestibular' },
  { valor: 'palatino', label: 'Palatino/Lingual' },
  { valor: 'mesial', label: 'Mesial' },
  { valor: 'distal', label: 'Distal' },
  { valor: 'oclusal', label: 'Oclusal/Incisal' },
]

function caraLabel(v: string | null): string {
  if (!v) return 'Pieza completa'
  return CARAS.find((c) => c.valor === v)?.label ?? v
}

// Objetivo de edición: pieza completa (cara null) o una cara concreta.
type Objetivo = { diente: number; cara: CaraValor | null }

const formVacio = {
  estado: 'sano' as EstadoDiente,
  tratamiento_id: '',
  notas: '',
}

export default function Odontograma() {
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [servicios, setServicios] = useState<Servicio[]>([])
  const [pacienteId, setPacienteId] = useState<string>('')
  const [marcas, setMarcas] = useState<MarcaOdontograma[]>([])
  const [denticion, setDenticion] = useState<Denticion>('permanente')
  const [loading, setLoading] = useState(true)
  const [cargandoMarcas, setCargandoMarcas] = useState(false)

  const [open, setOpen] = useState(false)
  const [objetivo, setObjetivo] = useState<Objetivo | null>(null)
  const [form, setForm] = useState(formVacio)
  const [saving, setSaving] = useState(false)

  const paciente = clientes.find((c) => c.id === pacienteId) ?? null

  async function cargarBase() {
    setLoading(true)
    const [{ data: cli, error: errCli }, { data: serv, error: errServ }] = await Promise.all([
      supabase.from('clientes').select('*').order('nombre'),
      supabase.from('servicios').select('*').eq('activo', true).order('nombre'),
    ])
    if (errCli) alert('Error al cargar pacientes: ' + errCli.message)
    if (errServ) alert('Error al cargar servicios: ' + errServ.message)
    setClientes(cli ?? [])
    setServicios(serv ?? [])
    setLoading(false)
  }

  async function cargarMarcas(pid: string) {
    if (!pid) {
      setMarcas([])
      return
    }
    setCargandoMarcas(true)
    const { data, error } = await supabase.from('odontograma').select('*').eq('cliente_id', pid)
    if (error) alert('Error al cargar el odontograma: ' + error.message)
    setMarcas(data ?? [])
    setCargandoMarcas(false)
  }

  useEffect(() => {
    cargarBase()
  }, [])

  useEffect(() => {
    cargarMarcas(pacienteId)
  }, [pacienteId])

  // Marca de pieza completa (cara === null) más reciente de un diente.
  function marcaPieza(diente: number): MarcaOdontograma | null {
    const piezas = marcas
      .filter((m) => m.diente === diente && m.cara == null)
      .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
    return piezas.length ? piezas[0] : null
  }

  // Marca de una cara concreta de un diente.
  function marcaCara(diente: number, cara: CaraValor): MarcaOdontograma | null {
    const caras = marcas
      .filter((m) => m.diente === diente && m.cara === cara)
      .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
    return caras.length ? caras[0] : null
  }

  function abrir(obj: Objetivo) {
    setObjetivo(obj)
    const existente = obj.cara ? marcaCara(obj.diente, obj.cara) : marcaPieza(obj.diente)
    setForm({
      estado: existente?.estado ?? 'sano',
      tratamiento_id: existente?.tratamiento_id ?? '',
      notas: existente?.notas ?? '',
    })
    setOpen(true)
  }

  async function guardar() {
    if (!objetivo) return
    setSaving(true)
    const base = {
      estado: form.estado,
      tratamiento_id: form.tratamiento_id || null,
      notas: form.notas || null,
    }

    if (objetivo.cara == null) {
      // PIEZA COMPLETA: reemplaza las marcas previas de pieza completa del diente.
      const { error: errDel } = await supabase
        .from('odontograma')
        .delete()
        .eq('cliente_id', pacienteId)
        .eq('diente', objetivo.diente)
        .is('cara', null)
      if (errDel) {
        setSaving(false)
        return alert('Error al actualizar la pieza: ' + errDel.message)
      }
      const { error } = await supabase.from('odontograma').insert({
        cliente_id: pacienteId,
        diente: objetivo.diente,
        cara: null,
        cita_id: null,
        ...base,
      })
      setSaving(false)
      if (error) return alert('Error al guardar: ' + error.message)
    } else {
      // CARA: si ya existe, UPDATE por id; si no, INSERT.
      const existente = marcaCara(objetivo.diente, objetivo.cara)
      if (existente) {
        const { error } = await supabase.from('odontograma').update(base).eq('id', existente.id)
        setSaving(false)
        if (error) return alert('Error al guardar: ' + error.message)
      } else {
        const { error } = await supabase.from('odontograma').insert({
          cliente_id: pacienteId,
          diente: objetivo.diente,
          cara: objetivo.cara,
          cita_id: null,
          ...base,
        })
        setSaving(false)
        if (error) return alert('Error al guardar: ' + error.message)
      }
    }
    setOpen(false)
    cargarMarcas(pacienteId)
  }

  async function eliminarMarca(m: MarcaOdontograma) {
    if (!confirm(`¿Eliminar la marca del diente ${m.diente}?`)) return
    const { error } = await supabase.from('odontograma').delete().eq('id', m.id)
    if (error) return alert('Error al eliminar: ' + error.message)
    cargarMarcas(pacienteId)
  }

  const arcadaSup = denticion === 'permanente' ? ARCADA_PERMANENTE_SUP : ARCADA_TEMPORAL_SUP
  const arcadaInf = denticion === 'permanente' ? ARCADA_PERMANENTE_INF : ARCADA_TEMPORAL_INF
  const mitad = denticion === 'permanente' ? 8 : 5

  // ---- Dibujo SVG de un diente (silueta simple) ----
  function DienteSVG({ n }: { n: number }) {
    const pieza = marcaPieza(n)
    const def = pieza ? estadoDienteDef(pieza.estado) : null
    const relleno = def ? def.color : '#ffffff'
    return (
      <button
        type="button"
        onClick={() => abrir({ diente: n, cara: null })}
        title={def ? `${def.label} — clic para pieza completa` : 'Pieza completa'}
        className="rounded-lg p-0.5 transition hover:ring-2 hover:ring-brand-300"
      >
        <svg width="34" height="40" viewBox="0 0 34 40" aria-hidden="true">
          {/* Corona + raíces (silueta simplificada de molar) */}
          <path
            d="M6 14 C6 6 12 3 17 3 C22 3 28 6 28 14 C28 20 26 23 24 25
               L23 36 C23 38 21 38 20 36 L18.5 27 C18 25 16 25 15.5 27 L14 36
               C13 38 11 38 11 36 L10 25 C8 23 6 20 6 14 Z"
            fill={relleno}
            stroke="#94a3b8"
            strokeWidth="1.2"
            strokeLinejoin="round"
          />
          {/* Ausente: X roja sobre la pieza */}
          {pieza?.estado === 'ausente' && (
            <g stroke="#dc2626" strokeWidth="2.4" strokeLinecap="round">
              <line x1="8" y1="7" x2="26" y2="33" />
              <line x1="26" y1="7" x2="8" y2="33" />
            </g>
          )}
          {/* Implante: tornillo central */}
          {pieza?.estado === 'implante' && (
            <g stroke="#0f766e" strokeWidth="1.6" strokeLinecap="round">
              <line x1="17" y1="10" x2="17" y2="34" />
              <line x1="12" y1="14" x2="22" y2="14" />
              <line x1="12" y1="19" x2="22" y2="19" />
              <line x1="13" y1="24" x2="21" y2="24" />
              <line x1="14" y1="29" x2="20" y2="29" />
            </g>
          )}
        </svg>
      </button>
    )
  }

  // ---- Cruz de 5 caras (diagrama dental clásico) ----
  function CruzCaras({ n }: { n: number }) {
    // Cuadrado de 34x34 con centro (5..29). Esquinas del cuadrado exterior.
    const zonas: { cara: CaraValor; label: string; forma: 'poly' | 'rect'; pts?: string; rect?: [number, number, number, number] }[] = [
      { cara: 'vestibular', label: 'Vestibular', forma: 'poly', pts: '0,0 34,0 22,12 12,12' }, // arriba
      { cara: 'palatino', label: 'Palatino/Lingual', forma: 'poly', pts: '12,22 22,22 34,34 0,34' }, // abajo
      { cara: 'mesial', label: 'Mesial', forma: 'poly', pts: '0,0 12,12 12,22 0,34' }, // izquierda
      { cara: 'distal', label: 'Distal', forma: 'poly', pts: '34,0 34,34 22,22 22,12' }, // derecha
      { cara: 'oclusal', label: 'Oclusal/Incisal', forma: 'rect', rect: [12, 12, 10, 10] }, // centro
    ]
    return (
      <svg width="34" height="34" viewBox="0 0 34 34">
        {zonas.map((z) => {
          const m = marcaCara(n, z.cara)
          const fill = m ? estadoDienteDef(m.estado).color : '#ffffff'
          const title = m ? `${z.label}: ${estadoDienteDef(m.estado).label}` : z.label
          const common = {
            fill,
            stroke: '#94a3b8',
            strokeWidth: 0.8,
            onClick: () => abrir({ diente: n, cara: z.cara }),
            style: { cursor: 'pointer' as const },
          }
          if (z.forma === 'rect' && z.rect) {
            const [x, y, w, h] = z.rect
            return (
              <rect key={z.cara} x={x} y={y} width={w} height={h} {...common}>
                <title>{title}</title>
              </rect>
            )
          }
          return (
            <polygon key={z.cara} points={z.pts} {...common}>
              <title>{title}</title>
            </polygon>
          )
        })}
      </svg>
    )
  }

  function Arcada({ dientes }: { dientes: number[] }) {
    return (
      <div className="flex items-end justify-center">
        {dientes.map((n, i) => (
          <div key={n} className="flex items-end">
            {i === mitad && <div className="mx-2 h-24 w-px self-center bg-slate-300" />}
            <div className="flex flex-col items-center gap-0.5 px-0.5">
              <DienteSVG n={n} />
              <span className="text-[10px] font-semibold text-slate-500">{n}</span>
              <CruzCaras n={n} />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (loading) return <Cargando />

  return (
    <div>
      <PageHeader title="Odontograma" subtitle="Mapa dental por paciente" />

      <div className="mb-6 max-w-md">
        <label className="label">Paciente</label>
        <select className="input" value={pacienteId} onChange={(e) => setPacienteId(e.target.value)}>
          <option value="">Selecciona un paciente…</option>
          {clientes.map((c) => (
            <option key={c.id} value={c.id}>
              {codigoCliente(c.codigo)} — {c.nombre}
            </option>
          ))}
        </select>
      </div>

      {!paciente ? (
        <div className="card flex flex-col items-center gap-3 py-12 text-center">
          <User className="text-brand-300" size={40} />
          <p className="text-slate-500">Elige un paciente para ver y editar su odontograma.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Toggle de dentición */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              className={denticion === 'permanente' ? 'btn-primary' : 'btn-ghost'}
              onClick={() => setDenticion('permanente')}
            >
              Permanente
            </button>
            <button
              type="button"
              className={denticion === 'temporal' ? 'btn-primary' : 'btn-ghost'}
              onClick={() => setDenticion('temporal')}
            >
              Temporal (niños)
            </button>
          </div>

          {/* Mapa dental */}
          <div className="card py-6">
            {cargandoMarcas ? (
              <Cargando texto="Cargando odontograma…" />
            ) : (
              <div className="overflow-x-auto">
                <div className="flex min-w-max flex-col items-center gap-6">
                  <div className="flex flex-col items-center gap-1">
                    <span className="text-xs uppercase tracking-wide text-slate-400">Arcada superior</span>
                    <Arcada dientes={arcadaSup} />
                  </div>
                  <div className="h-px w-full bg-slate-200" />
                  <div className="flex flex-col items-center gap-1">
                    <Arcada dientes={arcadaInf} />
                    <span className="text-xs uppercase tracking-wide text-slate-400">Arcada inferior</span>
                  </div>
                </div>
              </div>
            )}
            <p className="mt-4 text-center text-xs text-slate-400">
              Clic en el diente para la pieza completa · clic en una zona de la cruz para esa cara.
            </p>
          </div>

          {/* Leyenda */}
          <div className="flex flex-wrap gap-2">
            {ESTADOS_DIENTE.map((e) => (
              <span
                key={e.value}
                className="flex items-center gap-1.5 rounded-full border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600"
              >
                <span className="h-3 w-3 rounded-full border border-slate-300" style={{ backgroundColor: e.color }} />
                {e.label}
              </span>
            ))}
          </div>

          {/* Marcas registradas */}
          <div className="overflow-x-auto panel-3d">
            <table className="min-w-full divide-y divide-slate-100 text-sm">
              <thead className="thead-3d">
                <tr>
                  <th className="px-5 py-3 text-left">Diente</th>
                  <th className="px-5 py-3 text-left">Cara</th>
                  <th className="px-5 py-3 text-left">Estado</th>
                  <th className="px-5 py-3 text-left">Notas</th>
                  <th className="px-5 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {marcas.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-5 py-8 text-center text-slate-500">
                      Sin marcas registradas para este paciente.
                    </td>
                  </tr>
                ) : (
                  [...marcas]
                    .sort((a, b) => a.diente - b.diente)
                    .map((m) => {
                      const def = estadoDienteDef(m.estado)
                      return (
                        <tr key={m.id}>
                          <td className="px-5 py-3 font-mono font-semibold text-brand-700">{m.diente}</td>
                          <td className="px-5 py-3 text-slate-600">{caraLabel(m.cara)}</td>
                          <td className="px-5 py-3">
                            <span className="inline-flex items-center gap-1.5 text-slate-700">
                              <span
                                className="h-3 w-3 rounded-full border border-slate-300"
                                style={{ backgroundColor: def.color }}
                              />
                              {def.label}
                            </span>
                          </td>
                          <td className="px-5 py-3 text-slate-600">{m.notas || '—'}</td>
                          <td className="px-5 py-3">
                            <div className="flex justify-end">
                              <button
                                onClick={() => eliminarMarca(m)}
                                className="rounded-lg p-2 text-slate-600 hover:bg-rose-50 hover:text-rose-600"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal
        open={open}
        title={
          objetivo
            ? `Diente ${objetivo.diente} — ${objetivo.cara == null ? 'Pieza completa' : `Cara: ${caraLabel(objetivo.cara)}`}`
            : 'Diente'
        }
        onClose={() => setOpen(false)}
        footer={
          <>
            <button className="btn-ghost" onClick={() => setOpen(false)}>
              Cancelar
            </button>
            <button className="btn-primary" onClick={guardar} disabled={saving}>
              <Save size={16} /> {saving ? 'Guardando…' : 'Guardar'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="label">Estado</label>
            <select
              className="input"
              value={form.estado}
              onChange={(e) => setForm({ ...form, estado: e.target.value as EstadoDiente })}
            >
              {ESTADOS_DIENTE.map((e) => (
                <option key={e.value} value={e.value}>
                  {e.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Tratamiento (opcional)</label>
            <select
              className="input"
              value={form.tratamiento_id}
              onChange={(e) => setForm({ ...form, tratamiento_id: e.target.value })}
            >
              <option value="">Sin tratamiento asociado</option>
              {servicios.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nombre}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Notas</label>
            <textarea
              className="input"
              rows={2}
              value={form.notas}
              onChange={(e) => setForm({ ...form, notas: e.target.value })}
              placeholder="Observaciones clínicas…"
            />
          </div>
        </div>
      </Modal>
    </div>
  )
}
