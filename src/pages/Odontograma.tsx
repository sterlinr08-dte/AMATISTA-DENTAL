import { useEffect, useState } from 'react'
import { Trash2, Save, User, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { Cliente, Servicio, MarcaOdontograma, EstadoDiente, CondicionMarca } from '../types'
import {
  ARCADA_PERMANENTE_SUP,
  ARCADA_PERMANENTE_INF,
  ARCADA_TEMPORAL_SUP,
  ARCADA_TEMPORAL_INF,
  ESTADOS_DIENTE,
  estadoDienteDef,
  CLASES_BLACK,
  claseBlackDef,
  colorMarca,
  condicionPorDefecto,
  condicionEditable,
  condicionLabel,
  COLOR_POR_HACER,
  COLOR_REALIZADO,
} from '../lib/dental'
import PageHeader from '../components/PageHeader'
import Cargando from '../components/Cargando'
import DienteSVG from '../components/DienteSVG'
import SelectorPaciente from '../components/SelectorPaciente'

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
  condicion: '' as CondicionMarca | '',
  clase_black: '',
  tratamiento_id: '',
  notas: '',
}

export default function Odontograma({ pacienteFijo }: { pacienteFijo?: string } = {}) {
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [servicios, setServicios] = useState<Servicio[]>([])
  const [pacienteId, setPacienteId] = useState<string>(pacienteFijo ?? '')
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
    if (pacienteFijo != null) setPacienteId(pacienteFijo)
  }, [pacienteFijo])

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
    const estadoIni = existente?.estado ?? 'sano'
    setForm({
      estado: estadoIni,
      condicion: existente?.condicion ?? condicionPorDefecto(estadoIni) ?? '',
      clase_black: existente?.clase_black != null ? String(existente.clase_black) : '',
      tratamiento_id: existente?.tratamiento_id ?? '',
      notas: existente?.notas ?? '',
    })
    setOpen(true)
  }

  // Al cambiar el estado, ajusta la condición por defecto (rojo/azul) de ese estado.
  function cambiarEstado(estado: EstadoDiente) {
    setForm((f) => ({ ...f, estado, condicion: condicionPorDefecto(estado) ?? '' }))
  }

  async function guardar() {
    if (!objetivo) return
    setSaving(true)
    const base = {
      estado: form.estado,
      condicion: form.condicion || condicionPorDefecto(form.estado),
      clase_black: form.clase_black ? Number(form.clase_black) : null,
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

  // ---- Diente clicable (usa el SVG anatómico realista) ----
  function DienteBoton({ n, arriba }: { n: number; arriba: boolean }) {
    const pieza = marcaPieza(n)
    const def = pieza ? estadoDienteDef(pieza.estado) : null
    const titulo = pieza && def
      ? `${def.label} · ${condicionLabel(pieza.condicion)} — clic para pieza completa`
      : 'Pieza completa'
    return (
      <button
        type="button"
        onClick={() => abrir({ diente: n, cara: null })}
        title={titulo}
        className="rounded-lg p-0.5 transition hover:ring-2 hover:ring-brand-300"
      >
        <DienteSVG
          fdi={n}
          arriba={arriba}
          colorPieza={pieza ? colorMarca(pieza.estado, pieza.condicion) : undefined}
          estado={pieza?.estado}
          sigla={def && def.grupo !== 'sano' && def.grupo !== 'ausente' ? def.sigla : undefined}
          size={34}
        />
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
          const fill = m ? (colorMarca(m.estado, m.condicion) ?? '#ffffff') : '#ffffff'
          const title = m
            ? `${z.label}: ${estadoDienteDef(m.estado).label} (${condicionLabel(m.condicion)})`
            : z.label
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

  function Arcada({ dientes, arriba }: { dientes: number[]; arriba: boolean }) {
    return (
      <div className="flex items-end justify-center">
        {dientes.map((n, i) => (
          <div key={n} className="flex items-end">
            {i === mitad && <div className="mx-2 h-24 w-px self-center bg-slate-300" />}
            <div className="flex flex-col items-center gap-0.5 px-0.5">
              <DienteBoton n={n} arriba={arriba} />
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
      {!pacienteFijo && (
        <>
          <PageHeader title="Odontograma" subtitle="Mapa dental por paciente" />
          <div className="mb-6 max-w-md">
            <label className="label">Paciente</label>
            <SelectorPaciente clientes={clientes} value={pacienteId} onChange={setPacienteId} />
          </div>
        </>
      )}

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
                    <Arcada dientes={arcadaSup} arriba={true} />
                  </div>
                  <div className="h-px w-full bg-slate-200" />
                  <div className="flex flex-col items-center gap-1">
                    <Arcada dientes={arcadaInf} arriba={false} />
                    <span className="text-xs uppercase tracking-wide text-slate-400">Arcada inferior</span>
                  </div>
                </div>
              </div>
            )}
            <p className="mt-4 text-center text-xs text-slate-400">
              Clic en el diente para la pieza completa · clic en una zona de la cruz para esa cara.
            </p>
          </div>

          {/* Regla de color: rojo = por hacer, azul = realizado */}
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-2.5 text-sm">
            <span className="flex items-center gap-1.5 font-semibold" style={{ color: COLOR_POR_HACER }}>
              <span className="h-3 w-3 rounded-full" style={{ backgroundColor: COLOR_POR_HACER }} />
              Rojo = por hacer (requerido)
            </span>
            <span className="flex items-center gap-1.5 font-semibold" style={{ color: COLOR_REALIZADO }}>
              <span className="h-3 w-3 rounded-full" style={{ backgroundColor: COLOR_REALIZADO }} />
              Azul = realizado (hecho)
            </span>
            <span className="text-xs text-slate-500">· Cada hallazgo lleva su signo (sigla) sobre el diente.</span>
          </div>

          {/* Leyenda de signos (estados) */}
          <div className="flex flex-wrap gap-2">
            {ESTADOS_DIENTE.filter((e) => e.grupo !== 'sano').map((e) => (
              <span
                key={e.value}
                className="flex items-center gap-1.5 rounded-full border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600"
              >
                <span
                  className="flex h-4 min-w-4 items-center justify-center rounded px-0.5 text-[10px] font-bold text-white"
                  style={{ backgroundColor: e.color }}
                >
                  {e.sigla || '•'}
                </span>
                {e.label}
              </span>
            ))}
          </div>

          {/* Referencia: Clasificación de Black */}
          <div className="card">
            <h3 className="mb-3 text-sm font-semibold text-amber-800">Clasificación de Black</h3>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {CLASES_BLACK.map((c) => (
                <div key={c.value} className="flex gap-2 rounded-lg border border-amber-100 bg-amber-50/40 p-2.5">
                  <span className="flex h-6 w-9 shrink-0 items-center justify-center rounded-md bg-amber-100 text-xs font-bold text-amber-800">
                    {c.romano}
                  </span>
                  <p className="text-xs leading-snug text-slate-600">{c.descripcion}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Marcas registradas */}
          <div className="overflow-x-auto panel-3d">
            <table className="min-w-full divide-y divide-slate-100 text-sm">
              <thead className="thead-3d">
                <tr>
                  <th className="px-5 py-3 text-left">Diente</th>
                  <th className="px-5 py-3 text-left">Cara</th>
                  <th className="px-5 py-3 text-left">Estado</th>
                  <th className="px-5 py-3 text-left">Condición</th>
                  <th className="px-5 py-3 text-left">Clase (Black)</th>
                  <th className="px-5 py-3 text-left">Notas</th>
                  <th className="px-5 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {marcas.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-8 text-center text-slate-500">
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
                                className="flex h-4 min-w-4 items-center justify-center rounded px-0.5 text-[10px] font-bold text-white"
                                style={{ backgroundColor: colorMarca(m.estado, m.condicion) ?? '#cbd5e1' }}
                              >
                                {def.sigla || '•'}
                              </span>
                              {def.label}
                            </span>
                          </td>
                          <td className="px-5 py-3">
                            {def.grupo === 'sano' || def.grupo === 'ausente' ? (
                              <span className="text-slate-400">—</span>
                            ) : (
                              <span
                                className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold text-white"
                                style={{ backgroundColor: colorMarca(m.estado, m.condicion) }}
                              >
                                {condicionLabel(m.condicion ?? condicionPorDefecto(m.estado))}
                              </span>
                            )}
                          </td>
                          <td className="px-5 py-3">
                            {claseBlackDef(m.clase_black) ? (
                              <span
                                className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800"
                                title={claseBlackDef(m.clase_black)!.descripcion}
                              >
                                {claseBlackDef(m.clase_black)!.label}
                              </span>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
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

      {/* Panel lateral deslizante (en vez de ventana flotante) */}
      {open && (
        <div className="fixed inset-0 z-30 bg-slate-900/20 lg:hidden" onClick={() => setOpen(false)} />
      )}
      <aside
        className={`fixed inset-y-0 right-0 z-40 flex w-full max-w-sm transform flex-col border-l border-amber-100 bg-white shadow-[-12px_0_40px_-16px_rgba(201,162,39,0.35)] transition-transform duration-300 ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
        aria-hidden={!open}
      >
        {objetivo && (
          <>
            <header className="flex items-center justify-between border-b border-amber-100 px-5 py-4">
              <div>
                <h3 className="text-base font-semibold text-amber-800">Diente {objetivo.diente}</h3>
                <p className="text-xs text-slate-500">
                  {objetivo.cara == null ? 'Pieza completa' : `Cara: ${caraLabel(objetivo.cara)}`}
                </p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="rounded-lg p-1.5 text-slate-500 hover:bg-amber-50 hover:text-amber-700"
                aria-label="Cerrar"
              >
                <X size={20} />
              </button>
            </header>

            <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
              {/* Vista previa del diente elegido (en vivo según el estado) */}
              {(() => {
                const arribaSel = arcadaSup.includes(objetivo.diente)
                const defSel = estadoDienteDef(form.estado)
                const conSigno = defSel.grupo !== 'sano' && defSel.grupo !== 'ausente'
                const colorSel = colorMarca(form.estado, form.condicion || null)
                return (
                  <div className="flex flex-col items-center rounded-2xl border border-amber-100 bg-amber-50/40 py-4">
                    <DienteSVG
                      fdi={objetivo.diente}
                      arriba={arribaSel}
                      colorPieza={colorSel}
                      estado={form.estado}
                      sigla={conSigno ? defSel.sigla : undefined}
                      size={74}
                    />
                    <p className="mt-2 text-sm font-semibold text-slate-700">{defSel.label}</p>
                    {conSigno && (
                      <span
                        className="mt-1 rounded-full px-2.5 py-0.5 text-xs font-semibold text-white"
                        style={{ backgroundColor: colorSel }}
                      >
                        {condicionLabel(form.condicion || condicionPorDefecto(form.estado))}
                      </span>
                    )}
                  </div>
                )
              })()}

              <div>
                <label className="label">Estado / hallazgo</label>
            <select
              className="input"
              value={form.estado}
              onChange={(e) => cambiarEstado(e.target.value as EstadoDiente)}
            >
              {ESTADOS_DIENTE.map((e) => (
                <option key={e.value} value={e.value}>
                  {e.sigla ? `${e.sigla} · ${e.label}` : e.label}
                </option>
              ))}
            </select>
          </div>

          {/* Condición: rojo (por hacer) / azul (realizado) */}
          {estadoDienteDef(form.estado).grupo !== 'sano' && estadoDienteDef(form.estado).grupo !== 'ausente' && (
            <div>
              <label className="label">Condición</label>
              {condicionEditable(form.estado) ? (
                <div className="grid grid-cols-2 gap-2">
                  {(['por_hacer', 'realizado'] as CondicionMarca[]).map((c) => {
                    const activo = (form.condicion || condicionPorDefecto(form.estado)) === c
                    const color = c === 'por_hacer' ? COLOR_POR_HACER : COLOR_REALIZADO
                    return (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setForm({ ...form, condicion: c })}
                        className={`flex items-center justify-center gap-2 rounded-lg border-2 px-3 py-2 text-sm font-semibold transition ${
                          activo ? 'text-white' : 'bg-white text-slate-600'
                        }`}
                        style={activo ? { backgroundColor: color, borderColor: color } : { borderColor: '#e2e8f0' }}
                      >
                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: activo ? '#fff' : color }} />
                        {condicionLabel(c)}
                      </button>
                    )
                  })}
                </div>
              ) : (
                <div
                  className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-white"
                  style={{ backgroundColor: COLOR_POR_HACER }}
                >
                  <span className="h-2.5 w-2.5 rounded-full bg-white" />
                  Por hacer (hallazgo a tratar)
                </div>
              )}
            </div>
          )}

          <div>
            <label className="label">Clasificación de Black (opcional)</label>
            <select
              className="input"
              value={form.clase_black}
              onChange={(e) => setForm({ ...form, clase_black: e.target.value })}
            >
              <option value="">Sin clasificar</option>
              {CLASES_BLACK.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
            {form.clase_black && (
              <p className="mt-1.5 text-xs text-slate-500">
                {claseBlackDef(Number(form.clase_black))?.descripcion}
              </p>
            )}
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

            <footer className="flex justify-end gap-2 border-t border-amber-100 px-5 py-3">
              <button className="btn-ghost" onClick={() => setOpen(false)}>
                Cancelar
              </button>
              <button className="btn-primary" onClick={guardar} disabled={saving}>
                <Save size={16} /> {saving ? 'Guardando…' : 'Guardar'}
              </button>
            </footer>
          </>
        )}
      </aside>
    </div>
  )
}
