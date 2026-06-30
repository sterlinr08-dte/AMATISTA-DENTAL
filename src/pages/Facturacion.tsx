import { useEffect, useState } from 'react'
import { Plus, Trash2, Printer, Ban, X, Search, Receipt, UserPlus, Undo2, Settings } from 'lucide-react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { conectarQZ } from '../lib/impresora'
import { Cliente, Factura, FacturaItem, Servicio, Articulo, Empleado, EstadoFactura, TipoVenta } from '../types'
import { money, fechaCorta, hoyISO, codigoArticulo, codigoFactura, codigoCliente } from '../lib/format'
import { ITBIS_RATE } from '../lib/constants'
import { useAuth } from '../lib/auth'
import { useNegocio } from '../lib/negocio'
import PageHeader from '../components/PageHeader'
import Cargando from '../components/Cargando'
import Modal from '../components/Modal'
import DataTable from '../components/DataTable'

interface LineaTmp {
  servicio_id: string
  articulo_id: string
  descripcion: string
  cantidad: number
  precio_unit: number
  empleado_id: string
}

const lineaVacia: LineaTmp = { servicio_id: '', articulo_id: '', descripcion: '', cantidad: 1, precio_unit: 0, empleado_id: '' }

const estadoBadge: Record<EstadoFactura, string> = {
  PENDIENTE: 'bg-amber-50 text-amber-700',
  PAGADA: 'bg-emerald-50 text-emerald-700',
  ANULADA: 'bg-rose-50 text-rose-700',
}

export default function Facturacion() {
  const { perfil, puedeAccion } = useAuth()
  const { negocio } = useNegocio()
  const puedeAnular = puedeAccion('facturas.anular')
  const puedeEliminar = puedeAccion('facturas.eliminar')
  const puedeEditar = puedeAccion('facturas.editar')
  const puedeVenderSinExistencia = puedeAccion('facturas.vender_sin_existencia')
  const puedeModificarLineas = puedeAccion('facturas.modificar_lineas')
  const puedeCambiarFecha = puedeAccion('facturas.cambiar_fecha')

  const [facturas, setFacturas] = useState<Factura[]>([])
  const [qzListo, setQzListo] = useState(false)   // impresión directa (QZ Tray) conectada
  const [verEstado, setVerEstado] = useState<'ABIERTAS' | 'PAGADAS' | 'TODAS'>('ABIERTAS')
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [servicios, setServicios] = useState<Servicio[]>([])
  const [articulos, setArticulos] = useState<Articulo[]>([])
  const [empleados, setEmpleados] = useState<Empleado[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [verId, setVerId] = useState<string | null>(null)
  const [verItems, setVerItems] = useState<FacturaItem[]>([])

  // Devoluciones / notas de crédito
  const [devueltoPorFactura, setDevueltoPorFactura] = useState<Record<string, number>>({})
  const [devolverFactura, setDevolverFactura] = useState<Factura | null>(null)
  const [devolverItems, setDevolverItems] = useState<FacturaItem[]>([])
  const [yaDevuelto, setYaDevuelto] = useState<Record<string, number>>({})  // factura_item_id -> cant ya devuelta
  const [devCant, setDevCant] = useState<Record<string, number>>({})        // factura_item_id -> cant a devolver ahora
  const [devMetodo, setDevMetodo] = useState('Efectivo')
  const [devMotivo, setDevMotivo] = useState('')
  const [savingDev, setSavingDev] = useState(false)
  const [devOk, setDevOk] = useState<{ codigo: string; monto: number } | null>(null)

  // formulario de nueva factura
  const [clienteId, setClienteId] = useState('')
  const [clienteNombre, setClienteNombre] = useState('')
  const [fecha, setFecha] = useState(hoyISO())
  const [tipoVenta, setTipoVenta] = useState<TipoVenta>('CONTADO')
  const [aplicaItbis, setAplicaItbis] = useState(false)
  const [descuento, setDescuento] = useState(0)               // descuento como monto (RD$)
  const [descuentoModo, setDescuentoModo] = useState<'monto' | 'pct'>('monto')
  const [descuentoPct, setDescuentoPct] = useState(0)          // descuento como % del subtotal
  const [notas, setNotas] = useState('')
  const [lineas, setLineas] = useState<LineaTmp[]>([])
  const [buscarItem, setBuscarItem] = useState('')
  const [editId, setEditId] = useState<string | null>(null)
  // Cantidad por artículo que ya tenía la factura al editar (para no bloquear de más la existencia)
  const [cantOriginal, setCantOriginal] = useState<Record<string, number>>({})
  // Cantidad de ítems que ya tenía la factura al abrir (los primeros N renglones son los previos)
  const [lineasOriginales, setLineasOriginales] = useState(0)
  // Catálogo completo (ventana de la lupa)
  const [catalogoOpen, setCatalogoOpen] = useState(false)
  const [catTab, setCatTab] = useState<'catalogo' | 'historial'>('catalogo')
  const [buscarCat, setBuscarCat] = useState('')
  // Crear cliente rápido (desde la factura)
  const [crearClienteOpen, setCrearClienteOpen] = useState(false)
  const [nuevoCli, setNuevoCli] = useState({ nombre: '', telefono: '', email: '' })
  const [savingCli, setSavingCli] = useState(false)
  // Buscador de cliente (combobox)
  const [buscarCliente, setBuscarCliente] = useState('')
  const [clienteFocus, setClienteFocus] = useState(false)

  // Resultados del buscador (servicios + artículos)
  const q = buscarItem.trim().toLowerCase()
  const resultados = q
    ? [
        ...servicios
          .filter((s) => s.nombre.toLowerCase().includes(q) || (s.categoria ?? '').toLowerCase().includes(q))
          .map((s) => ({ tipo: 's' as const, id: s.id, nombre: s.nombre, precio: Number(s.precio), stock: null as number | null })),
        ...articulos
          .filter((a) => a.nombre.toLowerCase().includes(q) || a.categoria.toLowerCase().includes(q) || codigoArticulo(a.codigo).includes(q))
          .map((a) => ({ tipo: 'a' as const, id: a.id, nombre: a.nombre, precio: Number(a.precio), stock: Number(a.stock) })),
      ].slice(0, 8)
    : []

  // Lista completa para la ventana del catálogo (la lupa), con filtro propio
  const qc = buscarCat.trim().toLowerCase()
  const catalogo = [
    ...servicios
      .filter((s) => !qc || s.nombre.toLowerCase().includes(qc) || (s.categoria ?? '').toLowerCase().includes(qc))
      .map((s) => ({ tipo: 's' as const, id: s.id, nombre: s.nombre, precio: Number(s.precio), stock: null as number | null })),
    ...articulos
      .filter((a) => !qc || a.nombre.toLowerCase().includes(qc) || a.categoria.toLowerCase().includes(qc) || codigoArticulo(a.codigo).includes(qc))
      .map((a) => ({ tipo: 'a' as const, id: a.id, nombre: a.nombre, precio: Number(a.precio), stock: Number(a.stock) })),
  ]

  function agregarDesdeBusqueda(r: { tipo: 's' | 'a'; id: string; nombre: string; precio: number; stock?: number | null }) {
    if (r.tipo === 'a' && (r.stock ?? 0) <= 0) {
      if (!puedeVenderSinExistencia) {
        alert(`"${r.nombre}" no tiene existencia. Solo administración puede facturar sin existencia.`)
        return
      }
      if (!confirm(`"${r.nombre}" no tiene existencia (0). ¿Agregar de todos modos?`)) return
    }
    setLineas((prev) => {
      // Si el mismo servicio/artículo ya está, suma la cantidad en vez de duplicar
      const existe = prev.findIndex((l) =>
        r.tipo === 's' ? l.servicio_id === r.id : l.articulo_id === r.id,
      )
      if (existe >= 0) {
        return prev.map((l, idx) => (idx === existe ? { ...l, cantidad: l.cantidad + 1 } : l))
      }
      // Cada ítem nuevo entra SIN asignar; el usuario elige quién lo hizo
      const linea: LineaTmp = {
        servicio_id: r.tipo === 's' ? r.id : '',
        articulo_id: r.tipo === 'a' ? r.id : '',
        descripcion: r.nombre,
        cantidad: 1,
        precio_unit: r.precio,
        empleado_id: '',
      }
      return [...prev, linea]
    })
    setBuscarItem('')
  }

  // Agrega un concepto manual (algo que no está en el catálogo)
  function agregarManual() {
    setLineas((prev) => [...prev, { ...lineaVacia }])
  }

  // Crear cliente rápido sin salir de la factura
  function abrirCrearCliente() {
    setNuevoCli({ nombre: clienteNombre || '', telefono: '', email: '' })
    setCrearClienteOpen(true)
  }
  async function guardarNuevoCliente() {
    if (!nuevoCli.nombre.trim()) return alert('El nombre del cliente es obligatorio')
    setSavingCli(true)
    const { data, error } = await supabase
      .from('clientes')
      .insert({ nombre: nuevoCli.nombre.trim(), telefono: nuevoCli.telefono || null, email: nuevoCli.email || null })
      .select()
      .single()
    if (error || !data) {
      setSavingCli(false)
      return alert('Error al crear el cliente: ' + error?.message)
    }
    // Recargar la lista y dejar seleccionado el cliente recién creado
    const { data: cls } = await supabase.from('clientes').select('*').order('nombre')
    setClientes(cls ?? [])
    setClienteId((data as any).id)
    setClienteNombre('')
    setBuscarCliente(`${codigoCliente((data as any).codigo)} · ${(data as any).nombre}`)
    setSavingCli(false)
    setCrearClienteOpen(false)
  }

  async function cargar() {
    setLoading(true)
    const [{ data }, { data: dev }] = await Promise.all([
      supabase.from('facturas').select('*').order('numero', { ascending: false }),
      supabase.from('devoluciones').select('factura_id, monto'),
    ])
    setFacturas(data ?? [])
    // Total devuelto por factura (para el indicador "Devuelta")
    const acc: Record<string, number> = {}
    for (const d of dev ?? []) acc[(d as any).factura_id] = (acc[(d as any).factura_id] ?? 0) + Number((d as any).monto)
    setDevueltoPorFactura(acc)
    setLoading(false)
  }

  async function cargarCatalogos() {
    const [cl, se, ar, em] = await Promise.all([
      supabase.from('clientes').select('*').order('nombre'),
      supabase.from('servicios').select('*').eq('activo', true).order('nombre'),
      supabase.from('articulos').select('*').eq('activo', true).order('nombre'),
      supabase.from('empleados').select('*').eq('activo', true).order('nombre'),
    ])
    setClientes(cl.data ?? [])
    setServicios(se.data ?? [])
    setArticulos(ar.data ?? [])
    setEmpleados(em.data ?? [])
  }

  useEffect(() => {
    cargar()
    cargarCatalogos()
  }, [])

  // Estado de la impresora directa (QZ Tray): verde si está conectada
  useEffect(() => {
    let cancel = false
    const revisar = () => conectarQZ().then((ok) => { if (!cancel) setQzListo(ok) }).catch(() => { if (!cancel) setQzListo(false) })
    revisar()
    const t = setInterval(revisar, 15000)
    return () => { cancel = true; clearInterval(t) }
  }, [])

  const subtotal = lineas.reduce((s, l) => s + l.cantidad * l.precio_unit, 0)
  // Descuento efectivo en RD$: por % del subtotal o por monto fijo (nunca mayor que el subtotal)
  const descuentoMonto = Math.min(subtotal, descuentoModo === 'pct' ? subtotal * (descuentoPct / 100) : descuento)
  const baseImponible = Math.max(0, subtotal - descuentoMonto)
  const itbis = aplicaItbis ? baseImponible * ITBIS_RATE : 0
  const total = baseImponible + itbis
  // En una cuenta ya creada (editando), descuento e ITBIS quedan protegidos salvo autorización
  const protegerCuenta = !!editId && !puedeModificarLineas

  // Clientes que coinciden con la búsqueda (nombre, código o teléfono)
  const clientesFiltrados = (() => {
    const t = buscarCliente.trim().toLowerCase()
    const base = !t
      ? clientes
      : clientes.filter((c) => c.nombre.toLowerCase().includes(t) || codigoCliente(c.codigo).includes(t) || (c.telefono ?? '').toLowerCase().includes(t))
    return base.slice(0, 8)
  })()

  function nuevaFactura() {
    setEditId(null)
    setClienteId('')
    setClienteNombre('')
    setBuscarCliente('')
    setFecha(hoyISO())
    setTipoVenta('CONTADO')
    setAplicaItbis(false)
    setDescuento(0)
    setDescuentoModo('monto')
    setDescuentoPct(0)
    setNotas('')
    setLineas([])
    setCantOriginal({})
    setLineasOriginales(0)
    setBuscarItem('')
    setOpen(true)
  }

  // Editar una factura ya guardada (solo PENDIENTE y con permiso)
  async function abrirEditar(f: Factura) {
    if (f.estado !== 'PENDIENTE') return alert('Solo se pueden editar facturas pendientes (aún no cobradas).')
    const { data, error } = await supabase
      .from('factura_items')
      .select('*')
      .eq('factura_id', f.id)
      .order('id')
    if (error) return alert('Error al cargar la factura: ' + error.message)
    setEditId(f.id)
    setClienteId(f.cliente_id ?? '')
    setClienteNombre(f.cliente_nombre ?? '')
    {
      const cl = f.cliente_id ? clientes.find((c) => c.id === f.cliente_id) : null
      setBuscarCliente(cl ? `${codigoCliente(cl.codigo)} · ${cl.nombre}` : '')
    }
    setFecha(f.fecha)
    setTipoVenta(f.tipo_venta ?? 'CONTADO')
    setAplicaItbis(Number(f.itbis) > 0)
    setDescuento(Number(f.descuento))
    setDescuentoModo('monto')
    setDescuentoPct(0)
    setNotas(f.notas ?? '')
    setBuscarItem('')
    setLineas(
      (data ?? []).map((it: any) => ({
        servicio_id: it.servicio_id ?? '',
        articulo_id: it.articulo_id ?? '',
        descripcion: it.descripcion,
        cantidad: Number(it.cantidad),
        precio_unit: Number(it.precio_unit),
        empleado_id: it.empleado_id ?? '',
      })),
    )
    // Guarda cuánto de cada artículo ya tenía esta factura (esa cantidad ya está descontada)
    const orig: Record<string, number> = {}
    for (const it of (data ?? []) as any[]) {
      if (it.articulo_id) orig[it.articulo_id] = (orig[it.articulo_id] ?? 0) + Number(it.cantidad)
    }
    setCantOriginal(orig)
    setLineasOriginales((data ?? []).length)
    setOpen(true)
  }

  function setLinea(i: number, patch: Partial<LineaTmp>) {
    setLineas((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)))
  }

  async function guardar(imprimir = false) {
    const items = lineas.filter((l) => l.descripcion.trim() && l.cantidad > 0)
    if (items.length === 0) return alert('Agrega al menos un ítem con descripción')
    // No permitir dejar la existencia en negativo (salvo administración)
    if (!puedeVenderSinExistencia) {
      for (const l of items) {
        if (!l.articulo_id) continue
        const art = articulos.find((a) => a.id === l.articulo_id)
        if (!art) continue
        const disponible = Number(art.stock) + (cantOriginal[l.articulo_id] ?? 0)
        if (l.cantidad > disponible) {
          return alert(`No hay suficiente existencia de "${l.descripcion}" (disponible: ${disponible}). Solo administración puede facturar dejándolo en negativo.`)
        }
      }
    }
    setSaving(true)
    const datos = {
      cliente_id: clienteId || null,
      cliente_nombre: clienteId ? clientes.find((c) => c.id === clienteId)?.nombre : clienteNombre || 'Cliente de contado',
      // Sin permiso de administración la venta nueva siempre lleva la fecha de hoy.
      fecha: !puedeCambiarFecha && !editId ? hoyISO() : fecha,
      tipo_venta: tipoVenta,
      subtotal,
      descuento: descuentoMonto,
      itbis,
      total,
      notas: notas || null,
    }

    let facturaId = editId
    if (editId) {
      // Editar: devolver el stock anterior, actualizar y reinsertar el detalle
      await restaurarStock(editId)
      const { error } = await supabase.from('facturas').update(datos).eq('id', editId)
      if (error) {
        setSaving(false)
        return alert('Error al actualizar factura: ' + error.message)
      }
      const { error: eDel } = await supabase.from('factura_items').delete().eq('factura_id', editId)
      if (eDel) {
        setSaving(false)
        return alert('Error al actualizar el detalle: ' + eDel.message)
      }
    } else {
      const { data: factura, error } = await supabase
        .from('facturas')
        .insert({ ...datos, estado: 'PENDIENTE', metodo_pago: null })
        .select()
        .single()
      if (error || !factura) {
        setSaving(false)
        return alert('Error al crear factura: ' + error?.message)
      }
      facturaId = factura.id
    }

    const payload = items.map((l) => ({
      factura_id: facturaId,
      servicio_id: l.servicio_id || null,
      articulo_id: l.articulo_id || null,
      empleado_id: l.empleado_id || null,
      descripcion: l.descripcion,
      cantidad: l.cantidad,
      precio_unit: l.precio_unit,
      importe: l.cantidad * l.precio_unit,
    }))
    const { error: e2 } = await supabase.from('factura_items').insert(payload)
    if (e2) {
      setSaving(false)
      return alert('Factura guardada pero falló el detalle: ' + e2.message)
    }
    // Descontar del stock los artículos vendidos
    for (const l of items) {
      if (l.articulo_id) {
        await supabase.rpc('ajustar_stock', { p_articulo: l.articulo_id, p_delta: -l.cantidad })
      }
    }
    setSaving(false)
    setOpen(false)
    await cargar()
    // Guardar e imprimir: abre el recibo de la factura recién guardada y lo manda a imprimir
    if (imprimir && facturaId) {
      await verDetalle({ id: facturaId } as Factura)
      setTimeout(() => window.print(), 400)
    }
  }

  // Devuelve al stock los artículos de una factura
  async function restaurarStock(facturaId: string) {
    const { data } = await supabase.from('factura_items').select('articulo_id, cantidad').eq('factura_id', facturaId)
    for (const it of data ?? []) {
      if ((it as any).articulo_id) {
        await supabase.rpc('ajustar_stock', { p_articulo: (it as any).articulo_id, p_delta: Number((it as any).cantidad) })
      }
    }
  }

  async function cambiarEstado(f: Factura, estado: EstadoFactura) {
    // Al anular, devolver los artículos al inventario
    if (estado === 'ANULADA' && f.estado !== 'ANULADA') {
      await restaurarStock(f.id)
    }
    const { error } = await supabase.from('facturas').update({ estado }).eq('id', f.id)
    if (error) return alert('Error: ' + error.message)
    cargar()
  }

  async function eliminar(f: Factura) {
    if (!confirm(`¿Eliminar la factura ${codigoFactura(f)}?`)) return
    // Si no estaba anulada, devolver el stock antes de borrar
    if (f.estado !== 'ANULADA') {
      await restaurarStock(f.id)
    }
    const { error } = await supabase.from('facturas').delete().eq('id', f.id)
    if (error) return alert('Error al eliminar: ' + error.message)
    cargar()
  }

  async function verDetalle(f: Factura) {
    setVerId(f.id)
    const { data } = await supabase.from('factura_items').select('*, empleado:empleados(nombre)').eq('factura_id', f.id)
    setVerItems((data as FacturaItem[]) ?? [])
  }

  // === DEVOLUCIONES ===
  async function abrirDevolucion(f: Factura) {
    const { data: items } = await supabase.from('factura_items').select('*').eq('factura_id', f.id)
    // Cantidades ya devueltas por renglón (de devoluciones previas)
    const { data: devs } = await supabase.from('devoluciones').select('id').eq('factura_id', f.id)
    const devIds = (devs ?? []).map((d: any) => d.id)
    const ya: Record<string, number> = {}
    if (devIds.length) {
      const { data: di } = await supabase.from('devolucion_items').select('factura_item_id, cantidad').in('devolucion_id', devIds)
      for (const d of di ?? []) {
        const k = (d as any).factura_item_id
        if (k) ya[k] = (ya[k] ?? 0) + Number((d as any).cantidad)
      }
    }
    setVerId(null)
    setDevolverFactura(f)
    setDevolverItems((items as FacturaItem[]) ?? [])
    setYaDevuelto(ya)
    setDevCant({})
    setDevMetodo(f.metodo_pago && f.metodo_pago !== 'Mixto' ? f.metodo_pago : 'Efectivo')
    setDevMotivo('')
    setDevOk(null)
  }

  async function confirmarDevolucion() {
    if (!devolverFactura) return
    const lineas = devolverItems
      .map((it) => ({ it, cant: Number(devCant[it.id] || 0) }))
      .filter((x) => x.cant > 0)
    if (lineas.length === 0) return alert('Indica al menos una cantidad a devolver.')
    for (const { it, cant } of lineas) {
      const disp = Number(it.cantidad) - Number(yaDevuelto[it.id] || 0)
      if (cant > disp + 0.001) return alert(`No puedes devolver más de ${disp} de "${it.descripcion}".`)
    }
    const monto = lineas.reduce((s, { it, cant }) => s + Number(it.precio_unit) * cant, 0)
    setSavingDev(true)
    // Caja abierta (para registrar la salida si la devolución es en efectivo)
    let cajaId: string | null = null
    if (devMetodo === 'Efectivo') {
      const { data: caja } = await supabase.from('caja_sesiones').select('id').eq('estado', 'ABIERTA').order('abierta_at', { ascending: false }).limit(1).maybeSingle()
      cajaId = (caja as any)?.id ?? null
    }
    const { data: dev, error: ed } = await supabase.from('devoluciones').insert({
      factura_id: devolverFactura.id,
      monto,
      metodo_pago: devMetodo,
      motivo: devMotivo || null,
      caja_id: cajaId,
      registrado_por: perfil?.nombre || perfil?.username || null,
    }).select('id').single()
    if (ed || !dev) { setSavingDev(false); return alert('Error al registrar la devolución: ' + ed?.message) }
    const { error: ei } = await supabase.from('devolucion_items').insert(
      lineas.map(({ it, cant }) => ({
        devolucion_id: (dev as any).id,
        factura_item_id: it.id,
        articulo_id: (it as any).articulo_id ?? null,
        descripcion: it.descripcion,
        cantidad: cant,
        importe: Number(it.precio_unit) * cant,
      })),
    )
    if (ei) { setSavingDev(false); return alert('Error al guardar el detalle: ' + ei.message) }
    // Reponer stock de los productos devueltos
    for (const { it, cant } of lineas) {
      if ((it as any).articulo_id) {
        await supabase.rpc('ajustar_stock', { p_articulo: (it as any).articulo_id, p_delta: cant })
      }
    }
    // Salida de caja si fue en efectivo y hay caja abierta
    if (devMetodo === 'Efectivo' && cajaId) {
      await supabase.from('caja_movimientos').insert({
        caja_id: cajaId,
        tipo: 'SALIDA',
        concepto: `Devolución factura ${codigoFactura(devolverFactura)}`,
        monto,
        factura_id: devolverFactura.id,
      })
    }
    setSavingDev(false)
    setDevOk({ codigo: codigoFactura(devolverFactura), monto })
    cargar()
  }

  const facturaVista = facturas.find((f) => f.id === verId)
  const devTotal = devolverItems.reduce((s, it) => s + Number(it.precio_unit) * Number(devCant[it.id] || 0), 0)

  // Cliente seleccionado en la factura en curso y su historial (para "ver cómo se arregló la última vez")
  const clienteSel = clienteId ? clientes.find((c) => c.id === clienteId) ?? null : null
  const histRows = clienteSel ? facturas.filter((f) => f.cliente_id === clienteSel.id) : facturas

  // Cuentas abiertas = facturas PENDIENTES (en curso, a las que se les sigue agregando)
  const abiertas = facturas.filter((f) => f.estado === 'PENDIENTE')
  const totalAbiertas = abiertas.reduce((s, f) => s + Number(f.total), 0)
  const facturasFiltradas =
    verEstado === 'ABIERTAS' ? abiertas : verEstado === 'PAGADAS' ? facturas.filter((f) => f.estado === 'PAGADA') : facturas

  return (
    <div>
      {!open && (<>
      <PageHeader
        title="Facturación"
        subtitle={`${facturas.length} factura(s)`}
      />

      {/* Resumen de cuentas abiertas (compacto) */}
      <div className="mb-3 inline-flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50/70 px-2.5 py-1 text-xs">
        <Receipt size={13} className="text-amber-600" />
        <span className="font-semibold text-slate-700">{abiertas.length} cuenta(s) abierta(s)</span>
        <span className="text-amber-300">·</span>
        <span className="text-slate-500">Sin cobrar: <b className="text-slate-700">{money(totalAbiertas)}</b></span>
      </div>

      {/* Filtro de estado */}

      {/* Impresora + configuración, encima del buscador */}
      <div className="mb-2 flex items-center justify-end gap-2">
        <span
          className={`badge ${qzListo ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}
          title={qzListo ? 'Impresora conectada' : 'Impresora no conectada'}
        >
          <Printer size={16} className="inline" />
          <span className={`ml-1.5 inline-block h-2.5 w-2.5 rounded-full ${qzListo ? 'bg-emerald-500' : 'bg-slate-400'}`} />
        </span>
        <Link
          to="/configuracion?tab=impresora"
          title="Configurar impresora (descargas y prueba)"
          className="rounded-lg p-2 text-slate-500 ring-1 ring-slate-200 transition hover:bg-slate-50 hover:text-brand-600"
        >
          <Settings size={18} />
        </Link>
      </div>

      {loading ? (
        <Cargando />
      ) : (
        <DataTable
          rows={facturasFiltradas}
          rowKey={(f) => f.id}
          toolbar={
            <div className="flex flex-wrap items-center gap-2">
              <button className="btn-primary" onClick={nuevaFactura}>
                <Plus size={16} /> Nueva factura
              </button>
              {([['ABIERTAS', `Abiertas (${abiertas.length})`], ['PAGADAS', 'Pagadas'], ['TODAS', 'Todas']] as const).map(([key, label]) => (
                <button key={key} onClick={() => setVerEstado(key)} className={verEstado === key ? 'btn-primary' : 'btn-ghost'}>
                  {label}
                </button>
              ))}
              <button type="button" onClick={() => { setBuscarCat(''); setCatTab('historial'); setCatalogoOpen(true) }} className="btn-ghost">
                Ver historial
              </button>
            </div>
          }
          searchText={(f) => `${codigoFactura(f)} ${f.cliente_nombre ?? ''} ${f.estado} ${f.fecha}`}
          searchPlaceholder="Buscar por código, cliente, estado o fecha…"
          emptyText={verEstado === 'ABIERTAS' ? 'No hay cuentas abiertas.' : 'No hay facturas que coincidan.'}
          initialSort={{ index: 0, dir: 'desc' }}
          columns={[
            { header: 'Factura', cell: (f) => <span className="font-mono font-semibold text-slate-700">{codigoFactura(f)}</span>, sortValue: (f) => f.numero ?? 0 },
            {
              header: 'Cliente', sortValue: (f) => f.cliente_nombre ?? '', cell: (f) => (
                <button className="font-medium text-brand-700 hover:underline" onClick={() => verDetalle(f)}>
                  {f.cliente_nombre || 'Cliente'}
                </button>
              ),
            },
            { header: 'Fecha', cell: (f) => <span className="text-slate-600">{fechaCorta(f.fecha)}</span>, sortValue: (f) => f.fecha },
            { header: 'Total', align: 'right', cell: (f) => <span className="font-semibold text-slate-800">{money(f.total)}</span>, sortValue: (f) => f.total },
            { header: 'Estado', cell: (f) => <span className={`badge ${estadoBadge[f.estado]}`}>{f.estado}</span>, sortValue: (f) => f.estado },
            {
              header: '', align: 'right', cell: (f) => (
                <div className="flex justify-end gap-1">
                  {f.estado === 'PENDIENTE' && puedeEditar && (
                    <button title="Agregar más consumo a esta cuenta" onClick={() => abrirEditar(f)} className="rounded-lg bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-700 hover:bg-brand-100">
                      <Plus size={13} className="-mt-0.5 mr-0.5 inline" /> Agregar consumo
                    </button>
                  )}
                  {f.estado !== 'ANULADA' && puedeAnular && (
                    <button title="Anular" onClick={() => cambiarEstado(f, 'ANULADA')} className="rounded-lg p-2 text-slate-600 hover:bg-amber-50 hover:text-amber-600">
                      <Ban size={16} />
                    </button>
                  )}
                  <button title="Ver / imprimir" onClick={() => verDetalle(f)} className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 hover:text-brand-600">
                    <Printer size={16} />
                  </button>
                  {puedeEliminar && (
                    <button title="Eliminar" onClick={() => eliminar(f)} className="rounded-lg p-2 text-slate-600 hover:bg-rose-50 hover:text-rose-600">
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              ),
            },
          ]}
        />
      )}

      </>)}

      {/* PANTALLA DE VENTA (a página completa, ya no es ventana emergente) */}
      {open && (
        <div className="mx-auto max-w-2xl">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-2xl font-bold uppercase text-slate-800">{editId ? 'Editar factura' : 'Nueva venta'}</h2>
              <p className="text-sm text-slate-600">Registra los servicios y productos a cobrar.</p>
            </div>
            <button className="btn-ghost shrink-0" onClick={() => setOpen(false)}>
              <X size={16} /> Cerrar
            </button>
          </div>
          <div className="card space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Cliente</label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" />
                  <input
                    className="input pl-9"
                    placeholder="Buscar cliente por nombre o código… (vacío = de contado)"
                    value={buscarCliente}
                    onChange={(e) => { setBuscarCliente(e.target.value); setClienteId('') }}
                    onFocus={() => setClienteFocus(true)}
                    onBlur={() => setTimeout(() => setClienteFocus(false), 150)}
                  />
                  {clienteId && (
                    <button type="button" onClick={() => { setClienteId(''); setBuscarCliente('') }} title="Quitar cliente" className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-rose-600">
                      <X size={15} />
                    </button>
                  )}
                  {clienteFocus && (
                    <div className="absolute z-10 mt-1 max-h-56 w-full overflow-y-auto rounded-xl border border-pink-100 bg-white shadow-card">
                      <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => { setClienteId(''); setBuscarCliente(''); setClienteFocus(false) }} className="block w-full px-3 py-2 text-left text-sm text-slate-500 hover:bg-pink-50">
                        — De contado —
                      </button>
                      {clientesFiltrados.length === 0 ? (
                        <p className="px-3 py-2 text-sm text-slate-500">Sin coincidencias</p>
                      ) : (
                        clientesFiltrados.map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => { setClienteId(c.id); setBuscarCliente(`${codigoCliente(c.codigo)} · ${c.nombre}`); setClienteFocus(false) }}
                            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-pink-50"
                          >
                            <span className="font-mono font-semibold text-brand-700">{codigoCliente(c.codigo)}</span>
                            <span className="truncate text-slate-700">{c.nombre}</span>
                            {c.telefono && <span className="ml-auto shrink-0 text-xs text-slate-500">{c.telefono}</span>}
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
                <button type="button" onClick={abrirCrearCliente} title="Crear cliente nuevo" className="btn-ghost shrink-0">
                  <UserPlus size={16} /> Crear
                </button>
              </div>
            </div>
            <div>
              <label className="label">Fecha</label>
              <input
                type="date"
                className={`input ${!puedeCambiarFecha ? 'cursor-not-allowed bg-slate-100 text-slate-500' : ''}`}
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                disabled={!puedeCambiarFecha}
                title={!puedeCambiarFecha ? 'La fecha es la de hoy. Solo administración puede cambiarla.' : undefined}
              />
              {!puedeCambiarFecha && (
                <p className="mt-1 text-xs text-slate-500">Fecha de hoy. Solo administración puede cambiarla.</p>
              )}
            </div>
          </div>
          {!clienteId && (
            <div>
              <label className="label">Nombre (cliente de contado)</label>
              <input className="input" value={clienteNombre} onChange={(e) => setClienteNombre(e.target.value)} placeholder="Opcional" />
            </div>
          )}

          <div>
            <label className="label">Tipo de venta</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setTipoVenta('CONTADO')}
                className={`rounded-xl border px-3 py-2 text-sm font-semibold transition ${tipoVenta === 'CONTADO' ? 'border-brand-400 bg-brand-50 text-brand-700' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}
              >
                Contado <span className="font-mono text-xs opacity-70">CO</span>
              </button>
              <button
                type="button"
                onClick={() => setTipoVenta('CREDITO')}
                className={`rounded-xl border px-3 py-2 text-sm font-semibold transition ${tipoVenta === 'CREDITO' ? 'border-brand-400 bg-brand-50 text-brand-700' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}
              >
                Crédito <span className="font-mono text-xs opacity-70">CR</span>
              </button>
            </div>
            <p className="mt-1 text-xs text-slate-600">Secuencia independiente por tipo: {tipoVenta === 'CREDITO' ? 'CR000001, CR000002… (crédito)' : 'CO000001, CO000002… (contado)'}.</p>
          </div>

          <div>
            <label className="label">Buscar servicio o artículo</label>
            <div className="relative">
              <button
                type="button"
                onClick={() => { setBuscarCat(''); setCatTab('catalogo'); setCatalogoOpen(true) }}
                title="Ver catálogo e historial de facturas"
                className="absolute left-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-600 transition hover:bg-brand-50 hover:text-brand-600"
              >
                <Search size={16} />
              </button>
              <input
                className="input pl-9"
                placeholder="Toca la lupa para ver todo, o escribe para buscar…"
                value={buscarItem}
                onChange={(e) => setBuscarItem(e.target.value)}
              />
              {q && (
                <div className="absolute z-10 mt-1 max-h-52 w-full overflow-y-auto rounded-xl border border-pink-100 bg-white shadow-card">
                  {resultados.length === 0 ? (
                    <p className="px-3 py-2 text-sm text-slate-600">Sin coincidencias</p>
                  ) : (
                    resultados.map((r) => (
                      <button
                        key={`${r.tipo}:${r.id}`}
                        type="button"
                        onClick={() => agregarDesdeBusqueda(r)}
                        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-pink-50"
                      >
                        <span className="flex min-w-0 items-center gap-2">
                          <span className={`badge ${r.tipo === 's' ? 'bg-brand-50 text-brand-700' : 'bg-amber-50 text-amber-700'}`}>
                            {r.tipo === 's' ? 'Servicio' : 'Artículo'}
                          </span>
                          <span className="truncate text-slate-700">{r.nombre}</span>
                          {r.tipo === 'a' && (
                            <span className={`text-xs ${(r.stock ?? 0) <= 0 ? 'text-rose-500' : 'text-slate-600'}`}>
                              {(r.stock ?? 0) <= 0 ? 'Sin existencia' : `Existencia: ${r.stock}`}
                            </span>
                          )}
                        </span>
                        <span className="shrink-0 font-semibold text-slate-800">{money(r.precio)}</span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>

          <div>
            <label className="label">Artículos o servicios agregados</label>
            {editId && lineasOriginales > 0 && !puedeModificarLineas && (
              <p className="mb-2 text-xs font-medium text-amber-600">Lo ya agregado (🔒) no se puede modificar ni eliminar sin autorización. Puedes seguir agregando consumo.</p>
            )}
            {lineas.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-6 text-center text-sm text-slate-600">
                Busca arriba y toca un servicio o producto para agregarlo aquí.
              </div>
            ) : (
              <div className="space-y-5">
                {lineas.map((l, i) => {
                  const esManual = !l.servicio_id && !l.articulo_id
                  // Renglón ya agregado antes (cuenta abierta): no se puede modificar/eliminar sin autorización
                  const bloqueado = i < lineasOriginales && !puedeModificarLineas
                  return (
                    <div key={i} className={`rounded-xl border-2 p-3 shadow-sm ${bloqueado ? 'border-slate-100 bg-slate-50' : 'border-slate-200 bg-white'}`}>
                      <div className="flex items-start justify-between gap-2">
                        {esManual ? (
                          <input
                            className="input flex-1"
                            placeholder="Concepto (ej: ajuste, recargo…)"
                            value={l.descripcion}
                            readOnly={bloqueado}
                            onChange={(e) => setLinea(i, { descripcion: e.target.value })}
                          />
                        ) : (
                          <span className="flex min-w-0 items-center gap-2 font-semibold text-slate-800">
                            <span className={`badge ${l.servicio_id ? 'bg-brand-50 text-brand-700' : 'bg-amber-50 text-amber-700'}`}>
                              {l.servicio_id ? 'Servicio' : 'Producto'}
                            </span>
                            <span className="truncate">{l.descripcion}</span>
                          </span>
                        )}
                        {bloqueado ? (
                          <span className="badge shrink-0 bg-slate-200 text-slate-500" title="Ya agregado · requiere autorización para modificar">🔒 Agregado</span>
                        ) : (
                          <button onClick={() => setLineas(lineas.filter((_, idx) => idx !== i))} className="rounded-lg p-1.5 text-slate-600 hover:bg-rose-50 hover:text-rose-600">
                            <X size={16} />
                          </button>
                        )}
                      </div>

                      <div className="mt-2">
                        <span className="text-xs font-medium text-slate-600">Realizado por</span>
                        <select className="input" value={l.empleado_id} onChange={(e) => setLinea(i, { empleado_id: e.target.value })}>
                          <option value="">— Sin asignar —</option>
                          {empleados.map((e) => (
                            <option key={e.id} value={e.id}>{e.nombre}</option>
                          ))}
                        </select>
                      </div>

                      <div className="mt-2 grid grid-cols-3 gap-2">
                        <div>
                          <span className="text-xs font-medium text-slate-600">Cant.</span>
                          <input type="number" min={1} className={`input ${bloqueado ? 'bg-slate-100 text-slate-500' : ''}`} value={l.cantidad || ''} readOnly={bloqueado} onChange={(e) => setLinea(i, { cantidad: Number(e.target.value) })} />
                        </div>
                        <div>
                          <span className="text-xs font-medium text-slate-600">Precio</span>
                          <input type="number" min={0} step={50} className={`input ${bloqueado ? 'bg-slate-100 text-slate-500' : ''}`} value={l.precio_unit || ''} readOnly={bloqueado} onChange={(e) => setLinea(i, { precio_unit: Number(e.target.value) })} />
                        </div>
                        <div>
                          <span className="text-xs font-medium text-slate-600">Importe</span>
                          <input className="input bg-slate-50" value={money(l.cantidad * l.precio_unit)} readOnly />
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
            <div className="mt-2 flex flex-wrap gap-2">
              <button className="btn-ghost" onClick={agregarManual}>
                <Plus size={14} /> Concepto manual
              </button>
            </div>
          </div>

          <div>
            <label className="label">Descuento</label>
            <div className="flex items-center gap-2">
              <div className="flex overflow-hidden rounded-lg ring-1 ring-slate-200">
                <button type="button" disabled={protegerCuenta} onClick={() => setDescuentoModo('monto')} className={`px-3 py-2 text-sm font-semibold transition ${descuentoModo === 'monto' ? 'bg-brand-600 text-white' : 'bg-white text-slate-500 hover:bg-slate-50'}`}>RD$</button>
                <button type="button" disabled={protegerCuenta} onClick={() => setDescuentoModo('pct')} className={`px-3 py-2 text-sm font-semibold transition ${descuentoModo === 'pct' ? 'bg-brand-600 text-white' : 'bg-white text-slate-500 hover:bg-slate-50'}`}>%</button>
              </div>
              {descuentoModo === 'monto' ? (
                <input type="number" min={0} step={50} className={`input w-32 ${protegerCuenta ? 'bg-slate-100 text-slate-500' : ''}`} value={descuento || ''} readOnly={protegerCuenta} onChange={(e) => setDescuento(Number(e.target.value))} />
              ) : (
                <>
                  <input type="number" min={0} max={100} step={1} className={`input w-24 ${protegerCuenta ? 'bg-slate-100 text-slate-500' : ''}`} value={descuentoPct || ''} readOnly={protegerCuenta} onChange={(e) => setDescuentoPct(Math.min(100, Math.max(0, Number(e.target.value))))} />
                  <span className="text-sm font-medium text-slate-600">= {money(descuentoMonto)}</span>
                </>
              )}
            </div>
            <p className="mt-1 text-xs text-slate-600">{protegerCuenta ? '🔒 El descuento no se puede cambiar sin autorización.' : 'El método de pago se elige al cobrar en Caja.'}</p>
          </div>

          <label className={`flex items-center gap-2 text-sm text-slate-600 ${protegerCuenta ? 'opacity-60' : ''}`}>
            <input type="checkbox" checked={aplicaItbis} disabled={protegerCuenta} onChange={(e) => setAplicaItbis(e.target.checked)} />
            Aplicar ITBIS (18%) {protegerCuenta && <span className="text-xs">🔒</span>}
          </label>

          <div className="rounded-lg bg-slate-50 p-3 text-sm">
            <div className="flex justify-between text-slate-600"><span>Subtotal</span><span>{money(subtotal)}</span></div>
            {descuentoMonto > 0 && <div className="flex justify-between text-slate-600"><span>Descuento{descuentoModo === 'pct' ? ` (${descuentoPct}%)` : ''}</span><span>- {money(descuentoMonto)}</span></div>}
            {aplicaItbis && <div className="flex justify-between text-slate-600"><span>ITBIS (18%)</span><span>{money(itbis)}</span></div>}
            <div className="mt-1 flex justify-between border-t border-slate-200 pt-1 text-base font-bold text-slate-800"><span>Total</span><span>{money(total)}</span></div>
          </div>

          <div>
            <label className="label">Notas</label>
            <textarea className="input" rows={2} value={notas} onChange={(e) => setNotas(e.target.value)} />
          </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-lg font-bold text-slate-800">Total: {money(total)}</p>
            <div className="flex flex-wrap gap-2">
              <button className="btn-ghost" onClick={() => setOpen(false)}>Cancelar</button>
              <button className="btn-primary" onClick={() => guardar(false)} disabled={saving}>
                {saving ? 'Guardando…' : 'Guardar factura'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* VENTANA DE LA LUPA: catálogo de servicios/artículos (o historial, según se abra) */}
      <Modal open={catalogoOpen} title={catTab === 'historial' ? (clienteSel ? `Historial de ${clienteSel.nombre}` : 'Historial de facturas') : 'Buscar servicio o artículo'} onClose={() => setCatalogoOpen(false)}>
        <div className="space-y-3">
          {catTab === 'catalogo' && (
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
          )}

          {catTab === 'catalogo' ? (
            <>
              <div className="max-h-[55vh] divide-y divide-slate-50 overflow-y-auto rounded-xl border border-slate-100">
                {catalogo.length === 0 ? (
                  <p className="px-3 py-6 text-center text-slate-600">Sin coincidencias</p>
                ) : (
                  catalogo.map((r) => (
                    <button
                      key={`${r.tipo}:${r.id}`}
                      type="button"
                      onClick={() => { agregarDesdeBusqueda(r); setCatalogoOpen(false) }}
                      className="flex w-full items-center justify-between gap-3 px-3 py-3 text-left hover:bg-pink-50"
                    >
                      <span className="flex min-w-0 flex-col">
                        <span className="flex items-center gap-2">
                          <span className={`badge ${r.tipo === 's' ? 'bg-brand-50 text-brand-700' : 'bg-amber-50 text-amber-700'}`}>
                            {r.tipo === 's' ? 'Servicio' : 'Artículo'}
                          </span>
                          <span className="truncate font-medium text-slate-800">{r.nombre}</span>
                        </span>
                        {r.tipo === 'a' && (
                          <span className={`mt-0.5 text-xs ${(r.stock ?? 0) <= 0 ? 'text-rose-500' : 'text-slate-600'}`}>
                            {(r.stock ?? 0) <= 0 ? 'Sin existencia' : `Existencia: ${r.stock}`}
                          </span>
                        )}
                      </span>
                      <span className="shrink-0 font-semibold text-slate-800">{money(r.precio)}</span>
                    </button>
                  ))
                )}
              </div>
              <p className="text-xs text-slate-600">Toca un servicio o artículo y se agrega a la factura.</p>
            </>
          ) : (
            <DataTable
              rows={histRows}
              rowKey={(f) => f.id}
              searchText={(f) => `${codigoFactura(f)} ${f.cliente_nombre ?? ''} ${f.fecha} ${f.estado}`}
              searchPlaceholder="Filtrar por código, cliente, fecha o estado…"
              emptyText={clienteSel ? 'Este cliente no tiene facturas anteriores.' : 'Sin facturas'}
              pageSize={8}
              initialSort={{ index: 0, dir: 'desc' }}
              onRowClick={(f) => { setCatalogoOpen(false); verDetalle(f) }}
              columns={[
                { header: 'Factura', cell: (f) => <span className="font-mono font-semibold text-slate-700">{codigoFactura(f)}</span>, sortValue: (f) => f.numero ?? 0 },
                { header: 'Cliente', cell: (f) => <span className="text-slate-600">{f.cliente_nombre || 'Cliente'}</span>, sortValue: (f) => f.cliente_nombre ?? '' },
                { header: 'Fecha', cell: (f) => <span className="text-slate-500">{fechaCorta(f.fecha)}</span>, sortValue: (f) => f.fecha },
                { header: 'Total', align: 'right', cell: (f) => money(f.total), sortValue: (f) => f.total },
                { header: 'Estado', cell: (f) => <span className={`badge ${estadoBadge[f.estado]}`}>{f.estado}</span>, sortValue: (f) => f.estado },
              ]}
            />
          )}

          <div className="flex justify-end">
            <button className="btn-primary" onClick={() => setCatalogoOpen(false)}>Listo</button>
          </div>
        </div>
      </Modal>

      {/* Modal VER / IMPRIMIR */}
      <Modal open={!!verId} title={`Factura ${facturaVista ? codigoFactura(facturaVista) : ''}`} onClose={() => setVerId(null)}>
        {facturaVista && (
          <div id="factura-print" className="print-area space-y-3">
            <div className="text-center">
              <img src={`${import.meta.env.BASE_URL}${negocio.logo}`} alt={negocio.nombre} className="mx-auto mb-2 h-20 rounded-lg bg-black object-contain" />
              <p className="font-display text-xl font-bold text-brand-800">{negocio.nombre}</p>
              {negocio.rnc && <p className="text-xs text-slate-500">RNC: {negocio.rnc}</p>}
              <p className="text-xs text-slate-500">{negocio.direccion} · {negocio.referencia}</p>
              <p className="text-xs text-slate-500">Tel {negocio.telefono} · WhatsApp {negocio.whatsapp} · {negocio.instagram}</p>
              <p className="mt-1 text-xs font-medium text-slate-600">Factura {codigoFactura(facturaVista)} · {facturaVista.tipo_venta === 'CREDITO' ? 'Crédito' : 'Contado'} · {fechaCorta(facturaVista.fecha)}</p>
            </div>
            <div className="text-sm text-slate-600">
              <p><span className="font-medium">Cliente:</span> {(() => { const cl = clientes.find((c) => c.id === facturaVista.cliente_id); return cl ? `${codigoCliente(cl.codigo)} · ${facturaVista.cliente_nombre}` : facturaVista.cliente_nombre })()}</p>
              <p><span className="font-medium">Estado:</span> {facturaVista.estado}</p>
              <p><span className="font-medium">Pago:</span> {facturaVista.metodo_pago}</p>
            </div>
            <table className="w-full text-sm">
              <thead className="border-b text-left text-xs text-slate-600">
                <tr><th className="py-1">Descripción</th><th className="py-1 text-center">Cant.</th><th className="py-1 text-right">Importe</th></tr>
              </thead>
              <tbody>
                {verItems.map((it) => (
                  <tr key={it.id} className="border-b border-slate-50">
                    <td className="py-1">
                      {it.descripcion}
                      {(it as any).empleado?.nombre && <span className="block text-xs text-slate-600">por {(it as any).empleado.nombre}</span>}
                    </td>
                    <td className="py-1 text-center">{it.cantidad}</td>
                    <td className="py-1 text-right">{money(it.importe)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="space-y-0.5 text-sm">
              <div className="flex justify-between text-slate-600"><span>Subtotal</span><span>{money(facturaVista.subtotal)}</span></div>
              {facturaVista.descuento > 0 && <div className="flex justify-between text-slate-600"><span>Descuento</span><span>- {money(facturaVista.descuento)}</span></div>}
              {facturaVista.itbis > 0 && <div className="flex justify-between text-slate-600"><span>ITBIS</span><span>{money(facturaVista.itbis)}</span></div>}
              <div className="flex justify-between border-t pt-1 text-base font-bold text-slate-800"><span>Total</span><span>{money(facturaVista.total)}</span></div>
              {(devueltoPorFactura[facturaVista.id] ?? 0) > 0 && (
                <div className="flex justify-between font-semibold text-rose-600"><span>Devuelto</span><span>- {money(devueltoPorFactura[facturaVista.id])}</span></div>
              )}
            </div>
            <div className="no-print flex gap-2">
              {facturaVista.estado === 'PAGADA' && puedeAnular && (
                <button className="btn-ghost flex-1" onClick={() => abrirDevolucion(facturaVista)}>
                  <Undo2 size={16} /> Devolver
                </button>
              )}
              <button className="btn-primary flex-1" onClick={() => window.print()}>
                <Printer size={16} /> Imprimir
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* DEVOLUCIÓN / NOTA DE CRÉDITO */}
      <Modal
        open={!!devolverFactura}
        title={devOk ? 'Devolución registrada' : `Devolver — Factura ${devolverFactura ? codigoFactura(devolverFactura) : ''}`}
        onClose={() => setDevolverFactura(null)}
        footer={devOk ? null : (
          <>
            <button className="btn-ghost" onClick={() => setDevolverFactura(null)}>Cancelar</button>
            <button className="btn-primary" onClick={confirmarDevolucion} disabled={savingDev || devTotal <= 0}>
              {savingDev ? 'Procesando…' : `Devolver ${money(devTotal)}`}
            </button>
          </>
        )}
      >
        {devOk ? (
          <div className="space-y-4">
            <div className="flex flex-col items-center gap-1 text-center">
              <Undo2 className="text-emerald-500" size={56} />
              <p className="text-lg font-bold text-slate-800">Devolución registrada</p>
              <p className="text-sm text-slate-600">Factura {devOk.codigo} · {money(devOk.monto)}</p>
            </div>
            <div className="print-area space-y-2 rounded-xl border border-slate-100 p-3 text-sm">
              <div className="text-center">
                <img src={`${import.meta.env.BASE_URL}${negocio.logo}`} alt={negocio.nombre} className="mx-auto mb-1 h-14 rounded-lg bg-black object-contain" />
                <p className="font-display text-base font-bold text-brand-800">{negocio.nombre}</p>
                {negocio.rnc && <p className="text-xs text-slate-500">RNC: {negocio.rnc}</p>}
                <p className="mt-1 text-xs font-semibold text-slate-600">NOTA DE CRÉDITO / DEVOLUCIÓN</p>
                <p className="text-xs text-slate-600">Factura {devOk.codigo} · {fechaCorta(hoyISO())}</p>
              </div>
              <div className="flex justify-between border-t pt-1 text-base font-bold text-slate-800"><span>Total devuelto</span><span>{money(devOk.monto)}</span></div>
              <div className="flex justify-between text-slate-600"><span>Método</span><span>{devMetodo}</span></div>
              {devMotivo && <p className="text-slate-600"><span className="font-medium">Motivo:</span> {devMotivo}</p>}
              <p className="text-xs text-slate-600">Atendió: {perfil?.nombre || perfil?.username || ''}</p>
              <div className="border-t pt-1 text-center text-xs text-slate-500"><p>{negocio.direccion} · {negocio.referencia}</p></div>
            </div>
            <div className="no-print flex gap-2">
              <button className="btn-ghost flex-1" onClick={() => setDevolverFactura(null)}>Cerrar</button>
              <button className="btn-primary flex-1" onClick={() => window.print()}><Printer size={16} /> Imprimir nota</button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">Indica cuánto devolver de cada renglón. El stock de los productos se repone automáticamente.</p>
            <div className="space-y-2">
              {devolverItems.map((it) => {
                const disp = Number(it.cantidad) - Number(yaDevuelto[it.id] || 0)
                return (
                  <div key={it.id} className="flex items-center gap-2 rounded-lg border border-slate-200 p-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-800">{it.descripcion}</p>
                      <p className="text-xs text-slate-600">Vendido {it.cantidad} · disponible {disp} · {money(it.precio_unit)} c/u</p>
                    </div>
                    <input
                      type="number" min={0} max={disp} step={1}
                      className="input w-20"
                      value={devCant[it.id] || ''}
                      disabled={disp <= 0}
                      onChange={(e) => setDevCant((prev) => ({ ...prev, [it.id]: Math.min(disp, Math.max(0, Number(e.target.value))) }))}
                    />
                  </div>
                )
              })}
            </div>
            <div>
              <label className="label">Devolver el dinero en</label>
              <div className="flex gap-2">
                {['Efectivo', 'Tarjeta', 'Transferencia'].map((m) => (
                  <button key={m} type="button" onClick={() => setDevMetodo(m)} className={`rounded-xl border px-3 py-2 text-sm font-semibold ${devMetodo === m ? 'border-brand-400 bg-brand-50 text-brand-700' : 'border-slate-200 text-slate-500'}`}>{m}</button>
                ))}
              </div>
              {devMetodo === 'Efectivo' && <p className="mt-1 text-xs text-slate-600">Si hay una caja abierta, se registra la salida de efectivo automáticamente.</p>}
            </div>
            <div>
              <label className="label">Motivo (opcional)</label>
              <textarea className="input" rows={2} value={devMotivo} onChange={(e) => setDevMotivo(e.target.value)} placeholder="Producto defectuoso, cambio de opinión…" />
            </div>
            <div className="rounded-xl bg-rose-50 px-4 py-3 text-center">
              <p className="text-xs uppercase tracking-widest text-rose-500">Total a devolver</p>
              <p className="text-2xl font-extrabold text-rose-700">{money(devTotal)}</p>
            </div>
          </div>
        )}
      </Modal>

      {/* CREAR CLIENTE RÁPIDO (desde la factura) */}
      <Modal
        open={crearClienteOpen}
        title="Crear cliente"
        onClose={() => setCrearClienteOpen(false)}
        footer={
          <>
            <button className="btn-ghost" onClick={() => setCrearClienteOpen(false)}>Cancelar</button>
            <button className="btn-primary" onClick={guardarNuevoCliente} disabled={savingCli}>
              <UserPlus size={16} /> {savingCli ? 'Guardando…' : 'Crear y seleccionar'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-500">Se le asigna un código automático. Luego puedes completar sus datos en el módulo Clientes.</p>
          <div>
            <label className="label">Nombre</label>
            <input className="input" value={nuevoCli.nombre} autoFocus onChange={(e) => setNuevoCli({ ...nuevoCli, nombre: e.target.value })} placeholder="Nombre del cliente" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Teléfono</label>
              <input className="input" value={nuevoCli.telefono} onChange={(e) => setNuevoCli({ ...nuevoCli, telefono: e.target.value })} />
            </div>
            <div>
              <label className="label">Email</label>
              <input type="email" className="input" value={nuevoCli.email} onChange={(e) => setNuevoCli({ ...nuevoCli, email: e.target.value })} />
            </div>
          </div>
        </div>
      </Modal>
    </div>
  )
}
