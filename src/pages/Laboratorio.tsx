import { useEffect, useMemo, useState } from 'react'
import { Plus, Pencil, Trash2, Save, FlaskConical, CalendarClock } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { Cliente, Empleado, OrdenLaboratorio } from '../types'
import { money, fechaCorta, hoyISO } from '../lib/format'
import { TIPOS_TRABAJO, labelTrabajo, ESTADOS_ORDEN, estadoOrdenDef, ESTADOS_ACTIVOS, codigoOrden } from '../lib/laboratorio'
import PageHeader from '../components/PageHeader'
import Cargando from '../components/Cargando'
import Modal from '../components/Modal'
import SelectorPaciente from '../components/SelectorPaciente'

type OrdenConCliente = OrdenLaboratorio & { cliente: Pick<Cliente, 'id' | 'nombre'> | null }

const vacio = {
  cliente_id: '', empleado_id: '', laboratorio: '', tipo_trabajo: 'corona',
  descripcion: '', dientes: '', color: '', fecha_estimada: '', costo: 0, notas: '',
}

export default function Laboratorio({ pacienteFijo }: { pacienteFijo?: string } = {}) {
  const [items, setItems] = useState<OrdenConCliente[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [empleados, setEmpleados] = useState<Empleado[]>([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState<'curso' | 'listas' | 'todas'>('curso')

  const [open, setOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState({ ...vacio, cliente_id: pacienteFijo ?? '' })
  const [saving, setSaving] = useState(false)

  async function cargar() {
    setLoading(true)
    let q = supabase.from('ordenes_laboratorio').select('*, cliente:clientes(id,nombre)').order('numero', { ascending: false })
    if (pacienteFijo) q = q.eq('cliente_id', pacienteFijo)
    const [{ data }, cl, em] = await Promise.all([
      q,
      supabase.from('clientes').select('*').order('nombre'),
      supabase.from('empleados').select('*').eq('activo', true).order('nombre'),
    ])
    setItems((data as OrdenConCliente[]) ?? [])
    setClientes(cl.data ?? [])
    setEmpleados(em.data ?? [])
    setLoading(false)
  }
  useEffect(() => { cargar() /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [pacienteFijo])

  const hoy = hoyISO()
  const visibles = useMemo(() => {
    if (filtro === 'curso') return items.filter((o) => ESTADOS_ACTIVOS.includes(o.estado))
    if (filtro === 'listas') return items.filter((o) => o.estado === 'RECIBIDA' || o.estado === 'ENTREGADA')
    return items
  }, [items, filtro])
  const nCurso = items.filter((o) => ESTADOS_ACTIVOS.includes(o.estado)).length

  function nombreEmpleado(id: string | null): string { return empleados.find((e) => e.id === id)?.nombre ?? '—' }

  function nuevo() {
    setEditId(null)
    setForm({ ...vacio, cliente_id: pacienteFijo ?? '' })
    setOpen(true)
  }
  function editar(o: OrdenConCliente) {
    setEditId(o.id)
    setForm({
      cliente_id: o.cliente_id, empleado_id: o.empleado_id ?? '', laboratorio: o.laboratorio ?? '',
      tipo_trabajo: o.tipo_trabajo, descripcion: o.descripcion ?? '', dientes: o.dientes ?? '',
      color: o.color ?? '', fecha_estimada: o.fecha_estimada ?? '', costo: Number(o.costo), notas: o.notas ?? '',
    })
    setOpen(true)
  }
  async function guardar() {
    if (!form.cliente_id) return alert('Selecciona el paciente.')
    setSaving(true)
    const payload = {
      cliente_id: form.cliente_id,
      empleado_id: form.empleado_id || null,
      laboratorio: form.laboratorio || null,
      tipo_trabajo: form.tipo_trabajo,
      descripcion: form.descripcion || null,
      dientes: form.dientes || null,
      color: form.color || null,
      fecha_estimada: form.fecha_estimada || null,
      costo: Number(form.costo) || 0,
      notas: form.notas || null,
    }
    const { error } = editId
      ? await supabase.from('ordenes_laboratorio').update(payload).eq('id', editId)
      : await supabase.from('ordenes_laboratorio').insert(payload)
    setSaving(false)
    if (error) return alert('Error al guardar: ' + error.message)
    setOpen(false)
    cargar()
  }

  // Cambiar estado; al enviar/recibir se marcan las fechas automáticamente.
  async function cambiarEstado(o: OrdenConCliente, estado: OrdenLaboratorio['estado']) {
    const patch: any = { estado }
    if (estado === 'ENVIADA' && !o.fecha_envio) patch.fecha_envio = hoyISO()
    if (estado === 'RECIBIDA' && !o.fecha_recibido) patch.fecha_recibido = hoyISO()
    await supabase.from('ordenes_laboratorio').update(patch).eq('id', o.id)
    cargar()
  }
  async function eliminar(o: OrdenConCliente) {
    if (!confirm(`¿Eliminar la orden ${codigoOrden(o.numero)}?`)) return
    await supabase.from('ordenes_laboratorio').delete().eq('id', o.id)
    cargar()
  }

  return (
    <div>
      {pacienteFijo ? (
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-700">{items.length} orden(es) de laboratorio</h3>
          <button className="btn-primary" onClick={nuevo}><Plus size={16} /> Nueva orden</button>
        </div>
      ) : (
        <PageHeader
          title="Laboratorio"
          subtitle={nCurso > 0 ? `${nCurso} trabajo(s) en curso` : 'Órdenes de trabajo al laboratorio'}
          action={<button className="btn-primary" onClick={nuevo}><Plus size={16} /> Nueva orden</button>}
        />
      )}

      <div className="mb-4 flex gap-2">
        {([['curso', `En curso (${nCurso})`], ['listas', 'Recibidas / entregadas'], ['todas', 'Todas']] as const).map(([k, l]) => (
          <button key={k} onClick={() => setFiltro(k)} className={filtro === k ? 'btn-primary' : 'btn-ghost'}>{l}</button>
        ))}
      </div>

      {loading ? (
        <Cargando />
      ) : visibles.length === 0 ? (
        <div className="card flex flex-col items-center gap-3 py-12 text-center">
          <FlaskConical className="text-brand-300" size={40} />
          <p className="text-slate-500">{filtro === 'curso' ? 'No hay trabajos en curso.' : 'No hay órdenes en esta vista.'}</p>
          <button className="btn-primary" onClick={nuevo}><Plus size={16} /> Nueva orden</button>
        </div>
      ) : (
        <div className="space-y-2.5">
          {visibles.map((o) => {
            const atrasada = o.fecha_estimada && o.fecha_estimada < hoy && ESTADOS_ACTIVOS.includes(o.estado)
            return (
              <div key={o.id} className="card flex flex-wrap items-center gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono font-semibold text-brand-700">{codigoOrden(o.numero)}</span>
                    <span className="font-semibold text-slate-800">{labelTrabajo(o.tipo_trabajo)}</span>
                    {o.dientes && <span className="text-xs font-medium text-slate-500">· diente(s) {o.dientes}</span>}
                    {o.color && <span className="badge bg-slate-100 text-slate-600">Tono {o.color}</span>}
                  </div>
                  <p className="mt-0.5 text-sm text-slate-500">
                    {!pacienteFijo && <>{o.cliente?.nombre ?? 'Paciente'} · </>}
                    {o.laboratorio || 'Sin laboratorio'}{o.empleado_id ? ` · Dr(a). ${nombreEmpleado(o.empleado_id)}` : ''}
                  </p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-3 text-xs text-slate-500">
                    {o.fecha_estimada && (
                      <span className={`inline-flex items-center gap-1 ${atrasada ? 'font-semibold text-rose-600' : ''}`}>
                        <CalendarClock size={12} /> Entrega {fechaCorta(o.fecha_estimada)}{atrasada ? ' (atrasada)' : ''}
                      </span>
                    )}
                    {Number(o.costo) > 0 && <span>Costo lab.: {money(Number(o.costo))}</span>}
                  </p>
                </div>

                <select
                  className={`badge cursor-pointer border-0 ${estadoOrdenDef(o.estado).color}`}
                  value={o.estado}
                  onChange={(e) => cambiarEstado(o, e.target.value as OrdenLaboratorio['estado'])}
                >
                  {ESTADOS_ORDEN.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>

                <div className="flex gap-1">
                  <button onClick={() => editar(o)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-brand-600"><Pencil size={15} /></button>
                  <button onClick={() => eliminar(o)} className="rounded-lg p-2 text-slate-500 hover:bg-rose-50 hover:text-rose-600"><Trash2 size={15} /></button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <Modal
        open={open}
        title={editId ? 'Editar orden de laboratorio' : 'Nueva orden de laboratorio'}
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
              <label className="label">Paciente</label>
              {pacienteFijo ? (
                <input className="input bg-slate-50" value={clientes.find((c) => c.id === form.cliente_id)?.nombre ?? ''} readOnly />
              ) : (
                <SelectorPaciente clientes={clientes} value={form.cliente_id} onChange={(id) => setForm({ ...form, cliente_id: id })} />
              )}
            </div>
            <div>
              <label className="label">Odontólogo</label>
              <select className="input" value={form.empleado_id} onChange={(e) => setForm({ ...form, empleado_id: e.target.value })}>
                <option value="">— Sin asignar —</option>
                {empleados.map((em) => <option key={em.id} value={em.id}>{em.nombre}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Tipo de trabajo</label>
              <select className="input" value={form.tipo_trabajo} onChange={(e) => setForm({ ...form, tipo_trabajo: e.target.value })}>
                {TIPOS_TRABAJO.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Laboratorio</label>
              <input className="input" value={form.laboratorio} onChange={(e) => setForm({ ...form, laboratorio: e.target.value })} placeholder="Nombre del laboratorio" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="label">Diente(s)</label>
              <input className="input" value={form.dientes} onChange={(e) => setForm({ ...form, dientes: e.target.value })} placeholder="Ej. 11, 21" />
            </div>
            <div>
              <label className="label">Tono / color</label>
              <input className="input" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} placeholder="Ej. A2" />
            </div>
            <div>
              <label className="label">Costo lab. (RD$)</label>
              <input type="number" min={0} step={50} className="input" value={form.costo || ''} onChange={(e) => setForm({ ...form, costo: Number(e.target.value) })} />
            </div>
          </div>
          <div>
            <label className="label">Fecha estimada de entrega</label>
            <input type="date" className="input w-48" value={form.fecha_estimada} onChange={(e) => setForm({ ...form, fecha_estimada: e.target.value })} />
          </div>
          <div>
            <label className="label">Descripción / indicaciones</label>
            <textarea className="input" rows={2} value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} placeholder="Detalles del trabajo para el laboratorio" />
          </div>
          <div>
            <label className="label">Notas</label>
            <input className="input" value={form.notas} onChange={(e) => setForm({ ...form, notas: e.target.value })} />
          </div>
        </div>
      </Modal>
    </div>
  )
}
