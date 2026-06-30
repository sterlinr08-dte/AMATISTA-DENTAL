import { useEffect, useState } from 'react'
import { Trash2, Save, Smile, User } from 'lucide-react'
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
  CARAS_DIENTE,
} from '../lib/dental'
import PageHeader from '../components/PageHeader'
import Cargando from '../components/Cargando'
import Modal from '../components/Modal'

type Denticion = 'permanente' | 'temporal'

const formVacio = {
  estado: 'sano' as EstadoDiente,
  cara: '',
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
  const [dienteSel, setDienteSel] = useState<number | null>(null)
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

  // Estado actual de pieza completa (marca con cara === null más reciente del diente).
  function estadoActual(diente: number): EstadoDiente | null {
    const piezas = marcas
      .filter((m) => m.diente === diente && m.cara == null)
      .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
    return piezas.length ? piezas[0].estado : null
  }

  function abrirDiente(diente: number) {
    setDienteSel(diente)
    const actual = estadoActual(diente)
    setForm({ ...formVacio, estado: actual ?? 'sano' })
    setOpen(true)
  }

  async function guardar() {
    if (dienteSel == null) return
    setSaving(true)
    const esPiezaCompleta = form.cara.trim() === ''
    if (esPiezaCompleta) {
      // Borra el estado previo de pieza completa para que sea único por diente.
      const { error: errDel } = await supabase
        .from('odontograma')
        .delete()
        .eq('cliente_id', pacienteId)
        .eq('diente', dienteSel)
        .is('cara', null)
      if (errDel) {
        setSaving(false)
        return alert('Error al actualizar la pieza: ' + errDel.message)
      }
    }
    const payload = {
      cliente_id: pacienteId,
      diente: dienteSel,
      cara: esPiezaCompleta ? null : form.cara,
      estado: form.estado,
      tratamiento_id: form.tratamiento_id || null,
      cita_id: null,
      notas: form.notas || null,
    }
    const { error } = await supabase.from('odontograma').insert(payload)
    setSaving(false)
    if (error) return alert('Error al guardar: ' + error.message)
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

  function Diente({ n }: { n: number }) {
    const estado = estadoActual(n)
    const color = estado ? estadoDienteDef(estado).color : '#ffffff'
    return (
      <button
        type="button"
        onClick={() => abrirDiente(n)}
        title={estado ? estadoDienteDef(estado).label : 'Sin registrar'}
        className="flex h-10 w-10 flex-col items-center justify-center rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 shadow-sm transition hover:ring-2 hover:ring-brand-300"
        style={{ backgroundColor: color }}
      >
        {n}
      </button>
    )
  }

  function Arcada({ dientes }: { dientes: number[] }) {
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
          <div className="card flex flex-col items-center gap-4 py-6">
            {cargandoMarcas ? (
              <Cargando texto="Cargando odontograma…" />
            ) : (
              <>
                <Arcada dientes={arcadaSup} />
                <div className="my-1 flex items-center gap-2 text-xs uppercase tracking-wide text-slate-400">
                  <Smile size={16} className="text-brand-300" />
                  <span>Arcada superior · inferior</span>
                </div>
                <Arcada dientes={arcadaInf} />
              </>
            )}
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
                          <td className="px-5 py-3 text-slate-600">{m.cara || 'Pieza completa'}</td>
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
        title={dienteSel != null ? `Diente ${dienteSel}` : 'Diente'}
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
            <label className="label">Cara</label>
            <select className="input" value={form.cara} onChange={(e) => setForm({ ...form, cara: e.target.value })}>
              <option value="">Pieza completa</option>
              {CARAS_DIENTE.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-slate-500">
              «Pieza completa» reemplaza el estado actual del diente. Una cara agrega una marca nueva.
            </p>
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
