import { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { Cliente } from '../types'
import { fechaCorta, conPrefijo } from '../lib/format'
import { useAuth } from '../lib/auth'
import { useNegocio } from '../lib/negocio'
import PageHeader from '../components/PageHeader'
import Cargando from '../components/Cargando'
import Modal from '../components/Modal'
import DataTable from '../components/DataTable'

const vacio = {
  nombre: '',
  telefono: '',
  email: '',
  fecha_nacimiento: '',
  notas: '',
}

export default function Clientes() {
  const { puedeAccion } = useAuth()
  const { negocio } = useNegocio()
  const puedeEliminar = puedeAccion('clientes.eliminar')
  const [items, setItems] = useState<Cliente[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState(vacio)
  const [saving, setSaving] = useState(false)

  async function cargar() {
    setLoading(true)
    const { data, error } = await supabase.from('clientes').select('*').order('nombre')
    if (error) alert('Error al cargar clientes: ' + error.message)
    setItems(data ?? [])
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

  function abrirEditar(c: Cliente) {
    setEditId(c.id)
    setForm({
      nombre: c.nombre,
      telefono: c.telefono ?? '',
      email: c.email ?? '',
      fecha_nacimiento: c.fecha_nacimiento ?? '',
      notas: c.notas ?? '',
    })
    setOpen(true)
  }

  async function guardar() {
    if (!form.nombre.trim()) return alert('El nombre es obligatorio')
    setSaving(true)
    const payload = {
      nombre: form.nombre,
      telefono: form.telefono || null,
      email: form.email || null,
      fecha_nacimiento: form.fecha_nacimiento || null,
      notas: form.notas || null,
    }
    const { error } = editId
      ? await supabase.from('clientes').update(payload).eq('id', editId)
      : await supabase.from('clientes').insert(payload)
    setSaving(false)
    if (error) return alert('Error al guardar: ' + error.message)
    setOpen(false)
    cargar()
  }

  async function eliminar(c: Cliente) {
    if (!confirm(`¿Eliminar a "${c.nombre}"?`)) return
    const { error } = await supabase.from('clientes').delete().eq('id', c.id)
    if (error) return alert('Error al eliminar: ' + error.message)
    cargar()
  }

  return (
    <div>
      <PageHeader
        title="Clientes"
        subtitle={`${items.length} cliente(s) registrados`}
        action={
          <button className="btn-primary" onClick={abrirNuevo}>
            <Plus size={16} /> Nuevo cliente
          </button>
        }
      />

      {loading ? (
        <Cargando />
      ) : (
        <DataTable
          rows={items}
          rowKey={(c) => c.id}
          searchText={(c) => `${conPrefijo(negocio.prefijo_cliente, c.codigo)} ${c.nombre} ${c.telefono ?? ''} ${c.email ?? ''}`}
          searchPlaceholder="Buscar por código, nombre, teléfono o email…"
          emptyText={items.length === 0 ? 'Aún no hay clientes.' : 'No hay clientes que coincidan.'}
          columns={[
            { header: 'Código', cell: (c) => <span className="font-mono font-semibold text-brand-700">{conPrefijo(negocio.prefijo_cliente, c.codigo)}</span>, sortValue: (c) => c.codigo },
            { header: 'Nombre', cell: (c) => <span className="font-medium text-slate-800">{c.nombre}</span>, sortValue: (c) => c.nombre },
            { header: 'Teléfono', cell: (c) => <span className="text-slate-600">{c.telefono || '—'}</span>, sortValue: (c) => c.telefono ?? '' },
            { header: 'Email', cell: (c) => <span className="text-slate-600">{c.email || '—'}</span>, sortValue: (c) => c.email ?? '' },
            { header: 'Nacimiento', cell: (c) => <span className="text-slate-600">{c.fecha_nacimiento ? fechaCorta(c.fecha_nacimiento) : '—'}</span>, sortValue: (c) => c.fecha_nacimiento ?? '' },
            {
              header: '', align: 'right', cell: (c) => (
                <div className="flex justify-end gap-1">
                  <button onClick={() => abrirEditar(c)} className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 hover:text-brand-600">
                    <Pencil size={16} />
                  </button>
                  {puedeEliminar && (
                    <button onClick={() => eliminar(c)} className="rounded-lg p-2 text-slate-600 hover:bg-rose-50 hover:text-rose-600">
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              ),
            },
          ]}
        />
      )}

      <Modal
        open={open}
        title={editId ? 'Editar cliente' : 'Nuevo cliente'}
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
            <input className="input" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Teléfono</label>
              <input className="input" value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} />
            </div>
            <div>
              <label className="label">Fecha de nacimiento</label>
              <input type="date" className="input" value={form.fecha_nacimiento} onChange={(e) => setForm({ ...form, fecha_nacimiento: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="label">Email</label>
            <input type="email" className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div>
            <label className="label">Notas</label>
            <textarea className="input" rows={2} value={form.notas} onChange={(e) => setForm({ ...form, notas: e.target.value })} placeholder="Preferencias, alergias, etc." />
          </div>
        </div>
      </Modal>
    </div>
  )
}
