// Catálogos para el módulo de Radiografías / Análisis.

export type TipoRadiografia = 'bitewing' | 'panoramica' | 'periapical'

export const TIPOS_RADIOGRAFIA: { value: TipoRadiografia; label: string; desc: string; icon: string }[] = [
  { value: 'bitewing', label: 'Bitewing', desc: 'Aleta de mordida', icon: '🦷' },
  { value: 'panoramica', label: 'Panorámica', desc: 'Vista completa', icon: '🪥' },
  { value: 'periapical', label: 'Periapical o retroalveolar', desc: 'Diente y raíz', icon: '🦷' },
]

export function labelTipoRx(t: string): string {
  return TIPOS_RADIOGRAFIA.find((x) => x.value === t)?.label ?? t
}

// Tipos de hallazgo que el odontólogo puede marcar sobre la placa.
export const TIPOS_HALLAZGO: { value: string; label: string; color: string }[] = [
  { value: 'caries', label: 'Caries', color: 'bg-rose-100 text-rose-700' },
  { value: 'perdida_osea', label: 'Pérdida ósea', color: 'bg-orange-100 text-orange-700' },
  { value: 'lesion_periapical', label: 'Lesión periapical', color: 'bg-red-100 text-red-700' },
  { value: 'calculo', label: 'Cálculo / sarro', color: 'bg-amber-100 text-amber-700' },
  { value: 'restauracion', label: 'Restauración', color: 'bg-blue-100 text-blue-700' },
  { value: 'endodoncia', label: 'Tratamiento de conducto', color: 'bg-indigo-100 text-indigo-700' },
  { value: 'reabsorcion', label: 'Reabsorción', color: 'bg-purple-100 text-purple-700' },
  { value: 'fractura', label: 'Fractura', color: 'bg-pink-100 text-pink-700' },
  { value: 'impactacion', label: 'Diente impactado', color: 'bg-teal-100 text-teal-700' },
  { value: 'otro', label: 'Otro', color: 'bg-slate-100 text-slate-600' },
]

export function labelHallazgo(t: string): string {
  return TIPOS_HALLAZGO.find((x) => x.value === t)?.label ?? t
}
export function colorHallazgo(t: string): string {
  return TIPOS_HALLAZGO.find((x) => x.value === t)?.color ?? 'bg-slate-100 text-slate-600'
}

export const SEVERIDADES: { value: string; label: string; color: string }[] = [
  { value: 'leve', label: 'Leve', color: 'bg-emerald-100 text-emerald-700' },
  { value: 'moderada', label: 'Moderada', color: 'bg-amber-100 text-amber-700' },
  { value: 'severa', label: 'Severa', color: 'bg-rose-100 text-rose-700' },
]

export function colorSeveridad(s: string | null | undefined): string {
  return SEVERIDADES.find((x) => x.value === s)?.color ?? 'bg-slate-100 text-slate-500'
}
