// Chat interno corporativo — tipos, catálogos y utilidades.
// Se apoya 100% en Supabase (Postgres + Realtime + Storage + RLS).

export type TipoConversacion = 'directo' | 'grupo' | 'departamento' | 'paciente' | 'tratamiento'

export interface ChatUsuario {
  id: string
  nombre: string | null
  username: string | null
  rol_key: string | null
}

export interface ChatMensaje {
  id: string
  conversacion_id: string
  autor_id: string | null
  texto: string | null
  adjunto_url: string | null
  adjunto_nombre: string | null
  adjunto_tipo: string | null
  responde_a: string | null
  mencionados: string[]
  editado_at: string | null
  eliminado: boolean
  created_at: string
}

export interface ChatParticipante {
  conversacion_id: string
  usuario_id: string
  rol: 'admin' | 'miembro'
  ultima_lectura: string
  archivado: boolean
  silenciado: boolean
}

// Fila de la vista `chat_mis_conversaciones`.
export interface ConversacionResumen {
  id: string
  tipo: TipoConversacion
  nombre: string | null
  departamento: string | null
  cliente_id: string | null
  presupuesto_id: string | null
  creada_por: string | null
  created_at: string
  ultimo_mensaje_at: string
  ultima_lectura: string
  archivado: boolean
  silenciado: boolean
  cliente_nombre: string | null
  otro_id: string | null
  otro_nombre: string | null
  n_participantes: number
  no_leidos: number
  ultimo: {
    texto: string | null
    autor_id: string | null
    created_at: string
    adjunto_tipo: string | null
    eliminado: boolean
  } | null
}

// Departamentos de la clínica (Fase 2 — grupos automáticos).
export const DEPARTAMENTOS: { key: string; nombre: string; emoji: string }[] = [
  { key: 'recepcion', nombre: 'Recepción', emoji: '🛎️' },
  { key: 'odontologos', nombre: 'Odontólogos', emoji: '🦷' },
  { key: 'ortodoncia', nombre: 'Ortodoncia', emoji: '😁' },
  { key: 'endodoncia', nombre: 'Endodoncia', emoji: '🔬' },
  { key: 'cirugia', nombre: 'Cirugía', emoji: '🔪' },
  { key: 'laboratorio', nombre: 'Laboratorio', emoji: '⚗️' },
  { key: 'caja', nombre: 'Caja', emoji: '💵' },
  { key: 'administracion', nombre: 'Administración', emoji: '🗂️' },
]

export function nombreDepartamento(key: string | null): string {
  return DEPARTAMENTOS.find((d) => d.key === key)?.nombre ?? 'Departamento'
}

// Respuestas rápidas (Fase 7 — un clic).
export const RESPUESTAS_RAPIDAS: string[] = [
  'Paciente confirmado ✅',
  'Paciente llegó 🚪',
  'Doctor disponible 👨‍⚕️',
  'Material agotado ⚠️',
  'Laboratorio entregó la prótesis 🦷',
  'Presupuesto aprobado 📄',
  'Pago recibido 💵',
  'Ya voy 🏃',
]

// Iniciales para el avatar.
export function inicialesChat(nombre: string | null | undefined): string {
  const n = (nombre ?? '').trim()
  if (!n) return '?'
  const p = n.split(/\s+/)
  return ((p[0]?.[0] ?? '') + (p[1]?.[0] ?? '')).toUpperCase() || '?'
}

// Color estable del avatar a partir del id del usuario.
const PALETA = ['#c9a227', '#0f9d6b', '#2563eb', '#db2777', '#7c3aed', '#ea580c', '#0891b2', '#65a30d']
export function colorAvatar(id: string | null | undefined): string {
  if (!id) return PALETA[0]
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return PALETA[h % PALETA.length]
}

// Hora corta HH:MM AM/PM (para la burbuja).
export function horaChat(ts: string): string {
  return new Date(ts).toLocaleTimeString('es-DO', { hour: 'numeric', minute: '2-digit', hour12: true })
}

// Etiqueta relativa para la lista de conversaciones (hoy → hora, ayer, fecha).
export function cuandoChat(ts: string): string {
  const d = new Date(ts)
  const hoy = new Date()
  const mismoDia = d.toDateString() === hoy.toDateString()
  if (mismoDia) return horaChat(ts)
  const ayer = new Date(hoy); ayer.setDate(hoy.getDate() - 1)
  if (d.toDateString() === ayer.toDateString()) return 'Ayer'
  return d.toLocaleDateString('es-DO', { day: '2-digit', month: '2-digit' })
}

// Separador de fecha entre grupos de mensajes.
export function diaChat(ts: string): string {
  const d = new Date(ts)
  const hoy = new Date()
  if (d.toDateString() === hoy.toDateString()) return 'Hoy'
  const ayer = new Date(hoy); ayer.setDate(hoy.getDate() - 1)
  if (d.toDateString() === ayer.toDateString()) return 'Ayer'
  return d.toLocaleDateString('es-DO', { weekday: 'long', day: 'numeric', month: 'long' })
}

// Vista previa del último mensaje en la lista.
export function vistaPrevia(u: ConversacionResumen['ultimo']): string {
  if (!u) return 'Sin mensajes aún'
  if (u.eliminado) return 'Mensaje eliminado'
  if (!u.texto && u.adjunto_tipo) {
    if (u.adjunto_tipo.startsWith('image/')) return '📷 Foto'
    return '📎 Archivo'
  }
  return u.texto ?? ''
}

// Detecta menciones @nombre en el texto y devuelve los ids de usuario referidos.
export function detectarMenciones(texto: string, usuarios: ChatUsuario[]): string[] {
  const ids: string[] = []
  const bajo = texto.toLowerCase()
  for (const u of usuarios) {
    const etq = (u.username || u.nombre || '').toLowerCase().replace(/\s+/g, '')
    if (etq && bajo.includes('@' + etq)) ids.push(u.id)
  }
  return ids
}

// Nombre visible de un usuario.
export function nombreUsuario(u: ChatUsuario | undefined | null): string {
  if (!u) return 'Usuario'
  return u.nombre || u.username || 'Usuario'
}
