import { useEffect, useState } from 'react'
import { Trash2, Save, Ruler, User, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { Cliente, MarcaPeriodontal } from '../types'
import { hoyISO } from '../lib/format'
import { ARCADA_PERMANENTE_SUP, ARCADA_PERMANENTE_INF } from '../lib/dental'
import PageHeader from '../components/PageHeader'
import Cargando from '../components/Cargando'
import DienteSVG from '../components/DienteSVG'
import SelectorPaciente from '../components/SelectorPaciente'

// Los campos numéricos se editan como texto para permitir el valor vacío (null).
type CampoNum =
  | 'ps_vm' | 'ps_vc' | 'ps_vd'
  | 'ps_lm' | 'ps_lc' | 'ps_ld'
  | 'rec_v' | 'rec_l'

interface FormPeriodontal {
  ps_vm: string; ps_vc: string; ps_vd: string
  ps_lm: string; ps_lc: string; ps_ld: string
  rec_v: string; rec_l: string
  movilidad: string
  furca: string
  sangrado: boolean
  supuracion: boolean
  placa: boolean
  notas: string
}

const formVacio: FormPeriodontal = {
  ps_vm: '', ps_vc: '', ps_vd: '',
  ps_lm: '', ps_lc: '', ps_ld: '',
  rec_v: '', rec_l: '',
  movilidad: '0',
  furca: '0',
  sangrado: false,
  supuracion: false,
  placa: false,
  notas: '',
}

// Convierte un valor numérico del registro a texto para el formulario.
function numAstr(v: number | null): string {
  return v == null ? '' : String(v)
}

// Convierte un texto del formulario a número o null (campos vacíos -> null).
function strAnum(v: string): number | null {
  const t = v.trim()
  if (t === '') return null
  const n = Number(t)
  return Number.isNaN(n) ? null : n
}

export default function Periodontograma({ pacienteFijo }: { pacienteFijo?: string } = {}) {
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [pacienteId, setPacienteId] = useState<string>(pacienteFijo ?? '')
  const [fecha, setFecha] = useState<string>(hoyISO())
  const [registros, setRegistros] = useState<MarcaPeriodontal[]>([])
  const [loading, setLoading] = useState(true)
  const [cargandoRegistros, setCargandoRegistros] = useState(false)

  const [open, setOpen] = useState(false)
  const [dienteSel, setDienteSel] = useState<number | null>(null)
  const [form, setForm] = useState<FormPeriodontal>(formVacio)
  const [saving, setSaving] = useState(false)

  const paciente = clientes.find((c) => c.id === pacienteId) ?? null

  async function cargarBase() {
    setLoading(true)
    const { data, error } = await supabase.from('clientes').select('*').order('nombre')
    if (error) alert('Error al cargar pacientes: ' + error.message)
    setClientes(data ?? [])
    setLoading(false)
  }

  async function cargarRegistros(pid: string, f: string) {
    if (!pid || !f) {
      setRegistros([])
      return
    }
    setCargandoRegistros(true)
    const { data, error } = await supabase
      .from('periodontograma')
      .select('*')
      .eq('cliente_id', pid)
      .eq('fecha', f)
    if (error) alert('Error al cargar el periodontograma: ' + error.message)
    setRegistros(data ?? [])
    setCargandoRegistros(false)
  }

  useEffect(() => {
    cargarBase()
  }, [])

  useEffect(() => {
    if (pacienteFijo != null) setPacienteId(pacienteFijo)
  }, [pacienteFijo])

  useEffect(() => {
    cargarRegistros(pacienteId, fecha)
  }, [pacienteId, fecha])

  // Registro existente de una pieza en la fecha seleccionada (si lo hay).
  function registroDe(diente: number): MarcaPeriodontal | undefined {
    return registros.find((r) => r.diente === diente)
  }

  function abrirDiente(diente: number) {
    setDienteSel(diente)
    const r = registroDe(diente)
    if (r) {
      setForm({
        ps_vm: numAstr(r.ps_vm), ps_vc: numAstr(r.ps_vc), ps_vd: numAstr(r.ps_vd),
        ps_lm: numAstr(r.ps_lm), ps_lc: numAstr(r.ps_lc), ps_ld: numAstr(r.ps_ld),
        rec_v: numAstr(r.rec_v), rec_l: numAstr(r.rec_l),
        movilidad: numAstr(r.movilidad) || '0',
        furca: numAstr(r.furca) || '0',
        sangrado: r.sangrado,
        supuracion: r.supuracion,
        placa: r.placa,
        notas: r.notas ?? '',
      })
    } else {
      setForm(formVacio)
    }
    setOpen(true)
  }

  async function guardar() {
    if (dienteSel == null) return
    setSaving(true)
    const payload = {
      cliente_id: pacienteId,
      fecha,
      diente: dienteSel,
      ps_vm: strAnum(form.ps_vm), ps_vc: strAnum(form.ps_vc), ps_vd: strAnum(form.ps_vd),
      ps_lm: strAnum(form.ps_lm), ps_lc: strAnum(form.ps_lc), ps_ld: strAnum(form.ps_ld),
      rec_v: strAnum(form.rec_v), rec_l: strAnum(form.rec_l),
      movilidad: strAnum(form.movilidad),
      furca: strAnum(form.furca),
      sangrado: form.sangrado,
      supuracion: form.supuracion,
      placa: form.placa,
      notas: form.notas.trim() || null,
    }
    const existente = registroDe(dienteSel)
    const { error } = existente
      ? await supabase.from('periodontograma').update(payload).eq('id', existente.id)
      : await supabase.from('periodontograma').insert(payload)
    setSaving(false)
    if (error) return alert('Error al guardar: ' + error.message)
    setOpen(false)
    cargarRegistros(pacienteId, fecha)
  }

  async function eliminarRegistro(r: MarcaPeriodontal) {
    if (!confirm(`¿Eliminar el registro periodontal del diente ${r.diente}?`)) return
    const { error } = await supabase.from('periodontograma').delete().eq('id', r.id)
    if (error) return alert('Error al eliminar: ' + error.message)
    cargarRegistros(pacienteId, fecha)
  }

  // Color de una profundidad de sondaje (mm): verde ≤3, ámbar 4–5, rojo ≥6.
  function colorPS(v: number | null): string {
    if (v == null) return 'text-slate-300'
    if (v <= 3) return 'text-emerald-600'
    if (v <= 5) return 'text-amber-600'
    return 'text-rose-600 font-bold'
  }

  function fmtNum(v: number | null | undefined): string {
    return v == null ? '·' : String(v)
  }

  // Peor bolsa de la pieza (para tintar el diente).
  function maxPS(r: MarcaPeriodontal | undefined): number | null {
    if (!r) return null
    const vals = [r.ps_vm, r.ps_vc, r.ps_vd, r.ps_lm, r.ps_lc, r.ps_ld].filter(
      (x): x is number => x != null,
    )
    return vals.length ? Math.max(...vals) : null
  }

  // Tinte del diente según su peor bolsa: rojo (≥6), ámbar (4–5), verde suave si sano.
  function tintePieza(r: MarcaPeriodontal | undefined): string | undefined {
    const m = maxPS(r)
    if (m == null) return undefined
    if (m >= 6) return '#ef4444'
    if (m >= 4) return '#f59e0b'
    return '#34d399'
  }

  // NIC (Nivel de Inserción Clínica) de un lado = mayor sondaje del lado + recesión.
  function nicLado(sitios: (number | null)[], rec: number | null): number | null {
    const p = sitios.filter((x): x is number => x != null)
    if (!p.length) return null
    return Math.max(...p) + (rec ?? 0)
  }
  function nicMax(r: MarcaPeriodontal | undefined): number | null {
    if (!r) return null
    const v = nicLado([r.ps_vm, r.ps_vc, r.ps_vd], r.rec_v)
    const l = nicLado([r.ps_lm, r.ps_lc, r.ps_ld], r.rec_l)
    const vals = [v, l].filter((x): x is number => x != null)
    return vals.length ? Math.max(...vals) : null
  }

  // Índices del examen (sobre las piezas registradas en la fecha).
  const nReg = registros.length
  const pct = (k: number) => (nReg ? Math.round((100 * k) / nReg) : 0)
  const idxSangrado = pct(registros.filter((r) => r.sangrado).length)
  const idxPlaca = pct(registros.filter((r) => r.placa).length)
  const idxSupur = pct(registros.filter((r) => r.supuracion).length)
  const todosPS = registros.flatMap((r) =>
    [r.ps_vm, r.ps_vc, r.ps_vd, r.ps_lm, r.ps_lc, r.ps_ld].filter((x): x is number => x != null),
  )
  const promPS = todosPS.length ? (todosPS.reduce((a, b) => a + b, 0) / todosPS.length).toFixed(1) : '–'

  // Trío de profundidades de sondaje (mesial–central–distal) de una cara.
  function TrioPS({ vals }: { vals: (number | null)[] }) {
    return (
      <div className="flex justify-center gap-1 font-mono text-[11px] leading-none">
        {vals.map((v, i) => (
          <span key={i} className={`w-3 text-center ${colorPS(v)}`}>
            {fmtNum(v)}
          </span>
        ))}
      </div>
    )
  }

  // Una columna de la carta: cara vestibular arriba, diente y número, cara
  // palatino/lingual abajo, con recesión, movilidad, furca y sangrado.
  function ColumnaDiente({ n, arriba }: { n: number; arriba: boolean }) {
    const r = registroDe(n)
    const registrado = !!r
    return (
      <button
        type="button"
        onClick={() => abrirDiente(n)}
        title={registrado ? `Diente ${n} · con registro` : `Diente ${n} · sin registrar`}
        className={
          'flex w-12 shrink-0 flex-col items-center gap-0.5 rounded-lg border px-0.5 py-1 transition hover:ring-2 hover:ring-amber-300 ' +
          (registrado ? 'border-amber-300 bg-amber-50/60' : 'border-slate-200 bg-white')
        }
      >
        {/* Vestibular */}
        <span className="text-[8px] font-semibold uppercase tracking-wide text-slate-400">V</span>
        <TrioPS vals={[r?.ps_vm ?? null, r?.ps_vc ?? null, r?.ps_vd ?? null]} />
        <span className="font-mono text-[9px] text-sky-600" title="Recesión vestibular">
          {r?.rec_v != null ? `↕${r.rec_v}` : ''}
        </span>

        {/* Diente + número + sangrado */}
        <span className="relative">
          <DienteSVG fdi={n} arriba={arriba} colorPieza={tintePieza(r)} size={26} />
          {r?.sangrado && (
            <span
              className="absolute -right-0.5 top-0 h-2.5 w-2.5 rounded-full border border-white bg-rose-500"
              title="Sangrado al sondaje"
            />
          )}
          {r?.supuracion && (
            <span
              className="absolute -left-0.5 top-0 h-2.5 w-2.5 rounded-full border border-white bg-yellow-400"
              title="Supuración"
            />
          )}
        </span>
        <span className="font-mono text-[10px] font-semibold text-slate-600">{n}</span>

        {/* Palatino / Lingual */}
        <span className="font-mono text-[9px] text-sky-600" title="Recesión palatino/lingual">
          {r?.rec_l != null ? `↕${r.rec_l}` : ''}
        </span>
        <TrioPS vals={[r?.ps_lm ?? null, r?.ps_lc ?? null, r?.ps_ld ?? null]} />
        <span className="text-[8px] font-semibold uppercase tracking-wide text-slate-400">P/L</span>

        {/* Movilidad / furca */}
        {(r?.movilidad || r?.furca) ? (
          <span className="text-[8px] font-semibold text-slate-500">
            {r?.movilidad ? `M${r.movilidad}` : ''}{r?.movilidad && r?.furca ? ' ' : ''}{r?.furca ? `F${r.furca}` : ''}
          </span>
        ) : null}
      </button>
    )
  }

  function Arcada({ dientes, arriba }: { dientes: number[]; arriba: boolean }) {
    const mitad = 8
    return (
      <div className="flex items-stretch justify-center gap-1">
        {dientes.map((n, i) => (
          <div key={n} className="flex items-stretch gap-1">
            {i === mitad && <div className="mx-1 w-px self-stretch bg-slate-300" />}
            <ColumnaDiente n={n} arriba={arriba} />
          </div>
        ))}
      </div>
    )
  }

  // Resumen "V:3-2-3 / L:2-2-3" para la tabla.
  function resumenPS(r: MarcaPeriodontal): string {
    const v = [r.ps_vm, r.ps_vc, r.ps_vd].map((x) => (x == null ? '–' : x)).join('-')
    const l = [r.ps_lm, r.ps_lc, r.ps_ld].map((x) => (x == null ? '–' : x)).join('-')
    return `V:${v} / L:${l}`
  }

  if (loading) return <Cargando />

  return (
    <div>
      {!pacienteFijo && (
        <PageHeader title="Periodontograma" subtitle="Carta periodontal por paciente y fecha" />
      )}

      <div className="mb-6 flex flex-wrap gap-4">
        {!pacienteFijo && (
          <div className="min-w-[16rem] flex-1">
            <label className="label">Paciente</label>
            <SelectorPaciente clientes={clientes} value={pacienteId} onChange={setPacienteId} />
          </div>
        )}
        <div className="w-56">
          <label className="label">Fecha del examen</label>
          <input type="date" className="input" value={fecha} onChange={(e) => setFecha(e.target.value)} />
        </div>
      </div>

      {!paciente ? (
        <div className="card flex flex-col items-center gap-3 py-12 text-center">
          <User className="text-amber-400" size={40} />
          <p className="text-slate-500">Elige un paciente para ver y editar su periodontograma.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Carta periodontal */}
          <div className="card py-6">
            {cargandoRegistros ? (
              <Cargando texto="Cargando periodontograma…" />
            ) : (
              <div className="overflow-x-auto">
                <div className="flex min-w-max flex-col items-center gap-3">
                  <span className="text-xs uppercase tracking-wide text-slate-400">Arcada superior</span>
                  <Arcada dientes={ARCADA_PERMANENTE_SUP} arriba={true} />
                  <div className="my-1 flex items-center gap-2 text-xs uppercase tracking-wide text-slate-400">
                    <Ruler size={16} className="text-amber-400" />
                    <span>Clic en un diente para registrar / editar</span>
                  </div>
                  <Arcada dientes={ARCADA_PERMANENTE_INF} arriba={false} />
                  <span className="text-xs uppercase tracking-wide text-slate-400">Arcada inferior</span>
                </div>
              </div>
            )}
          </div>

          {/* Índices del examen */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {[
              { label: 'Piezas registradas', val: String(nReg), tono: 'text-slate-700' },
              { label: 'Índice de sangrado', val: `${idxSangrado}%`, tono: idxSangrado >= 20 ? 'text-rose-600' : 'text-emerald-600' },
              { label: 'Índice de placa', val: `${idxPlaca}%`, tono: idxPlaca >= 20 ? 'text-rose-600' : 'text-emerald-600' },
              { label: 'Supuración', val: `${idxSupur}%`, tono: idxSupur > 0 ? 'text-amber-600' : 'text-emerald-600' },
              { label: 'Sondaje promedio', val: `${promPS} mm`, tono: 'text-slate-700' },
            ].map((s) => (
              <div key={s.label} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-center shadow-sm">
                <p className={`text-xl font-bold ${s.tono}`}>{s.val}</p>
                <p className="mt-0.5 text-[11px] font-medium text-slate-500">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Leyenda */}
          <div className="flex flex-wrap gap-2 text-xs font-medium text-slate-600">
            <span className="flex items-center gap-1.5 rounded-full border border-slate-200 px-2.5 py-1">
              <span className="font-mono font-bold text-emerald-600">1-3</span> Sondaje normal (mm)
            </span>
            <span className="flex items-center gap-1.5 rounded-full border border-slate-200 px-2.5 py-1">
              <span className="font-mono font-bold text-amber-600">4-5</span> Bolsa moderada
            </span>
            <span className="flex items-center gap-1.5 rounded-full border border-slate-200 px-2.5 py-1">
              <span className="font-mono font-bold text-rose-600">≥6</span> Bolsa profunda
            </span>
            <span className="flex items-center gap-1.5 rounded-full border border-slate-200 px-2.5 py-1">
              <span className="h-2 w-2 rounded-full bg-rose-500" /> Sangrado al sondaje
            </span>
            <span className="flex items-center gap-1.5 rounded-full border border-slate-200 px-2.5 py-1">
              <span className="h-2 w-2 rounded-full bg-yellow-400" /> Supuración
            </span>
            <span className="flex items-center gap-1.5 rounded-full border border-slate-200 px-2.5 py-1">
              <span className="font-mono text-sky-600">↕</span> Recesión (mm)
            </span>
            <span className="flex items-center gap-1.5 rounded-full border border-slate-200 px-2.5 py-1">
              <span className="font-semibold text-slate-500">M</span> Movilidad ·{' '}
              <span className="font-semibold text-slate-500">F</span> Furca
            </span>
          </div>

          {/* Registros de la fecha */}
          <div className="overflow-x-auto panel-3d">
            <table className="min-w-full divide-y divide-slate-100 text-sm">
              <thead className="thead-3d">
                <tr>
                  <th className="px-5 py-3 text-left">Diente</th>
                  <th className="px-5 py-3 text-left">Prof. sondaje (mm)</th>
                  <th className="px-5 py-3 text-left">Recesión (V/L)</th>
                  <th className="px-5 py-3 text-left">NIC (mm)</th>
                  <th className="px-5 py-3 text-left">Movilidad</th>
                  <th className="px-5 py-3 text-left">Sangrado</th>
                  <th className="px-5 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {registros.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-8 text-center text-slate-500">
                      Sin registros periodontales para esta fecha.
                    </td>
                  </tr>
                ) : (
                  [...registros]
                    .sort((a, b) => a.diente - b.diente)
                    .map((r) => (
                      <tr key={r.id}>
                        <td className="px-5 py-3 font-mono font-semibold text-amber-700">{r.diente}</td>
                        <td className="px-5 py-3 font-mono text-slate-600">{resumenPS(r)}</td>
                        <td className="px-5 py-3 text-slate-600">
                          {r.rec_v ?? '–'} / {r.rec_l ?? '–'}
                        </td>
                        <td className="px-5 py-3 font-mono font-semibold text-sky-700">{nicMax(r) ?? '–'}</td>
                        <td className="px-5 py-3 text-slate-600">{r.movilidad ?? '–'}</td>
                        <td className="px-5 py-3 text-slate-600">{r.sangrado ? 'Sí' : 'No'}</td>
                        <td className="px-5 py-3">
                          <div className="flex justify-end">
                            <button
                              onClick={() => eliminarRegistro(r)}
                              className="rounded-lg p-2 text-slate-600 hover:bg-rose-50 hover:text-rose-600"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
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
        {dienteSel != null && (
          <>
            <header className="flex items-center justify-between border-b border-amber-100 px-5 py-4">
              <div>
                <h3 className="text-base font-semibold text-amber-800">Diente {dienteSel}</h3>
                <p className="text-xs text-slate-500">Registro periodontal</p>
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
              {/* Vista previa del diente elegido (tinte según la peor bolsa en el formulario) */}
              {(() => {
                const arribaSel = ARCADA_PERMANENTE_SUP.includes(dienteSel)
                const psForm = [form.ps_vm, form.ps_vc, form.ps_vd, form.ps_lm, form.ps_lc, form.ps_ld]
                  .map((v) => strAnum(v))
                  .filter((x): x is number => x != null)
                const maxForm = psForm.length ? Math.max(...psForm) : null
                const tinte = maxForm == null ? undefined : maxForm >= 6 ? '#ef4444' : maxForm >= 4 ? '#f59e0b' : '#34d399'
                return (
                  <div className="flex flex-col items-center rounded-2xl border border-amber-100 bg-amber-50/40 py-4">
                    <DienteSVG fdi={dienteSel} arriba={arribaSel} colorPieza={tinte} size={74} />
                    {maxForm != null && (
                      <p className="mt-2 text-sm font-semibold text-slate-700">Sondaje máx: {maxForm} mm</p>
                    )}
                  </div>
                )
              })()}

          <div>
            <label className="label">Profundidad de sondaje · Vestibular (mm)</label>
            <div className="grid grid-cols-3 gap-2">
              {([
                ['ps_vm', 'Mesial'],
                ['ps_vc', 'Central'],
                ['ps_vd', 'Distal'],
              ] as [CampoNum, string][]).map(([campo, etq]) => (
                <div key={campo}>
                  <input
                    type="number"
                    min={0}
                    max={15}
                    className="input"
                    placeholder={etq}
                    value={form[campo]}
                    onChange={(e) => setForm({ ...form, [campo]: e.target.value })}
                  />
                  <p className="mt-1 text-center text-[11px] text-slate-500">{etq}</p>
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="label">Profundidad de sondaje · Palatino/Lingual (mm)</label>
            <div className="grid grid-cols-3 gap-2">
              {([
                ['ps_lm', 'Mesial'],
                ['ps_lc', 'Central'],
                ['ps_ld', 'Distal'],
              ] as [CampoNum, string][]).map(([campo, etq]) => (
                <div key={campo}>
                  <input
                    type="number"
                    min={0}
                    max={15}
                    className="input"
                    placeholder={etq}
                    value={form[campo]}
                    onChange={(e) => setForm({ ...form, [campo]: e.target.value })}
                  />
                  <p className="mt-1 text-center text-[11px] text-slate-500">{etq}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Recesión Vestibular (mm)</label>
              <input
                type="number"
                min={0}
                max={15}
                className="input"
                value={form.rec_v}
                onChange={(e) => setForm({ ...form, rec_v: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Recesión Lingual (mm)</label>
              <input
                type="number"
                min={0}
                max={15}
                className="input"
                value={form.rec_l}
                onChange={(e) => setForm({ ...form, rec_l: e.target.value })}
              />
            </div>
          </div>

          {/* NIC (Nivel de Inserción Clínica) calculado automáticamente = sondaje + recesión */}
          {(() => {
            const nv = nicLado([strAnum(form.ps_vm), strAnum(form.ps_vc), strAnum(form.ps_vd)], strAnum(form.rec_v))
            const nl = nicLado([strAnum(form.ps_lm), strAnum(form.ps_lc), strAnum(form.ps_ld)], strAnum(form.rec_l))
            return (
              <div className="flex items-center gap-4 rounded-lg border border-sky-100 bg-sky-50/60 px-4 py-2.5 text-sm">
                <span className="font-semibold text-sky-800">NIC (automático)</span>
                <span className="text-slate-600">Vestibular: <b className="font-mono">{nv ?? '–'}</b> mm</span>
                <span className="text-slate-600">Palatino/Lingual: <b className="font-mono">{nl ?? '–'}</b> mm</span>
                <span className="text-[11px] text-slate-400">= sondaje + recesión</span>
              </div>
            )
          })()}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Movilidad</label>
              <select
                className="input"
                value={form.movilidad}
                onChange={(e) => setForm({ ...form, movilidad: e.target.value })}
              >
                {[0, 1, 2, 3].map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Furca</label>
              <select
                className="input"
                value={form.furca}
                onChange={(e) => setForm({ ...form, furca: e.target.value })}
              >
                {[0, 1, 2, 3].map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-wrap gap-6">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300 text-amber-600 focus:ring-amber-400"
                checked={form.sangrado}
                onChange={(e) => setForm({ ...form, sangrado: e.target.checked })}
              />
              Sangrado al sondaje
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300 text-amber-600 focus:ring-amber-400"
                checked={form.supuracion}
                onChange={(e) => setForm({ ...form, supuracion: e.target.checked })}
              />
              Supuración
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300 text-amber-600 focus:ring-amber-400"
                checked={form.placa}
                onChange={(e) => setForm({ ...form, placa: e.target.checked })}
              />
              Placa
            </label>
          </div>

          <div>
            <label className="label">Notas</label>
            <textarea
              className="input"
              rows={2}
              value={form.notas}
              onChange={(e) => setForm({ ...form, notas: e.target.value })}
              placeholder="Observaciones periodontales…"
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
