// Tipos de dominio para AMATISTA DENTAL

export type EstadoCita = 'PENDIENTE' | 'CONFIRMADA' | 'COMPLETADA' | 'CANCELADA'

export interface Empleado {
  id: string
  nombre: string
  puesto: string
  telefono: string | null
  email: string | null
  especialidad: string | null
  color: string | null
  comision_pct: number
  activo: boolean
  created_at: string
  updated_at: string
}

export interface Servicio {
  id: string
  nombre: string
  categoria: string
  descripcion: string | null
  duracion_min: number
  precio: number
  // % de comisión propio del servicio. Si es null, se usa el % del empleado.
  comision_pct: number | null
  activo: boolean
  created_at: string
  updated_at: string
}

export interface Cliente {
  id: string
  codigo: number
  nombre: string
  telefono: string | null
  email: string | null
  fecha_nacimiento: string | null
  notas: string | null
  created_at: string
  updated_at: string
}

export interface Cita {
  id: string
  numero: number
  cliente_id: string | null
  empleado_id: string | null
  servicio_id: string | null
  fecha: string
  hora_inicio: string
  hora_fin: string | null
  estado: EstadoCita
  precio: number
  notas: string | null
  created_at: string
  updated_at: string
}

// Cita con las relaciones expandidas (join)
export interface CitaConRelaciones extends Cita {
  cliente: Pick<Cliente, 'id' | 'nombre' | 'telefono'> | null
  empleado: Pick<Empleado, 'id' | 'nombre' | 'color'> | null
  servicio: Pick<Servicio, 'id' | 'nombre' | 'precio' | 'duracion_min'> | null
}

// ===================== FACTURACIÓN Y CONTABILIDAD =====================

export type EstadoFactura = 'PENDIENTE' | 'PAGADA' | 'ANULADA'
export type TipoVenta = 'CONTADO' | 'CREDITO'
export type TipoPagoEmpleado = 'SALARIO' | 'COMISION' | 'ADELANTO' | 'BONO'

export interface FacturaItem {
  id: string
  factura_id: string
  servicio_id: string | null
  empleado_id: string | null
  descripcion: string
  cantidad: number
  precio_unit: number
  importe: number
  articulo_id?: string | null
  empleado?: { nombre: string } | null
}

export interface Factura {
  id: string
  numero: number
  tipo_venta: TipoVenta
  serie: number | null
  cliente_id: string | null
  cliente_nombre: string | null
  cita_id: string | null
  fecha: string
  subtotal: number
  descuento: number
  itbis: number
  total: number
  estado: EstadoFactura
  metodo_pago: string | null
  caja_id: string | null
  notas: string | null
  created_at: string
  updated_at: string
}

export interface FacturaConItems extends Factura {
  items: FacturaItem[]
}

// Línea de pago de una factura (pago dividido / mixto: efectivo + tarjeta, etc.)
export interface FacturaPago {
  id: string
  factura_id: string
  metodo: string
  monto: number
  caja_id: string | null
  registrado_por: string | null
  created_at: string
}

// Devolución / nota de crédito sobre una factura (total o parcial)
export interface Devolucion {
  id: string
  factura_id: string
  fecha: string
  monto: number
  metodo_pago: string
  motivo: string | null
  caja_id: string | null
  registrado_por: string | null
  created_at: string
}

export interface DevolucionItem {
  id: string
  devolucion_id: string
  factura_item_id: string | null
  articulo_id: string | null
  descripcion: string | null
  cantidad: number
  importe: number
}

export interface Gasto {
  id: string
  numero: number
  fecha: string
  categoria: string
  concepto: string
  beneficiario: string | null
  monto: number
  metodo_pago: string | null
  notas: string | null
  created_at: string
}

export interface CompraAbono {
  id: string
  compra_id: string
  fecha: string
  monto: number
  metodo_pago: string | null
  registrado_por: string | null
  notas: string | null
  created_at: string
}

export interface Compra {
  id: string
  numero: number
  tipo_pago: 'CONTADO' | 'CREDITO'
  fecha: string
  proveedor: string | null
  descripcion: string
  categoria: string
  subtotal: number
  itbis: number
  total: number
  metodo_pago: string | null
  articulo_id: string | null
  cantidad: number | null
  notas: string | null
  created_at: string
}

export interface FacturaAbono {
  id: string
  factura_id: string
  fecha: string
  monto: number
  metodo_pago: string | null
  caja_id: string | null
  registrado_por: string | null
  notas: string | null
  created_at: string
}

export interface Proveedor {
  id: string
  codigo: number
  nombre: string
  telefono: string | null
  contacto: string | null
  notas: string | null
  activo: boolean
  created_at: string
  updated_at: string
}

export interface Auditoria {
  id: string
  fecha: string
  usuario: string | null
  modulo: string
  accion: string
  descripcion: string | null
  registro_id: string | null
}

export interface PagoEmpleado {
  id: string
  numero: number
  empleado_id: string | null
  empleado_nombre: string | null
  fecha: string
  periodo: string | null
  tipo: TipoPagoEmpleado
  monto: number
  metodo_pago: string | null
  notas: string | null
  // Para tipo COMISION: rango de fechas que cubre el pago (control de "ya pagado")
  comision_desde: string | null
  comision_hasta: string | null
  created_at: string
}

// Tipado mínimo para el cliente de Supabase.
export type Database = any

export interface CajaSesion {
  id: string
  numero: number
  abierta_at: string
  cerrada_at: string | null
  monto_inicial: number
  monto_contado: number | null
  diferencia: number | null
  estado: 'ABIERTA' | 'CERRADA'
  abierta_por: string | null
  cerrada_por: string | null
  notas: string | null
  created_at: string
}

export interface CajaMovimiento {
  id: string
  caja_id: string
  tipo: 'ENTRADA' | 'SALIDA'
  concepto: string
  monto: number
  factura_id: string | null
  created_at: string
}

export interface Articulo {
  id: string
  codigo: number
  nombre: string
  categoria: string
  descripcion: string | null
  precio: number
  costo: number
  stock: number
  stock_min: number
  activo: boolean
  created_at: string
  updated_at: string
}

export type EstadoMobiliario = 'BUENO' | 'REGULAR' | 'DANADO'

// Mobiliario y equipos (activos físicos del salón; no es inventario de venta).
export interface Mobiliario {
  id: string
  codigo: number
  nombre: string
  categoria: string
  cantidad: number
  estado: EstadoMobiliario
  ubicacion: string | null
  costo: number
  fecha_compra: string | null
  proveedor: string | null
  serie: string | null
  foto_url: string | null
  notas: string | null
  activo: boolean
  created_at: string
  updated_at: string
}

// ===================== ODONTOLOGÍA (AMATISTA DENTAL) =====================
// Notación dental FDI: permanentes 11-48, temporales 51-85.

export type EstadoDiente =
  | 'sano' | 'caries' | 'obturado' | 'ausente' | 'corona' | 'implante'
  | 'endodoncia' | 'fractura' | 'sellante' | 'extraccion_indicada'
  | 'protesis' | 'puente' | 'movilidad'

// Una marca del odontograma (estado de una pieza o cara concreta del paciente)
export interface MarcaOdontograma {
  id: string
  cliente_id: string
  diente: number
  cara: string | null
  estado: EstadoDiente
  tratamiento_id: string | null
  cita_id: string | null
  notas: string | null
  created_at: string
  updated_at: string
}

// Ficha clínica del paciente (1 por paciente, PK = cliente_id)
export interface HistoriaClinica {
  cliente_id: string
  antecedentes: string | null
  alergias: string | null
  medicamentos: string | null
  enfermedades: string | null
  grupo_sanguineo: string | null
  embarazada: boolean
  fumador: boolean
  observaciones: string | null
  updated_at: string
}

// Nota de evolución / consulta por visita
export interface HistoriaEvolucion {
  id: string
  cliente_id: string
  cita_id: string | null
  empleado_id: string | null
  fecha: string
  motivo: string | null
  diagnostico: string | null
  procedimiento: string | null
  indicaciones: string | null
  notas: string | null
  created_at: string
}

export type EstadoPresupuesto = 'BORRADOR' | 'PRESENTADO' | 'APROBADO' | 'RECHAZADO' | 'FACTURADO'
export type EstadoPresupuestoItem = 'PENDIENTE' | 'APROBADO' | 'REALIZADO'

export interface PresupuestoItem {
  id: string
  presupuesto_id: string
  servicio_id: string | null
  diente: number | null
  descripcion: string
  cantidad: number
  precio_unit: number
  subtotal: number
  estado: EstadoPresupuestoItem
  created_at: string
}

export interface Presupuesto {
  id: string
  codigo: number
  cliente_id: string | null
  empleado_id: string | null
  fecha: string
  estado: EstadoPresupuesto
  subtotal: number
  descuento: number
  total: number
  notas: string | null
  factura_id: string | null
  created_at: string
  updated_at: string
}

export interface PresupuestoConItems extends Presupuesto {
  items: PresupuestoItem[]
}
