import { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { Articulo } from '../types'
import { money, conPrefijo } from '../lib/format'
import { useAuth } from '../lib/auth'
import { useNegocio } from '../lib/negocio'
import PageHeader from '../components/PageHeader'
import Cargando from '../components/Cargando'
import Modal from '../components/Modal'
import DataTable from '../components/DataTable'

const vacio = {
  nombre: '',
  categoria: 'General',
  descripcion: '',
  precio: 0,
  costo: 0,
  stock: 0,
  stock_min: 5,
  activo: true,
}

export default function Articulos() {
  const { puedeAccion } = useAuth()
  const { negocio } = useNegocio()
  const puedeEliminar = puedeAccion('articulos.eliminar')
  const [items, setItems] = useState<Articulo[]>([])
  const [categorias, setCategorias] = useState<string[]>(['General'])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [editCodigo, setEditCodigo] = useState<number | null>(null)
  const [form, setForm] = useState(vacio)
  const [saving, setSaving] = useState(false)

  // Próximo código de la secuencia (4 dígitos). En instalaciones nuevas empieza en 0000.
  const proximoCodigo = items.length ? Math.max(...items.map((a) => a.codigo)) + 1 : 0

  async function cargar() {
    setLoading(true)
    const [{ data }, { data: cats }] = await Promise.all([
      supabase.from('articulos').select('*').order('codigo'),
      supabase.from('categorias').select('nombre').eq('tipo', 'articulo').order('nombre'),
    ])
    setItems(data ?? [])
    if (cats && cats.length) setCategorias(cats.map((c: any) => c.nombre))
    setLoading(false)
  }

  useEffect(() => {
    cargar()
  }, [])

  function abrirNuevo() {
    setEditId(null)
    setEditCodigo(null)
    setForm(vacio)
    setOpen(true)
  }
  function abrirEditar(a: Articulo) {
    setEditId(a.id)
    setEditCodigo(a.codigo)
    setForm({
      nombre: a.nombre,
      categoria: a.categoria,
      descripcion: a.descripcion ?? '',
      precio: Number(a.precio),
      costo: Number(a.costo),
      stock: Number(a.stock),
      stock_min: Number(a.stock_min ?? 5),
      activo: a.activo,
    })
    setOpen(true)
  }

  async function guardar() {
    if (!form.nombre.trim()) return alert('El nombre es obligatorio')
    setSaving(true)
    const payload = { ...form, descripcion: form.descripcion || null }
    let error
    let codigoCreado: number | null = null
    if (editId) {
      ;({ error } = await supabase.from('articulos').update(payload).eq('id', editId))
    } else {
      // Insertar y recuperar el código (4 dígitos) que asignó la secuencia.
      const res = await supabase.from('articulos').insert(payload).select('codigo').single()
      error = res.error
      codigoCreado = res.data?.codigo ?? null
    }
    setSaving(false)
    if (error) return alert('Error al guardar: ' + error.message)
    setOpen(false)
    if (codigoCreado != null) alert(`Artículo creado con el código ${conPrefijo(negocio.prefijo_articulo, codigoCreado)}.`)
    cargar()
  }

  async function eliminar(a: Articulo) {
    if (!confirm(`¿Eliminar el artículo "${a.nombre}"?`)) return
    const { error } = await supabase.from('articulos').delete().eq('id', a.id)
    if (error) return alert('Error al eliminar: ' + error.message)
    cargar()
  }

  return (
    <div>
      <PageHeader
        title="Artículos / Productos"
        subtitle="Inventario de productos del salón"
        action={
          <button className="btn-primary" onClick={abrirNuevo}>
            <Plus size={16} /> Nuevo artículo
          </button>
        }
      />

      {loading ? (
        <Cargando />
      ) : (
        <DataTable
          rows={items}
          rowKey={(a) => a.id}
          searchText={(a) => `${a.nombre} ${a.categoria} ${conPrefijo(negocio.prefijo_articulo, a.codigo)}`}
          searchPlaceholder="Buscar por nombre, categoría o código…"
          emptyText={items.length === 0 ? 'Aún no hay artículos.' : 'No hay artículos que coincidan.'}
          columns={[
            { header: 'Código', cell: (a) => <span className="font-mono font-semibold text-brand-700">{conPrefijo(negocio.prefijo_articulo, a.codigo)}</span>, sortValue: (a) => a.codigo },
            {
              header: 'Artículo', sortValue: (a) => a.nombre, cell: (a) => (
                <>
                  <p className="font-medium text-slate-800">{a.nombre}</p>
                  {a.descripcion && <p className="text-xs text-slate-600">{a.descripcion}</p>}
                </>
              ),
            },
            { header: 'Categoría', cell: (a) => <span className="badge bg-brand-50 text-brand-700">{a.categoria}</span>, sortValue: (a) => a.categoria },
            { header: 'Costo', align: 'right', cell: (a) => <span className="text-slate-500">{money(a.costo)}</span>, sortValue: (a) => a.costo },
            { header: 'Precio', align: 'right', cell: (a) => <span className="font-semibold text-slate-800">{money(a.precio)}</span>, sortValue: (a) => a.precio },
            {
              header: 'Existencia', align: 'right', sortValue: (a) => a.stock, cell: (a) => (
                <span className={`badge ${Number(a.stock) <= 0 ? 'bg-rose-50 text-rose-700' : Number(a.stock) <= Number(a.stock_min) ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>
                  {Number(a.stock) <= 0 ? 'Agotado' : a.stock}
                </span>
              ),
            },
            {
              header: '', align: 'right', cell: (a) => (
                <div className="flex justify-end gap-1">
                  <button onClick={() => abrirEditar(a)} className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 hover:text-brand-600"><Pencil size={16} /></button>
                  {puedeEliminar && (
                    <button onClick={() => eliminar(a)} className="rounded-lg p-2 text-slate-600 hover:bg-rose-50 hover:text-rose-600"><Trash2 size={16} /></button>
                  )}
                </div>
              ),
            },
          ]}
        />
      )}

      <Modal
        open={open}
        title={editId ? 'Editar artículo' : 'Nuevo artículo'}
        onClose={() => setOpen(false)}
        footer={
          <>
            <button className="btn-ghost" onClick={() => setOpen(false)}>Cancelar</button>
            <button className="btn-primary" onClick={guardar} disabled={saving}>{saving ? 'Guardando…' : 'Guardar'}</button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="label">Código</label>
            <input
              className="input w-32 bg-slate-50 font-mono font-semibold text-brand-700"
              value={conPrefijo(negocio.prefijo_articulo, editId ? editCodigo : proximoCodigo)}
              readOnly
            />
            <p className="mt-1 text-xs text-slate-500">
              {editId ? 'Código del artículo.' : 'Se asigna automáticamente en secuencia de 4 dígitos.'}
            </p>
          </div>
          <div>
            <label className="label">Nombre</label>
            <input className="input" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} placeholder="Shampoo profesional" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Categoría</label>
              <select className="input" value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })}>
                {categorias.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Existencia</label>
              <input type="number" min={0} className="input" value={form.stock || ''} onChange={(e) => setForm({ ...form, stock: Number(e.target.value) })} />
            </div>
          </div>
          <div>
            <label className="label">Existencia mínima (alerta de bajo inventario)</label>
            <input type="number" min={0} className="input" value={form.stock_min || ''} onChange={(e) => setForm({ ...form, stock_min: Number(e.target.value) })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Costo (RD$)</label>
              <input type="number" min={0} step={10} className="input" value={form.costo || ''} onChange={(e) => setForm({ ...form, costo: Number(e.target.value) })} />
            </div>
            <div>
              <label className="label">Precio de venta (RD$)</label>
              <input type="number" min={0} step={10} className="input" value={form.precio || ''} onChange={(e) => setForm({ ...form, precio: Number(e.target.value) })} />
            </div>
          </div>
          <div>
            <label className="label">Descripción</label>
            <textarea className="input" rows={2} value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} />
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" checked={form.activo} onChange={(e) => setForm({ ...form, activo: e.target.checked })} />
            Artículo activo
          </label>
        </div>
      </Modal>
    </div>
  )
}
