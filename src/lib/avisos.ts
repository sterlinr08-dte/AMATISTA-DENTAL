export type NivelAviso = 'info' | 'importante' | 'urgente'

export interface Aviso {
  id: string
  titulo: string
  cuerpo: string | null
  nivel: NivelAviso
  fijado: boolean
  expira: string | null
  creado_por: string | null
  activo: boolean
  created_at: string
}

export const NIVELES_AVISO: Record<NivelAviso, { label: string; emoji: string; card: string; badge: string }> = {
  info:       { label: 'Información', emoji: 'ℹ️', card: 'border-sky-200 bg-sky-50',      badge: 'bg-sky-100 text-sky-700' },
  importante: { label: 'Importante', emoji: '⭐', card: 'border-amber-200 bg-amber-50',   badge: 'bg-amber-100 text-amber-700' },
  urgente:    { label: 'Urgente',    emoji: '🚨', card: 'border-rose-200 bg-rose-50',     badge: 'bg-rose-100 text-rose-700' },
}

// ¿El aviso sigue vigente hoy? (sin fecha de expiración = siempre)
export function avisoVigente(a: Aviso, hoyISO: string): boolean {
  return a.activo && (!a.expira || a.expira >= hoyISO)
}

// Orden: fijados primero, luego los más recientes.
export function ordenarAvisos(a: Aviso, b: Aviso): number {
  if (a.fijado !== b.fijado) return a.fijado ? -1 : 1
  return b.created_at.localeCompare(a.created_at)
}
