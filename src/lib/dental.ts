// Odontología (Amatista Dental): notación dental FDI y estados de pieza.
import type { EstadoDiente } from '../types'

// Dientes permanentes por cuadrante (notación FDI), ordenados de forma que
// al concatenar arcada superior (der→izq) e inferior se dibuje como una boca.
export const DIENTES_PERMANENTES = {
  supDerecho: [18, 17, 16, 15, 14, 13, 12, 11],
  supIzquierdo: [21, 22, 23, 24, 25, 26, 27, 28],
  infIzquierdo: [38, 37, 36, 35, 34, 33, 32, 31],
  infDerecho: [41, 42, 43, 44, 45, 46, 47, 48],
}

// Dientes temporales (dentición primaria) por cuadrante.
export const DIENTES_TEMPORALES = {
  supDerecho: [55, 54, 53, 52, 51],
  supIzquierdo: [61, 62, 63, 64, 65],
  infIzquierdo: [75, 74, 73, 72, 71],
  infDerecho: [81, 82, 83, 84, 85],
}

// Filas del odontograma listas para render (cada fila = mitad de una arcada).
export const ARCADA_PERMANENTE_SUP = [...DIENTES_PERMANENTES.supDerecho, ...DIENTES_PERMANENTES.supIzquierdo]
export const ARCADA_PERMANENTE_INF = [...DIENTES_PERMANENTES.infDerecho, ...DIENTES_PERMANENTES.infIzquierdo]
export const ARCADA_TEMPORAL_SUP = [...DIENTES_TEMPORALES.supDerecho, ...DIENTES_TEMPORALES.supIzquierdo]
export const ARCADA_TEMPORAL_INF = [...DIENTES_TEMPORALES.infDerecho, ...DIENTES_TEMPORALES.infIzquierdo]

export interface EstadoDienteDef {
  value: EstadoDiente
  label: string
  color: string
}

// Estados clínicos de una pieza y su color en el odontograma.
export const ESTADOS_DIENTE: EstadoDienteDef[] = [
  { value: 'sano', label: 'Sano', color: '#e5e7eb' },
  { value: 'caries', label: 'Caries', color: '#ef4444' },
  { value: 'obturado', label: 'Obturado', color: '#3b82f6' },
  { value: 'ausente', label: 'Ausente', color: '#9ca3af' },
  { value: 'corona', label: 'Corona', color: '#f59e0b' },
  { value: 'implante', label: 'Implante', color: '#14b8a6' },
  { value: 'endodoncia', label: 'Endodoncia', color: '#8b5cf6' },
  { value: 'fractura', label: 'Fractura', color: '#f97316' },
  { value: 'sellante', label: 'Sellante', color: '#22c55e' },
  { value: 'extraccion_indicada', label: 'Extracción indicada', color: '#dc2626' },
  { value: 'protesis', label: 'Prótesis', color: '#a855f7' },
  { value: 'puente', label: 'Puente', color: '#0ea5e9' },
  { value: 'movilidad', label: 'Movilidad', color: '#eab308' },
]

export function estadoDienteDef(v: string): EstadoDienteDef {
  return ESTADOS_DIENTE.find((e) => e.value === v) ?? ESTADOS_DIENTE[0]
}

// Caras / superficies de una pieza.
export const CARAS_DIENTE = ['Vestibular', 'Palatino/Lingual', 'Mesial', 'Distal', 'Oclusal/Incisal']

export const GRUPOS_SANGUINEOS = ['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-']

export const ESTADOS_PRESUPUESTO: { value: string; label: string; color: string }[] = [
  { value: 'BORRADOR', label: 'Borrador', color: 'bg-slate-100 text-slate-600' },
  { value: 'PRESENTADO', label: 'Presentado', color: 'bg-blue-100 text-blue-700' },
  { value: 'APROBADO', label: 'Aprobado', color: 'bg-emerald-100 text-emerald-700' },
  { value: 'RECHAZADO', label: 'Rechazado', color: 'bg-rose-100 text-rose-700' },
  { value: 'FACTURADO', label: 'Facturado', color: 'bg-amber-100 text-amber-800' },
]
export function estadoPresupuestoDef(v: string) {
  return ESTADOS_PRESUPUESTO.find((e) => e.value === v) ?? ESTADOS_PRESUPUESTO[0]
}
