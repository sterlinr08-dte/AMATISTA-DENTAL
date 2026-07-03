export type EstadoTarea = 'pendiente' | 'en_proceso' | 'completada'

export interface Tarea {
  id: string
  titulo: string
  descripcion: string | null
  estado: EstadoTarea
  asignado_a: string | null
  creada_por: string | null
  fecha_limite: string | null
  conversacion_id: string | null
  cliente_id: string | null
  presupuesto_id: string | null
  created_at: string
  completada_at: string | null
  cliente?: { nombre: string } | null
}

export const ESTADOS_TAREA: Record<EstadoTarea, { label: string; badge: string; punto: string }> = {
  pendiente:   { label: 'Pendiente',  badge: 'bg-slate-100 text-slate-600',  punto: 'bg-slate-400' },
  en_proceso:  { label: 'En proceso', badge: 'bg-blue-100 text-blue-700',    punto: 'bg-blue-500' },
  completada:  { label: 'Completada', badge: 'bg-emerald-100 text-emerald-700', punto: 'bg-emerald-500' },
}

// Contexto opcional al crear una tarea desde el chat / la ficha.
export interface ContextoTarea {
  conversacion_id?: string | null
  cliente_id?: string | null
  presupuesto_id?: string | null
}
