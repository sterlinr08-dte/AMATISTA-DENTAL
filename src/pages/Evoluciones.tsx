import { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2, Save, Stethoscope, ArrowRight } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { Cliente, Empleado, Evolucion } from '../types'
import { fechaCorta, hoyISO } from '../lib/format'
import PageHeader from '../components/PageHeader'
import Cargando from '../components/Cargando'
import Modal from '../components/Modal'
import SelectorPaciente from '../components/SelectorPaciente'

const vacio = { fecha: hoyISO(), empleado_id: '', motivo: '', nota: '', proximo: '' }

export default function Evoluciones({ pacienteFijo }: { pacienteFijo?: string } = {}) {
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [empleados, setEmpleados] = useState<Empleado[]>([])
  const [pacienteId, setPacienteId] = useState<string>(pacienteFijo ?? '')
  const [items, setItems] = useState<Evolucion[]>([])
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
    const { data } = await supabase.from('evoluciones').select('*').eq('cliente_id', pid).order('fecha', { ascending: false }).order('created_at', { ascending: false })
    setItems((data as Evolucion[]) ?? [])
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
  function editar(e: Evolucion) {
    setEditId(e.id)
    setForm({ fecha: e.fecha, empleado_id: e.empleado_id ?? '', motivo: e.motivo ?? '', nota: e.nota, proximo: e.proximo ?? '' })
    setOpen(true)
  }
  async function guardar() {
    if (!form.nota.trim()) return alert('Escribe la evolución (qué se hizo).')
    setSaving(true)
    const payload = {
      cliente_id: pacienteId,
      empleado_id: form.empleado_id || null,
      fecha: form.fecha,
      motivo: form.motivo || null,
      nota: form.nota.trim(),
      proximo: form.proximo || null,
    }
    const { error } = editId
      ? await supabase.from('evoluciones').update(payload).eq('id', editId)
      : await supabase.from('evoluciones').insert(payload)
    setSaving(false)
    if (error) return alert('Error al guardar: ' + error.message)
    setOpen(false)
    cargar(pacienteId)
  }
  async function eliminar(e: Evolucion) {
    if (!confirm('¿Eliminar esta evolución?')) return
    await supabase.from('evoluciones').delete().eq('id', e.id)
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
                    {e.motivo && <p className="mt-1.5 text-sm font-semibold text-slate-700">Motivo: <span className="font-normal">{e.motivo}</span></p>}
                    <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{e.nota}</p>
                    {e.proximo && (
                      <p className="mt-2 flex items-start gap-1.5 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
                        <ArrowRight size={15} className="mt-0.5 shrink-0" /> <span><b>Próximo / indicaciones:</b> {e.proximo}</span>
                      </p>
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
            <label className="label">Motivo de la visita (opcional)</label>
            <input className="input" value={form.motivo} onChange={(e) => setForm({ ...form, motivo: e.target.value })} placeholder="Ej. dolor en molar inferior derecho" />
          </div>
          <div>
            <label className="label">Evolución — qué se hizo / hallazgos</label>
            <textarea className="input" rows={5} value={form.nota} onChange={(e) => setForm({ ...form, nota: e.target.value })} placeholder="Descripción del tratamiento realizado, hallazgos, observaciones…" />
          </div>
          <div>
            <label className="label">Próximo / indicaciones (opcional)</label>
            <input className="input" value={form.proximo} onChange={(e) => setForm({ ...form, proximo: e.target.value })} placeholder="Ej. control en 1 semana, tomar analgésico si duele" />
          </div>
        </div>
      </Modal>
    </div>
  )
}
