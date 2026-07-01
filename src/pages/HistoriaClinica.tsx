import { useEffect, useState } from 'react'
import { Save, Trash2, Plus, FileText, Check } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { Cliente, Empleado, HistoriaClinica as Ficha, HistoriaEvolucion } from '../types'
import { fechaCorta, hoyISO } from '../lib/format'
import { GRUPOS_SANGUINEOS } from '../lib/dental'
import PageHeader from '../components/PageHeader'
import Cargando from '../components/Cargando'
import Modal from '../components/Modal'
import DataTable, { Columna } from '../components/DataTable'
import SelectorPaciente from '../components/SelectorPaciente'

const fichaVacia = {
  antecedentes: '',
  alergias: '',
  medicamentos: '',
  enfermedades: '',
  grupo_sanguineo: '',
  embarazada: false,
  fumador: false,
  observaciones: '',
}

const evolucionVacia = {
  fecha: hoyISO(),
  empleado_id: '' as string,
  motivo: '',
  diagnostico: '',
  procedimiento: '',
  indicaciones: '',
  notas: '',
}

export default function HistoriaClinica({ pacienteFijo }: { pacienteFijo?: string } = {}) {
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [empleados, setEmpleados] = useState<Empleado[]>([])
  const [pacienteId, setPacienteId] = useState<string>(pacienteFijo ?? '')

  const [cargandoFicha, setCargandoFicha] = useState(false)
  const [ficha, setFicha] = useState(fichaVacia)
  const [guardandoFicha, setGuardandoFicha] = useState(false)
  const [guardado, setGuardado] = useState(false)

  const [evoluciones, setEvoluciones] = useState<HistoriaEvolucion[]>([])
  const [cargandoEvol, setCargandoEvol] = useState(false)
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(evolucionVacia)
  const [saving, setSaving] = useState(false)

  // Carga inicial: clientes y empleados activos.
  useEffect(() => {
    async function inicial() {
      const [{ data: cli, error: errCli }, { data: emp, error: errEmp }] = await Promise.all([
        supabase.from('clientes').select('*').order('nombre'),
        supabase.from('empleados').select('*').eq('activo', true).order('nombre'),
      ])
      if (errCli) alert('Error al cargar pacientes: ' + errCli.message)
      if (errEmp) alert('Error al cargar profesionales: ' + errEmp.message)
      setClientes(cli ?? [])
      setEmpleados(emp ?? [])
    }
    inicial()
  }, [])

  useEffect(() => {
    if (pacienteFijo != null) setPacienteId(pacienteFijo)
  }, [pacienteFijo])

  async function cargarFicha(pid: string) {
    setCargandoFicha(true)
    const { data, error } = await supabase
      .from('historias_clinicas')
      .select('*')
      .eq('cliente_id', pid)
      .maybeSingle()
    if (error) alert('Error al cargar la ficha: ' + error.message)
    if (data) {
      const f = data as Ficha
      setFicha({
        antecedentes: f.antecedentes ?? '',
        alergias: f.alergias ?? '',
        medicamentos: f.medicamentos ?? '',
        enfermedades: f.enfermedades ?? '',
        grupo_sanguineo: f.grupo_sanguineo ?? '',
        embarazada: f.embarazada ?? false,
        fumador: f.fumador ?? false,
        observaciones: f.observaciones ?? '',
      })
    } else {
      setFicha(fichaVacia)
    }
    setCargandoFicha(false)
  }

  async function cargarEvoluciones(pid: string) {
    setCargandoEvol(true)
    const { data, error } = await supabase
      .from('historia_evoluciones')
      .select('*')
      .eq('cliente_id', pid)
      .order('fecha', { ascending: false })
    if (error) alert('Error al cargar evoluciones: ' + error.message)
    setEvoluciones((data ?? []) as HistoriaEvolucion[])
    setCargandoEvol(false)
  }

  // Al cambiar de paciente, recargar ficha y evoluciones.
  useEffect(() => {
    if (!pacienteId) {
      setFicha(fichaVacia)
      setEvoluciones([])
      return
    }
    setGuardado(false)
    cargarFicha(pacienteId)
    cargarEvoluciones(pacienteId)
  }, [pacienteId])

  async function guardarFicha() {
    if (!pacienteId) return
    setGuardandoFicha(true)
    const payload = {
      cliente_id: pacienteId,
      antecedentes: ficha.antecedentes || null,
      alergias: ficha.alergias || null,
      medicamentos: ficha.medicamentos || null,
      enfermedades: ficha.enfermedades || null,
      grupo_sanguineo: ficha.grupo_sanguineo || null,
      embarazada: ficha.embarazada,
      fumador: ficha.fumador,
      observaciones: ficha.observaciones || null,
    }
    const { error } = await supabase
      .from('historias_clinicas')
      .upsert(payload, { onConflict: 'cliente_id' })
    setGuardandoFicha(false)
    if (error) return alert('Error al guardar la ficha: ' + error.message)
    await cargarFicha(pacienteId)
    setGuardado(true)
    setTimeout(() => setGuardado(false), 2500)
  }

  function abrirNuevaEvolucion() {
    setForm({ ...evolucionVacia, fecha: hoyISO() })
    setOpen(true)
  }

  async function guardarEvolucion() {
    if (!pacienteId) return
    setSaving(true)
    const payload = {
      cliente_id: pacienteId,
      fecha: form.fecha,
      empleado_id: form.empleado_id || null,
      motivo: form.motivo || null,
      diagnostico: form.diagnostico || null,
      procedimiento: form.procedimiento || null,
      indicaciones: form.indicaciones || null,
      notas: form.notas || null,
    }
    const { error } = await supabase.from('historia_evoluciones').insert(payload)
    setSaving(false)
    if (error) return alert('Error al guardar la evolución: ' + error.message)
    setOpen(false)
    cargarEvoluciones(pacienteId)
  }

  async function eliminarEvolucion(e: HistoriaEvolucion) {
    if (!confirm('¿Eliminar esta evolución?')) return
    const { error } = await supabase.from('historia_evoluciones').delete().eq('id', e.id)
    if (error) return alert('Error al eliminar: ' + error.message)
    cargarEvoluciones(pacienteId)
  }

  function nombreProfesional(id: string | null): string {
    if (!id) return '—'
    return empleados.find((e) => e.id === id)?.nombre ?? '—'
  }

  const columnas: Columna<HistoriaEvolucion>[] = [
    { header: 'Fecha', cell: (e) => <span className="text-slate-600">{fechaCorta(e.fecha)}</span>, sortValue: (e) => e.fecha },
    { header: 'Motivo', cell: (e) => <span className="font-medium text-slate-800">{e.motivo || '—'}</span>, sortValue: (e) => e.motivo ?? '' },
    { header: 'Diagnóstico', cell: (e) => <span className="text-slate-600">{e.diagnostico || '—'}</span>, sortValue: (e) => e.diagnostico ?? '' },
    { header: 'Procedimiento', cell: (e) => <span className="text-slate-600">{e.procedimiento || '—'}</span>, sortValue: (e) => e.procedimiento ?? '' },
    { header: 'Profesional', cell: (e) => <span className="text-slate-600">{nombreProfesional(e.empleado_id)}</span>, sortValue: (e) => nombreProfesional(e.empleado_id) },
    {
      header: '', align: 'right', cell: (e) => (
        <div className="flex justify-end gap-1">
          <button onClick={() => eliminarEvolucion(e)} className="rounded-lg p-2 text-slate-600 hover:bg-rose-50 hover:text-rose-600">
            <Trash2 size={16} />
          </button>
        </div>
      ),
    },
  ]

  return (
    <div>
      {!pacienteFijo && (
        <>
          <PageHeader title="Historia clínica" subtitle="Ficha clínica y evoluciones del paciente" />
          <div className="card mb-6 max-w-md">
            <label className="label">Paciente</label>
            <SelectorPaciente clientes={clientes} value={pacienteId} onChange={setPacienteId} />
          </div>
        </>
      )}

      {!pacienteId ? (
        <div className="card flex flex-col items-center gap-3 py-12 text-center">
          <FileText className="text-brand-300" size={40} />
          <p className="text-slate-500">Selecciona un paciente para ver y editar su historia clínica.</p>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="card">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-display text-lg font-bold uppercase text-slate-800">Ficha clínica</h2>
              <div className="flex items-center gap-3">
                {guardado && (
                  <span className="inline-flex items-center gap-1 text-sm font-medium text-emerald-600">
                    <Check size={16} /> Guardado
                  </span>
                )}
                <button className="btn-primary" onClick={guardarFicha} disabled={guardandoFicha}>
                  <Save size={16} /> {guardandoFicha ? 'Guardando…' : 'Guardar ficha'}
                </button>
              </div>
            </div>

            {cargandoFicha ? (
              <Cargando />
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="label">Antecedentes</label>
                    <textarea className="input" rows={3} value={ficha.antecedentes} onChange={(e) => setFicha({ ...ficha, antecedentes: e.target.value })} />
                  </div>
                  <div>
                    <label className="label">Alergias</label>
                    <textarea className="input" rows={3} value={ficha.alergias} onChange={(e) => setFicha({ ...ficha, alergias: e.target.value })} />
                  </div>
                  <div>
                    <label className="label">Medicamentos</label>
                    <textarea className="input" rows={3} value={ficha.medicamentos} onChange={(e) => setFicha({ ...ficha, medicamentos: e.target.value })} />
                  </div>
                  <div>
                    <label className="label">Enfermedades</label>
                    <textarea className="input" rows={3} value={ficha.enfermedades} onChange={(e) => setFicha({ ...ficha, enfermedades: e.target.value })} />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div>
                    <label className="label">Grupo sanguíneo</label>
                    <select className="input" value={ficha.grupo_sanguineo} onChange={(e) => setFicha({ ...ficha, grupo_sanguineo: e.target.value })}>
                      <option value="">—</option>
                      {GRUPOS_SANGUINEOS.map((g) => (
                        <option key={g}>{g}</option>
                      ))}
                    </select>
                  </div>
                  <label className="flex items-center gap-2 self-end pb-2 text-sm text-slate-600">
                    <input type="checkbox" checked={ficha.embarazada} onChange={(e) => setFicha({ ...ficha, embarazada: e.target.checked })} />
                    Embarazada
                  </label>
                  <label className="flex items-center gap-2 self-end pb-2 text-sm text-slate-600">
                    <input type="checkbox" checked={ficha.fumador} onChange={(e) => setFicha({ ...ficha, fumador: e.target.checked })} />
                    Fumador
                  </label>
                </div>

                <div>
                  <label className="label">Observaciones</label>
                  <textarea className="input" rows={3} value={ficha.observaciones} onChange={(e) => setFicha({ ...ficha, observaciones: e.target.value })} />
                </div>
              </div>
            )}
          </div>

          <div>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-display text-lg font-bold uppercase text-slate-800">Evoluciones</h2>
              <button className="btn-primary" onClick={abrirNuevaEvolucion}>
                <Plus size={16} /> Nueva evolución
              </button>
            </div>

            {cargandoEvol ? (
              <Cargando />
            ) : (
              <DataTable
                rows={evoluciones}
                rowKey={(e) => e.id}
                searchText={(e) => `${fechaCorta(e.fecha)} ${e.motivo ?? ''} ${e.diagnostico ?? ''} ${e.procedimiento ?? ''} ${nombreProfesional(e.empleado_id)}`}
                searchPlaceholder="Buscar por motivo, diagnóstico o profesional…"
                emptyText="Aún no hay evoluciones registradas."
                columns={columnas}
              />
            )}
          </div>
        </div>
      )}

      <Modal
        open={open}
        title="Nueva evolución"
        onClose={() => setOpen(false)}
        footer={
          <>
            <button className="btn-ghost" onClick={() => setOpen(false)}>Cancelar</button>
            <button className="btn-primary" onClick={guardarEvolucion} disabled={saving}>
              {saving ? 'Guardando…' : 'Guardar'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Fecha</label>
              <input type="date" className="input" value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} />
            </div>
            <div>
              <label className="label">Profesional</label>
              <select className="input" value={form.empleado_id} onChange={(e) => setForm({ ...form, empleado_id: e.target.value })}>
                <option value="">—</option>
                {empleados.map((emp) => (
                  <option key={emp.id} value={emp.id}>{emp.nombre}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="label">Motivo</label>
            <input className="input" value={form.motivo} onChange={(e) => setForm({ ...form, motivo: e.target.value })} />
          </div>
          <div>
            <label className="label">Diagnóstico</label>
            <textarea className="input" rows={2} value={form.diagnostico} onChange={(e) => setForm({ ...form, diagnostico: e.target.value })} />
          </div>
          <div>
            <label className="label">Procedimiento</label>
            <textarea className="input" rows={2} value={form.procedimiento} onChange={(e) => setForm({ ...form, procedimiento: e.target.value })} />
          </div>
          <div>
            <label className="label">Indicaciones</label>
            <textarea className="input" rows={2} value={form.indicaciones} onChange={(e) => setForm({ ...form, indicaciones: e.target.value })} />
          </div>
          <div>
            <label className="label">Notas</label>
            <textarea className="input" rows={2} value={form.notas} onChange={(e) => setForm({ ...form, notas: e.target.value })} />
          </div>
        </div>
      </Modal>
    </div>
  )
}
