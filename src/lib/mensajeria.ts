// Mensajería a pacientes (recordatorios de citas por WhatsApp).
//
// Hoy funciona con "click-to-send": se abre WhatsApp con el mensaje ya escrito y
// el usuario solo presiona enviar (gratis, sin API). Cuando se quiera envío 100%
// automático, se conecta un proveedor de WhatsApp (API) reutilizando estos mismos
// helpers para armar el mensaje.

export const PLANTILLA_CITA_DEFAULT =
  'Hola {paciente} 👋, le recordamos su cita en {clinica} el {fecha} a las {hora}. Por favor confirme respondiendo *Sí*. ¡Gracias!'

// Normaliza un teléfono dominicano al formato que espera wa.me (código país + número, sin signos).
export function normalizarTelefonoRD(tel: string | null | undefined): string {
  const d = (tel || '').replace(/\D/g, '')
  if (!d) return ''
  if (d.length === 10) return '1' + d              // 809/829/849 + 7 dígitos
  if (d.length === 11 && d.startsWith('1')) return d
  return d                                          // ya trae código de país u otro formato
}

export function construirMensajeCita(
  datos: { paciente: string; clinica: string; fecha: string; hora: string },
  plantilla?: string | null,
): string {
  return (plantilla?.trim() || PLANTILLA_CITA_DEFAULT)
    .replace(/{paciente}/g, datos.paciente)
    .replace(/{clinica}/g, datos.clinica)
    .replace(/{fecha}/g, datos.fecha)
    .replace(/{hora}/g, datos.hora)
}

// Enlace de WhatsApp con el mensaje precargado (abre el chat listo para enviar).
export function linkWhatsApp(tel: string | null | undefined, mensaje: string): string {
  const num = normalizarTelefonoRD(tel)
  return `https://wa.me/${num}?text=${encodeURIComponent(mensaje)}`
}
