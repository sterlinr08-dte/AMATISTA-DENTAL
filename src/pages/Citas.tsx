import { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2, CalendarDays, Clock, Receipt } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { CitaConRelaciones, Cliente, Empleado, EstadoCita, Servicio } from '../types'
import { hora, money, fechaLarga, hoyISO, codigoFactura, conPrefijo } from '../lib/format'
import { useAuth } from '../lib/auth'
import { useNegocio } from '../lib/negocio'
import PageHeader from '../components/PageHeader'
import Cargando from '../components/Cargando'
import Modal from '../components/Modal'
import Paginacion, { usePaginacion } from '../components/Paginacion'
import SelectorPaciente from '../components/SelectorPaciente'

const SELECT = `*,
  cliente:clientes(id,nombre,telefono),
  empleado:empleados(id,nombre,color),
  servicio:servicios(id,nombre,precio,duracion_min),
  cita_servicios(precio, servicio:servicios(nombre))`

interface ServLinea { servicio_id: string; empleado_id: string; precio: number }

const estados: { value: EstadoCita; label: string; clase: string }[] = [
  { value: 'PENDIENTE', label: 'Pendiente', clase: 'bg-amber-50 text-amber-700' },
  { value: 'CONFIRMADA', label: 'Confirmada', clase: 'bg-sky-50 text-sky-700' },
  { value: 'COMPLETADA', label: 'Completada', clase: 'bg-emerald-50 text-emerald-700' },
  { value: 'CANCELADA', label: 'Cancelada', clase: 'bg-rose-50 text-rose-700' },
]

function badgeEstado(e: EstadoCita) {
  return estados.find((x) => x.value === e)?.clase ?? 'bg-slate-100 text-slate-600'
}

function sumarMinutos(h: string, min: number): string {
  const [hh, mm] = h.split(':').map(Number)
  const total = hh * 60 + mm + min
  const nh = Math.floor((total % 1440) / 60)
  const nm = total % 60
  return `${String(nh).padStart(2, '0')}:${String(nm).padStart(2, '0')}`
}

const vacio = {
  cliente_id: '',
  fecha: hoyISO(),
  hora_inicio: '09:00',
  estado: 'PENDIENTE' as EstadoCita,
  notas: '',
}

export default function Citas() {
  const { puedeAccion } = useAuth()
  const { negocio } = useNegocio()
  const puedeEliminar = puedeAccion('citas.eliminar')
  const [items, setItems] = useState<CitaConRelaciones[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [empleados, setEmpleados] = useState<Empleado[]>([])
  const [servicios, setServicios] = useState<Servicio[]>([])
  const [loading, setLoading] = useState(true)
  const [fecha, setFecha] = useState(hoyISO())
  const [open, setOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState(vacio)
  const [servLineas, setServLineas] = useState<ServLinea[]>([])
  const [saving, setSaving] = useState(false)

  const totalPrecio = servLineas.reduce((s, l) => s + Number(l.precio || 0), 0)
  const totalDuracion = servLineas.reduce((s, l) => s + (servicios.find((x) => x.id === l.servicio_id)?.duracion_min ?? 0), 0)

  const pag = usePaginacion(items, 10)

  function agregarServicio() {
    setServLineas((prev) => [...prev, { servicio_id: '', empleado_id: '', precio: 0 }])
  }
  function setServLinea(i: number, patch: Partial<ServLinea>) {
    setServLineas((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)))
  }
  function elegirServicioLinea(i: number, id: string) {
    const s = servicios.find((x) => x.id === id)
    setServLinea(i, { servicio_id: id, precio: s ? Number(s.precio) : 0 })
  }
  function quitarServicio(i: number) {
    setServLineas((prev) => prev.filter((_, idx) => idx !== i))
  }

  async function cargar() {
    setLoading(true)
    const { data, error } = await supabase
      .from('citas')
      .select(SELECT)
      .eq('fecha', fecha)
      .order('hora_inicio')
    if (error) alert('Error al cargar citas: ' + error.message)
    setItems((data as CitaConRelaciones[]) ?? [])
    setLoading(false)
  }

  async function cargarCatalogos() {
    const [cl, em, se] = await Promise.all([
      supabase.from('clientes').select('*').order('nombre'),
      supabase.from('empleados').select('*').eq('activo', true).order('nombre'),
      supabase.from('servicios').select('*').eq('activo', true).order('nombre'),
    ])
    setClientes(cl.data ?? [])
    setEmpleados(em.data ?? [])
    setServicios(se.data ?? [])
  }

  useEffect(() => {
    cargarCatalogos()
  }, [])

  useEffect(() => {
    cargar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fecha])

  function abrirNuevo() {
    setEditId(null)
    setForm({ ...vacio, fecha })
    setServLineas([{ servicio_id: '', empleado_id: '', precio: 0 }])
    setOpen(true)
  }

  async function abrirEditar(c: CitaConRelaciones) {
    setEditId(c.id)
    setForm({
      cliente_id: c.cliente_id ?? '',
      fecha: c.fecha,
      hora_inicio: c.hora_inicio.slice(0, 5),
      estado: c.estado,
      notas: c.notas ?? '',
    })
    const { data } = await supabase.from('cita_servicios').select('servicio_id, empleado_id, precio').eq('cita_id', c.id).order('created_at')
    if (data && data.length) {
      setServLineas((data as any[]).map((s) => ({ servicio_id: s.servicio_id ?? '', empleado_id: s.empleado_id ?? '', precio: Number(s.precio) })))
    } else {
      // Cita antigua (un solo servicio en la fila)
      setServLineas([{ servicio_id: c.servicio_id ?? '', empleado_id: c.empleado_id ?? '', precio: Number(c.precio) }])
    }
    setOpen(true)
  }

  async function guardar() {
    if (!form.cliente_id) return alert('Selecciona un cliente')
    const serv = servLineas.filter((l) => l.servicio_id)
    if (serv.length === 0) return alert('Agrega al menos un servicio')
    setSaving(true)
    const payload = {
      cliente_id: form.cliente_id,
      empleado_id: serv[0].empleado_id || null, // empleado principal (para la agenda)
      servicio_id: serv[0].servicio_id, // servicio principal (etiqueta / compatibilidad)
      fecha: form.fecha,
      hora_inicio: form.hora_inicio,
      hora_fin: sumarMinutos(form.hora_inicio, totalDuracion),
      estado: form.estado,
      precio: totalPrecio,
      notas: form.notas || null,
    }
    let citaId = editId
    if (editId) {
      const { error } = await supabase.from('citas').update(payload).eq('id', editId)
      if (error) { setSaving(false); return alert('Error al guardar: ' + error.message) }
      await supabase.from('cita_servicios').delete().eq('cita_id', editId)
    } else {
      const { data, error } = await supabase.from('citas').insert(payload).select('id').single()
      if (error || !data) { setSaving(false); return alert('Error al guardar: ' + error?.message) }
      citaId = (data as any).id
    }
    await supabase.from('cita_servicios').insert(
      serv.map((l) => ({ cita_id: citaId, servicio_id: l.servicio_id, empleado_id: l.empleado_id || null, precio: l.precio, duracion_min: servicios.find((x) => x.id === l.servicio_id)?.duracion_min ?? 0 })),
    )
    setSaving(false)
    setOpen(false)
    if (form.fecha !== fecha) setFecha(form.fecha)
    else cargar()
  }

  async function cambiarEstado(c: CitaConRelaciones, estado: EstadoCita) {
    const { error } = await supabase.from('citas').update({ estado }).eq('id', c.id)
    if (error) return alert('Error: ' + error.message)
    cargar()
  }

  async function eliminar(c: CitaConRelaciones) {
    if (!confirm('¿Eliminar esta cita?')) return
    const { error } = await supabase.from('citas').delete().eq('id', c.id)
    if (error) return alert('Error al eliminar: ' + error.message)
    cargar()
  }

  // Genera una factura (PENDIENTE) a partir de la cita, lista para cobrar en Caja
  async function facturar(c: CitaConRelaciones) {
    // Evitar doble facturación
    const { data: existente } = await supabase.from('facturas').select('id,numero,tipo_venta,serie').eq('cita_id', c.id).maybeSingle()
    if (existente) return alert(`Esta cita ya tiene la factura ${codigoFactura(existente as any)}. Cóbrala en Caja.`)
    if (!confirm(`¿Generar factura de ${money(c.precio)} para ${c.cliente?.nombre ?? 'el cliente'}? Luego se cobra en Caja.`)) return

    const { data: factura, error } = await supabase
      .from('facturas')
      .insert({
        cliente_id: c.cliente_id,
        cliente_nombre: c.cliente?.nombre ?? 'Cliente',
        cita_id: c.id,
        fecha: hoyISO(),
        subtotal: c.precio,
        descuento: 0,
        itbis: 0,
        total: c.precio,
        estado: 'PENDIENTE',
        metodo_pago: null,
      })
      .select()
      .single()
    if (error || !factura) return alert('Error al facturar: ' + error?.message)

    // Un renglón de factura por cada servicio de la cita (o uno solo si es cita antigua)
    const { data: cs } = await supabase.from('cita_servicios').select('servicio_id, empleado_id, precio, servicio:servicios(nombre)').eq('cita_id', c.id).order('created_at')
    const renglones = (cs && cs.length)
      ? (cs as any[]).map((s) => ({
          factura_id: factura.id,
          servicio_id: s.servicio_id,
          empleado_id: s.empleado_id || c.empleado_id || null,
          descripcion: s.servicio?.nombre ?? 'Servicio',
          cantidad: 1,
          precio_unit: Number(s.precio),
          importe: Number(s.precio),
        }))
      : [{
          factura_id: factura.id,
          servicio_id: c.servicio_id,
          empleado_id: c.empleado_id || null,
          descripcion: c.servicio?.nombre ?? 'Servicio',
          cantidad: 1,
          precio_unit: c.precio,
          importe: c.precio,
        }]
    const { error: eItems } = await supabase.from('factura_items').insert(renglones)
    if (eItems) {
      // Evita dejar una factura sin renglones: la elimina y avisa
      await supabase.from('facturas').delete().eq('id', factura.id)
      return alert('Error al generar el detalle de la factura: ' + eItems.message)
    }
    // Marcar la cita como completada
    if (c.estado !== 'COMPLETADA') await supabase.from('citas').update({ estado: 'COMPLETADA' }).eq('id', c.id)
    alert(`Factura ${codigoFactura(factura)} generada. Ahora cóbrala en Caja.`)
    cargar()
  }

  return (
    <div>
      <PageHeader
        title="Citas / Agenda"
        subtitle={fechaLarga(fecha)}
        action={
          <div className="flex items-center gap-2">
            <input type="date" className="input w-auto" value={fecha} onChange={(e) => setFecha(e.target.value)} />
            <button className="btn-primary" onClick={abrirNuevo}>
              <Plus size={16} /> Nueva cita
            </button>
          </div>
        }
      />

      {loading ? (
        <Cargando />
      ) : items.length === 0 ? (
        <div className="card flex flex-col items-center gap-3 py-12 text-center">
          <CalendarDays className="text-brand-300" size={40} />
          <p className="text-slate-500">No hay citas para este día.</p>
          <button className="btn-primary" onClick={abrirNuevo}>
            <Plus size={16} /> Agendar cita
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {pag.visibles.map((c) => (
            <div key={c.id} className="card flex flex-wrap items-center gap-4">
              <div className="flex w-24 shrink-0 flex-col items-center rounded-lg bg-brand-50 py-2 text-brand-700">
                <Clock size={16} />
                <span className="mt-1 text-sm font-semibold">{hora(c.hora_inicio)}</span>
                {c.hora_fin && <span className="text-xs text-brand-400">{hora(c.hora_fin)}</span>}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-semibold text-brand-700">{conPrefijo(negocio.prefijo_cita, c.numero)}</span>
                  <p className="font-semibold text-slate-800">{c.cliente?.nombre ?? 'Cliente eliminado'}</p>
                </div>
                <p className="text-sm text-slate-500">
                  {((c as any).cita_servicios?.length ? (c as any).cita_servicios.map((s: any) => s.servicio?.nombre).filter(Boolean).join(', ') : c.servicio?.nombre) || 'Servicio'} · {money(c.precio)}
                </p>
                {c.empleado && (
                  <span className="mt-1 inline-flex items-center gap-1 text-xs text-slate-600">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: c.empleado.color ?? '#C9A227' }} />
                    {c.empleado.nombre}
                  </span>
                )}
              </div>

              <select
                className={`badge cursor-pointer border-0 ${badgeEstado(c.estado)}`}
                value={c.estado}
                onChange={(e) => cambiarEstado(c, e.target.value as EstadoCita)}
              >
                {estados.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>

              <div className="flex gap-1">
                {c.estado !== 'CANCELADA' && (
                  <button onClick={() => facturar(c)} title="Generar factura" className="rounded-lg p-2 text-slate-600 hover:bg-emerald-50 hover:text-emerald-600">
                    <Receipt size={16} />
                  </button>
                )}
                <button onClick={() => abrirEditar(c)} className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 hover:text-brand-600">
                  <Pencil size={16} />
                </button>
                {puedeEliminar && (
                  <button onClick={() => eliminar(c)} className="rounded-lg p-2 text-slate-600 hover:bg-rose-50 hover:text-rose-600">
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            </div>
          ))}
          <Paginacion pagina={pag.pagina} totalPaginas={pag.totalPaginas} total={pag.total} desde={pag.desde} pageSize={pag.pageSize} onPagina={pag.setPagina} />
        </div>
      )}

      <Modal
        open={open}
        title={editId ? 'Editar cita' : 'Nueva cita'}
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
            <label className="label">Cliente</label>
            <SelectorPaciente clientes={clientes} value={form.cliente_id} onChange={(id) => setForm({ ...form, cliente_id: id })} />
          </div>
          <div>
            <label className="label">Servicios (cada uno con su empleado)</label>
            <div className="space-y-2">
              {servLineas.map((l, i) => (
                <div key={i} className="rounded-lg border border-slate-200 p-2">
                  <div className="flex gap-2">
                    <select className="input flex-1" value={l.servicio_id} onChange={(e) => elegirServicioLinea(i, e.target.value)}>
                      <option value="">— Selecciona un servicio —</option>
                      {servicios.map((s) => (
                        <option key={s.id} value={s.id}>{s.nombre} · {money(s.precio)}</option>
                      ))}
                    </select>
                    {servLineas.length > 1 && (
                      <button type="button" onClick={() => quitarServicio(i)} className="rounded-lg px-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600">
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-xs font-medium text-slate-600">Realizado por</span>
                      <select className="input" value={l.empleado_id} onChange={(e) => setServLinea(i, { empleado_id: e.target.value })}>
                        <option value="">— Sin asignar —</option>
                        {empleados.map((e) => (
                          <option key={e.id} value={e.id}>{e.nombre}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <span className="text-xs font-medium text-slate-600">Precio</span>
                      <input type="number" min={0} step={50} className="input" value={l.precio || ''} onChange={(e) => setServLinea(i, { precio: Number(e.target.value) })} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-2 flex items-center justify-between">
              <button type="button" className="btn-ghost" onClick={agregarServicio}>
                <Plus size={14} /> Agregar servicio
              </button>
              <span className="text-sm font-semibold text-slate-700">Total: {money(totalPrecio)} · {totalDuracion} min</span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Fecha</label>
              <input type="date" className="input" value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} />
            </div>
            <div>
              <label className="label">Hora</label>
              <input type="time" className="input" value={form.hora_inicio} onChange={(e) => setForm({ ...form, hora_inicio: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="label">Estado</label>
            <select className="input" value={form.estado} onChange={(e) => setForm({ ...form, estado: e.target.value as EstadoCita })}>
              {estados.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
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
