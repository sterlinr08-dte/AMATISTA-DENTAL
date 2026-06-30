import { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2, Wallet, Search } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { Gasto } from '../types'
import { money, fechaCorta, hoyISO, conPrefijo } from '../lib/format'
import { METODOS_PAGO, CATEGORIAS_GASTO } from '../lib/constants'
import { useAuth } from '../lib/auth'
import { useNegocio } from '../lib/negocio'
import PageHeader from '../components/PageHeader'
import Cargando from '../components/Cargando'
import Modal from '../components/Modal'
import Paginacion, { usePaginacion } from '../components/Paginacion'

const vacio = {
  fecha: hoyISO(),
  categoria: 'General',
  concepto: '',
  beneficiario: '',
  monto: 0,
  metodo_pago: 'Efectivo',
  notas: '',
}

export default function Gastos() {
  const { puedeAccion } = useAuth()
  const { negocio } = useNegocio()
  const puedeEliminar = puedeAccion('gastos.eliminar')
  const puedeCambiarFecha = puedeAccion('gastos.cambiar_fecha')
  const [items, setItems] = useState<Gasto[]>([])
  const [busqueda, setBusqueda] = useState('')
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState(vacio)
  const [saving, setSaving] = useState(false)

  const q = busqueda.trim().toLowerCase()
  const filtrados = q
    ? items.filter((g) => g.concepto.toLowerCase().includes(q) || g.categoria.toLowerCase().includes(q) || g.fecha.includes(q))
    : items

  const pag = usePaginacion(filtrados, 10)

  async function cargar() {
    setLoading(true)
    const { data } = await supabase.from('gastos').select('*').order('fecha', { ascending: false })
    setItems(data ?? [])
    setLoading(false)
  }

  useEffect(() => {
    cargar()
  }, [])

  const totalMes = items
    .filter((g) => g.fecha.slice(0, 7) === hoyISO().slice(0, 7))
    .reduce((s, g) => s + Number(g.monto), 0)

  function abrirNuevo() {
    setEditId(null)
    setForm(vacio)
    setOpen(true)
  }

  function abrirEditar(g: Gasto) {
    setEditId(g.id)
    setForm({
      fecha: g.fecha,
      categoria: g.categoria,
      concepto: g.concepto,
      beneficiario: g.beneficiario ?? '',
      monto: Number(g.monto),
      metodo_pago: g.metodo_pago ?? 'Efectivo',
      notas: g.notas ?? '',
    })
    setOpen(true)
  }

  async function guardar() {
    if (!form.concepto.trim()) return alert('El concepto es obligatorio')
    if (form.monto <= 0) return alert('El monto debe ser mayor que 0')
    setSaving(true)
    const payload = {
      ...form,
      // Sin permiso de administración un gasto nuevo siempre lleva la fecha de hoy.
      fecha: !puedeCambiarFecha && !editId ? hoyISO() : form.fecha,
      beneficiario: form.beneficiario || null,
      notas: form.notas || null,
    }
    const { error } = editId
      ? await supabase.from('gastos').update(payload).eq('id', editId)
      : await supabase.from('gastos').insert(payload)
    setSaving(false)
    if (error) return alert('Error al guardar: ' + error.message)
    setOpen(false)
    cargar()
  }

  async function eliminar(g: Gasto) {
    if (!confirm(`¿Eliminar el gasto "${g.concepto}"?`)) return
    const { error } = await supabase.from('gastos').delete().eq('id', g.id)
    if (error) return alert('Error al eliminar: ' + error.message)
    cargar()
  }

  return (
    <div>
      <PageHeader
        title="Gastos"
        subtitle={`Gastos de este mes: ${money(totalMes)}`}
        action={
          <button className="btn-primary" onClick={abrirNuevo}>
            <Plus size={16} /> Nuevo gasto
          </button>
        }
      />

      {items.length > 0 && (
        <div className="relative mb-4 max-w-md">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" />
          <input className="input pl-9" placeholder="Buscar por concepto, categoría o fecha…" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
        </div>
      )}

      {loading ? (
        <Cargando />
      ) : items.length === 0 ? (
        <div className="card flex flex-col items-center gap-3 py-12 text-center">
          <Wallet className="text-brand-300" size={40} />
          <p className="text-slate-500">Aún no hay gastos registrados.</p>
        </div>
      ) : filtrados.length === 0 ? (
        <div className="card flex flex-col items-center gap-3 py-12 text-center">
          <Search className="text-brand-300" size={40} />
          <p className="text-slate-500">No hay gastos que coincidan con «{busqueda}».</p>
        </div>
      ) : (
        <div className="overflow-x-auto panel-3d">
          <table className="min-w-full divide-y divide-slate-100 text-sm">
            <thead className="thead-3d">
              <tr>
                <th className="px-5 py-3">No.</th>
                <th className="px-5 py-3">Fecha</th>
                <th className="px-5 py-3">Concepto</th>
                <th className="px-5 py-3">Categoría</th>
                <th className="px-5 py-3">Pago</th>
                <th className="px-5 py-3 text-right">Monto</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {pag.visibles.map((g) => (
                <tr key={g.id}>
                  <td className="px-5 py-3"><span className="font-mono font-semibold text-brand-700">{conPrefijo(negocio.prefijo_gasto, g.numero)}</span></td>
                  <td className="px-5 py-3 text-slate-600">{fechaCorta(g.fecha)}</td>
                  <td className="px-5 py-3">
                    <p className="font-medium text-slate-800">{g.concepto}</p>
                    {g.beneficiario && <p className="text-xs text-slate-600">{g.beneficiario}</p>}
                  </td>
                  <td className="px-5 py-3"><span className="badge bg-slate-100 text-slate-600">{g.categoria}</span></td>
                  <td className="px-5 py-3 text-slate-600">{g.metodo_pago}</td>
                  <td className="px-5 py-3 text-right font-semibold text-rose-600">{money(g.monto)}</td>
                  <td className="px-5 py-3">
                    <div className="flex justify-end gap-1">
                      <button onClick={() => abrirEditar(g)} className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 hover:text-brand-600"><Pencil size={16} /></button>
                      {puedeEliminar && (
                        <button onClick={() => eliminar(g)} className="rounded-lg p-2 text-slate-600 hover:bg-rose-50 hover:text-rose-600"><Trash2 size={16} /></button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <Paginacion pagina={pag.pagina} totalPaginas={pag.totalPaginas} total={pag.total} desde={pag.desde} pageSize={pag.pageSize} onPagina={pag.setPagina} />
        </div>
      )}

      <Modal
        open={open}
        title={editId ? 'Editar gasto' : 'Nuevo gasto'}
        onClose={() => setOpen(false)}
        footer={
          <>
            <button className="btn-ghost" onClick={() => setOpen(false)}>Cancelar</button>
            <button className="btn-primary" onClick={guardar} disabled={saving}>{saving ? 'Guardando…' : 'Guardar'}</button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Fecha</label>
              <input
                type="date"
                className={`input ${!puedeCambiarFecha ? 'cursor-not-allowed bg-slate-100 text-slate-500' : ''}`}
                value={form.fecha}
                onChange={(e) => setForm({ ...form, fecha: e.target.value })}
                disabled={!puedeCambiarFecha}
                title={!puedeCambiarFecha ? 'La fecha es la de hoy. Solo administración puede cambiarla.' : undefined}
              />
              {!puedeCambiarFecha && <p className="mt-1 text-xs text-slate-500">Fecha de hoy. Solo administración puede cambiarla.</p>}
            </div>
            <div>
              <label className="label">Categoría</label>
              <select className="input" value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })}>
                {CATEGORIAS_GASTO.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="label">Concepto</label>
            <input className="input" value={form.concepto} onChange={(e) => setForm({ ...form, concepto: e.target.value })} placeholder="Pago de luz" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Beneficiario</label>
              <input className="input" value={form.beneficiario} onChange={(e) => setForm({ ...form, beneficiario: e.target.value })} />
            </div>
            <div>
              <label className="label">Monto (RD$)</label>
              <input type="number" min={0} step={50} className="input" value={form.monto || ''} onChange={(e) => setForm({ ...form, monto: Number(e.target.value) })} />
            </div>
          </div>
          <div>
            <label className="label">Método de pago</label>
            <select className="input" value={form.metodo_pago} onChange={(e) => setForm({ ...form, metodo_pago: e.target.value })}>
              {METODOS_PAGO.map((m) => <option key={m}>{m}</option>)}
            </select>
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
