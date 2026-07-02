import { useEffect, useState } from 'react'
import { Save, FileText, Check } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { Cliente, HistoriaClinica as Ficha } from '../types'
import { GRUPOS_SANGUINEOS } from '../lib/dental'
import PageHeader from '../components/PageHeader'
import Cargando from '../components/Cargando'
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

export default function HistoriaClinica({ pacienteFijo }: { pacienteFijo?: string } = {}) {
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [pacienteId, setPacienteId] = useState<string>(pacienteFijo ?? '')

  const [cargandoFicha, setCargandoFicha] = useState(false)
  const [ficha, setFicha] = useState(fichaVacia)
  const [guardandoFicha, setGuardandoFicha] = useState(false)
  const [guardado, setGuardado] = useState(false)

  // Carga inicial: solo pacientes (las evoluciones viven en la pestaña Evoluciones).
  useEffect(() => {
    supabase.from('clientes').select('*').order('nombre').then(({ data, error }) => {
      if (error) alert('Error al cargar pacientes: ' + error.message)
      setClientes(data ?? [])
    })
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

  // Al cambiar de paciente, recargar la ficha.
  useEffect(() => {
    if (!pacienteId) {
      setFicha(fichaVacia)
      return
    }
    setGuardado(false)
    cargarFicha(pacienteId)
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

  return (
    <div>
      {!pacienteFijo && (
        <>
          <PageHeader title="Historia clínica" subtitle="Antecedentes y ficha clínica del paciente" />
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
        </div>
      )}
    </div>
  )
}
