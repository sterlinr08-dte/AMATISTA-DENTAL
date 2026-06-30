import { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2, Search, X, Printer } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { Compra, Articulo, Proveedor } from '../types'
import { money, fechaCorta, fechaHora, hoyISO, codigoArticulo, conPrefijo } from '../lib/format'
import { METODOS_PAGO, CATEGORIAS_COMPRA, ITBIS_RATE } from '../lib/constants'
import { useAuth } from '../lib/auth'
import { useNegocio } from '../lib/negocio'
import PageHeader from '../components/PageHeader'
import Cargando from '../components/Cargando'
import Modal from '../components/Modal'
import DataTable from '../components/DataTable'

interface LineaCompra { articulo_id: string; descripcion: string; cantidad: number; costo_unit: number }
const lineaCompraVacia: LineaCompra = { articulo_id: '', descripcion: '', cantidad: 1, costo_unit: 0 }

interface ReciboCompra { numero: number | null; proveedor: string; categoria: string; fecha: string; subtotal: number; itbis: number; total: number; metodo: string; hora: string; items: LineaCompra[] }

const vacio = {
  fecha: hoyISO(),
  proveedor: '',
  descripcion: '',
  categoria: 'Insumos',
  aplicaItbis: false,
  tipo_pago: 'CONTADO' as 'CONTADO' | 'CREDITO',
  metodo_pago: 'Efectivo',
  notas: '',
}

export default function Compras() {
  const { puedeAccion } = useAuth()
  const { negocio } = useNegocio()
  const puedeEliminar = puedeAccion('compras.eliminar')
  const puedeCambiarFecha = puedeAccion('compras.cambiar_fecha')
  const [editCompra, setEditCompra] = useState<Compra | null>(null)
  const [recibo, setRecibo] = useState<ReciboCompra | null>(null)
  const [items, setItems] = useState<Compra[]>([])
  const [articulos, setArticulos] = useState<Articulo[]>([])
  const [proveedores, setProveedores] = useState<Proveedor[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState(vacio)
  const [lineas, setLineas] = useState<LineaCompra[]>([])
  const [saving, setSaving] = useState(false)
  // catálogo de artículos / historial de compras (lupa)
  const [catalogoOpen, setCatalogoOpen] = useState(false)
  const [buscarCat, setBuscarCat] = useState('')

  async function cargar() {
    setLoading(true)
    const [{ data }, { data: arts }, { data: provs }] = await Promise.all([
      supabase.from('compras').select('*').order('fecha', { ascending: false }),
      supabase.from('articulos').select('*').eq('activo', true).order('nombre'),
      supabase.from('proveedores').select('*').eq('activo', true).order('nombre'),
    ])
    setItems(data ?? [])
    setArticulos(arts ?? [])
    setProveedores(provs ?? [])
    setLoading(false)
  }

  useEffect(() => {
    cargar()
  }, [])

  const totalMes = items
    .filter((c) => c.fecha.slice(0, 7) === hoyISO().slice(0, 7))
    .reduce((s, c) => s + Number(c.total), 0)

  const subtotal = lineas.reduce((s, l) => s + l.cantidad * l.costo_unit, 0)
  const itbis = form.aplicaItbis ? subtotal * ITBIS_RATE : 0
  const total = subtotal + itbis

  function abrirNuevo() {
    setEditId(null)
    setEditCompra(null)
    setForm(vacio)
    setLineas([])
    setOpen(true)
  }

  async function abrirEditar(c: Compra) {
    setEditId(c.id)
    setEditCompra(c)
    setForm({
      fecha: c.fecha,
      proveedor: c.proveedor ?? '',
      descripcion: c.descripcion,
      categoria: c.categoria,
      aplicaItbis: Number(c.itbis) > 0,
      tipo_pago: c.tipo_pago ?? 'CONTADO',
      metodo_pago: c.metodo_pago ?? 'Efectivo',
      notas: c.notas ?? '',
    })
    const { data } = await supabase.from('compra_items').select('*').eq('compra_id', c.id).order('created_at')
    if (data && data.length) {
      setLineas((data as any[]).map((it) => ({ articulo_id: it.articulo_id ?? '', descripcion: it.descripcion, cantidad: Number(it.cantidad), costo_unit: Number(it.costo_unit) })))
    } else {
      // Compra antigua (un solo artículo guardado en la fila)
      const cant = Number(c.cantidad ?? 0)
      setLineas([{ articulo_id: c.articulo_id ?? '', descripcion: c.descripcion, cantidad: cant > 0 ? cant : 1, costo_unit: cant > 0 ? Number(c.subtotal) / cant : Number(c.subtotal) }])
    }
    setOpen(true)
  }

  // Agrega un artículo del catálogo como renglón (suma cantidad si ya está)
  function agregarArticulo(a: Articulo) {
    setLineas((prev) => {
      const i = prev.findIndex((l) => l.articulo_id === a.id)
      if (i >= 0) return prev.map((l, idx) => (idx === i ? { ...l, cantidad: l.cantidad + 1 } : l))
      return [...prev, { articulo_id: a.id, descripcion: a.nombre, cantidad: 1, costo_unit: Number(a.costo) || 0 }]
    })
  }
  function agregarManual() {
    setLineas((prev) => [...prev, { ...lineaCompraVacia }])
  }
  function setLinea(i: number, patch: Partial<LineaCompra>) {
    setLineas((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)))
  }

  // Devuelve a la existencia los artículos de una compra (al editar o eliminar)
  async function restaurarExistencia(compraId: string, compra: Compra | null) {
    const { data } = await supabase.from('compra_items').select('articulo_id, cantidad').eq('compra_id', compraId)
    if (data && data.length) {
      for (const it of data as any[]) {
        if (it.articulo_id) await supabase.rpc('ajustar_stock', { p_articulo: it.articulo_id, p_delta: -Number(it.cantidad) })
      }
    } else if (compra?.articulo_id && compra.cantidad) {
      await supabase.rpc('ajustar_stock', { p_articulo: compra.articulo_id, p_delta: -Number(compra.cantidad) })
    }
  }

  async function guardar(imprimir = false) {
    const its = lineas.filter((l) => l.descripcion.trim() && l.cantidad > 0)
    if (its.length === 0) return alert('Agrega al menos un artículo o concepto')
    const subt = its.reduce((s, l) => s + l.cantidad * l.costo_unit, 0)
    if (subt <= 0) return alert('El monto debe ser mayor que 0')
    setSaving(true)
    const itb = form.aplicaItbis ? subt * ITBIS_RATE : 0
    const desc = form.descripcion.trim() || (its.length === 1 ? its[0].descripcion : `${its[0].descripcion} y ${its.length - 1} más`)
    const payload = {
      // Sin permiso de administración una compra nueva siempre lleva la fecha de hoy.
      fecha: !puedeCambiarFecha && !editId ? hoyISO() : form.fecha,
      proveedor: form.proveedor || null,
      descripcion: desc,
      categoria: form.categoria,
      subtotal: subt,
      itbis: itb,
      total: subt + itb,
      tipo_pago: form.tipo_pago,
      metodo_pago: form.metodo_pago,
      articulo_id: null,
      cantidad: null,
      notas: form.notas || null,
    }
    let compraId = editId
    let numero: number | null = editCompra?.numero ?? null
    if (editId) {
      await restaurarExistencia(editId, editCompra)
      const { error } = await supabase.from('compras').update(payload).eq('id', editId)
      if (error) { setSaving(false); return alert('Error al guardar: ' + error.message) }
      await supabase.from('compra_items').delete().eq('compra_id', editId)
    } else {
      const { data, error } = await supabase.from('compras').insert(payload).select().single()
      if (error) { setSaving(false); return alert('Error al guardar: ' + error.message) }
      compraId = (data as any).id
      numero = (data as any).numero ?? null
    }
    await supabase.from('compra_items').insert(
      its.map((l) => ({ compra_id: compraId, articulo_id: l.articulo_id || null, descripcion: l.descripcion, cantidad: l.cantidad, costo_unit: l.costo_unit, importe: l.cantidad * l.costo_unit })),
    )
    // Sumar a la existencia y actualizar el costo de cada artículo del inventario
    for (const l of its) {
      if (l.articulo_id) {
        await supabase.rpc('ajustar_stock', { p_articulo: l.articulo_id, p_delta: l.cantidad })
        await supabase.from('articulos').update({ costo: l.costo_unit }).eq('id', l.articulo_id)
      }
    }
    if (imprimir) {
      setRecibo({ numero, proveedor: form.proveedor || 'Sin proveedor', categoria: form.categoria, fecha: form.fecha, subtotal: subt, itbis: itb, total: subt + itb, metodo: form.metodo_pago, hora: new Date().toISOString(), items: its })
      setTimeout(() => window.print(), 400)
    }
    setSaving(false)
    setOpen(false)
    cargar()
  }

  async function eliminar(c: Compra) {
    if (!confirm(`¿Eliminar la compra "${c.descripcion}"?`)) return
    await restaurarExistencia(c.id, c)
    const { error } = await supabase.from('compras').delete().eq('id', c.id)
    if (error) return alert('Error al eliminar: ' + error.message)
    cargar()
  }

  return (
    <div>
      {!open && (<>
      <PageHeader
        title="Compras"
        subtitle={`Compras de este mes: ${money(totalMes)}`}
        action={
          <button className="btn-primary" onClick={abrirNuevo}>
            <Plus size={16} /> Nueva compra
          </button>
        }
      />

      {loading ? (
        <Cargando />
      ) : (
        <DataTable
          rows={items}
          rowKey={(c) => c.id}
          searchText={(c) => `${c.descripcion} ${c.proveedor ?? ''} ${c.categoria} ${c.numero} ${c.fecha}`}
          searchPlaceholder="Buscar por descripción, proveedor, categoría, # o fecha…"
          emptyText={items.length === 0 ? 'Aún no hay compras registradas.' : 'No hay compras que coincidan.'}
          columns={[
            { header: 'No.', cell: (c) => <span className="font-mono font-semibold text-brand-700">{conPrefijo(negocio.prefijo_compra, c.numero)}</span>, sortValue: (c) => c.numero },
            { header: 'Fecha', cell: (c) => <span className="text-slate-600">{fechaCorta(c.fecha)}</span>, sortValue: (c) => c.fecha },
            { header: 'Descripción', cell: (c) => <span className="font-medium text-slate-800">{c.descripcion}</span>, sortValue: (c) => c.descripcion },
            { header: 'Proveedor', cell: (c) => <span className="text-slate-600">{c.proveedor || '—'}</span>, sortValue: (c) => c.proveedor ?? '' },
            { header: 'Categoría', cell: (c) => <span className="badge bg-slate-100 text-slate-600">{c.categoria}</span>, sortValue: (c) => c.categoria },
            { header: 'Total', align: 'right', cell: (c) => <span className="font-semibold text-slate-800">{money(c.total)}</span>, sortValue: (c) => c.total },
            {
              header: '', align: 'right', cell: (c) => (
                <div className="flex justify-end gap-1">
                  <button onClick={() => abrirEditar(c)} className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 hover:text-brand-600"><Pencil size={16} /></button>
                  {puedeEliminar && (
                    <button onClick={() => eliminar(c)} className="rounded-lg p-2 text-slate-600 hover:bg-rose-50 hover:text-rose-600"><Trash2 size={16} /></button>
                  )}
                </div>
              ),
            },
          ]}
        />
      )}
      </>)}

      {/* PANTALLA DE COMPRA (a página completa, ya no es ventana emergente) */}
      {open && (
        <div className="mx-auto max-w-2xl">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-2xl font-bold uppercase text-slate-800">{editId ? 'Editar compra' : 'Nueva compra'}</h2>
              <p className="text-sm text-slate-600">Registra la compra y, si aplica, súmala al inventario.</p>
            </div>
            <button className="btn-ghost shrink-0" onClick={() => setOpen(false)}>
              <X size={16} /> Cerrar
            </button>
          </div>
          <div className="card space-y-4">
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
                {CATEGORIAS_COMPRA.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="label">Proveedor</label>
            <select className="input" value={form.proveedor} onChange={(e) => setForm({ ...form, proveedor: e.target.value })}>
              <option value="">— Sin proveedor —</option>
              {proveedores.map((p) => <option key={p.id} value={p.nombre}>{p.nombre}</option>)}
              {/* Si la compra guardada tiene un proveedor que ya no está en la lista, lo mostramos igual */}
              {form.proveedor && !proveedores.some((p) => p.nombre === form.proveedor) && (
                <option value={form.proveedor}>{form.proveedor}</option>
              )}
            </select>
            {proveedores.length === 0 && (
              <p className="mt-1 text-xs text-amber-600">No hay proveedores. Créalos en Configuración → Proveedores.</p>
            )}
          </div>

          {/* Renglones: artículos del inventario y/o conceptos manuales */}
          <div>
            <label className="label">Artículos y conceptos comprados</label>
            {lineas.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-6 text-center text-sm text-slate-600">
                Usa la lupa para agregar artículos del inventario, o «Concepto manual» para algo sin inventario.
              </div>
            ) : (
              <div className="space-y-3">
                {lineas.map((l, i) => {
                  const esManual = !l.articulo_id
                  return (
                    <div key={i} className="rounded-xl border-2 border-slate-200 bg-white p-3 shadow-sm">
                      <div className="flex items-start justify-between gap-2">
                        {esManual ? (
                          <input className="input flex-1" placeholder="Concepto (ej: flete, empaque…)" value={l.descripcion} onChange={(e) => setLinea(i, { descripcion: e.target.value })} />
                        ) : (
                          <span className="flex min-w-0 items-center gap-2 font-semibold text-slate-800">
                            <span className="badge bg-amber-50 text-amber-700">Artículo</span>
                            <span className="truncate">{l.descripcion}</span>
                          </span>
                        )}
                        <button onClick={() => setLineas(lineas.filter((_, idx) => idx !== i))} className="rounded-lg p-1.5 text-slate-600 hover:bg-rose-50 hover:text-rose-600"><X size={16} /></button>
                      </div>
                      <div className="mt-2 grid grid-cols-3 gap-2">
                        <div>
                          <span className="text-xs font-medium text-slate-600">Cant.</span>
                          <input type="number" min={0} className="input" value={l.cantidad || ''} onChange={(e) => setLinea(i, { cantidad: Number(e.target.value) })} />
                        </div>
                        <div>
                          <span className="text-xs font-medium text-slate-600">Costo c/u</span>
                          <input type="number" min={0} step={5} className="input" value={l.costo_unit || ''} onChange={(e) => setLinea(i, { costo_unit: Number(e.target.value) })} />
                        </div>
                        <div>
                          <span className="text-xs font-medium text-slate-600">Importe</span>
                          <input className="input bg-slate-50" value={money(l.cantidad * l.costo_unit)} readOnly />
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
            <div className="mt-2 flex flex-wrap gap-2">
              <button type="button" className="btn-ghost" onClick={() => { setBuscarCat(''); setCatalogoOpen(true) }}>
                <Search size={14} /> Agregar artículo
              </button>
              <button type="button" className="btn-ghost" onClick={agregarManual}>
                <Plus size={14} /> Concepto manual
              </button>
            </div>
          </div>

          <div>
            <label className="label">Descripción general (opcional)</label>
            <input className="input" value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} placeholder="Resumen de la compra (si lo dejas vacío se arma solo)" />
          </div>

          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" checked={form.aplicaItbis} onChange={(e) => setForm({ ...form, aplicaItbis: e.target.checked })} />
            Incluir ITBIS (18%)
          </label>
          <div className="rounded-lg bg-slate-50 p-3 text-sm">
            <div className="flex justify-between text-slate-600"><span>Subtotal</span><span>{money(subtotal)}</span></div>
            {form.aplicaItbis && <div className="flex justify-between text-slate-600"><span>ITBIS</span><span>{money(itbis)}</span></div>}
            <div className="mt-1 flex justify-between border-t border-slate-200 pt-1 font-bold text-slate-800"><span>Total</span><span>{money(total)}</span></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Tipo de pago</label>
              <select className="input" value={form.tipo_pago} onChange={(e) => setForm({ ...form, tipo_pago: e.target.value as 'CONTADO' | 'CREDITO' })}>
                <option value="CONTADO">Contado (pagada)</option>
                <option value="CREDITO">Crédito (queda por pagar)</option>
              </select>
            </div>
            <div>
              <label className="label">Método de pago</label>
              <select className="input" value={form.metodo_pago} onChange={(e) => setForm({ ...form, metodo_pago: e.target.value })}>
                {METODOS_PAGO.map((m) => <option key={m}>{m}</option>)}
              </select>
            </div>
          </div>
          {form.tipo_pago === 'CREDITO' && (
            <p className="-mt-2 text-xs text-amber-600">Esta compra quedará en <b>Cuentas por pagar</b> hasta saldarla.</p>
          )}
          <div>
            <label className="label">Notas</label>
            <textarea className="input" rows={2} value={form.notas} onChange={(e) => setForm({ ...form, notas: e.target.value })} />
          </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-lg font-bold text-slate-800">Total: {money(total)}</p>
            <div className="flex flex-wrap gap-2">
              <button className="btn-ghost" onClick={() => setOpen(false)}>Cancelar</button>
              <button className="btn-ghost" onClick={() => guardar(false)} disabled={saving}>{saving ? 'Guardando…' : 'Guardar'}</button>
              <button className="btn-primary" onClick={() => guardar(true)} disabled={saving}><Printer size={16} /> Guardar e imprimir</button>
            </div>
          </div>
        </div>
      )}

      {/* COMPROBANTE DE COMPRA (imprimible) */}
      <Modal open={!!recibo} title="Comprobante de compra" onClose={() => setRecibo(null)}>
        {recibo && (
          <div className="space-y-3">
            <div id="recibo-compra" className="print-area space-y-2 rounded-xl border border-slate-100 p-3 text-sm">
              <div className="text-center">
                <img src={`${import.meta.env.BASE_URL}${negocio.logo}`} alt={negocio.nombre} className="mx-auto mb-1 h-14 rounded-lg bg-black object-contain" />
                <p className="font-display text-base font-bold text-brand-800">{negocio.nombre}</p>
                {negocio.rnc && <p className="text-xs text-slate-500">RNC: {negocio.rnc}</p>}
                <p className="mt-1 text-xs font-semibold text-slate-600">COMPROBANTE DE COMPRA</p>
                <p className="text-xs text-slate-600">{recibo.numero != null ? `Compra ${recibo.numero} · ` : ''}{fechaHora(recibo.hora)}</p>
              </div>
              <p className="text-slate-600"><span className="font-medium">Proveedor:</span> {recibo.proveedor}</p>
              <p className="text-slate-600"><span className="font-medium">Categoría:</span> {recibo.categoria}</p>
              <table className="w-full border-t pt-1 text-xs">
                <tbody>
                  {recibo.items.map((it, idx) => (
                    <tr key={idx} className="border-b border-slate-50 text-slate-600">
                      <td className="py-1">{it.cantidad}× {it.descripcion}</td>
                      <td className="py-1 text-right">{money(it.cantidad * it.costo_unit)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="space-y-0.5 border-t pt-1">
                <div className="flex justify-between text-slate-600"><span>Subtotal</span><span>{money(recibo.subtotal)}</span></div>
                {recibo.itbis > 0 && <div className="flex justify-between text-slate-600"><span>ITBIS</span><span>{money(recibo.itbis)}</span></div>}
                <div className="flex justify-between text-base font-bold text-slate-800"><span>Total</span><span>{money(recibo.total)}</span></div>
                <div className="flex justify-between text-slate-600"><span>Método</span><span>{recibo.metodo}</span></div>
              </div>
              <div className="border-t pt-1 text-center text-xs text-slate-500">
                <p>{negocio.direccion} · {negocio.referencia}</p>
              </div>
            </div>
            <div className="flex gap-2 no-print">
              <button className="btn-ghost flex-1" onClick={() => setRecibo(null)}>Cerrar</button>
              <button className="btn-primary flex-1" onClick={() => window.print()}><Printer size={16} /> Imprimir</button>
            </div>
          </div>
        )}
      </Modal>

      {/* VENTANA DE LA LUPA: artículos del inventario */}
      <Modal open={catalogoOpen} title="Buscar artículo" onClose={() => setCatalogoOpen(false)}>
        <div className="space-y-3">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" />
            <input
              className="input pl-9"
              placeholder="Filtrar por nombre, categoría o código…"
              value={buscarCat}
              onChange={(e) => setBuscarCat(e.target.value)}
              autoFocus
            />
          </div>

          <div className="max-h-[55vh] divide-y divide-slate-50 overflow-y-auto rounded-xl border border-slate-100">
            {articulos.length === 0 ? (
              <p className="px-3 py-6 text-center text-slate-600">No hay artículos en el inventario.</p>
            ) : (
              articulos.filter((a) => {
                const f = buscarCat.trim().toLowerCase()
                return !f || a.nombre.toLowerCase().includes(f) || a.categoria.toLowerCase().includes(f) || codigoArticulo(a.codigo).includes(f)
              }).map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => agregarArticulo(a)}
                  className="flex w-full items-center justify-between gap-3 px-3 py-3 text-left hover:bg-pink-50"
                >
                  <span className="flex min-w-0 flex-col">
                    <span className="flex items-center gap-2">
                      <span className="font-mono text-xs text-slate-600">{codigoArticulo(a.codigo)}</span>
                      <span className="truncate font-medium text-slate-800">{a.nombre}</span>
                    </span>
                    <span className={`mt-0.5 text-xs ${Number(a.stock) <= 0 ? 'text-rose-500' : 'text-slate-600'}`}>
                      {Number(a.stock) <= 0 ? 'Sin existencia' : `Existencia: ${a.stock}`}
                    </span>
                  </span>
                  <span className="shrink-0 text-slate-600">{money(a.costo)}</span>
                </button>
              ))
            )}
          </div>
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-600">Toca para agregar; puedes añadir varios.</p>
            <button type="button" className="btn-primary" onClick={() => setCatalogoOpen(false)}>Listo</button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
