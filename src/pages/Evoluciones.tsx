import { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2, Save, Stethoscope } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { Cliente, Empleado, HistoriaEvolucion } from '../types'
import { fechaCorta, hoyISO } from '../lib/format'
import PageHeader from '../components/PageHeader'
import Cargando from '../components/Cargando'
import Modal from '../components/Modal'
import SelectorPaciente from '../components/SelectorPaciente'

const vacio = { fecha: hoyISO(), empleado_id: '', motivo: '', diagnostico: '', procedimiento: '', indicaciones: '', notas: '' }

export default function Evoluciones({ pacienteFijo }: { pacienteFijo?: string } = {}) {
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [empleados, setEmpleados] = useState<Empleado[]>([])
  const [pacienteId, setPacienteId] = useState<string>(pacienteFijo ?? '')
  const [items, setItems] = useState<HistoriaEvolucion[]>([])
  const [cargando, setCargando] = useState(false)

  const [open, setOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState(vacio)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    Promise.all([
      supabase.from('clientes').select('*').order('nombre'),
      supabase.from('empleados').select('*').eq('activo', true).order('nombre'),
    ]).then(([cl, em]) => { setClientes(cl.data ?? []); setEmpleados(em.data ?? []) })
  }, [])
  useEffect(() => { if (pacienteFijo != null) setPacienteId(pacienteFijo) }, [pacienteFijo])

  async function cargar(pid: string) {
    setCargando(true)
    const { data } = await supabase.from('historia_evoluciones').select('*').eq('cliente_id', pid).order('fecha', { ascending: false }).order('created_at', { ascending: false })
    setItems((data as HistoriaEvolucion[]) ?? [])
    setCargando(false)
  }
  useEffect(() => {
    if (!pacienteId) { setItems([]); return }
    cargar(pacienteId)
  }, [pacienteId])

  function nombreEmpleado(id: string | null): string {
    return empleados.find((e) => e.id === id)?.nombre ?? 'Sin asignar'
  }

  function nuevo() {
    setEditId(null)
    setForm({ ...vacio, fecha: hoyISO() })
    setOpen(true)
  }
  function editar(e: HistoriaEvolucion) {
    setEditId(e.id)
    setForm({
      fecha: e.fecha, empleado_id: e.empleado_id ?? '', motivo: e.motivo ?? '',
      diagnostico: e.diagnostico ?? '', procedimiento: e.procedimiento ?? '',
      indicaciones: e.indicaciones ?? '', notas: e.notas ?? '',
    })
    setOpen(true)
  }
  async function guardar() {
    if (!form.motivo.trim() && !form.procedimiento.trim() && !form.notas.trim()) {
      return alert('Escribe al menos el motivo, el procedimiento o una nota.')
    }
    setSaving(true)
    const payload = {
      cliente_id: pacienteId,
      empleado_id: form.empleado_id || null,
      fecha: form.fecha,
      motivo: form.motivo || null,
      diagnostico: form.diagnostico || null,
      procedimiento: form.procedimiento || null,
      indicaciones: form.indicaciones || null,
      notas: form.notas || null,
    }
    const { error } = editId
      ? await supabase.from('historia_evoluciones').update(payload).eq('id', editId)
      : await supabase.from('historia_evoluciones').insert(payload)
    setSaving(false)
    if (error) return alert('Error al guardar: ' + error.message)
    setOpen(false)
    cargar(pacienteId)
  }
  async function eliminar(e: HistoriaEvolucion) {
    if (!confirm('¿Eliminar esta evolución?')) return
    await supabase.from('historia_evoluciones').delete().eq('id', e.id)
    cargar(pacienteId)
  }

  return (
    <div>
      {!pacienteFijo && (
        <>
          <PageHeader title="Evoluciones clínicas" subtitle="Qué se hizo en cada visita" />
          <div className="card mb-6 max-w-md">
            <label className="label">Paciente</label>
            <SelectorPaciente clientes={clientes} value={pacienteId} onChange={setPacienteId} />
          </div>
        </>
      )}

      {!pacienteId ? (
        <div className="card flex flex-col items-center gap-3 py-12 text-center">
          <Stethoscope className="text-brand-300" size={40} />
          <p className="text-slate-500">Selecciona un paciente para ver sus evoluciones.</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-700">{items.length} evolución(es)</h3>
            <button className="btn-primary" onClick={nuevo}><Plus size={16} /> Nueva evolución</button>
          </div>

          {cargando ? (
            <Cargando />
          ) : items.length === 0 ? (
            <div className="card flex flex-col items-center gap-3 py-12 text-center">
              <Stethoscope className="text-brand-300" size={40} />
              <p className="text-slate-500">Aún no hay evoluciones. Registra la primera visita.</p>
            </div>
          ) : (
            <div className="relative space-y-4 before:absolute before:left-[7px] before:top-1 before:h-full before:w-0.5 before:bg-amber-100">
              {items.map((e) => (
                <div key={e.id} className="relative pl-7">
                  <span className="absolute left-0 top-1.5 h-3.5 w-3.5 rounded-full border-2 border-white bg-brand-500 shadow" />
                  <div className="card">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-slate-800">{fechaCorta(e.fecha)}</span>
                        <span className="badge bg-brand-50 text-brand-700">{nombreEmpleado(e.empleado_id)}</span>
                      </div>
                      <div className="flex gap-1">
                        <button onClick={() => editar(e)} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-brand-600"><Pencil size={15} /></button>
                        <button onClick={() => eliminar(e)} className="rounded-lg p-1.5 text-slate-500 hover:bg-rose-50 hover:text-rose-600"><Trash2 size={15} /></button>
                      </div>
                    </div>
                    {e.motivo && <p className="mt-1.5 text-sm text-slate-700"><b>Motivo:</b> {e.motivo}</p>}
                    {e.diagnostico && <p className="mt-1 text-sm text-slate-700"><b>Diagnóstico:</b> {e.diagnostico}</p>}
                    {e.procedimiento && <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700"><b>Procedimiento:</b> {e.procedimiento}</p>}
                    {e.notas && <p className="mt-1 whitespace-pre-wrap text-sm text-slate-600">{e.notas}</p>}
                    {e.indicaciones && (
                      <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800"><b>Indicaciones:</b> {e.indicaciones}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <Modal
        open={open}
        title={editId ? 'Editar evolución' : 'Nueva evolución'}
        onClose={() => setOpen(false)}
        footer={
          <>
            <button className="btn-ghost" onClick={() => setOpen(false)}>Cancelar</button>
            <button className="btn-primary" onClick={guardar} disabled={saving}><Save size={16} /> {saving ? 'Guardando…' : 'Guardar'}</button>
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
                <option value="">— Sin asignar —</option>
                {empleados.map((em) => <option key={em.id} value={em.id}>{em.nombre}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="label">Motivo de la visita</label>
            <input className="input" value={form.motivo} onChange={(e) => setForm({ ...form, motivo: e.target.value })} placeholder="Ej. dolor en molar inferior derecho" />
          </div>
          <div>
            <label className="label">Diagnóstico</label>
            <textarea className="input" rows={2} value={form.diagnostico} onChange={(e) => setForm({ ...form, diagnostico: e.target.value })} />
          </div>
          <div>
            <label className="label">Procedimiento realizado</label>
            <textarea className="input" rows={3} value={form.procedimiento} onChange={(e) => setForm({ ...form, procedimiento: e.target.value })} placeholder="Qué se hizo en la visita" />
          </div>
          <div>
            <label className="label">Indicaciones</label>
            <input className="input" value={form.indicaciones} onChange={(e) => setForm({ ...form, indicaciones: e.target.value })} placeholder="Ej. control en 1 semana, analgésico si duele" />
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
