import { useEffect, useState } from 'react'
import { Plus, Trash2, Printer, Ban, X, Search, Receipt, UserPlus, Undo2, Settings, HandCoins, FileText, DollarSign, CreditCard, ArrowLeftRight, Wallet as WalletIcon, MoreHorizontal, Layers, Share2, Eye, Lock, Unlock, Pencil } from 'lucide-react'
import { Link } from 'react-router-dom'
import QRCode from 'qrcode'
import { supabase } from '../lib/supabase'
import { conectarQZ } from '../lib/impresora'
import { emitirECF, construirUrlQrECF, ECF_ESTADO_LABEL, type EcfResultado, type EcfFacturaPayload, type EcfConfig } from '../lib/ecf'
import TicketFactura from '../components/TicketFactura'
import { Cliente, Factura, FacturaItem, Servicio, Articulo, Empleado, EstadoFactura, TipoVenta, CajaSesion } from '../types'
import { money, fechaCorta, hoyISO, codigoArticulo, codigoFactura, codigoCliente, conPrefijo } from '../lib/format'
import { ITBIS_RATE, METODOS_PAGO } from '../lib/constants'
import { useAuth } from '../lib/auth'
import { useNegocio } from '../lib/negocio'
import { setPantallaCompletaAbierta } from '../lib/pantallaCompleta'
import PageHeader from '../components/PageHeader'
import Cargando from '../components/Cargando'
import Modal from '../components/Modal'
import DataTable from '../components/DataTable'

// Ícono por método de pago (métodos simples; "Pago mixto" es un modo aparte)
const METODO_ICONO: Record<string, typeof DollarSign> = {
  Efectivo: DollarSign,
  Tarjeta: CreditCard,
  Transferencia: ArrowLeftRight,
  Cheque: FileText,
  PayPal: WalletIcon,
  Otro: MoreHorizontal,
}

// Línea de un pago mixto (varios métodos para una misma factura)
interface LineaPagoMixto {
  metodo: string
  monto: number
}

interface LineaTmp {
  servicio_id: string
  articulo_id: string
  descripcion: string
  cantidad: number
  precio_unit: number
  empleado_id: string
  // Si la línea viene de un tratamiento realizado del plan, su id (para marcarlo facturado).
  presupuesto_item_id?: string
}

const lineaVacia: LineaTmp = { servicio_id: '', articulo_id: '', descripcion: '', cantidad: 1, precio_unit: 0, empleado_id: '' }

// Ítem de plan realizado pendiente de facturar (con datos del plan para armar la línea).
interface PendientePlan {
  id: string
  servicio_id: string | null
  diente: number | null
  descripcion: string
  cantidad: number
  precio_unit: number
  empleado_id: string | null
}

const estadoBadge: Record<EstadoFactura, string> = {
  PENDIENTE: 'bg-amber-50 text-amber-700',
  PAGADA: 'bg-emerald-50 text-emerald-700',
  ANULADA: 'bg-rose-50 text-rose-700',
}

// Tipo de comprobante fiscal según lo que se factura y el modo (tradicional / e-CF).
const CODIGO_COMPROBANTE = {
  consumo: { tradicional: 'B02', electronico: 'E32' },
  credito: { tradicional: 'B01', electronico: 'E31' },
} as const

export default function Facturacion({ pacienteFijo }: { pacienteFijo?: string } = {}) {
  const { perfil, puedeAccion } = useAuth()
  const { negocio } = useNegocio()
  const puedeAnular = puedeAccion('facturas.anular')
  const puedeEliminar = puedeAccion('facturas.eliminar')
  const puedeEditar = puedeAccion('facturas.editar')
  const puedeVenderSinExistencia = puedeAccion('facturas.vender_sin_existencia')
  const puedeModificarLineas = puedeAccion('facturas.modificar_lineas')
  const puedeCambiarFecha = puedeAccion('facturas.cambiar_fecha')
  const puedeCobrarPendiente = puedeAccion('facturas.cobrar')
  const puedeDescuentoSinLimite = puedeAccion('facturas.descuento_sin_limite')
  const puedeModificarImpuestos = puedeAccion('facturas.modificar_impuestos')

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
  const [devOk, setDevOk] = useState<{ codigo: string; monto: number; ncf?: string | null } | null>(null)

  // formulario de nueva factura
  const [clienteId, setClienteId] = useState('')
  const [clienteNombre, setClienteNombre] = useState('')
  const [fecha, setFecha] = useState(hoyISO())
  const [tipoVenta, setTipoVenta] = useState<TipoVenta>('CONTADO')
  // Estado de la factura al guardar (solo aplica a ventas de contado nuevas):
  // "pendiente" no cobra nada; "cobrar" muestra métodos de pago y cobra de una vez.
  const [estadoPago, setEstadoPago] = useState<'pendiente' | 'cobrar'>('cobrar')
  const [metodoCobroNueva, setMetodoCobroNueva] = useState('Efectivo')
  const [montoRecibido, setMontoRecibido] = useState(0)
  // Detalle de tarjeta / transferencia (opcional, se guarda junto al pago)
  const [tarjetaTipo, setTarjetaTipo] = useState('')
  const [tarjetaUltimos4, setTarjetaUltimos4] = useState('')
  const [tarjetaAutorizacion, setTarjetaAutorizacion] = useState('')
  const [tarjetaTerminal, setTarjetaTerminal] = useState('')
  const [transferenciaBanco, setTransferenciaBanco] = useState('')
  const [transferenciaReferencia, setTransferenciaReferencia] = useState('')
  const [transferenciaComprobante, setTransferenciaComprobante] = useState('')
  // Pago mixto: varias líneas de método + monto
  const [pagosMixtos, setPagosMixtos] = useState<LineaPagoMixto[]>([{ metodo: 'Efectivo', monto: 0 }, { metodo: 'Tarjeta', monto: 0 }])
  // Caja abierta actual (para mostrar el estado y validar el cobro en efectivo)
  const [cajaAbierta, setCajaAbierta] = useState<CajaSesion | null>(null)
  // Confirmación final antes de guardar, y pantalla de éxito después de guardar
  const [confirmando, setConfirmando] = useState<'pendiente' | 'cobrar' | null>(null)
  const [facturaGuardada, setFacturaGuardada] = useState<Factura | null>(null)
  // Crédito: vencimiento, plazo, inicial y observaciones
  const [creditoVencimiento, setCreditoVencimiento] = useState('')
  const [creditoPlazoDias, setCreditoPlazoDias] = useState(30)
  const [creditoInicial, setCreditoInicial] = useState(0)
  const [creditoObservaciones, setCreditoObservaciones] = useState('')
  // Cobrar una factura de contado que quedó PENDIENTE (sin pasar por Caja).
  const [cobrarPendiente, setCobrarPendiente] = useState<Factura | null>(null)
  const [metodoCobroPendiente, setMetodoCobroPendiente] = useState('Efectivo')
  const [savingCobro, setSavingCobro] = useState(false)
  const [aplicaItbis, setAplicaItbis] = useState(false)
  const [descuento, setDescuento] = useState(0)               // descuento como monto (RD$)
  const [descuentoModo, setDescuentoModo] = useState<'monto' | 'pct'>('monto')
  const [descuentoPct, setDescuentoPct] = useState(0)          // descuento como % del subtotal
  const [descuentoMotivo, setDescuentoMotivo] = useState('')
  const [notas, setNotas] = useState('')
  const [lineas, setLineas] = useState<LineaTmp[]>([])
  // Tratamientos realizados (del plan) pendientes de facturar para el paciente elegido.
  const [pendientesPlan, setPendientesPlan] = useState<PendientePlan[]>([])
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
  const [clienteGenerico, setClienteGenerico] = useState(false)
  // Fila de servicio/artículo expandida (para editar cantidad/precio/empleado)
  const [lineaExpandida, setLineaExpandida] = useState<number | null>(null)

  // Comprobante fiscal DGII (solo si está activo en Configuración)
  const [tipoComprobante, setTipoComprobante] = useState<'consumo' | 'credito'>('consumo')
  const [compradorRnc, setCompradorRnc] = useState('')
  const [compradorRazon, setCompradorRazon] = useState('')

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

  // Carga los tratamientos REALIZADOS (de los planes del paciente) que aún no se han facturado.
  async function cargarPendientesPlan(cli: string) {
    if (!cli) {
      setPendientesPlan([])
      return
    }
    const { data, error } = await supabase
      .from('presupuesto_items')
      .select('id, servicio_id, diente, descripcion, cantidad, precio_unit, presupuestos!inner(cliente_id, empleado_id)')
      .eq('estado', 'REALIZADO')
      .eq('facturado', false)
      .eq('presupuestos.cliente_id', cli)
      .order('id')
    if (error) {
      setPendientesPlan([])
      return
    }
    setPendientesPlan(
      (data ?? []).map((it: any) => ({
        id: it.id,
        servicio_id: it.servicio_id ?? null,
        diente: it.diente ?? null,
        descripcion: it.descripcion,
        cantidad: Number(it.cantidad) || 1,
        precio_unit: Number(it.precio_unit) || 0,
        empleado_id: it.presupuestos?.empleado_id ?? null,
      })),
    )
  }

  // Al elegir paciente en una factura NUEVA, ofrecer sus tratamientos realizados.
  useEffect(() => {
    if (open && !editId && clienteId) cargarPendientesPlan(clienteId)
    else setPendientesPlan([])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editId, clienteId])

  // Agrega un tratamiento realizado del plan como línea de la factura.
  function agregarDesdePlan(p: PendientePlan) {
    const desc = p.diente != null ? `${p.descripcion} (diente ${p.diente})` : p.descripcion
    setLineas((prev) => [
      ...prev,
      {
        servicio_id: p.servicio_id ?? '',
        articulo_id: '',
        descripcion: desc,
        cantidad: p.cantidad,
        precio_unit: p.precio_unit,
        empleado_id: p.empleado_id ?? '',
        presupuesto_item_id: p.id,
      },
    ])
    setPendientesPlan((prev) => prev.filter((x) => x.id !== p.id))
  }

  function agregarTodosDelPlan() {
    pendientesPlan.forEach((p) => agregarDesdePlan(p))
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
    let fq = supabase.from('facturas').select('*').order('numero', { ascending: false })
    if (pacienteFijo) fq = fq.eq('cliente_id', pacienteFijo)
    const [{ data }, { data: dev }] = await Promise.all([
      fq,
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pacienteFijo])

  // Estado de la impresora directa (QZ Tray): verde si está conectada
  useEffect(() => {
    let cancel = false
    const revisar = () => conectarQZ().then((ok) => { if (!cancel) setQzListo(ok) }).catch(() => { if (!cancel) setQzListo(false) })
    revisar()
    const t = setInterval(revisar, 15000)
    return () => { cancel = true; clearInterval(t) }
  }, [])

  // Mientras la pantalla de Nueva venta / Editar esté abierta, ocultar la
  // burbuja flotante de chat (no debe tapar campos ni el botón de guardar).
  useEffect(() => {
    setPantallaCompletaAbierta(open)
    return () => setPantallaCompletaAbierta(false)
  }, [open])

  // Caja abierta actual (para mostrar su estado y validar el cobro en efectivo)
  async function cargarCajaAbierta() {
    const { data } = await supabase.from('caja_sesiones').select('*').eq('estado', 'ABIERTA').order('abierta_at', { ascending: false }).limit(1).maybeSingle()
    setCajaAbierta((data as CajaSesion) ?? null)
  }

  const subtotal = lineas.reduce((s, l) => s + l.cantidad * l.precio_unit, 0)
  // Descuento efectivo en RD$: por % del subtotal o por monto fijo (nunca mayor que el subtotal)
  const descuentoMonto = Math.min(subtotal, descuentoModo === 'pct' ? subtotal * (descuentoPct / 100) : descuento)
  const baseImponible = Math.max(0, subtotal - descuentoMonto)
  const itbis = aplicaItbis ? baseImponible * ITBIS_RATE : 0
  const total = baseImponible + itbis
  // En una cuenta ya creada (editando), descuento e ITBIS quedan protegidos salvo autorización
  const protegerCuenta = !!editId && !puedeModificarLineas
  // % de descuento real sobre el subtotal (para comparar contra el límite configurado)
  const descuentoPctEfectivo = subtotal > 0 ? (descuentoMonto / subtotal) * 100 : 0
  const descuentoExcedeLimite = !puedeDescuentoSinLimite && descuentoPctEfectivo > negocio.descuento_limite_pct + 0.01
  const puedeEditarImpuestos = !editId || puedeModificarImpuestos
  const pagosMixtosSuma = pagosMixtos.reduce((s, p) => s + Number(p.monto || 0), 0)
  const balancePendienteCredito = Math.max(0, total - creditoInicial)
  const cobrarDeUnaVezUI = !editId && tipoVenta === 'CONTADO' && estadoPago === 'cobrar' && puedeCobrarPendiente
  const montoEfectivoAPagar = metodoCobroNueva === 'Mixto'
    ? pagosMixtos.filter((p) => p.metodo === 'Efectivo').reduce((s, p) => s + Number(p.monto || 0), 0)
    : (metodoCobroNueva === 'Efectivo' ? total : 0)
  const cambioEfectivo = montoRecibido - montoEfectivoAPagar

  useEffect(() => {
    if (open && cobrarDeUnaVezUI) cargarCajaAbierta()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, cobrarDeUnaVezUI])

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
    // En la ficha del paciente, la factura arranca ya con ese paciente seleccionado.
    const fijo = pacienteFijo ? clientes.find((c) => c.id === pacienteFijo) : null
    setClienteId(fijo ? fijo.id : '')
    setClienteNombre('')
    setBuscarCliente(fijo ? `${codigoCliente(fijo.codigo)} · ${fijo.nombre}` : '')
    setFecha(hoyISO())
    setTipoVenta('CONTADO')
    setEstadoPago('cobrar')
    setMetodoCobroNueva('Efectivo')
    setMontoRecibido(0)
    setTarjetaTipo(''); setTarjetaUltimos4(''); setTarjetaAutorizacion(''); setTarjetaTerminal('')
    setTransferenciaBanco(''); setTransferenciaReferencia(''); setTransferenciaComprobante('')
    setPagosMixtos([{ metodo: 'Efectivo', monto: 0 }, { metodo: 'Tarjeta', monto: 0 }])
    setCreditoVencimiento(''); setCreditoPlazoDias(30); setCreditoInicial(0); setCreditoObservaciones('')
    setConfirmando(null)
    setFacturaGuardada(null)
    setClienteGenerico(false)
    setLineaExpandida(null)
    setAplicaItbis(false)
    setDescuento(0)
    setDescuentoModo('monto')
    setDescuentoPct(0)
    setDescuentoMotivo('')
    setNotas('')
    setLineas([])
    setCantOriginal({})
    setLineasOriginales(0)
    setBuscarItem('')
    setTipoComprobante('consumo')
    setCompradorRnc('')
    setCompradorRazon('')
    setOpen(true)
  }

  // Editar una factura ya guardada (solo PENDIENTE y con permiso)
  async function abrirEditar(f: Factura) {
    if (f.estado !== 'PENDIENTE') return alert('Solo se pueden editar facturas pendientes (aún no cobradas).')
    if (f.ncf) return alert(`Esta factura ya tiene un comprobante fiscal (${f.ncf}) y no puede modificarse. Si necesitas cambiarla, anúlala y emite una nueva.`)
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
    setEstadoPago('pendiente')
    setConfirmando(null)
    setFacturaGuardada(null)
    setClienteGenerico(!f.cliente_id)
    setLineaExpandida(null)
    setCreditoVencimiento(f.credito_vencimiento ?? '')
    setCreditoPlazoDias(f.credito_plazo_dias ?? 30)
    setCreditoInicial(Number(f.credito_inicial ?? 0))
    setCreditoObservaciones(f.credito_observaciones ?? '')
    setAplicaItbis(Number(f.itbis) > 0)
    setDescuento(Number(f.descuento))
    setDescuentoModo('monto')
    setDescuentoPct(0)
    setDescuentoMotivo(f.descuento_motivo ?? '')
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

  async function guardar() {
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
    // Validaciones adicionales del rediseño móvil
    if (total < 0) return alert('El total no puede ser negativo.')
    if (descuentoExcedeLimite) {
      return alert(`El descuento (${descuentoPctEfectivo.toFixed(1)}%) supera el límite de ${negocio.descuento_limite_pct}% sin autorización. Reduce el descuento o pide a un gerente/administrador que lo aplique.`)
    }
    if (tipoVenta === 'CREDITO' && !creditoVencimiento) {
      return alert('Indica la fecha de vencimiento del crédito.')
    }
    const cobrarDeUnaVez = !editId && tipoVenta === 'CONTADO' && estadoPago === 'cobrar' && puedeCobrarPendiente
    const esMixto = cobrarDeUnaVez && metodoCobroNueva === 'Mixto'
    if (esMixto && Math.abs(pagosMixtosSuma - total) > 0.01) {
      return alert(`La suma del pago mixto (${money(pagosMixtosSuma)}) no coincide con el total (${money(total)}).`)
    }
    // Si se va a cobrar de una vez, verificar la caja ANTES de crear nada (para
    // poder cancelar limpio si el usuario no confirma cobrar sin caja abierta).
    let cajaIdCobro: string | null = null
    if (cobrarDeUnaVez && montoEfectivoAPagar > 0) {
      const { data: caja } = await supabase.from('caja_sesiones').select('id').eq('estado', 'ABIERTA').order('abierta_at', { ascending: false }).limit(1).maybeSingle()
      cajaIdCobro = (caja as any)?.id ?? null
      if (!cajaIdCobro && !confirm('No hay una caja abierta, así que este cobro en efectivo NO quedará registrado en el arqueo de caja (puede causar descuadre). ¿Continuar de todos modos?')) {
        return
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
      descuento_motivo: descuentoMotivo || null,
      descuento_tipo: descuentoModo === 'pct' ? 'PORCENTAJE' : 'MONTO',
      descuento_porcentaje: descuentoModo === 'pct' ? descuentoPct : 0,
      credito_vencimiento: tipoVenta === 'CREDITO' ? (creditoVencimiento || null) : null,
      credito_plazo_dias: tipoVenta === 'CREDITO' ? creditoPlazoDias : null,
      credito_inicial: tipoVenta === 'CREDITO' ? creditoInicial : 0,
      credito_observaciones: tipoVenta === 'CREDITO' ? (creditoObservaciones || null) : null,
    }

    // Tipo de comprobante fiscal para la factura NUEVA (si está activo).
    let tipoComp: string | null = null
    let compRnc: string | null = null
    let compRazon: string | null = null
    if (!editId && negocio.comprobantes_activos) {
      if (tipoComprobante === 'credito' && !compradorRnc.trim()) {
        setSaving(false)
        return alert('Para Crédito Fiscal debes indicar el RNC/cédula del comprador.')
      }
      tipoComp = CODIGO_COMPROBANTE[tipoComprobante][negocio.modo_comprobante]
      compRnc = compradorRnc.trim() || null
      compRazon = compradorRazon.trim() || (tipoComprobante === 'credito' ? (clientes.find((c) => c.id === clienteId)?.nombre ?? null) : null)
    }

    let facturaId = editId
    let facturaNueva: Factura | null = null

    if (editId) {
      // Editar: devolver el stock anterior, actualizar y reinsertar el detalle.
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
      const payload = items.map((l) => ({
        factura_id: editId,
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
        return alert('Error al actualizar el detalle: ' + e2.message)
      }
      for (const l of items) {
        if (l.articulo_id) await supabase.rpc('ajustar_stock', { p_articulo: l.articulo_id, p_delta: -l.cantidad })
      }
    } else {
      // NUEVA: todo en UNA sola transacción del servidor (factura + ítems + NCF +
      // stock + marcado del plan). Si algo falla, se revierte todo: nada a medias
      // y el NCF fiscal no se consume.
      const itemsPayload = items.map((l) => ({
        servicio_id: l.servicio_id || null,
        articulo_id: l.articulo_id || null,
        empleado_id: l.empleado_id || null,
        descripcion: l.descripcion,
        cantidad: l.cantidad,
        precio_unit: l.precio_unit,
        importe: l.cantidad * l.precio_unit,
        presupuesto_item_id: l.presupuesto_item_id || null,
      }))
      const { data: fact, error } = await supabase.rpc('crear_factura', {
        p_cliente_id: datos.cliente_id,
        p_cliente_nombre: datos.cliente_nombre,
        p_fecha: datos.fecha,
        p_tipo_venta: datos.tipo_venta,
        p_subtotal: subtotal,
        p_descuento: descuentoMonto,
        p_itbis: itbis,
        p_total: total,
        p_notas: datos.notas,
        p_items: itemsPayload,
        p_tipo_comprobante: tipoComp,
        p_comprador_rnc: compRnc,
        p_comprador_razon_social: compRazon,
      })
      if (error || !fact) {
        setSaving(false)
        return alert('No se pudo crear la factura: ' + (error?.message || 'error desconocido') + (tipoComp ? '\n\nSi es por el comprobante fiscal, revisa la secuencia en Configuración → Comprobantes DGII.' : ''))
      }
      facturaNueva = fact as Factura
      facturaId = (fact as Factura).id
      // El RPC crea la factura con sus campos base; el detalle de descuento y
      // crédito (metadatos, no afectan el total) se completa en un paso aparte.
      await supabase.from('facturas').update({
        descuento_motivo: datos.descuento_motivo,
        descuento_tipo: datos.descuento_tipo,
        descuento_porcentaje: datos.descuento_porcentaje,
        credito_vencimiento: datos.credito_vencimiento,
        credito_plazo_dias: datos.credito_plazo_dias,
        credito_inicial: datos.credito_inicial,
        credito_observaciones: datos.credito_observaciones,
      }).eq('id', facturaId)
    }

    // e-CF: si es factura electrónica nueva con e-NCF, registrar/enviar el comprobante.
    if (facturaNueva?.ncf && negocio.modo_comprobante === 'electronico') {
      const payload: EcfFacturaPayload = {
        encf: facturaNueva.ncf,
        tipo: facturaNueva.tipo_comprobante ?? '',
        rnc_emisor: negocio.rnc,
        razon_social_emisor: negocio.razon_social || negocio.nombre,
        rnc_comprador: facturaNueva.comprador_rnc ?? null,
        razon_social_comprador: facturaNueva.comprador_razon_social ?? null,
        fecha: datos.fecha,
        subtotal,
        descuento: descuentoMonto,
        itbis,
        total,
        items: items.map((l) => ({ descripcion: l.descripcion, cantidad: l.cantidad, precio: l.precio_unit, importe: l.cantidad * l.precio_unit })),
      }
      const config: EcfConfig = {
        proveedor: negocio.ecf_proveedor || null,
        api_url: negocio.ecf_api_url || null,
        api_token: negocio.ecf_api_token || null,
        ambiente: negocio.ecf_ambiente,
        emision_auto: negocio.ecf_emision_auto,
      }
      // Solo se envía de verdad si el emisor está configurado y el envío automático está activo.
      const res: EcfResultado = negocio.ecf_emision_auto && negocio.ecf_api_url && negocio.ecf_api_token
        ? await emitirECF(payload, config)
        : { ok: false, pendiente: true, estado: 'PENDIENTE', mensaje: negocio.ecf_api_url ? 'e-NCF asignado. Falta enviarlo a la DGII (envío manual).' : 'e-NCF asignado. Falta configurar el emisor electrónico.' }
      await supabase.from('facturas').update({
        ecf_estado: res.estado,
        ecf_codigo_seguridad: res.codigo_seguridad ?? null,
        ecf_track_id: res.track_id ?? null,
        ecf_qr_url: res.qr_url ?? null,
        ecf_fecha_firma: res.fecha_firma ?? null,
        ecf_mensaje: res.mensaje ?? null,
      }).eq('id', facturaId)
    }

    // Cobrar de una vez (factura nueva de contado con "Guardar y cobrar").
    if (cobrarDeUnaVez && facturaId) {
      const metodoFactura = esMixto ? 'Mixto' : metodoCobroNueva
      const { error: eCobro } = await supabase.from('facturas')
        .update({ estado: 'PAGADA', metodo_pago: metodoFactura, caja_id: cajaIdCobro })
        .eq('id', facturaId)
      if (eCobro) {
        alert('La factura se creó, pero no se pudo marcar como pagada: ' + eCobro.message + '\n\nPuedes cobrarla luego desde Facturación.')
      } else {
        // Una línea por método (pago mixto = varias líneas; los demás, una sola).
        const lineasPago = esMixto
          ? pagosMixtos.filter((p) => Number(p.monto) > 0)
          : [{ metodo: metodoCobroNueva, monto: total }]
        const registradoPor = perfil?.nombre || perfil?.username || 'Usuario'
        const payloadPagos = lineasPago.map((p) => ({
          factura_id: facturaId,
          metodo: p.metodo,
          monto: Number(p.monto),
          caja_id: cajaIdCobro,
          registrado_por: registradoPor,
          tarjeta_tipo: p.metodo === 'Tarjeta' ? (tarjetaTipo || null) : null,
          tarjeta_ultimos4: p.metodo === 'Tarjeta' ? (tarjetaUltimos4 || null) : null,
          tarjeta_autorizacion: p.metodo === 'Tarjeta' ? (tarjetaAutorizacion || null) : null,
          tarjeta_terminal: p.metodo === 'Tarjeta' ? (tarjetaTerminal || null) : null,
          transferencia_banco: p.metodo === 'Transferencia' ? (transferenciaBanco || null) : null,
          transferencia_referencia: p.metodo === 'Transferencia' ? (transferenciaReferencia || null) : null,
          transferencia_comprobante: p.metodo === 'Transferencia' ? (transferenciaComprobante || null) : null,
        }))
        await supabase.from('factura_pagos').insert(payloadPagos)
        if (montoEfectivoAPagar > 0 && cajaIdCobro) {
          await supabase.from('caja_movimientos').insert({
            caja_id: cajaIdCobro,
            tipo: 'ENTRADA',
            concepto: `Factura ${facturaNueva ? codigoFactura(facturaNueva) : ''} · ${datos.cliente_nombre}`,
            monto: montoEfectivoAPagar,
            factura_id: facturaId,
          })
        }
      }
    }

    // Inicial de una venta a crédito nueva (abono registrado igual que en Cuentas por cobrar).
    if (!editId && tipoVenta === 'CREDITO' && creditoInicial > 0 && facturaId) {
      const { data: cajaIni } = await supabase.from('caja_sesiones').select('id').eq('estado', 'ABIERTA').order('abierta_at', { ascending: false }).limit(1).maybeSingle()
      const cajaIdIni = (cajaIni as any)?.id ?? null
      await supabase.from('factura_abonos').insert({
        factura_id: facturaId,
        fecha: datos.fecha,
        monto: creditoInicial,
        metodo_pago: 'Efectivo',
        caja_id: cajaIdIni,
        registrado_por: perfil?.nombre || perfil?.username || null,
        notas: 'Inicial al crear la factura',
      })
      if (cajaIdIni) {
        await supabase.from('caja_movimientos').insert({
          caja_id: cajaIdIni,
          tipo: 'ENTRADA',
          concepto: `Inicial ${facturaNueva ? codigoFactura(facturaNueva) : ''} · ${datos.cliente_nombre}`,
          monto: creditoInicial,
          factura_id: facturaId,
        })
      }
      if (creditoInicial >= total - 0.01) {
        await supabase.from('facturas').update({ estado: 'PAGADA', metodo_pago: 'Efectivo', caja_id: cajaIdIni }).eq('id', facturaId)
      }
    }

    setSaving(false)
    setConfirmando(null)
    if (!editId && facturaNueva) {
      setFacturaGuardada({ ...facturaNueva, estado: cobrarDeUnaVez ? 'PAGADA' : facturaNueva.estado, metodo_pago: cobrarDeUnaVez ? (esMixto ? 'Mixto' : metodoCobroNueva) : facturaNueva.metodo_pago } as Factura)
    } else {
      setOpen(false)
    }
    await cargar()
  }

  // Valida lo esencial y abre la confirmación final antes de guardar de verdad.
  function abrirConfirmacion(estado: 'pendiente' | 'cobrar') {
    const items = lineas.filter((l) => l.descripcion.trim() && l.cantidad > 0)
    if (items.length === 0) return alert('Agrega al menos un servicio o artículo.')
    if (total < 0) return alert('El total no puede ser negativo.')
    if (descuentoExcedeLimite) {
      return alert(`El descuento (${descuentoPctEfectivo.toFixed(1)}%) supera el límite de ${negocio.descuento_limite_pct}% sin autorización.`)
    }
    if (tipoVenta === 'CREDITO' && !creditoVencimiento) return alert('Indica la fecha de vencimiento del crédito.')
    if (estado === 'cobrar' && metodoCobroNueva === 'Mixto') {
      const suma = pagosMixtos.reduce((s, p) => s + Number(p.monto || 0), 0)
      if (Math.abs(suma - total) > 0.01) return alert(`La suma del pago mixto (${money(suma)}) no coincide con el total (${money(total)}).`)
    }
    setEstadoPago(estado)
    setConfirmando(estado)
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

  // Cobrar una factura de CONTADO que quedó pendiente (sin ir a Caja).
  function abrirCobrarPendiente(f: Factura) {
    setCobrarPendiente(f)
    setMetodoCobroPendiente('Efectivo')
  }
  async function confirmarCobrarPendiente() {
    if (!cobrarPendiente) return
    setSavingCobro(true)
    let cajaId: string | null = null
    if (metodoCobroPendiente === 'Efectivo') {
      const { data: caja } = await supabase.from('caja_sesiones').select('id').eq('estado', 'ABIERTA').order('abierta_at', { ascending: false }).limit(1).maybeSingle()
      cajaId = (caja as any)?.id ?? null
      if (!cajaId && !confirm('No hay una caja abierta, así que este cobro en efectivo NO quedará registrado en el arqueo de caja (puede causar descuadre). ¿Continuar de todos modos?')) {
        setSavingCobro(false)
        return
      }
    }
    const { error } = await supabase.from('facturas')
      .update({ estado: 'PAGADA', metodo_pago: metodoCobroPendiente, caja_id: cajaId })
      .eq('id', cobrarPendiente.id)
    if (error) {
      setSavingCobro(false)
      return alert('Error al cobrar: ' + error.message)
    }
    await supabase.from('factura_pagos').insert({
      factura_id: cobrarPendiente.id,
      metodo: metodoCobroPendiente,
      monto: cobrarPendiente.total,
      caja_id: cajaId,
      registrado_por: perfil?.nombre || perfil?.username || 'Usuario',
    })
    if (metodoCobroPendiente === 'Efectivo' && cajaId) {
      await supabase.from('caja_movimientos').insert({
        caja_id: cajaId,
        tipo: 'ENTRADA',
        concepto: `Factura ${codigoFactura(cobrarPendiente)} · ${cobrarPendiente.cliente_nombre ?? 'Cliente'}`,
        monto: cobrarPendiente.total,
        factura_id: cobrarPendiente.id,
      })
    }
    setSavingCobro(false)
    setCobrarPendiente(null)
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

  // Comparte el resumen de una factura recién guardada (WhatsApp / lo que ofrezca el equipo).
  async function compartirFactura(f: Factura) {
    const texto = `${negocio.nombre}\nFactura ${codigoFactura(f)}\nCliente: ${f.cliente_nombre ?? 'Cliente'}\nTotal: ${money(f.total)}\nEstado: ${f.estado}`
    if (navigator.share) {
      try { await navigator.share({ title: `Factura ${codigoFactura(f)}`, text: texto }) } catch { /* el usuario canceló */ }
    } else if (navigator.clipboard) {
      await navigator.clipboard.writeText(texto)
      alert('Resumen copiado al portapapeles.')
    }
  }

  // Imprime la factura en HOJA NORMAL TAMAÑO CARTA (ventana autónoma con logo,
  // datos de la clínica, paciente, tabla de ítems y totales). Distinta del
  // ticket térmico de 72 mm (botón "Ticket").
  async function imprimirCarta() {
    const f = facturaVista
    if (!f) return
    const w = window.open('', '_blank', 'width=850,height=1100')
    if (!w) return alert('Permite las ventanas emergentes para imprimir.')
    const esc = (s: unknown) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
    // Bloque e-CF: QR + código de seguridad (representación impresa del comprobante electrónico)
    const esEcf = !!f.tipo_comprobante && f.tipo_comprobante.startsWith('E')
    let ecfBloque = ''
    if (esEcf) {
      if (f.ecf_codigo_seguridad || f.ecf_qr_url) {
        const urlQr = f.ecf_qr_url || construirUrlQrECF({
          ambiente: negocio.ecf_ambiente,
          rncEmisor: negocio.rnc,
          rncComprador: f.comprador_rnc,
          encf: f.ncf || '',
          fechaEmision: fechaCorta(f.fecha).replace(/\//g, '-'),
          montoTotal: Number(f.total),
          fechaFirma: f.ecf_fecha_firma,
          codigoSeguridad: f.ecf_codigo_seguridad || '',
        })
        let qrImg = ''
        try { qrImg = `<img src="${await QRCode.toDataURL(urlQr, { margin: 1, width: 150 })}" alt="QR e-CF">` } catch { qrImg = '' }
        ecfBloque = `<div class="ecf">
          ${qrImg}
          <div class="ecf-info">
            <div class="ecf-t">COMPROBANTE FISCAL ELECTRÓNICO (e-CF)</div>
            ${f.ecf_codigo_seguridad ? `<div>Código de seguridad: <b>${esc(f.ecf_codigo_seguridad)}</b></div>` : ''}
            ${f.ecf_fecha_firma ? `<div>Fecha de firma: ${esc(fechaCorta(f.ecf_fecha_firma))}</div>` : ''}
            <div>Representación impresa de un e-CF. Verifique su validez en dgii.gov.do</div>
          </div>
        </div>`
      } else {
        ecfBloque = `<div class="ecf-pend">e-CF ${esc(f.ncf || '')} — pendiente de envío a la DGII. Este documento no es válido como comprobante hasta ser aceptado.</div>`
      }
    }
    const logoSrc = `${location.origin}${import.meta.env.BASE_URL}${negocio.logo}`
    const cl = clientes.find((c) => c.id === f.cliente_id)
    const cliente = cl ? `${codigoCliente(cl.codigo)} · ${esc(f.cliente_nombre ?? cl.nombre)}` : esc(f.cliente_nombre ?? 'Cliente de contado')
    const filas = verItems
      .map((it) => {
        const emp = (it as any).empleado?.nombre ? `<div class="por">Realizado por ${esc((it as any).empleado.nombre)}</div>` : ''
        return `<tr>
          <td>${esc(it.descripcion)}${emp}</td>
          <td class="c">${it.cantidad}</td>
          <td class="r">${money(Number(it.precio_unit))}</td>
          <td class="r">${money(Number(it.importe))}</td>
        </tr>`
      })
      .join('')
    const devuelto = devueltoPorFactura[f.id] ?? 0
    w.document.write(`<!DOCTYPE html>
<html lang="es"><head><meta charset="utf-8"><title>${esc(codigoFactura(f))} — Factura</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; color:#1f2937; margin:0; padding:40px 48px; font-size:13px; }
  .enc { display:flex; align-items:center; gap:18px; border-bottom:3px solid #c9a227; padding-bottom:16px; margin-bottom:18px; }
  .enc img { height:74px; width:auto; object-fit:contain; }
  .clinica { font-size:22px; font-weight:bold; color:#111827; margin:0; }
  .datos { font-size:11px; color:#4b5563; margin-top:3px; line-height:1.4; }
  .fact-tit { text-align:right; margin-left:auto; }
  .fact-tit .lbl { font-size:20px; font-weight:bold; color:#c9a227; letter-spacing:1px; }
  .fact-tit .num { font-size:14px; font-weight:bold; color:#374151; }
  .meta { display:flex; justify-content:space-between; flex-wrap:wrap; gap:6px 24px; margin-bottom:14px; }
  .meta div { font-size:12.5px; }
  .meta .k { font-weight:bold; color:#374151; }
  table { width:100%; border-collapse:collapse; margin-top:6px; }
  thead th { background:#faf3df; border-bottom:2px solid #c9a227; text-align:left; padding:8px 10px; font-size:11px; text-transform:uppercase; letter-spacing:.5px; color:#6b5a17; }
  thead th.c { text-align:center; } thead th.r { text-align:right; }
  tbody td { border-bottom:1px solid #eee; padding:8px 10px; vertical-align:top; }
  tbody td.c { text-align:center; } tbody td.r { text-align:right; white-space:nowrap; }
  .por { font-size:11px; color:#6b7280; margin-top:2px; }
  .tot { margin-top:14px; margin-left:auto; width:280px; }
  .tot .fila { display:flex; justify-content:space-between; padding:3px 0; font-size:13px; color:#4b5563; }
  .tot .total { border-top:2px solid #c9a227; margin-top:4px; padding-top:6px; font-size:16px; font-weight:bold; color:#111827; }
  .tot .devuelto { color:#dc2626; font-weight:600; }
  .pie { margin-top:40px; border-top:1px solid #e5e7eb; padding-top:12px; text-align:center; font-size:11px; color:#6b7280; }
  .ecf { margin-top:22px; display:flex; gap:14px; align-items:center; border:1px solid #e5e7eb; border-radius:10px; padding:12px 14px; }
  .ecf img { width:110px; height:110px; }
  .ecf-info { font-size:11px; color:#4b5563; line-height:1.5; }
  .ecf-info .ecf-t { font-weight:bold; color:#111827; font-size:12px; margin-bottom:3px; }
  .ecf-pend { margin-top:22px; border:1px dashed #f59e0b; background:#fffbeb; border-radius:10px; padding:10px 14px; font-size:11px; color:#92400e; }
  @page { size: letter; margin: 16mm; }
</style></head><body>
  <div class="enc">
    <img src="${logoSrc}" alt="${esc(negocio.nombre)}">
    <div>
      <p class="clinica">${esc(negocio.nombre)}</p>
      <div class="datos">
        ${negocio.rnc ? `<div>RNC: ${esc(negocio.rnc)}</div>` : ''}
        ${negocio.direccion ? `<div>${esc(negocio.direccion)}${negocio.referencia ? ' · ' + esc(negocio.referencia) : ''}</div>` : ''}
        ${negocio.telefono ? `<div>Tel.: ${esc(negocio.telefono)}${negocio.whatsapp ? ' · WhatsApp: ' + esc(negocio.whatsapp) : ''}</div>` : ''}
      </div>
    </div>
    <div class="fact-tit">
      <div class="lbl">FACTURA</div>
      <div class="num">${esc(codigoFactura(f))}</div>
    </div>
  </div>

  <div class="meta">
    <div><span class="k">Cliente:</span> ${cliente}</div>
    <div><span class="k">Fecha:</span> ${esc(fechaCorta(f.fecha))}</div>
    ${f.ncf ? `<div><span class="k">NCF:</span> <b>${esc(f.ncf)}</b></div>` : ''}
    <div><span class="k">Tipo:</span> ${f.tipo_venta === 'CREDITO' ? 'Crédito' : 'Contado'}</div>
    ${f.comprador_rnc ? `<div><span class="k">RNC comprador:</span> ${esc(f.comprador_rnc)}</div>` : ''}
    ${f.comprador_razon_social ? `<div><span class="k">Razón social:</span> ${esc(f.comprador_razon_social)}</div>` : ''}
    <div><span class="k">Estado:</span> ${esc(f.estado)}</div>
    ${f.metodo_pago ? `<div><span class="k">Pago:</span> ${esc(f.metodo_pago)}</div>` : ''}
  </div>

  <table>
    <thead><tr>
      <th>Descripción</th><th class="c">Cant.</th><th class="r">Precio</th><th class="r">Importe</th>
    </tr></thead>
    <tbody>${filas || '<tr><td colspan="4" style="text-align:center;color:#9ca3af;padding:16px;">Sin ítems</td></tr>'}</tbody>
  </table>

  <div class="tot">
    <div class="fila"><span>Subtotal</span><span>${money(Number(f.subtotal))}</span></div>
    ${Number(f.descuento) > 0 ? `<div class="fila"><span>Descuento</span><span>- ${money(Number(f.descuento))}</span></div>` : ''}
    ${Number(f.itbis) > 0 ? `<div class="fila"><span>ITBIS (18%)</span><span>${money(Number(f.itbis))}</span></div>` : ''}
    <div class="fila total"><span>Total</span><span>${money(Number(f.total))}</span></div>
    ${devuelto > 0 ? `<div class="fila devuelto"><span>Devuelto</span><span>- ${money(devuelto)}</span></div>` : ''}
  </div>

  ${ecfBloque}

  <div class="pie">
    <p>¡Gracias por confiar en ${esc(negocio.nombre)}!</p>
    ${negocio.instagram ? `<p>${esc(negocio.instagram)}</p>` : ''}
  </div>
  <script>
    window.onload = function () {
      var imgs = Array.prototype.slice.call(document.images)
      Promise.all(imgs.map(function (img) {
        return img.complete ? Promise.resolve() : new Promise(function (res) { img.onload = img.onerror = res })
      })).then(function () { setTimeout(function () { window.focus(); window.print() }, 150) })
    }
  </script>
</body></html>`)
    w.document.close()
    w.focus()
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
      if (!cajaId && !confirm('No hay una caja abierta, así que esta salida de efectivo NO quedará registrada en la caja (puede causar descuadre). ¿Continuar de todos modos?')) {
        setSavingDev(false)
        return
      }
    }
    // Nota de crédito fiscal (si hay comprobantes activos y la factura tenía NCF)
    let notaDatos: Record<string, any> = {}
    if (negocio.comprobantes_activos && devolverFactura.ncf) {
      const tipoNota = negocio.modo_comprobante === 'electronico' ? 'E34' : 'B04'
      const { data: ncfNota, error: eNota } = await supabase.rpc('siguiente_ncf', { p_tipo: tipoNota })
      if (eNota || !ncfNota) {
        setSavingDev(false)
        return alert('No se pudo asignar la nota de crédito (' + tipoNota + '): ' + (eNota?.message || 'sin número disponible') + '.\n\nRevisa la secuencia en Configuración → Comprobantes DGII.')
      }
      notaDatos = { ncf: ncfNota, tipo_comprobante: tipoNota, ncf_afectado: devolverFactura.ncf }
    }
    const { data: dev, error: ed } = await supabase.from('devoluciones').insert({
      factura_id: devolverFactura.id,
      monto,
      metodo_pago: devMetodo,
      motivo: devMotivo || null,
      caja_id: cajaId,
      registrado_por: perfil?.nombre || perfil?.username || null,
      ...notaDatos,
    }).select('id, ncf').single()
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
    if (ei) {
      // No dejar una devolución sin detalle (contaminaría el total devuelto de la factura).
      await supabase.from('devoluciones').delete().eq('id', (dev as any).id)
      setSavingDev(false)
      return alert('No se pudo registrar la devolución (falló el detalle): ' + ei.message)
    }
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
    setDevOk({ codigo: codigoFactura(devolverFactura), monto, ncf: (dev as any).ncf ?? null })
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
      {!pacienteFijo && (
        <PageHeader
          title="Facturación"
          subtitle={`${facturas.length} factura(s)`}
        />
      )}

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
                  {f.estado === 'PENDIENTE' && f.tipo_venta !== 'CREDITO' && puedeCobrarPendiente && (
                    <button title="Cobrar esta factura" onClick={() => abrirCobrarPendiente(f)} className="rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100">
                      <HandCoins size={13} className="-mt-0.5 mr-0.5 inline" /> Cobrar
                    </button>
                  )}
                  {f.estado === 'PENDIENTE' && f.tipo_venta === 'CREDITO' && (
                    <Link to="/cuentas" title="Registrar abono en Cuentas por cobrar" className="rounded-lg bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-100">
                      <HandCoins size={13} className="-mt-0.5 mr-0.5 inline" /> Abonar
                    </Link>
                  )}
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
      {open && facturaGuardada && (
        <div className="mx-auto max-w-md space-y-4 py-6 text-center">
          <div className="flex flex-col items-center gap-2">
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
              <HandCoins size={32} />
            </span>
            <h2 className="font-display text-xl font-bold text-slate-800">¡Factura guardada con éxito!</h2>
            <p className="text-sm text-slate-500">La factura ha sido registrada correctamente.</p>
          </div>
          <div className="card grid grid-cols-2 gap-y-2 text-left text-sm">
            <span className="text-slate-500">Número de factura</span>
            <span className="text-right font-mono font-semibold text-slate-800">{codigoFactura(facturaGuardada)}</span>
            <span className="text-slate-500">Estado</span>
            <span className={`text-right font-semibold ${facturaGuardada.estado === 'PAGADA' ? 'text-emerald-600' : 'text-amber-600'}`}>{facturaGuardada.estado}</span>
            <span className="text-slate-500">Total</span>
            <span className="text-right font-bold text-slate-800">{money(facturaGuardada.total)}</span>
            <span className="text-slate-500">Cliente</span>
            <span className="truncate text-right font-semibold text-slate-800">{facturaGuardada.cliente_nombre || 'Cliente de contado'}</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button className="btn-ghost" onClick={async () => { await verDetalle(facturaGuardada); setTimeout(() => window.print(), 400) }}>
              <Printer size={16} /> Imprimir
            </button>
            <button className="btn-ghost" onClick={() => compartirFactura(facturaGuardada)}>
              <Share2 size={16} /> Compartir
            </button>
            <button className="btn-ghost" onClick={() => verDetalle(facturaGuardada)}>
              <Eye size={16} /> Ver factura
            </button>
            <button className="btn-primary" onClick={() => { setFacturaGuardada(null); nuevaFactura() }}>
              <Plus size={16} /> Crear otra
            </button>
          </div>
          <button className="btn-ghost w-full" onClick={() => { setFacturaGuardada(null); setOpen(false) }}>Volver a la lista</button>
        </div>
      )}

      {open && !facturaGuardada && (
        <div className="mx-auto max-w-2xl pb-6">
          <PageHeader
            title={editId ? 'Editar factura' : 'Nueva venta'}
            subtitle="Registra los servicios y productos a cobrar."
            action={
              <button className="btn-ghost shrink-0" onClick={() => setOpen(false)}>
                <X size={16} /> Cerrar
              </button>
            }
          />

          <div className="space-y-3">
            {/* 1. CLIENTE + 2. FECHA */}
            <div className="card space-y-3">
              <div>
                <label className="label">Cliente</label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" />
                    <input
                      className="input pl-9"
                      placeholder="Buscar cliente o paciente…"
                      value={buscarCliente}
                      onChange={(e) => { setBuscarCliente(e.target.value); setClienteId(''); setClienteGenerico(false) }}
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
                        {clientesFiltrados.length === 0 ? (
                          <p className="px-3 py-2 text-sm text-slate-500">Sin coincidencias</p>
                        ) : (
                          clientesFiltrados.map((c) => (
                            <button
                              key={c.id}
                              type="button"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => { setClienteId(c.id); setBuscarCliente(''); setClienteGenerico(false); setClienteFocus(false) }}
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

              {clienteSel && (
                <div className="flex items-start justify-between gap-2 rounded-xl bg-slate-50 px-3 py-2.5">
                  <div className="min-w-0 text-sm">
                    <p className="truncate font-semibold text-slate-800">{clienteSel.nombre}</p>
                    <p className="truncate text-xs text-slate-500">
                      Código: {codigoCliente(clienteSel.codigo)}
                      {clienteSel.telefono ? ` · ${clienteSel.telefono}` : ''}
                      {(clienteSel as any).documento ? ` · ${(clienteSel as any).documento}` : ''}
                    </p>
                  </div>
                  <button type="button" onClick={() => { setClienteId(''); setBuscarCliente('') }} title="Cambiar cliente" className="shrink-0 rounded-lg p-1.5 text-slate-500 hover:bg-white hover:text-brand-600">
                    <UserPlus size={15} />
                  </button>
                </div>
              )}

              {!clienteId && (
                <>
                  <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-600">
                    <input type="checkbox" checked={clienteGenerico} onChange={(e) => setClienteGenerico(e.target.checked)} />
                    Usar cliente genérico o de contado
                  </label>
                  {clienteGenerico && (
                    <input className="input" value={clienteNombre} onChange={(e) => setClienteNombre(e.target.value)} placeholder="Nombre (opcional)" />
                  )}
                </>
              )}

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
                {!puedeCambiarFecha && <p className="mt-1 text-xs text-slate-500">Fecha de hoy. Solo administración puede cambiarla.</p>}
              </div>
            </div>

            {/* 3. CONDICIÓN DE LA FACTURA */}
            <div className="card space-y-3">
              <label className="label">Condición de la factura</label>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setTipoVenta('CONTADO')} className={`flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2.5 text-sm font-semibold transition ${tipoVenta === 'CONTADO' ? 'border-brand-400 bg-brand-50 text-brand-700' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}>
                  <DollarSign size={15} /> Contado
                </button>
                <button type="button" onClick={() => setTipoVenta('CREDITO')} className={`flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2.5 text-sm font-semibold transition ${tipoVenta === 'CREDITO' ? 'border-brand-400 bg-brand-50 text-brand-700' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}>
                  <FileText size={15} /> Crédito
                </button>
              </div>

              {tipoVenta === 'CREDITO' && (
                <div className="space-y-2 border-t border-slate-100 pt-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-xs font-medium text-slate-600">Fecha de vencimiento</span>
                      <input type="date" className="input" value={creditoVencimiento} onChange={(e) => setCreditoVencimiento(e.target.value)} />
                    </div>
                    <div>
                      <span className="text-xs font-medium text-slate-600">Plazo (días)</span>
                      <input type="number" min={0} className="input" value={creditoPlazoDias || ''} onChange={(e) => setCreditoPlazoDias(Number(e.target.value))} />
                    </div>
                  </div>
                  {!editId && (
                    <div>
                      <span className="text-xs font-medium text-slate-600">Inicial (opcional)</span>
                      <input type="number" min={0} step={50} className="input" value={creditoInicial || ''} onChange={(e) => setCreditoInicial(Number(e.target.value))} />
                    </div>
                  )}
                  <div className="flex justify-between rounded-lg bg-amber-50 px-3 py-2 text-sm">
                    <span className="text-amber-700">Balance pendiente</span>
                    <span className="font-bold text-amber-800">{money(editId ? total : balancePendienteCredito)}</span>
                  </div>
                  <div>
                    <span className="text-xs font-medium text-slate-600">Observaciones de crédito</span>
                    <textarea className="input" rows={2} value={creditoObservaciones} onChange={(e) => setCreditoObservaciones(e.target.value)} placeholder="Opcional" />
                  </div>
                </div>
              )}
            </div>

            {/* Comprobante fiscal DGII (solo si está activo en Configuración) */}
            {negocio.comprobantes_activos && !editId && (
              <div className="card space-y-2">
                <label className="label">Comprobante fiscal</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setTipoComprobante('consumo')}
                    className={`rounded-xl border px-3 py-2 text-sm font-semibold transition ${tipoComprobante === 'consumo' ? 'border-brand-400 bg-brand-50 text-brand-700' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}
                  >
                    Consumo <span className="font-mono text-xs opacity-70">{CODIGO_COMPROBANTE.consumo[negocio.modo_comprobante]}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setTipoComprobante('credito')}
                    className={`rounded-xl border px-3 py-2 text-sm font-semibold transition ${tipoComprobante === 'credito' ? 'border-brand-400 bg-brand-50 text-brand-700' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}
                  >
                    Crédito Fiscal <span className="font-mono text-xs opacity-70">{CODIGO_COMPROBANTE.credito[negocio.modo_comprobante]}</span>
                  </button>
                </div>
                {tipoComprobante === 'credito' && (
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div>
                      <span className="text-xs font-medium text-slate-600">RNC / Cédula del comprador</span>
                      <input className="input" value={compradorRnc} onChange={(e) => setCompradorRnc(e.target.value)} placeholder="1-31-XXXXX-X" />
                    </div>
                    <div>
                      <span className="text-xs font-medium text-slate-600">Razón social</span>
                      <input className="input" value={compradorRazon} onChange={(e) => setCompradorRazon(e.target.value)} placeholder="Nombre fiscal del cliente" />
                    </div>
                  </div>
                )}
                <p className="text-[11px] text-slate-500">
                  Modo: {negocio.modo_comprobante === 'electronico' ? 'e-CF electrónico' : 'NCF tradicional'}. El número se asigna automáticamente al guardar.
                </p>
              </div>
            )}

            {/* Tratamientos realizados por el odontólogo, pendientes de facturar */}
            {pendientesPlan.length > 0 && (
              <div className="card space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-emerald-800">Tratamientos pendientes de facturar ({pendientesPlan.length})</span>
                  <button type="button" className="btn-ghost !py-1 text-xs" onClick={agregarTodosDelPlan}>
                    <Plus size={14} /> Agregar todos
                  </button>
                </div>
                <div className="space-y-1.5">
                  {pendientesPlan.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => agregarDesdePlan(p)}
                      className="flex w-full items-center justify-between gap-2 rounded-lg border border-emerald-100 bg-emerald-50/40 px-3 py-2 text-left text-sm transition hover:bg-emerald-50"
                    >
                      <span className="text-slate-700">
                        {p.descripcion}
                        {p.diente != null && <span className="text-slate-400"> · diente {p.diente}</span>}
                      </span>
                      <span className="flex shrink-0 items-center gap-2">
                        <span className="font-semibold text-slate-700">{money(p.precio_unit)}</span>
                        <Plus size={14} className="text-emerald-600" />
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 4. SERVICIOS O ARTÍCULOS */}
            <div className="card space-y-2">
              <label className="label">Servicios o artículos</label>
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

              {editId && lineasOriginales > 0 && !puedeModificarLineas && (
                <p className="text-xs font-medium text-amber-600">Lo ya agregado (🔒) no se puede modificar ni eliminar sin autorización.</p>
              )}

              {lineas.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-4 text-center text-sm text-slate-500">
                  No hay servicios o artículos agregados.
                </div>
              ) : (
                <div className="space-y-2">
                  {lineas.map((l, i) => {
                    const esManual = !l.servicio_id && !l.articulo_id
                    const bloqueado = i < lineasOriginales && !puedeModificarLineas
                    const expandida = lineaExpandida === i
                    return (
                      <div key={i} className={`rounded-xl border p-2.5 ${bloqueado ? 'border-slate-100 bg-slate-50' : 'border-slate-200 bg-white'}`}>
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            {esManual && !bloqueado ? (
                              <input
                                className="input !py-1.5 flex-1"
                                placeholder="Concepto (ej: ajuste, recargo…)"
                                value={l.descripcion}
                                onChange={(e) => setLinea(i, { descripcion: e.target.value })}
                              />
                            ) : (
                              <p className="truncate text-sm font-semibold text-slate-800">{l.descripcion}</p>
                            )}
                            <p className="text-xs text-slate-500">{l.cantidad} × {money(l.precio_unit)}</p>
                          </div>
                          <span className="shrink-0 font-semibold text-slate-800">{money(l.cantidad * l.precio_unit)}</span>
                          <div className="flex shrink-0 items-center gap-1">
                            {bloqueado ? (
                              <span className="badge bg-slate-200 text-slate-500" title="Ya agregado · requiere autorización">🔒</span>
                            ) : (
                              <>
                                <button type="button" onClick={() => setLineaExpandida(expandida ? null : i)} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-brand-600" title="Editar">
                                  <Pencil size={14} />
                                </button>
                                <button type="button" onClick={() => setLineas(lineas.filter((_, idx) => idx !== i))} className="rounded-lg p-1.5 text-slate-500 hover:bg-rose-50 hover:text-rose-600" title="Eliminar">
                                  <X size={16} />
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                        {expandida && !bloqueado && (
                          <div className="mt-2 space-y-2 border-t border-slate-100 pt-2">
                            <div>
                              <span className="text-xs font-medium text-slate-600">Realizado por</span>
                              <select className="input" value={l.empleado_id} onChange={(e) => setLinea(i, { empleado_id: e.target.value })}>
                                <option value="">— Sin asignar —</option>
                                {empleados.map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}
                              </select>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <span className="text-xs font-medium text-slate-600">Cantidad</span>
                                <input type="number" min={1} className="input" value={l.cantidad || ''} onChange={(e) => setLinea(i, { cantidad: Number(e.target.value) })} />
                              </div>
                              <div>
                                <span className="text-xs font-medium text-slate-600">Precio</span>
                                <input type="number" min={0} step={50} className="input" value={l.precio_unit || ''} onChange={(e) => setLinea(i, { precio_unit: Number(e.target.value) })} />
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                <button type="button" className="btn-ghost" onClick={() => { setBuscarCat(''); setCatTab('catalogo'); setCatalogoOpen(true) }}>
                  <Plus size={14} /> Agregar servicio
                </button>
                <button type="button" className="btn-ghost" onClick={agregarManual}>
                  <Plus size={14} /> Concepto manual
                </button>
              </div>
            </div>

            {/* 5. DESCUENTO */}
            <div className="card space-y-2">
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
              <input className="input" list="motivos-descuento" value={descuentoMotivo} disabled={protegerCuenta} onChange={(e) => setDescuentoMotivo(e.target.value)} placeholder="Seleccionar motivo (opcional)" />
              <datalist id="motivos-descuento">
                <option value="Cortesía" /><option value="Paciente frecuente" /><option value="Promoción" /><option value="Ajuste de precio" />
              </datalist>
              {protegerCuenta ? (
                <p className="text-xs text-slate-600">🔒 El descuento no se puede cambiar sin autorización.</p>
              ) : descuentoExcedeLimite ? (
                <p className="text-xs font-medium text-rose-600">Este descuento ({descuentoPctEfectivo.toFixed(1)}%) supera el límite de {negocio.descuento_limite_pct}% y requiere autorización.</p>
              ) : null}
            </div>

            {/* 6. IMPUESTOS */}
            <div className="card space-y-1.5">
              <label className={`flex items-center gap-2 text-sm text-slate-600 ${(!puedeEditarImpuestos || protegerCuenta) ? 'opacity-60' : ''}`}>
                <input type="checkbox" checked={aplicaItbis} disabled={!puedeEditarImpuestos || protegerCuenta} onChange={(e) => setAplicaItbis(e.target.checked)} />
                Aplicar ITBIS (18%) {(!puedeEditarImpuestos || protegerCuenta) && <span className="text-xs">🔒</span>}
              </label>
              <p className="text-xs text-slate-500">Impuestos calculados según la configuración de los servicios.</p>
            </div>

            {/* 7. RESUMEN */}
            <div className="card space-y-1 text-sm">
              <div className="flex justify-between text-slate-600"><span>Subtotal</span><span>{money(subtotal)}</span></div>
              {descuentoMonto > 0 && <div className="flex justify-between text-slate-600"><span>Descuento{descuentoModo === 'pct' ? ` (${descuentoPct}%)` : ''}</span><span>- {money(descuentoMonto)}</span></div>}
              {aplicaItbis && <div className="flex justify-between text-slate-600"><span>ITBIS (18%)</span><span>{money(itbis)}</span></div>}
              <div className="mt-1 flex items-center justify-between border-t border-slate-200 pt-1.5">
                <span className="font-bold text-slate-800">TOTAL</span>
                <span className="text-xl font-extrabold text-brand-700">{money(total)}</span>
              </div>
            </div>

            {/* 8. ESTADO DE LA FACTURA + 9. MÉTODO DE PAGO (solo contado nuevo) */}
            {!editId && tipoVenta === 'CONTADO' && puedeCobrarPendiente && (
              <div className="card space-y-3">
                <label className="label">Estado de la factura</label>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => setEstadoPago('pendiente')} className={`rounded-xl border p-3 text-left transition ${estadoPago === 'pendiente' ? 'border-brand-400 bg-brand-50' : 'border-slate-200 hover:bg-slate-50'}`}>
                    <FileText size={18} className={estadoPago === 'pendiente' ? 'text-brand-600' : 'text-slate-400'} />
                    <p className="mt-1 text-sm font-semibold text-slate-800">Guardar pendiente</p>
                    <p className="text-xs text-slate-500">La factura se guardará pendiente de pago.</p>
                  </button>
                  <button type="button" onClick={() => setEstadoPago('cobrar')} className={`rounded-xl border p-3 text-left transition ${estadoPago === 'cobrar' ? 'border-brand-400 bg-brand-50' : 'border-slate-200 hover:bg-slate-50'}`}>
                    <DollarSign size={18} className={estadoPago === 'cobrar' ? 'text-brand-600' : 'text-slate-400'} />
                    <p className="mt-1 text-sm font-semibold text-slate-800">Guardar y cobrar</p>
                    <p className="text-xs text-slate-500">La factura se guardará como pagada.</p>
                  </button>
                </div>

                {estadoPago === 'cobrar' && (
                  <div className="space-y-3 border-t border-slate-100 pt-3">
                    <label className="label">Método de pago</label>
                    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                      {METODOS_PAGO.map((m) => {
                        const Icon = METODO_ICONO[m] ?? MoreHorizontal
                        return (
                          <button key={m} type="button" onClick={() => setMetodoCobroNueva(m)} className={`flex flex-col items-center gap-1 rounded-xl border px-2 py-2.5 text-xs font-semibold transition ${metodoCobroNueva === m ? 'border-brand-400 bg-brand-50 text-brand-700' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}>
                            <Icon size={18} /> {m}
                          </button>
                        )
                      })}
                      <button type="button" onClick={() => setMetodoCobroNueva('Mixto')} className={`flex flex-col items-center gap-1 rounded-xl border px-2 py-2.5 text-xs font-semibold transition ${metodoCobroNueva === 'Mixto' ? 'border-brand-400 bg-brand-50 text-brand-700' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}>
                        <Layers size={18} /> Pago mixto
                      </button>
                    </div>

                    {metodoCobroNueva === 'Efectivo' && (
                      <div className="space-y-2">
                        {cajaAbierta ? (
                          <div className="flex items-center justify-between rounded-lg bg-emerald-50 px-3 py-2 text-sm">
                            <span className="flex items-center gap-1.5 font-semibold text-emerald-700"><Unlock size={14} /> Caja activa</span>
                            <span className="text-xs text-emerald-700/80">{conPrefijo(negocio.prefijo_caja, cajaAbierta.numero)} · Abierta por {cajaAbierta.abierta_por}</span>
                          </div>
                        ) : (
                          <div className="space-y-2 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
                            <p className="flex items-center gap-1.5 font-semibold"><Lock size={14} /> No existe una caja abierta para registrar efectivo.</p>
                            <div className="flex gap-2">
                              <Link to="/caja" className="btn-ghost !py-1 text-xs">Abrir caja</Link>
                              <button type="button" className="btn-ghost !py-1 text-xs" onClick={() => setMetodoCobroNueva('Otro')}>Cambiar método</button>
                            </div>
                          </div>
                        )}
                        <div className="space-y-1.5 rounded-lg bg-slate-50 p-3 text-sm">
                          <div className="flex justify-between"><span className="text-slate-500">Total a pagar</span><span className="font-semibold">{money(total)}</span></div>
                          <div>
                            <span className="text-xs font-medium text-slate-600">Monto recibido</span>
                            <input type="number" min={0} step={50} className="input" value={montoRecibido || ''} onChange={(e) => setMontoRecibido(Number(e.target.value))} />
                          </div>
                          <div className="flex justify-between font-bold"><span className={cambioEfectivo < 0 ? 'text-rose-600' : 'text-emerald-600'}>Cambio</span><span className={cambioEfectivo < 0 ? 'text-rose-600' : 'text-emerald-600'}>{money(Math.max(0, cambioEfectivo))}</span></div>
                        </div>
                      </div>
                    )}

                    {metodoCobroNueva === 'Tarjeta' && (
                      <div className="grid grid-cols-2 gap-2">
                        <input className="input" value={tarjetaTipo} onChange={(e) => setTarjetaTipo(e.target.value)} placeholder="Tipo de tarjeta" />
                        <input className="input" maxLength={4} value={tarjetaUltimos4} onChange={(e) => setTarjetaUltimos4(e.target.value.replace(/\D/g, ''))} placeholder="Últimos 4 dígitos" />
                        <input className="input" value={tarjetaAutorizacion} onChange={(e) => setTarjetaAutorizacion(e.target.value)} placeholder="No. de autorización" />
                        <input className="input" value={tarjetaTerminal} onChange={(e) => setTarjetaTerminal(e.target.value)} placeholder="Terminal (opcional)" />
                      </div>
                    )}

                    {metodoCobroNueva === 'Transferencia' && (
                      <div className="space-y-2">
                        <input className="input" value={transferenciaBanco} onChange={(e) => setTransferenciaBanco(e.target.value)} placeholder="Banco" />
                        <input className="input" value={transferenciaReferencia} onChange={(e) => setTransferenciaReferencia(e.target.value)} placeholder="Referencia" />
                        <input className="input" value={transferenciaComprobante} onChange={(e) => setTransferenciaComprobante(e.target.value)} placeholder="Comprobante (opcional)" />
                      </div>
                    )}

                    {metodoCobroNueva === 'Mixto' && (
                      <div className="space-y-2">
                        {pagosMixtos.map((p, i) => (
                          <div key={i} className="flex items-center gap-2">
                            <select className="input flex-1" value={p.metodo} onChange={(e) => setPagosMixtos((prev) => prev.map((x, idx) => idx === i ? { ...x, metodo: e.target.value } : x))}>
                              {METODOS_PAGO.map((m) => <option key={m}>{m}</option>)}
                            </select>
                            <input type="number" min={0} step={50} className="input w-28" value={p.monto || ''} onChange={(e) => setPagosMixtos((prev) => prev.map((x, idx) => idx === i ? { ...x, monto: Number(e.target.value) } : x))} />
                            {pagosMixtos.length > 1 && (
                              <button type="button" onClick={() => setPagosMixtos((prev) => prev.filter((_, idx) => idx !== i))} className="rounded-lg p-2 text-slate-500 hover:bg-rose-50 hover:text-rose-600"><X size={16} /></button>
                            )}
                          </div>
                        ))}
                        <button type="button" className="text-xs font-semibold text-brand-600 hover:underline" onClick={() => setPagosMixtos((prev) => [...prev, { metodo: 'Efectivo', monto: 0 }])}>+ Agregar línea</button>
                        <div className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm font-bold ${Math.abs(pagosMixtosSuma - total) < 0.01 ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                          <span>Pagado {money(pagosMixtosSuma)} de {money(total)}</span>
                          <span>{Math.abs(pagosMixtosSuma - total) < 0.01 ? 'Cuadra ✓' : pagosMixtosSuma < total ? `Falta ${money(total - pagosMixtosSuma)}` : `Sobra ${money(pagosMixtosSuma - total)}`}</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* 10. NOTAS */}
            <div className="card space-y-1.5">
              <label className="label">Notas (opcional)</label>
              <textarea className="input" rows={notas ? 3 : 2} value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Escribe una nota adicional…" />
            </div>
          </div>

          {/* 11. ACCIONES FINALES (barra fija) */}
          <div className="sticky bottom-0 -mx-4 mt-4 flex gap-2 border-t border-amber-100 bg-white/95 px-4 py-3 backdrop-blur" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
            <button className="btn-ghost" onClick={() => setOpen(false)}>Cancelar</button>
            {editId ? (
              <button className="btn-primary flex-1" disabled={lineas.length === 0 || saving} onClick={() => abrirConfirmacion('pendiente')}>
                Guardar cambios
              </button>
            ) : (
              <>
                <button className="btn-ghost flex-1" disabled={lineas.length === 0} onClick={() => abrirConfirmacion('pendiente')}>
                  Guardar pendiente
                </button>
                {tipoVenta === 'CONTADO' && puedeCobrarPendiente && (
                  <button className="btn-primary flex-1" disabled={lineas.length === 0} onClick={() => abrirConfirmacion('cobrar')}>
                    Guardar y cobrar
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* 12. CONFIRMACIÓN FINAL */}
      <Modal
        open={!!confirmando}
        title="Confirmar factura"
        onClose={() => setConfirmando(null)}
        footer={
          <>
            <button className="btn-ghost" onClick={() => setConfirmando(null)}>Volver</button>
            <button className="btn-primary" onClick={guardar} disabled={saving}>{saving ? 'Guardando…' : 'Confirmar factura'}</button>
          </>
        }
      >
        <div className="space-y-1.5 text-sm">
          <div className="flex justify-between"><span className="text-slate-500">Cliente</span><span className="font-medium text-slate-800">{clienteSel?.nombre || clienteNombre || 'Cliente de contado'}</span></div>
          <div className="flex justify-between"><span className="text-slate-500">Condición</span><span className="font-medium text-slate-800">{tipoVenta === 'CREDITO' ? 'Crédito' : 'Contado'}</span></div>
          <div className="flex justify-between"><span className="text-slate-500">Servicios</span><span className="font-medium text-slate-800">{lineas.length}</span></div>
          <div className="flex justify-between border-t border-slate-100 pt-1.5"><span className="font-semibold text-slate-700">Total</span><span className="font-bold text-slate-900">{money(total)}</span></div>
          <div className="flex justify-between"><span className="text-slate-500">Estado</span><span className="font-medium text-slate-800">{confirmando === 'cobrar' ? 'Pagada' : 'Pendiente'}</span></div>
          {confirmando === 'cobrar' && (
            <div className="flex justify-between"><span className="text-slate-500">Método de pago</span><span className="font-medium text-slate-800">{metodoCobroNueva === 'Mixto' ? 'Mixto' : metodoCobroNueva}</span></div>
          )}
        </div>
      </Modal>

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
      {/* Cobrar una factura de contado que quedó pendiente */}
      <Modal
        open={!!cobrarPendiente}
        title={`Cobrar factura ${cobrarPendiente ? codigoFactura(cobrarPendiente) : ''}`}
        onClose={() => setCobrarPendiente(null)}
        footer={
          <>
            <button className="btn-ghost" onClick={() => setCobrarPendiente(null)}>Cancelar</button>
            <button className="btn-primary" onClick={confirmarCobrarPendiente} disabled={savingCobro}>
              {savingCobro ? 'Cobrando…' : `Cobrar ${money(cobrarPendiente?.total ?? 0)}`}
            </button>
          </>
        }
      >
        {cobrarPendiente && (
          <div className="space-y-4">
            <div className="rounded-xl bg-slate-50 p-3 text-sm">
              <div className="flex justify-between text-slate-600"><span>Cliente</span><span className="font-medium text-slate-800">{cobrarPendiente.cliente_nombre || 'Cliente'}</span></div>
              <div className="mt-1 flex justify-between border-t border-slate-200 pt-1 font-bold text-slate-800"><span>Total</span><span>{money(cobrarPendiente.total)}</span></div>
            </div>
            <div>
              <label className="label">Método de pago</label>
              <div className="grid grid-cols-3 gap-2">
                {METODOS_PAGO.map((m) => (
                  <button key={m} type="button" onClick={() => setMetodoCobroPendiente(m)}
                    className={`rounded-xl border px-3 py-2 text-sm font-semibold transition ${metodoCobroPendiente === m ? 'border-emerald-400 bg-emerald-50 text-emerald-700' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}>
                    {m}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={!!verId} title={`Factura ${facturaVista ? codigoFactura(facturaVista) : ''}`} onClose={() => setVerId(null)}>
        {facturaVista && (
          <div id="factura-print" className="print-area space-y-3">
            <TicketFactura
              factura={facturaVista}
              items={verItems}
              negocio={negocio}
              clienteCodigo={clientes.find((c) => c.id === facturaVista.cliente_id)?.codigo ?? null}
              clienteTelefono={clientes.find((c) => c.id === facturaVista.cliente_id)?.telefono ?? null}
              devuelto={devueltoPorFactura[facturaVista.id] ?? 0}
            />
            {facturaVista.ecf_estado && (
              <p className="no-print text-center text-sm">
                <span className="font-medium">e-CF:</span>{' '}
                <span className={`badge ${ECF_ESTADO_LABEL[facturaVista.ecf_estado]?.color || 'bg-slate-100 text-slate-600'}`}>
                  {ECF_ESTADO_LABEL[facturaVista.ecf_estado]?.label || facturaVista.ecf_estado}
                </span>
              </p>
            )}
            <div className="no-print flex flex-wrap gap-2">
              {facturaVista.estado === 'PAGADA' && puedeAnular && (
                <button className="btn-ghost flex-1" onClick={() => abrirDevolucion(facturaVista)}>
                  <Undo2 size={16} /> Devolver
                </button>
              )}
              <button className="btn-ghost flex-1" onClick={() => window.print()} title="Ticket térmico de 72 mm">
                <Printer size={16} /> Ticket 72mm
              </button>
              <button className="btn-primary flex-1" onClick={imprimirCarta} title="Hoja tamaño carta">
                <Printer size={16} /> Imprimir (carta)
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
                <img src={`${import.meta.env.BASE_URL}${negocio.logo}`} alt={negocio.nombre} className="mx-auto mb-1 h-14 rounded-lg bg-white object-contain" />
                <p className="font-display text-base font-bold text-brand-800">{negocio.nombre}</p>
                {negocio.rnc && <p className="text-xs text-slate-500">RNC: {negocio.rnc}</p>}
                <p className="mt-1 text-xs font-semibold text-slate-600">NOTA DE CRÉDITO / DEVOLUCIÓN</p>
                {devOk.ncf && <p className="text-xs font-semibold text-slate-700">NCF: {devOk.ncf}</p>}
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
