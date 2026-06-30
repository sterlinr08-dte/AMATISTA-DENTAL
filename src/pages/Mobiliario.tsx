import { useEffect, useRef, useState } from 'react'
import { Plus, Pencil, Trash2, ImageOff, Upload, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { Mobiliario as MobiliarioItem } from '../types'
import { money, conPrefijo } from '../lib/format'
import { CATEGORIAS_MOBILIARIO, ESTADOS_MOBILIARIO } from '../lib/constants'
import { useAuth } from '../lib/auth'
import { useNegocio } from '../lib/negocio'
import PageHeader from '../components/PageHeader'
import Cargando from '../components/Cargando'
import Modal from '../components/Modal'
import DataTable from '../components/DataTable'

const vacio = {
  nombre: '',
  categoria: 'Mobiliario',
  cantidad: 1,
  estado: 'BUENO' as 'BUENO' | 'REGULAR' | 'DANADO',
  ubicacion: '',
  costo: 0,
  fecha_compra: '',
  proveedor: '',
  serie: '',
  foto_url: '' as string | null,
  notas: '',
  activo: true,
}

const COLOR_ESTADO: Record<string, string> = {
  BUENO: 'bg-emerald-50 text-emerald-700',
  REGULAR: 'bg-amber-50 text-amber-700',
  DANADO: 'bg-rose-50 text-rose-700',
}
const etiquetaEstado = (e: string) => ESTADOS_MOBILIARIO.find((x) => x.value === e)?.label ?? e

export default function Mobiliario() {
  const { puedeAccion } = useAuth()
  const { negocio } = useNegocio()
  const puedeEliminar = puedeAccion('mobiliario.eliminar')
  const [items, setItems] = useState<MobiliarioItem[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [editCodigo, setEditCodigo] = useState<number | null>(null)
  const [form, setForm] = useState(vacio)
  const [saving, setSaving] = useState(false)
  const [subiendo, setSubiendo] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  // Próximo código (4 dígitos). En instalaciones nuevas empieza en 0000.
  const proximoCodigo = items.length ? Math.max(...items.map((a) => a.codigo)) + 1 : 0
  // Valor total del mobiliario (costo × cantidad de los bienes activos).
  const valorTotal = items.reduce((s, a) => s + Number(a.costo) * Number(a.cantidad), 0)

  async function cargar() {
    setLoading(true)
    const { data } = await supabase.from('mobiliario').select('*').order('codigo')
    setItems(data ?? [])
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
  function abrirEditar(a: MobiliarioItem) {
    setEditId(a.id)
    setEditCodigo(a.codigo)
    setForm({
      nombre: a.nombre,
      categoria: a.categoria,
      cantidad: Number(a.cantidad),
      estado: a.estado,
      ubicacion: a.ubicacion ?? '',
      costo: Number(a.costo),
      fecha_compra: a.fecha_compra ?? '',
      proveedor: a.proveedor ?? '',
      serie: a.serie ?? '',
      foto_url: a.foto_url ?? '',
      notas: a.notas ?? '',
      activo: a.activo,
    })
    setOpen(true)
  }

  async function elegirFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) return alert('La foto es muy grande (máximo 5 MB).')
    setSubiendo(true)
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
    const nombre = `${crypto.randomUUID()}.${ext}`
    const { error } = await supabase.storage.from('mobiliario').upload(nombre, file, { upsert: false })
    setSubiendo(false)
    if (fileRef.current) fileRef.current.value = ''
    if (error) return alert('No se pudo subir la foto: ' + error.message)
    const { data } = supabase.storage.from('mobiliario').getPublicUrl(nombre)
    setForm((f) => ({ ...f, foto_url: data.publicUrl }))
  }

  async function guardar() {
    if (!form.nombre.trim()) return alert('El nombre es obligatorio')
    setSaving(true)
    const payload = {
      nombre: form.nombre.trim(),
      categoria: form.categoria,
      cantidad: Number(form.cantidad) || 1,
      estado: form.estado,
      ubicacion: form.ubicacion || '',
      costo: Number(form.costo) || 0,
      fecha_compra: form.fecha_compra || null,
      proveedor: form.proveedor || '',
      serie: form.serie || '',
      foto_url: form.foto_url || null,
      notas: form.notas || null,
      activo: form.activo,
    }
    let error
    let codigoCreado: number | null = null
    if (editId) {
      ;({ error } = await supabase.from('mobiliario').update(payload).eq('id', editId))
    } else {
      const res = await supabase.from('mobiliario').insert(payload).select('codigo').single()
      error = res.error
      codigoCreado = res.data?.codigo ?? null
    }
    setSaving(false)
    if (error) return alert('Error al guardar: ' + error.message)
    setOpen(false)
    if (codigoCreado != null) alert(`Bien registrado con el código ${conPrefijo(negocio.prefijo_mobiliario, codigoCreado)}.`)
    cargar()
  }

  async function eliminar(a: MobiliarioItem) {
    if (!confirm(`¿Eliminar "${a.nombre}" del inventario de mobiliario?`)) return
    const { error } = await supabase.from('mobiliario').delete().eq('id', a.id)
    if (error) return alert('Error al eliminar: ' + error.message)
    cargar()
  }

  return (
    <div>
      <PageHeader
        title="Mobiliario y equipos"
        subtitle="Inventario de los bienes del salón (muebles, equipos, decoración…)"
        action={
          <button className="btn-primary" onClick={abrirNuevo}>
            <Plus size={16} /> Nuevo bien
          </button>
        }
      />

      {loading ? (
        <Cargando />
      ) : (
        <>
          {items.length > 0 && (
            <div className="mb-4 grid grid-cols-2 gap-3 sm:max-w-md">
              <div className="card">
                <p className="text-xs uppercase tracking-wide text-slate-500">Bienes registrados</p>
                <p className="mt-1 text-2xl font-bold text-slate-800">{items.length}</p>
              </div>
              <div className="card">
                <p className="text-xs uppercase tracking-wide text-slate-500">Valor del mobiliario</p>
                <p className="mt-1 text-2xl font-bold text-brand-700">{money(valorTotal)}</p>
              </div>
            </div>
          )}

          <DataTable
            rows={items}
            rowKey={(a) => a.id}
            searchText={(a) => `${a.nombre} ${a.categoria} ${a.ubicacion ?? ''} ${a.serie ?? ''} ${conPrefijo(negocio.prefijo_mobiliario, a.codigo)}`}
            searchPlaceholder="Buscar por nombre, categoría, ubicación o código…"
            emptyText={items.length === 0 ? 'Aún no hay mobiliario registrado.' : 'No hay bienes que coincidan.'}
            columns={[
              { header: 'Código', cell: (a) => <span className="font-mono font-semibold text-brand-700">{conPrefijo(negocio.prefijo_mobiliario, a.codigo)}</span>, sortValue: (a) => a.codigo },
              {
                header: 'Bien', sortValue: (a) => a.nombre, cell: (a) => (
                  <div className="flex items-center gap-3">
                    {a.foto_url ? (
                      <img src={a.foto_url} alt={a.nombre} className="h-10 w-10 flex-none rounded-lg object-cover ring-1 ring-slate-200" />
                    ) : (
                      <span className="flex h-10 w-10 flex-none items-center justify-center rounded-lg bg-slate-100 text-slate-400"><ImageOff size={16} /></span>
                    )}
                    <div className="min-w-0">
                      <p className="font-medium text-slate-800">{a.nombre}</p>
                      {a.ubicacion && <p className="text-xs text-slate-600">{a.ubicacion}</p>}
                    </div>
                  </div>
                ),
              },
              { header: 'Categoría', cell: (a) => <span className="badge bg-brand-50 text-brand-700">{a.categoria}</span>, sortValue: (a) => a.categoria },
              { header: 'Cant.', align: 'right', cell: (a) => <span className="font-semibold text-slate-800">{a.cantidad}</span>, sortValue: (a) => a.cantidad },
              { header: 'Estado', cell: (a) => <span className={`badge ${COLOR_ESTADO[a.estado] ?? 'bg-slate-100 text-slate-600'}`}>{etiquetaEstado(a.estado)}</span>, sortValue: (a) => a.estado },
              { header: 'Costo', align: 'right', cell: (a) => <span className="text-slate-500">{money(a.costo)}</span>, sortValue: (a) => a.costo },
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
        </>
      )}

      <Modal
        open={open}
        title={editId ? 'Editar bien' : 'Nuevo bien'}
        onClose={() => setOpen(false)}
        footer={
          <>
            <button className="btn-ghost" onClick={() => setOpen(false)}>Cancelar</button>
            <button className="btn-primary" onClick={guardar} disabled={saving || subiendo}>{saving ? 'Guardando…' : 'Guardar'}</button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="label">Código</label>
            <input
              className="input w-32 bg-slate-50 font-mono font-semibold text-brand-700"
              value={conPrefijo(negocio.prefijo_mobiliario, editId ? editCodigo : proximoCodigo)}
              readOnly
            />
            <p className="mt-1 text-xs text-slate-500">
              {editId ? 'Código del bien.' : 'Se asigna automáticamente en secuencia de 4 dígitos.'}
            </p>
          </div>

          {/* Foto */}
          <div>
            <label className="label">Foto</label>
            <div className="flex items-center gap-3">
              {form.foto_url ? (
                <div className="relative">
                  <img src={form.foto_url} alt="Foto del bien" className="h-20 w-20 rounded-xl object-cover ring-1 ring-slate-200" />
                  <button
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, foto_url: '' }))}
                    className="absolute -right-2 -top-2 rounded-full bg-white p-1 text-slate-500 shadow ring-1 ring-slate-200 hover:text-rose-600"
                    aria-label="Quitar foto"
                  >
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <span className="flex h-20 w-20 items-center justify-center rounded-xl bg-slate-100 text-slate-400"><ImageOff size={22} /></span>
              )}
              <div>
                <button type="button" className="btn-ghost" onClick={() => fileRef.current?.click()} disabled={subiendo}>
                  <Upload size={16} /> {subiendo ? 'Subiendo…' : form.foto_url ? 'Cambiar foto' : 'Subir foto'}
                </button>
                <p className="mt-1 text-xs text-slate-500">JPG o PNG, hasta 5 MB.</p>
              </div>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={elegirFoto} />
            </div>
          </div>

          <div>
            <label className="label">Nombre</label>
            <input className="input" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} placeholder="Silla de estilista" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Categoría</label>
              <select className="input" value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })}>
                {CATEGORIAS_MOBILIARIO.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Cantidad</label>
              <input type="number" min={1} className="input" value={form.cantidad || ''} onChange={(e) => setForm({ ...form, cantidad: Number(e.target.value) })} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Estado</label>
              <select className="input" value={form.estado} onChange={(e) => setForm({ ...form, estado: e.target.value as 'BUENO' | 'REGULAR' | 'DANADO' })}>
                {ESTADOS_MOBILIARIO.map((e) => <option key={e.value} value={e.value}>{e.label}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Ubicación / área</label>
              <input className="input" value={form.ubicacion} onChange={(e) => setForm({ ...form, ubicacion: e.target.value })} placeholder="Área de peinado" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Costo (RD$)</label>
              <input type="number" min={0} step={10} className="input" value={form.costo || ''} onChange={(e) => setForm({ ...form, costo: Number(e.target.value) })} />
            </div>
            <div>
              <label className="label">Fecha de compra</label>
              <input type="date" className="input" value={form.fecha_compra} onChange={(e) => setForm({ ...form, fecha_compra: e.target.value })} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Proveedor</label>
              <input className="input" value={form.proveedor} onChange={(e) => setForm({ ...form, proveedor: e.target.value })} placeholder="Quién lo vendió" />
            </div>
            <div>
              <label className="label">N.º de serie</label>
              <input className="input" value={form.serie} onChange={(e) => setForm({ ...form, serie: e.target.value })} placeholder="Serie / modelo" />
            </div>
          </div>

          <div>
            <label className="label">Notas (mantenimiento, garantía…)</label>
            <textarea className="input" rows={2} value={form.notas} onChange={(e) => setForm({ ...form, notas: e.target.value })} />
          </div>

          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" checked={form.activo} onChange={(e) => setForm({ ...form, activo: e.target.checked })} />
            Bien activo (en uso)
          </label>
        </div>
      </Modal>
    </div>
  )
}
