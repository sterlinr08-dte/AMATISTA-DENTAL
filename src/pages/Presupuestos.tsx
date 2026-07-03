import { useEffect, useState } from 'react'
import { Plus, Trash2, Save, FileText, Check } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { Cliente, Empleado, Servicio, Presupuesto, PresupuestoItem, EstadoPresupuesto } from '../types'
import { money, fechaCorta, hoyISO } from '../lib/format'
import { ESTADOS_PRESUPUESTO, estadoPresupuestoDef } from '../lib/dental'
import PageHeader from '../components/PageHeader'
import Cargando from '../components/Cargando'
import Modal from '../components/Modal'
import DataTable from '../components/DataTable'
import type { Columna } from '../components/DataTable'
import SelectorPaciente from '../components/SelectorPaciente'

// Renglón temporal del presupuesto (en edición, antes de guardar)
interface ItemTmp {
  servicio_id: string
  diente: string        // FDI, opcional (texto para permitir vacío)
  descripcion: string
  cantidad: number
  precio_unit: number
}

const itemVacio: ItemTmp = { servicio_id: '', diente: '', descripcion: '', cantidad: 1, precio_unit: 0 }

// Código de presupuesto: P + 4 dígitos
function codigoPresupuesto(codigo: number | null | undefined): string {
  return 'P' + String(codigo ?? 0).padStart(4, '0')
}

export default function Presupuestos({ pacienteFijo }: { pacienteFijo?: string } = {}) {
  const [presupuestos, setPresupuestos] = useState<Presupuesto[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [empleados, setEmpleados] = useState<Empleado[]>([])
  const [servicios, setServicios] = useState<Servicio[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [convirtiendo, setConvirtiendo] = useState(false)

  // formulario del presupuesto
  const [editId, setEditId] = useState<string | null>(null)
  const [editEstado, setEditEstado] = useState<EstadoPresupuesto>('BORRADOR')
  const [editFacturaId, setEditFacturaId] = useState<string | null>(null)
  const [clienteId, setClienteId] = useState('')
  const [empleadoId, setEmpleadoId] = useState('')
  const [fecha, setFecha] = useState(hoyISO())
  const [estado, setEstado] = useState<EstadoPresupuesto>('BORRADOR')
  const [descuento, setDescuento] = useState(0)
  const [notas, setNotas] = useState('')
  const [items, setItems] = useState<ItemTmp[]>([])

  async function cargar() {
    setLoading(true)
    let q = supabase.from('presupuestos').select('*').order('codigo', { ascending: false })
    if (pacienteFijo) q = q.eq('cliente_id', pacienteFijo)
    const [{ data }, { data: cls }] = await Promise.all([
      q,
      supabase.from('clientes').select('*').order('nombre'),
    ])
    setPresupuestos(data ?? [])
    setClientes(cls ?? [])
    setLoading(false)
  }

  async function cargarCatalogos() {
    const [em, se] = await Promise.all([
      supabase.from('empleados').select('*').eq('activo', true).order('nombre'),
      supabase.from('servicios').select('*').eq('activo', true).order('nombre'),
    ])
    setEmpleados(em.data ?? [])
    setServicios(se.data ?? [])
  }

  useEffect(() => {
    cargar()
    cargarCatalogos()
  }, [pacienteFijo])

  function nombreCliente(id: string | null): string {
    if (!id) return 'Sin paciente'
    return clientes.find((c) => c.id === id)?.nombre ?? 'Paciente'
  }

  function nuevo() {
    setEditId(null)
    setEditEstado('BORRADOR')
    setEditFacturaId(null)
    setClienteId(pacienteFijo ?? '')
    setEmpleadoId('')
    setFecha(hoyISO())
    setEstado('BORRADOR')
    setDescuento(0)
    setNotas('')
    setItems([{ ...itemVacio }])
    setOpen(true)
  }

  async function abrirEditar(p: Presupuesto) {
    const { data, error } = await supabase
      .from('presupuesto_items')
      .select('*')
      .eq('presupuesto_id', p.id)
      .order('id')
    if (error) return alert('Error al cargar el presupuesto: ' + error.message)
    setEditId(p.id)
    setEditEstado(p.estado)
    setEditFacturaId(p.factura_id)
    setClienteId(p.cliente_id ?? '')
    setEmpleadoId(p.empleado_id ?? '')
    setFecha(p.fecha)
    setEstado(p.estado)
    setDescuento(Number(p.descuento))
    setNotas(p.notas ?? '')
    setItems(
      ((data as PresupuestoItem[]) ?? []).map((it) => ({
        servicio_id: it.servicio_id ?? '',
        diente: it.diente == null ? '' : String(it.diente),
        descripcion: it.descripcion,
        cantidad: Number(it.cantidad),
        precio_unit: Number(it.precio_unit),
      })),
    )
    setOpen(true)
  }

  function setItem(i: number, patch: Partial<ItemTmp>) {
    setItems((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)))
  }

  // Al elegir un tratamiento, autocompletar descripción y precio
  function elegirServicio(i: number, servicioId: string) {
    const s = servicios.find((x) => x.id === servicioId)
    if (s) {
      setItem(i, { servicio_id: servicioId, descripcion: s.nombre, precio_unit: Number(s.precio) })
    } else {
      setItem(i, { servicio_id: '' })
    }
  }

  function agregarItem() {
    setItems((prev) => [...prev, { ...itemVacio }])
  }

  function quitarItem(i: number) {
    setItems((prev) => prev.filter((_, idx) => idx !== i))
  }

  const subtotal = items.reduce((s, l) => s + l.cantidad * l.precio_unit, 0)
  const descuentoMonto = Math.min(subtotal, Math.max(0, descuento))
  const total = Math.max(0, subtotal - descuentoMonto)

  // Renglones válidos (con descripción y cantidad)
  function itemsValidos(): ItemTmp[] {
    return items.filter((l) => l.descripcion.trim() && l.cantidad > 0)
  }

  async function guardar() {
    const validos = itemsValidos()
    if (!clienteId) return alert('Selecciona el paciente.')
    if (validos.length === 0) return alert('Agrega al menos un tratamiento.')
    setSaving(true)

    const datos = {
      cliente_id: clienteId || null,
      empleado_id: empleadoId || null,
      fecha,
      estado,
      subtotal,
      descuento: descuentoMonto,
      total,
      notas: notas || null,
    }

    let presupuestoId = editId
    if (editId) {
      const { error } = await supabase.from('presupuestos').update(datos).eq('id', editId)
      if (error) {
        setSaving(false)
        return alert('Error al actualizar el presupuesto: ' + error.message)
      }
      // Reemplazar los renglones
      const { error: eDel } = await supabase.from('presupuesto_items').delete().eq('presupuesto_id', editId)
      if (eDel) {
        setSaving(false)
        return alert('Error al actualizar el detalle: ' + eDel.message)
      }
    } else {
      const { data, error } = await supabase
        .from('presupuestos')
        .insert(datos)
        .select()
        .single()
      if (error || !data) {
        setSaving(false)
        return alert('Error al crear el presupuesto: ' + error?.message)
      }
      presupuestoId = (data as Presupuesto).id
    }

    const payload = validos.map((l) => ({
      presupuesto_id: presupuestoId,
      servicio_id: l.servicio_id || null,
      diente: l.diente.trim() ? Number(l.diente) : null,
      descripcion: l.descripcion,
      cantidad: l.cantidad,
      precio_unit: l.precio_unit,
      subtotal: l.cantidad * l.precio_unit,
      estado: 'PENDIENTE',
    }))
    const { error: e2 } = await supabase.from('presupuesto_items').insert(payload)
    if (e2) {
      setSaving(false)
      return alert('Presupuesto guardado pero falló el detalle: ' + e2.message)
    }
    setSaving(false)
    setOpen(false)
    await cargar()
  }

  // Botones rápidos de estado (solo en edición): actualiza estado en la base
  async function marcarEstado(nuevoEstado: EstadoPresupuesto) {
    if (!editId) {
      setEstado(nuevoEstado)
      return
    }
    const { error } = await supabase.from('presupuestos').update({ estado: nuevoEstado }).eq('id', editId)
    if (error) return alert('Error al cambiar el estado: ' + error.message)
    setEstado(nuevoEstado)
    setEditEstado(nuevoEstado)
    await cargar()
  }

  // Convertir un presupuesto APROBADO en una factura de contado.
  // Factura los tratamientos guardados del plan, EXCLUYENDO los cancelados
  // ("No se realizará") y los que ya se facturaron por el panel por visita.
  async function convertirAFactura() {
    if (!editId) return
    if (estado !== 'APROBADO') return alert('Solo se puede facturar un presupuesto aprobado.')

    const { data: dbItems, error: eItems } = await supabase
      .from('presupuesto_items')
      .select('id, servicio_id, descripcion, cantidad, precio_unit, estado, facturado')
      .eq('presupuesto_id', editId)
    if (eItems) return alert('Error al leer los tratamientos: ' + eItems.message)
    const aFacturar = (dbItems ?? []).filter((it: any) => it.estado !== 'CANCELADO' && !it.facturado)
    if (aFacturar.length === 0) {
      return alert('No hay tratamientos para facturar (todos están cancelados o ya facturados).')
    }
    if (!confirm(`¿Crear una factura de contado con ${aFacturar.length} tratamiento(s)?`)) return
    setConvirtiendo(true)

    const sub = aFacturar.reduce((s: number, it: any) => s + Number(it.cantidad) * Number(it.precio_unit), 0)
    const desc = Math.min(sub, Math.max(0, descuento))
    const tot = Math.max(0, sub - desc)

    const { data: factura, error } = await supabase
      .from('facturas')
      .insert({
        cliente_id: clienteId || null,
        cliente_nombre: nombreCliente(clienteId),
        fecha: hoyISO(),
        subtotal: sub,
        descuento: desc,
        itbis: 0,
        total: tot,
        estado: 'PENDIENTE',
        tipo_venta: 'CONTADO',
      })
      .select()
      .single()
    if (error || !factura) {
      setConvirtiendo(false)
      return alert('Error al crear la factura: ' + error?.message)
    }
    const facturaId = (factura as { id: string }).id

    const payload = aFacturar.map((it: any) => ({
      factura_id: facturaId,
      servicio_id: it.servicio_id || null,
      descripcion: it.descripcion,
      cantidad: it.cantidad,
      precio_unit: it.precio_unit,
      importe: Number(it.cantidad) * Number(it.precio_unit),
    }))
    const { error: e2 } = await supabase.from('factura_items').insert(payload)
    if (e2) {
      // No dejar una factura huérfana sin renglones: se elimina.
      await supabase.from('facturas').delete().eq('id', facturaId)
      setConvirtiendo(false)
      return alert('No se pudo crear la factura (falló el detalle): ' + e2.message)
    }

    // Marcar esos tratamientos como facturados (para que el panel por visita no los reofrezca).
    const { error: eMarcar } = await supabase
      .from('presupuesto_items')
      .update({ facturado: true, factura_id: facturaId })
      .in('id', aFacturar.map((it: any) => it.id))
    if (eMarcar) {
      setConvirtiendo(false)
      return alert('La factura se creó, pero no se pudo marcar el plan como facturado. Avisa a administración para evitar doble cobro: ' + eMarcar.message)
    }

    const { error: e3 } = await supabase
      .from('presupuestos')
      .update({ estado: 'FACTURADO', factura_id: facturaId })
      .eq('id', editId)
    if (e3) {
      setConvirtiendo(false)
      return alert('Factura creada pero no se pudo marcar el presupuesto: ' + e3.message)
    }
    setConvirtiendo(false)
    setEstado('FACTURADO')
    setEditEstado('FACTURADO')
    setEditFacturaId(facturaId)
    setOpen(false)
    await cargar()
    alert('Presupuesto convertido a factura correctamente.')
  }

  const columnas: Columna<Presupuesto>[] = [
    { header: 'Código', cell: (p) => <span className="font-mono font-semibold text-slate-700">{codigoPresupuesto(p.codigo)}</span>, sortValue: (p) => p.codigo },
    { header: 'Paciente', cell: (p) => <span className="font-medium text-slate-800">{nombreCliente(p.cliente_id)}</span>, sortValue: (p) => nombreCliente(p.cliente_id) },
    { header: 'Fecha', cell: (p) => <span className="text-slate-600">{fechaCorta(p.fecha)}</span>, sortValue: (p) => p.fecha },
    { header: 'Estado', cell: (p) => <span className={`badge ${estadoPresupuestoDef(p.estado).color}`}>{estadoPresupuestoDef(p.estado).label}</span>, sortValue: (p) => p.estado },
    { header: 'Total', align: 'right', cell: (p) => <span className="font-semibold text-slate-800">{money(p.total)}</span>, sortValue: (p) => p.total },
  ]

  const facturado = editEstado === 'FACTURADO' || !!editFacturaId

  return (
    <div>
      {pacienteFijo ? (
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-700">{presupuestos.length} plan(es) de tratamiento</h3>
          <button className="btn-primary" onClick={nuevo}>
            <Plus size={16} /> Nuevo presupuesto
          </button>
        </div>
      ) : (
        <PageHeader
          title="Presupuestos"
          subtitle={`${presupuestos.length} plan(es) de tratamiento`}
          action={
            <button className="btn-primary" onClick={nuevo}>
              <Plus size={16} /> Nuevo presupuesto
            </button>
          }
        />
      )}

      {loading ? (
        <Cargando />
      ) : (
        <DataTable
          rows={presupuestos}
          rowKey={(p) => p.id}
          columns={columnas}
          onRowClick={abrirEditar}
          searchText={(p) => `${codigoPresupuesto(p.codigo)} ${nombreCliente(p.cliente_id)} ${p.estado}`}
          searchPlaceholder="Buscar por paciente o código…"
          emptyText="Aún no hay presupuestos. Crea el primero."
          initialSort={{ index: 0, dir: 'desc' }}
        />
      )}

      {/* MODAL crear / editar presupuesto */}
      <Modal
        open={open}
        title={editId ? 'Editar presupuesto' : 'Nuevo presupuesto'}
        onClose={() => setOpen(false)}
        footer={
          <>
            <button className="btn-ghost" onClick={() => setOpen(false)}>Cancelar</button>
            <button className="btn-primary" onClick={guardar} disabled={saving}>
              <Save size={16} /> {saving ? 'Guardando…' : 'Guardar'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          {/* Cabecera */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Paciente</label>
              {pacienteFijo ? (
                <input className="input bg-slate-50" value={nombreCliente(clienteId)} readOnly />
              ) : (
                <SelectorPaciente clientes={clientes} value={clienteId} onChange={setClienteId} />
              )}
            </div>
            <div>
              <label className="label">Odontólogo</label>
              <select className="input" value={empleadoId} onChange={(e) => setEmpleadoId(e.target.value)}>
                <option value="">— Sin asignar —</option>
                {empleados.map((em) => (
                  <option key={em.id} value={em.id}>{em.nombre}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Fecha</label>
              <input type="date" className="input" value={fecha} onChange={(e) => setFecha(e.target.value)} />
            </div>
            <div>
              <label className="label">Estado</label>
              <select className="input" value={estado} onChange={(e) => setEstado(e.target.value as EstadoPresupuesto)}>
                {ESTADOS_PRESUPUESTO.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Acciones rápidas de estado (solo en edición) */}
          {editId && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium text-slate-600">Marcar como:</span>
              {([
                ['PRESENTADO', 'Presentado', 'bg-blue-600 text-white ring-blue-300', 'bg-blue-50 text-blue-700 hover:bg-blue-100'],
                ['APROBADO', 'Aprobado', 'bg-emerald-600 text-white ring-emerald-300', 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'],
                ['RECHAZADO', 'Rechazado', 'bg-rose-600 text-white ring-rose-300', 'bg-rose-50 text-rose-700 hover:bg-rose-100'],
              ] as const).map(([val, label, activo, inactivo]) => {
                const sel = estado === val
                return (
                  <button key={val} type="button" onClick={() => marcarEstado(val)}
                    aria-pressed={sel}
                    className={`inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold shadow-sm transition ${sel ? `${activo} ring-2` : inactivo}`}>
                    {sel && <Check size={13} strokeWidth={3} />}
                    {label}
                  </button>
                )
              })}
            </div>
          )}

          {/* Renglones (tratamientos) */}
          <div>
            <label className="label">Tratamientos</label>
            {items.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-6 text-center text-sm text-slate-600">
                Agrega los tratamientos del plan.
              </div>
            ) : (
              <div className="space-y-3">
                {items.map((l, i) => (
                  <div key={i} className="rounded-xl border-2 border-slate-200 bg-white p-3 shadow-sm">
                    <div className="flex items-start gap-2">
                      <div className="flex-1">
                        <span className="text-xs font-medium text-slate-600">Tratamiento</span>
                        <select className="input" value={l.servicio_id} onChange={(e) => elegirServicio(i, e.target.value)}>
                          <option value="">— Selecciona o escribe abajo —</option>
                          {servicios.map((s) => (
                            <option key={s.id} value={s.id}>{s.nombre}</option>
                          ))}
                        </select>
                      </div>
                      <button onClick={() => quitarItem(i)} title="Quitar tratamiento" className="mt-5 rounded-lg p-1.5 text-slate-600 hover:bg-rose-50 hover:text-rose-600">
                        <Trash2 size={16} />
                      </button>
                    </div>

                    <div className="mt-2">
                      <span className="text-xs font-medium text-slate-600">Descripción</span>
                      <input
                        className="input"
                        placeholder="Descripción del tratamiento"
                        value={l.descripcion}
                        onChange={(e) => setItem(i, { descripcion: e.target.value })}
                      />
                    </div>

                    <div className="mt-2 grid grid-cols-4 gap-2">
                      <div>
                        <span className="text-xs font-medium text-slate-600">Diente</span>
                        <input type="number" className="input" placeholder="FDI" value={l.diente} onChange={(e) => setItem(i, { diente: e.target.value })} />
                      </div>
                      <div>
                        <span className="text-xs font-medium text-slate-600">Cant.</span>
                        <input type="number" min={1} className="input" value={l.cantidad || ''} onChange={(e) => setItem(i, { cantidad: Number(e.target.value) })} />
                      </div>
                      <div>
                        <span className="text-xs font-medium text-slate-600">Precio</span>
                        <input type="number" min={0} step={50} className="input" value={l.precio_unit || ''} onChange={(e) => setItem(i, { precio_unit: Number(e.target.value) })} />
                      </div>
                      <div>
                        <span className="text-xs font-medium text-slate-600">Subtotal</span>
                        <input className="input bg-slate-50" value={money(l.cantidad * l.precio_unit)} readOnly />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-2">
              <button className="btn-ghost" onClick={agregarItem}>
                <Plus size={14} /> Agregar tratamiento
              </button>
            </div>
          </div>

          {/* Descuento */}
          <div>
            <label className="label">Descuento (RD$)</label>
            <input type="number" min={0} step={50} className="input w-40" value={descuento || ''} onChange={(e) => setDescuento(Number(e.target.value))} />
          </div>

          {/* Totales */}
          <div className="rounded-lg bg-slate-50 p-3 text-sm">
            <div className="flex justify-between text-slate-600"><span>Subtotal</span><span>{money(subtotal)}</span></div>
            {descuentoMonto > 0 && <div className="flex justify-between text-slate-600"><span>Descuento</span><span>- {money(descuentoMonto)}</span></div>}
            <div className="mt-1 flex justify-between border-t border-slate-200 pt-1 text-base font-bold text-slate-800"><span>Total</span><span>{money(total)}</span></div>
          </div>

          {/* Notas */}
          <div>
            <label className="label">Notas</label>
            <textarea className="input" rows={2} value={notas} onChange={(e) => setNotas(e.target.value)} />
          </div>

          {/* Convertir a factura (solo APROBADO y aún no facturado) */}
          {editId && estado === 'APROBADO' && !facturado && (
            <button type="button" onClick={convertirAFactura} disabled={convirtiendo} className="flex w-full items-center justify-center gap-2 rounded-xl border border-brand-200 bg-brand-50 px-3 py-2 text-sm font-semibold text-brand-700 hover:bg-brand-100 disabled:opacity-60">
              <FileText size={16} /> {convirtiendo ? 'Convirtiendo…' : 'Convertir a factura'}
            </button>
          )}
          {facturado && (
            <p className="flex items-center justify-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800">
              <FileText size={16} /> Este presupuesto ya fue facturado.
            </p>
          )}
        </div>
      </Modal>
    </div>
  )
}
