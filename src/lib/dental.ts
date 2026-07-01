// Odontología (Amatista Dental): notación dental FDI y estados de pieza.
import type { EstadoDiente, CondicionMarca } from '../types'

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
// Vista del odontólogo frente al paciente: en cada fila, primero el lado
// derecho del paciente y luego el izquierdo, con la línea media al centro.
// En las arcadas INFERIORES se invierte cada cuadrante para que los incisivos
// centrales (41/31, 81/71) queden al centro, alineados con los superiores
// (11/21), y los molares en los extremos.
export const ARCADA_PERMANENTE_SUP = [...DIENTES_PERMANENTES.supDerecho, ...DIENTES_PERMANENTES.supIzquierdo]
export const ARCADA_PERMANENTE_INF = [
  ...[...DIENTES_PERMANENTES.infDerecho].reverse(),
  ...[...DIENTES_PERMANENTES.infIzquierdo].reverse(),
]
export const ARCADA_TEMPORAL_SUP = [...DIENTES_TEMPORALES.supDerecho, ...DIENTES_TEMPORALES.supIzquierdo]
export const ARCADA_TEMPORAL_INF = [
  ...[...DIENTES_TEMPORALES.infDerecho].reverse(),
  ...[...DIENTES_TEMPORALES.infIzquierdo].reverse(),
]

// Grupo de un estado: define cómo se colorea (regla rojo/azul) y si la condición
// (por hacer / realizado) es editable.
//   - sano: sin color.
//   - patologico: hallazgo a tratar → siempre ROJO (por hacer).
//   - prestacion: trabajo dental → editable ROJO (planeado) / AZUL (realizado).
//   - ausente: gris (se dibuja X).
export type GrupoEstado = 'sano' | 'patologico' | 'prestacion' | 'ausente'

export interface EstadoDienteDef {
  value: EstadoDiente
  label: string
  color: string // color de referencia para el selector (el render usa la condición)
  sigla: string // signo corto que se dibuja sobre el diente ('' si no aplica)
  grupo: GrupoEstado
}

// Colores de la convención clínica.
export const COLOR_POR_HACER = '#dc2626' // rojo = requerido / por hacer
export const COLOR_REALIZADO = '#2563eb' // azul = realizado / hecho
export const COLOR_AUSENTE = '#6b7280' // gris = ausente

// Estados clínicos de una pieza, con su signo (sigla) y grupo.
export const ESTADOS_DIENTE: EstadoDienteDef[] = [
  { value: 'sano', label: 'Sano', color: '#e5e7eb', sigla: '', grupo: 'sano' },
  { value: 'caries', label: 'Caries', color: COLOR_POR_HACER, sigla: 'C', grupo: 'patologico' },
  { value: 'fractura', label: 'Fractura', color: COLOR_POR_HACER, sigla: 'FX', grupo: 'patologico' },
  { value: 'extraccion_indicada', label: 'Extracción indicada', color: COLOR_POR_HACER, sigla: '✕', grupo: 'patologico' },
  { value: 'resto_radicular', label: 'Resto radicular', color: COLOR_POR_HACER, sigla: 'RR', grupo: 'patologico' },
  { value: 'movilidad', label: 'Movilidad', color: COLOR_POR_HACER, sigla: 'M', grupo: 'patologico' },
  { value: 'giroversion', label: 'Giroversión', color: COLOR_POR_HACER, sigla: '↻', grupo: 'patologico' },
  { value: 'diastema', label: 'Diastema', color: COLOR_POR_HACER, sigla: 'DS', grupo: 'patologico' },
  { value: 'supernumerario', label: 'Supernumerario', color: COLOR_POR_HACER, sigla: 'SP', grupo: 'patologico' },
  { value: 'obturado', label: 'Obturación / empaste', color: COLOR_REALIZADO, sigla: 'O', grupo: 'prestacion' },
  { value: 'corona', label: 'Corona', color: COLOR_REALIZADO, sigla: 'C', grupo: 'prestacion' },
  { value: 'corona_temporal', label: 'Corona temporal', color: COLOR_REALIZADO, sigla: 'CT', grupo: 'prestacion' },
  { value: 'endodoncia', label: 'Endodoncia', color: COLOR_REALIZADO, sigla: 'E', grupo: 'prestacion' },
  { value: 'implante', label: 'Implante', color: COLOR_REALIZADO, sigla: 'IMP', grupo: 'prestacion' },
  { value: 'sellante', label: 'Sellante', color: COLOR_REALIZADO, sigla: 'S', grupo: 'prestacion' },
  { value: 'protesis', label: 'Prótesis fija', color: COLOR_REALIZADO, sigla: 'PF', grupo: 'prestacion' },
  { value: 'protesis_removible', label: 'Prótesis removible', color: COLOR_REALIZADO, sigla: 'PPR', grupo: 'prestacion' },
  { value: 'protesis_total', label: 'Prótesis total', color: COLOR_REALIZADO, sigla: 'PT', grupo: 'prestacion' },
  { value: 'puente', label: 'Puente', color: COLOR_REALIZADO, sigla: 'PU', grupo: 'prestacion' },
  { value: 'ausente', label: 'Ausente', color: COLOR_AUSENTE, sigla: '', grupo: 'ausente' },
]

export function estadoDienteDef(v: string): EstadoDienteDef {
  return ESTADOS_DIENTE.find((e) => e.value === v) ?? ESTADOS_DIENTE[0]
}

// Condición por defecto según el estado: patológico = por hacer (rojo);
// prestación = realizado (azul); sano/ausente = null.
export function condicionPorDefecto(estado: string): CondicionMarca | null {
  const g = estadoDienteDef(estado).grupo
  if (g === 'patologico') return 'por_hacer'
  if (g === 'prestacion') return 'realizado'
  return null
}

// ¿La condición (por hacer / realizado) es editable para este estado?
export function condicionEditable(estado: string): boolean {
  return estadoDienteDef(estado).grupo === 'prestacion'
}

// Color final de la marca según su estado y condición (regla rojo/azul).
export function colorMarca(estado: string, condicion: CondicionMarca | null): string | undefined {
  const g = estadoDienteDef(estado).grupo
  if (g === 'sano') return undefined
  if (g === 'ausente') return COLOR_AUSENTE
  const cond = condicion ?? condicionPorDefecto(estado)
  return cond === 'realizado' ? COLOR_REALIZADO : COLOR_POR_HACER
}

export function condicionLabel(c: CondicionMarca | null | undefined): string {
  if (c === 'realizado') return 'Realizado'
  if (c === 'por_hacer') return 'Por hacer'
  return '—'
}

// Caras / superficies de una pieza.
export const CARAS_DIENTE = ['Vestibular', 'Palatino/Lingual', 'Mesial', 'Distal', 'Oclusal/Incisal']

// Clasificación de Black de caries/restauraciones (Clase I a VI).
export interface ClaseBlackDef {
  value: number
  label: string
  romano: string
  descripcion: string
}

export const CLASES_BLACK: ClaseBlackDef[] = [
  {
    value: 1,
    label: 'Clase I',
    romano: 'I',
    descripcion: 'Fosas y fisuras: caras oclusales de premolares y molares, 2/3 oclusales de vestibular/lingual y cíngulo de anteriores.',
  },
  {
    value: 2,
    label: 'Clase II',
    romano: 'II',
    descripcion: 'Caras proximales (mesial/distal) de premolares y molares.',
  },
  {
    value: 3,
    label: 'Clase III',
    romano: 'III',
    descripcion: 'Caras proximales de dientes anteriores (incisivos y caninos), sin comprometer el ángulo incisal.',
  },
  {
    value: 4,
    label: 'Clase IV',
    romano: 'IV',
    descripcion: 'Caras proximales de anteriores que comprometen el ángulo incisal.',
  },
  {
    value: 5,
    label: 'Clase V',
    romano: 'V',
    descripcion: 'Tercio gingival (cervical) de las caras vestibular o lingual de cualquier diente.',
  },
  {
    value: 6,
    label: 'Clase VI',
    romano: 'VI',
    descripcion: 'Bordes incisales de anteriores y puntas de cúspides de posteriores (desgaste/abrasión).',
  },
]

export function claseBlackDef(v: number | null | undefined): ClaseBlackDef | null {
  if (v == null) return null
  return CLASES_BLACK.find((c) => c.value === v) ?? null
}

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
