import { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2, Scissors, Search } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { Servicio } from '../types'
import { money } from '../lib/format'
import { useAuth } from '../lib/auth'
import PageHeader from '../components/PageHeader'
import Cargando from '../components/Cargando'
import Modal from '../components/Modal'

const vacio = {
  nombre: '',
  categoria: 'General',
  descripcion: '',
  duracion_min: 30,
  precio: 0,
  comision_pct: '' as number | '',
  activo: true,
}

export default function Servicios() {
  const { puedeAccion } = useAuth()
  const puedeEliminar = puedeAccion('servicios.eliminar')
  const [items, setItems] = useState<Servicio[]>([])
  const [categorias, setCategorias] = useState<string[]>(['General'])
  const [busqueda, setBusqueda] = useState('')
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState(vacio)
  const [saving, setSaving] = useState(false)

  const q = busqueda.trim().toLowerCase()
  const filtrados = q
    ? items.filter((s) => s.nombre.toLowerCase().includes(q) || s.categoria.toLowerCase().includes(q) || (s.descripcion ?? '').toLowerCase().includes(q))
    : items

  async function cargar() {
    setLoading(true)
    const [{ data, error }, { data: cats }] = await Promise.all([
      supabase.from('servicios').select('*').order('categoria').order('nombre'),
      supabase.from('categorias').select('nombre').eq('tipo', 'servicio').order('nombre'),
    ])
    if (error) alert('Error al cargar servicios: ' + error.message)
    setItems(data ?? [])
    if (cats && cats.length) setCategorias(cats.map((c: any) => c.nombre))
    setLoading(false)
  }

  useEffect(() => {
    cargar()
  }, [])

  function abrirNuevo() {
    setEditId(null)
    setForm(vacio)
    setOpen(true)
  }

  function abrirEditar(s: Servicio) {
    setEditId(s.id)
    setForm({
      nombre: s.nombre,
      categoria: s.categoria,
      descripcion: s.descripcion ?? '',
      duracion_min: s.duracion_min,
      precio: Number(s.precio),
      comision_pct: s.comision_pct == null ? '' : Number(s.comision_pct),
      activo: s.activo,
    })
    setOpen(true)
  }

  async function guardar() {
    if (!form.nombre.trim()) return alert('El nombre es obligatorio')
    setSaving(true)
    const payload = {
      ...form,
      descripcion: form.descripcion || null,
      comision_pct: form.comision_pct === '' ? null : Number(form.comision_pct),
    }
    const { error } = editId
      ? await supabase.from('servicios').update(payload).eq('id', editId)
      : await supabase.from('servicios').insert(payload)
    setSaving(false)
    if (error) return alert('Error al guardar: ' + error.message)
    setOpen(false)
    cargar()
  }

  async function eliminar(s: Servicio) {
    if (!confirm(`¿Eliminar el servicio "${s.nombre}"?`)) return
    const { error } = await supabase.from('servicios').delete().eq('id', s.id)
    if (error) return alert('Error al eliminar: ' + error.message)
    cargar()
  }

  return (
    <div>
      <PageHeader
        title="Servicios y precios"
        subtitle="Catálogo de servicios del salón"
        action={
          <button className="btn-primary" onClick={abrirNuevo}>
            <Plus size={16} /> Nuevo servicio
          </button>
        }
      />

      {items.length > 0 && (
        <div className="relative mb-4 max-w-md">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" />
          <input className="input pl-9" placeholder="Buscar por nombre, categoría o descripción…" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
        </div>
      )}

      {loading ? (
        <Cargando />
      ) : items.length === 0 ? (
        <div className="card flex flex-col items-center gap-3 py-12 text-center">
          <Scissors className="text-brand-300" size={40} />
          <p className="text-slate-500">Aún no hay servicios. Agrega el primero.</p>
        </div>
      ) : filtrados.length === 0 ? (
        <div className="card flex flex-col items-center gap-3 py-12 text-center">
          <Search className="text-brand-300" size={40} />
          <p className="text-slate-500">No hay servicios que coincidan con «{busqueda}».</p>
        </div>
      ) : (
        <div className="overflow-x-auto panel-3d">
          <table className="min-w-full divide-y divide-slate-100 text-sm">
            <thead className="thead-3d">
              <tr>
                <th className="px-5 py-3">Servicio</th>
                <th className="px-5 py-3">Categoría</th>
                <th className="px-5 py-3">Duración</th>
                <th className="px-5 py-3 text-right">Comisión</th>
                <th className="px-5 py-3 text-right">Precio</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtrados.map((s) => (
                <tr key={s.id} className={s.activo ? '' : 'opacity-50'}>
                  <td className="px-5 py-3">
                    <p className="font-medium text-slate-800">{s.nombre}</p>
                    {s.descripcion && <p className="text-xs text-slate-600">{s.descripcion}</p>}
                  </td>
                  <td className="px-5 py-3">
                    <span className="badge bg-brand-50 text-brand-700">{s.categoria}</span>
                  </td>
                  <td className="px-5 py-3 text-slate-600">{s.duracion_min} min</td>
                  <td className="px-5 py-3 text-right text-slate-600">
                    {s.comision_pct == null ? <span className="text-slate-400">— empleado</span> : `${Number(s.comision_pct)}%`}
                  </td>
                  <td className="px-5 py-3 text-right font-semibold text-slate-800">{money(s.precio)}</td>
                  <td className="px-5 py-3">
                    <div className="flex justify-end gap-1">
                      <button onClick={() => abrirEditar(s)} className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 hover:text-brand-600">
                        <Pencil size={16} />
                      </button>
                      {puedeEliminar && (
                        <button onClick={() => eliminar(s)} className="rounded-lg p-2 text-slate-600 hover:bg-rose-50 hover:text-rose-600">
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={open}
        title={editId ? 'Editar servicio' : 'Nuevo servicio'}
        onClose={() => setOpen(false)}
        footer={
          <>
            <button className="btn-ghost" onClick={() => setOpen(false)}>Cancelar</button>
            <button className="btn-primary" onClick={guardar} disabled={saving}>
              {saving ? 'Guardando…' : 'Guardar'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="label">Nombre</label>
            <input className="input" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} placeholder="Limpieza dental" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Categoría</label>
              <select className="input" value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })}>
                {categorias.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Duración (min)</label>
              <input type="number" min={5} step={5} className="input" value={form.duracion_min || ''} onChange={(e) => setForm({ ...form, duracion_min: Number(e.target.value) })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Precio (RD$)</label>
              <input type="number" min={0} step={50} className="input" value={form.precio || ''} onChange={(e) => setForm({ ...form, precio: Number(e.target.value) })} />
            </div>
            <div>
              <label className="label">% Comisión</label>
              <input
                type="number"
                min={0}
                max={100}
                step={1}
                className="input"
                value={form.comision_pct}
                onChange={(e) => setForm({ ...form, comision_pct: e.target.value === '' ? '' : Number(e.target.value) })}
                placeholder="Usa el % del empleado"
              />
              <p className="mt-1 text-xs text-slate-500">Déjalo vacío para usar el % de cada empleado.</p>
            </div>
          </div>
          <div>
            <label className="label">Descripción</label>
            <textarea className="input" rows={2} value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} />
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" checked={form.activo} onChange={(e) => setForm({ ...form, activo: e.target.checked })} />
            Servicio activo
          </label>
        </div>
      </Modal>
    </div>
  )
}
