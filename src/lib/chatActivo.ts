// Rastrea qué conversación está viendo el usuario ahora mismo, para no
// mostrar un "toast" de un mensaje que ya está leyendo en pantalla.
let activa: string | null = null

export function setConversacionActiva(id: string | null) { activa = id }
export function getConversacionActiva(): string | null { return activa }
