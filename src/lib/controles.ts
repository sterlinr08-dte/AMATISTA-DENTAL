// Catálogo del módulo Controles / Recall.

export const TIPOS_CONTROL: { value: string; label: string; meses: number; icon: string }[] = [
  { value: 'limpieza', label: 'Limpieza / profilaxis', meses: 6, icon: '🪥' },
  { value: 'ortodoncia', label: 'Control de ortodoncia', meses: 1, icon: '😬' },
  { value: 'revision', label: 'Revisión general', meses: 6, icon: '🔎' },
  { value: 'endodoncia', label: 'Control de endodoncia', meses: 6, icon: '🦷' },
  { value: 'protesis', label: 'Control de prótesis', meses: 12, icon: '🦷' },
  { value: 'otro', label: 'Otro', meses: 3, icon: '📌' },
]

export function labelControl(t: string): string {
  return TIPOS_CONTROL.find((x) => x.value === t)?.label ?? t
}
export function mesesControl(t: string): number {
  return TIPOS_CONTROL.find((x) => x.value === t)?.meses ?? 6
}

export const ESTADO_CONTROL: Record<string, { label: string; color: string }> = {
  PENDIENTE: { label: 'Por contactar', color: 'bg-amber-50 text-amber-700' },
  CONTACTADO: { label: 'Contactado', color: 'bg-blue-50 text-blue-700' },
  AGENDADO: { label: 'Agendó cita', color: 'bg-indigo-50 text-indigo-700' },
  COMPLETADO: { label: 'Completado', color: 'bg-emerald-50 text-emerald-700' },
}

// Mensaje de WhatsApp para invitar al paciente a volver.
export function mensajeControl(paciente: string, clinica: string, tipoLabel: string): string {
  return `Hola ${paciente} 👋, le saludamos de ${clinica}. Ya es momento de su ${tipoLabel.toLowerCase()}. ¿Desea que le agendemos una cita? ¡Con gusto le esperamos!`
}
