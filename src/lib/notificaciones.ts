export interface Notificacion {
  id: string
  usuario_id: string
  tipo: 'mensaje' | 'mencion' | 'archivo' | 'tarea' | 'tratamiento' | 'aviso' | 'info'
  titulo: string
  cuerpo: string | null
  enlace: string | null
  icono: string | null
  origen_id: string | null
  leida: boolean
  created_at: string
}

// Emoji por tipo (si la notificación no trae uno propio).
export function iconoTipo(tipo: Notificacion['tipo']): string {
  switch (tipo) {
    case 'mensaje': return '💬'
    case 'mencion': return '@'
    case 'archivo': return '📎'
    case 'tarea': return '✅'
    case 'tratamiento': return '🦷'
    case 'aviso': return '📢'
    default: return '🔔'
  }
}

// "hace 3 min", "hace 2 h", "ayer"…
export function hace(ts: string): string {
  const s = Math.floor((Date.now() - new Date(ts).getTime()) / 1000)
  if (s < 60) return 'ahora'
  const m = Math.floor(s / 60)
  if (m < 60) return `hace ${m} min`
  const h = Math.floor(m / 60)
  if (h < 24) return `hace ${h} h`
  const d = Math.floor(h / 24)
  if (d === 1) return 'ayer'
  if (d < 7) return `hace ${d} días`
  return new Date(ts).toLocaleDateString('es-DO', { day: '2-digit', month: '2-digit' })
}
