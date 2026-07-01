import { useEffect, useState } from 'react'
import { Trash2, Save, Ruler, User } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { Cliente, MarcaPeriodontal } from '../types'
import { codigoCliente, hoyISO } from '../lib/format'
import { ARCADA_PERMANENTE_SUP, ARCADA_PERMANENTE_INF } from '../lib/dental'
import PageHeader from '../components/PageHeader'
import Cargando from '../components/Cargando'
import Modal from '../components/Modal'

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

export default function Periodontograma() {
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [pacienteId, setPacienteId] = useState<string>('')
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

  function Diente({ n }: { n: number }) {
    const r = registroDe(n)
    const registrado = !!r
    return (
      <button
        type="button"
        onClick={() => abrirDiente(n)}
        title={registrado ? `Diente ${n} · con registro` : `Diente ${n} · sin registrar`}
        className={
          'relative flex h-10 w-10 items-center justify-center rounded-lg border text-xs font-semibold shadow-sm transition hover:ring-2 hover:ring-amber-300 ' +
          (registrado
            ? 'border-amber-400 bg-amber-50 text-amber-800'
            : 'border-slate-300 bg-white text-slate-700')
        }
      >
        {n}
        {r?.sangrado && (
          <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-rose-500" title="Sangrado" />
        )}
      </button>
    )
  }

  function Arcada({ dientes }: { dientes: number[] }) {
    const mitad = 8
    return (
      <div className="flex items-center justify-center gap-1">
        {dientes.map((n, i) => (
          <div key={n} className="flex items-center gap-1">
            {i === mitad && <div className="mx-1 h-10 w-px bg-slate-300" />}
            <Diente n={n} />
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
      <PageHeader title="Periodontograma" subtitle="Carta periodontal por paciente y fecha" />

      <div className="mb-6 flex flex-wrap gap-4">
        <div className="min-w-[16rem] flex-1">
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
          <div className="card flex flex-col items-center gap-4 py-6">
            {cargandoRegistros ? (
              <Cargando texto="Cargando periodontograma…" />
            ) : (
              <>
                <Arcada dientes={ARCADA_PERMANENTE_SUP} />
                <div className="my-1 flex items-center gap-2 text-xs uppercase tracking-wide text-slate-400">
                  <Ruler size={16} className="text-amber-400" />
                  <span>Arcada superior · inferior</span>
                </div>
                <Arcada dientes={ARCADA_PERMANENTE_INF} />
              </>
            )}
          </div>

          {/* Leyenda */}
          <div className="flex flex-wrap gap-2 text-xs font-medium text-slate-600">
            <span className="flex items-center gap-1.5 rounded-full border border-slate-200 px-2.5 py-1">
              <span className="h-3 w-3 rounded border border-amber-400 bg-amber-50" />
              Diente con registro
            </span>
            <span className="flex items-center gap-1.5 rounded-full border border-slate-200 px-2.5 py-1">
              <span className="h-2 w-2 rounded-full bg-rose-500" />
              Sangrado al sondaje
            </span>
            <span className="flex items-center gap-1.5 rounded-full border border-slate-200 px-2.5 py-1">
              Profundidad de sondaje (PS) en mm
            </span>
            <span className="flex items-center gap-1.5 rounded-full border border-slate-200 px-2.5 py-1">
              Recesión en mm
            </span>
            <span className="flex items-center gap-1.5 rounded-full border border-slate-200 px-2.5 py-1">
              Movilidad 0–3
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
                  <th className="px-5 py-3 text-left">Movilidad</th>
                  <th className="px-5 py-3 text-left">Sangrado</th>
                  <th className="px-5 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {registros.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-8 text-center text-slate-500">
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

      <Modal
        open={open}
        title={dienteSel != null ? `Diente ${dienteSel} — periodontal` : 'Diente'}
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
      </Modal>
    </div>
  )
}
