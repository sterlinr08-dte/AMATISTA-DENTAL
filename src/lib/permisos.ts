// Catálogo único de módulos del sistema (fuente de verdad para permisos y menú)

export interface Modulo {
  key: string
  label: string
  path: string
}

export const MODULOS: Modulo[] = [
  { key: 'panel', label: 'Panel', path: '/' },
  { key: 'citas', label: 'Citas / Agenda', path: '/citas' },
  { key: 'clientes', label: 'Pacientes', path: '/clientes' },
  { key: 'ficha', label: 'Ficha del paciente', path: '/ficha' },
  { key: 'chat', label: 'Chat interno', path: '/chat' },
  { key: 'tareas', label: 'Tareas', path: '/tareas' },
  { key: 'avisos', label: 'Avisos institucionales', path: '/avisos' },
  { key: 'odontograma', label: 'Odontograma', path: '/odontograma' },
  { key: 'historia', label: 'Historia clínica', path: '/historia' },
  { key: 'presupuestos', label: 'Presupuestos', path: '/presupuestos' },
  { key: 'periodontograma', label: 'Periodontograma', path: '/periodontograma' },
  { key: 'imagenes', label: 'Imágenes / Radiografías', path: '/imagenes' },
  { key: 'recetas', label: 'Recetas', path: '/recetas' },
  { key: 'documentos', label: 'Documentos', path: '/documentos' },
  { key: 'consentimientos', label: 'Consentimientos', path: '/consentimientos' },
  { key: 'alertas', label: 'Alertas', path: '/alertas' },
  { key: 'seguimiento', label: 'Seguimiento de planes', path: '/seguimiento' },
  { key: 'controles', label: 'Controles / Recall', path: '/controles' },
  { key: 'laboratorio', label: 'Laboratorio', path: '/laboratorio' },
  { key: 'servicios', label: 'Tratamientos y precios', path: '/servicios' },
  { key: 'articulos', label: 'Artículos / Productos', path: '/articulos' },
  { key: 'mobiliario', label: 'Mobiliario y equipos', path: '/mobiliario' },
  { key: 'empleados', label: 'Empleados', path: '/empleados' },
  { key: 'facturacion', label: 'Facturación', path: '/facturacion' },
  { key: 'caja', label: 'Caja', path: '/caja' },
  { key: 'cuentas', label: 'Cuentas por cobrar', path: '/cuentas' },
  { key: 'compras', label: 'Compras', path: '/compras' },
  { key: 'cuentas_pagar', label: 'Cuentas por pagar', path: '/por-pagar' },
  { key: 'gastos', label: 'Gastos', path: '/gastos' },
  { key: 'nomina', label: 'Pagos a empleados', path: '/nomina' },
  { key: 'contabilidad', label: 'Contabilidad', path: '/contabilidad' },
  { key: 'reportes', label: 'Reportes', path: '/reportes' },
  { key: 'indicadores', label: 'Indicadores', path: '/indicadores' },
  { key: 'configuracion', label: 'Configuración', path: '/configuracion' },
]

export const TODOS_MODULOS = MODULOS.map((m) => m.key)

// Funciones / acciones controlables por rol (control de accesos fino).
// Se guardan en el mismo arreglo de permisos del rol.
export interface Accion {
  key: string
  label: string
  modulo: string
}

export const ACCIONES: Accion[] = [
  { key: 'facturas.cobrar', label: 'Cobrar / registrar pago de facturas', modulo: 'facturacion' },
  { key: 'facturas.editar', label: 'Editar facturas ya guardadas', modulo: 'facturacion' },
  { key: 'facturas.cambiar_fecha', label: 'Cambiar la fecha de la factura (por defecto es la de hoy)', modulo: 'facturacion' },
  { key: 'facturas.anular', label: 'Anular facturas', modulo: 'facturacion' },
  { key: 'facturas.eliminar', label: 'Eliminar facturas', modulo: 'facturacion' },
  { key: 'facturas.vender_sin_existencia', label: 'Facturar artículos sin existencia (dejar en negativo)', modulo: 'facturacion' },
  { key: 'facturas.modificar_lineas', label: 'Modificar o eliminar ítems ya agregados a una cuenta abierta', modulo: 'facturacion' },
  { key: 'caja.abrir', label: 'Abrir y cerrar caja', modulo: 'caja' },
  { key: 'caja.movimiento', label: 'Registrar entradas / salidas de efectivo', modulo: 'caja' },
  { key: 'caja.cerrar_descuadre', label: 'Cerrar caja aunque haya descuadre (diferencia)', modulo: 'caja' },
  { key: 'caja.ver_descuadre', label: 'Ver el descuadre de la caja (sobrante / faltante)', modulo: 'caja' },
  { key: 'caja.ajustar_cuadre', label: 'Ajustar / corregir un cuadre de caja cerrado', modulo: 'reportes' },
  { key: 'creditos.cobrar', label: 'Registrar abonos de ventas a crédito', modulo: 'caja' },
  { key: 'pagos_proveedor.registrar', label: 'Registrar pagos a proveedores (cuentas por pagar)', modulo: 'cuentas_pagar' },
  { key: 'gastos.cambiar_fecha', label: 'Cambiar la fecha del gasto (por defecto es la de hoy)', modulo: 'gastos' },
  { key: 'compras.cambiar_fecha', label: 'Cambiar la fecha de la compra (por defecto es la de hoy)', modulo: 'compras' },
  { key: 'nomina.cambiar_fecha', label: 'Cambiar la fecha del pago a empleado (por defecto es la de hoy)', modulo: 'nomina' },
  { key: 'clientes.eliminar', label: 'Eliminar clientes', modulo: 'clientes' },
  { key: 'servicios.eliminar', label: 'Eliminar servicios', modulo: 'servicios' },
  { key: 'articulos.eliminar', label: 'Eliminar artículos', modulo: 'articulos' },
  { key: 'mobiliario.eliminar', label: 'Eliminar mobiliario / equipos', modulo: 'mobiliario' },
  { key: 'compras.eliminar', label: 'Eliminar compras', modulo: 'compras' },
  { key: 'gastos.eliminar', label: 'Eliminar gastos', modulo: 'gastos' },
  { key: 'citas.eliminar', label: 'Eliminar citas', modulo: 'citas' },
]

export function etiquetaPermiso(key: string): string {
  return MODULOS.find((m) => m.key === key)?.label ?? ACCIONES.find((a) => a.key === key)?.label ?? key
}

export interface Rol {
  key: string
  nombre: string
  permisos: string[]
  es_admin: boolean
  protegido: boolean
}

export interface Perfil {
  id: string
  nombre: string | null
  username: string | null
  email: string | null
  rol_key: string | null
  activo: boolean
  rol_nombre?: string | null
  permisos: string[]
  es_admin: boolean
}
