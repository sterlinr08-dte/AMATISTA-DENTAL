// Catálogo del módulo Órdenes de laboratorio.

export const TIPOS_TRABAJO: { value: string; label: string }[] = [
  { value: 'corona', label: 'Corona' },
  { value: 'puente', label: 'Puente' },
  { value: 'protesis_total', label: 'Prótesis total' },
  { value: 'protesis_parcial', label: 'Prótesis parcial removible' },
  { value: 'incrustacion', label: 'Incrustación' },
  { value: 'carilla', label: 'Carilla' },
  { value: 'ferula', label: 'Férula / guarda oclusal' },
  { value: 'provisional', label: 'Provisional' },
  { value: 'modelo', label: 'Modelo de estudio' },
  { value: 'aparato_orto', label: 'Aparato de ortodoncia' },
  { value: 'otro', label: 'Otro' },
]
export function labelTrabajo(t: string): string {
  return TIPOS_TRABAJO.find((x) => x.value === t)?.label ?? t
}

export const ESTADOS_ORDEN: { value: string; label: string; color: string }[] = [
  { value: 'SOLICITADA', label: 'Solicitada', color: 'bg-slate-100 text-slate-600' },
  { value: 'ENVIADA', label: 'Enviada al lab.', color: 'bg-blue-50 text-blue-700' },
  { value: 'EN_PROCESO', label: 'En proceso', color: 'bg-amber-50 text-amber-700' },
  { value: 'RECIBIDA', label: 'Recibida del lab.', color: 'bg-indigo-50 text-indigo-700' },
  { value: 'ENTREGADA', label: 'Entregada al paciente', color: 'bg-emerald-50 text-emerald-700' },
  { value: 'CANCELADA', label: 'Cancelada', color: 'bg-rose-50 text-rose-700' },
]
export function estadoOrdenDef(e: string) {
  return ESTADOS_ORDEN.find((x) => x.value === e) ?? { value: e, label: e, color: 'bg-slate-100 text-slate-600' }
}

// Órdenes "en curso" (siguen pendientes de llegar / entregar).
export const ESTADOS_ACTIVOS = ['SOLICITADA', 'ENVIADA', 'EN_PROCESO']

export function codigoOrden(n: number | null | undefined): string {
  return 'L' + String(n ?? 0).padStart(4, '0')
}
