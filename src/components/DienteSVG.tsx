import type { CSSProperties } from 'react'

// Diente anatómico y realista en SVG (efecto 3D con sombreado), estilo Dentalink.
// Se dibuja según el tipo de pieza (por el último dígito FDI) y se orienta la
// raíz según la arcada (`arriba`): superior => raíz hacia arriba y corona abajo;
// inferior => corona arriba y raíz hacia abajo.

type TipoDiente = 'incisivo' | 'canino' | 'premolar' | 'molar'

function tipoPorFdi(fdi: number): TipoDiente {
  const d = fdi % 10
  if (d === 1 || d === 2) return 'incisivo'
  if (d === 3) return 'canino'
  if (d === 4 || d === 5) return 'premolar'
  return 'molar'
}

// Fotos 3D hiperrealistas (fondo transparente) por tipo de pieza. Si existe una
// foto para el tipo, se usa en lugar del dibujo SVG. Se irán añadiendo el resto
// de tipos a medida que se generen. La imagen está dibujada con la corona ARRIBA
// y la raíz ABAJO; se voltea en Y según la arcada (ver más abajo).
const FOTOS: Partial<Record<TipoDiente, string>> = {
  incisivo: `${import.meta.env.BASE_URL}dientes/incisivo.png`,
  canino: `${import.meta.env.BASE_URL}dientes/canino.png`,
  molar: `${import.meta.env.BASE_URL}dientes/molar.png`,
}

interface DienteSVGProps {
  fdi: number
  /** true = arcada superior (raíz hacia arriba); false = inferior (raíz abajo). */
  arriba: boolean
  /** Color de relleno si la pieza tiene un estado completo. */
  colorPieza?: string
  /** Estado clínico: 'ausente' dibuja X, 'implante' dibuja tornillo. */
  estado?: string
  /** Tamaño (px). Por defecto ~40. */
  size?: number
}

// Paths dibujados en orientación "raíz arriba, corona abajo" dentro de un
// viewBox 40x52. Cuando la pieza es inferior, todo el grupo se voltea en Y.
// Cada tipo devuelve por separado la corona (que recibe el tinte de estado) y
// las raíces (siempre en tono marfil/hueso).
interface FormaDiente {
  corona: string
  raices: string[]
}

function formaPorTipo(tipo: TipoDiente): FormaDiente {
  switch (tipo) {
    case 'incisivo':
      return {
        // Corona en pala, borde incisal abajo; raíz cónica única larga.
        corona:
          'M13 26 C13 21 13.5 16 14.5 13.5 C15.5 11 18 10 20 10 ' +
          'C22 10 24.5 11 25.5 13.5 C26.5 16 27 21 27 26 ' +
          'C27 29 25 31 20 31 C15 31 13 29 13 26 Z',
        raices: ['M16 27 C16 22 15.5 18 15.5 14 C15.5 8 18 4 20 4 C22 4 24.5 8 24.5 14 C24.5 18 24 22 24 27 Z'],
      }
    case 'canino':
      return {
        // Corona con punta (cúspide única) marcada abajo; raíz larga y robusta.
        corona:
          'M12.5 25 C12.5 20 13 15 14 12.5 C15 10 17.5 9 20 9 ' +
          'C22.5 9 25 10 26 12.5 C27 15 27.5 20 27.5 25 ' +
          'C27.5 28 26 30 23 31 L20 33 L17 31 C14 30 12.5 28 12.5 25 Z',
        raices: ['M15.5 26 C15.5 21 15 17 15 13 C15 6 18 2 20 2 C22 2 25 6 25 13 C25 17 24.5 21 24.5 26 Z'],
      }
    case 'premolar':
      return {
        // Corona con 2 cúspides (surco central abajo); 1 raíz cónica.
        corona:
          'M11 24 C11 19 11.5 15 12.5 13 C13.5 11 16 10 18.5 10 ' +
          'C19.4 10 19.6 10.6 20 12 C20.4 10.6 20.6 10 21.5 10 ' +
          'C24 10 26.5 11 27.5 13 C28.5 15 29 19 29 24 ' +
          'C29 28 26 31 20 31 C14 31 11 28 11 24 Z',
        raices: ['M16 26 C16 21 15.5 17 15.5 13 C15.5 7 18 3 20 3 C22 3 24.5 7 24.5 13 C24.5 17 24 21 24 26 Z'],
      }
    case 'molar':
    default:
      return {
        // Corona ancha con 4 cúspides (dos surcos abajo); 2 raíces curvadas.
        corona:
          'M8 22 C8 17 8.5 14 9.5 12.5 C10.8 10.6 13.5 9.5 16 9.5 ' +
          'C16.9 9.5 17.1 10.2 17.6 11.6 C18 10.4 18.4 9.9 20 9.9 ' +
          'C21.6 9.9 22 10.4 22.4 11.6 C22.9 10.2 23.1 9.5 24 9.5 ' +
          'C26.5 9.5 29.2 10.6 30.5 12.5 C31.5 14 32 17 32 22 ' +
          'C32 28 27 32 20 32 C13 32 8 28 8 22 Z',
        raices: [
          'M13 25 C13 20 12 16 11 12 C10 7 12.5 4 15 5 C17 6 17.5 11 17.5 15 C17.5 19 17 22 16.5 25 Z',
          'M27 25 C27 20 28 16 29 12 C30 7 27.5 4 25 5 C23 6 22.5 11 22.5 15 C22.5 19 23 22 23.5 25 Z',
        ],
      }
  }
}

export default function DienteSVG({ fdi, arriba, colorPieza, estado, size = 40 }: DienteSVGProps) {
  const tipo = tipoPorFdi(fdi)

  // Si hay foto hiperrealista para este tipo de pieza, se renderiza la foto.
  const foto = FOTOS[tipo]
  if (foto) {
    return (
      <DienteFoto
        src={foto}
        arriba={arriba}
        colorPieza={colorPieza}
        estado={estado}
        size={size}
      />
    )
  }

  const { corona, raices } = formaPorTipo(tipo)

  // IDs únicos por instancia para que los gradientes no colisionen al repetir.
  const idEsmalte = `enamel-${fdi}`
  const idRaiz = `root-${fdi}`
  const idBrillo = `gloss-${fdi}`
  const idSombra = `shadow-${fdi}`

  const ausente = estado === 'ausente'
  const implante = estado === 'implante'

  // La orientación real: superior => raíz arriba (dibujo natural, sin voltear);
  // inferior => corona arriba (volteamos en Y). El viewBox es 40x52; el eje de
  // volteo es la mitad vertical (26).
  const transform = arriba ? undefined : 'translate(0,52) scale(1,-1)'

  return (
    <svg
      width={size}
      height={size * 1.3}
      viewBox="0 0 40 52"
      aria-hidden="true"
    >
      <defs>
        {/* Esmalte: gradiente radial con brillo arriba-izquierda y sombra abajo-derecha. */}
        <radialGradient id={idEsmalte} cx="38%" cy="35%" r="75%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="45%" stopColor="#f8fafc" />
          <stop offset="80%" stopColor="#e2e8f0" />
          <stop offset="100%" stopColor="#cbd5e1" />
        </radialGradient>
        {/* Raíz: tono hueso, algo más cálido y opaco. */}
        <linearGradient id={idRaiz} x1="30%" y1="0%" x2="70%" y2="100%">
          <stop offset="0%" stopColor="#f1e9dd" />
          <stop offset="55%" stopColor="#e7dccb" />
          <stop offset="100%" stopColor="#d6c7b0" />
        </linearGradient>
        {/* Brillo especular sobre la corona. */}
        <radialGradient id={idBrillo} cx="35%" cy="30%" r="45%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
        {/* Sombra suave de contacto. */}
        <filter id={idSombra} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur in="SourceAlpha" stdDeviation="0.9" result="blur" />
          <feOffset in="blur" dx="0.6" dy="0.9" result="off" />
          <feComponentTransfer in="off" result="sh">
            <feFuncA type="linear" slope="0.35" />
          </feComponentTransfer>
          <feMerge>
            <feMergeNode in="sh" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <g transform={transform} filter={`url(#${idSombra})`}>
        {/* Raíces primero (van "detrás" de la corona). */}
        {raices.map((d, i) => (
          <path
            key={i}
            d={d}
            fill={`url(#${idRaiz})`}
            stroke="#9ca3af"
            strokeWidth={1}
            strokeLinejoin="round"
          />
        ))}

        {/* Corona: esmalte con gradiente. */}
        <path
          d={corona}
          fill={`url(#${idEsmalte})`}
          stroke="#9ca3af"
          strokeWidth={1.1}
          strokeLinejoin="round"
        />

        {/* Tinte de estado sobre la corona, conservando el sombreado. */}
        {colorPieza && (
          <path d={corona} fill={colorPieza} fillOpacity={0.55} stroke="none" />
        )}

        {/* Brillo especular encima del tinte. */}
        <path d={corona} fill={`url(#${idBrillo})`} stroke="none" />
      </g>

      {/* Ausente: X roja gruesa (fuera del volteo para que se vea igual). */}
      {ausente && (
        <g stroke="#dc2626" strokeWidth={3.4} strokeLinecap="round" opacity={0.9}>
          <line x1="9" y1="9" x2="31" y2="43" />
          <line x1="31" y1="9" x2="9" y2="43" />
        </g>
      )}

      {/* Implante: tornillo/espiral gris sobre la raíz. */}
      {implante && (
        <g
          transform={transform}
          stroke="#64748b"
          strokeWidth={1.6}
          strokeLinecap="round"
          fill="none"
        >
          <line x1="20" y1="4" x2="20" y2="24" />
          <line x1="15" y1="7" x2="25" y2="9" />
          <line x1="15" y1="11" x2="25" y2="13" />
          <line x1="16" y1="15" x2="24" y2="17" />
          <line x1="17" y1="19" x2="23" y2="21" />
        </g>
      )}
    </svg>
  )
}

// Render con foto 3D real (PNG con fondo transparente). La corona de la imagen
// está arriba; para la arcada superior se voltea en Y (corona hacia el centro).
// El estado (color) tiñe SOLO la silueta del diente usando la imagen como máscara.
function DienteFoto({
  src,
  arriba,
  colorPieza,
  estado,
  size,
}: {
  src: string
  arriba: boolean
  colorPieza?: string
  estado?: string
  size: number
}) {
  const ausente = estado === 'ausente'
  const implante = estado === 'implante'
  // Superior: corona hacia abajo (voltear); inferior: corona hacia arriba (natural).
  const flip = arriba ? 'scaleY(-1)' : undefined
  const w = size
  const h = size * 1.3

  const mask: CSSProperties = {
    WebkitMaskImage: `url(${src})`,
    maskImage: `url(${src})`,
    WebkitMaskSize: 'contain',
    maskSize: 'contain',
    WebkitMaskRepeat: 'no-repeat',
    maskRepeat: 'no-repeat',
    WebkitMaskPosition: 'center',
    maskPosition: 'center',
  }

  return (
    <div className="relative" style={{ width: w, height: h }} aria-hidden="true">
      <img
        src={src}
        alt=""
        draggable={false}
        className="h-full w-full object-contain drop-shadow-sm"
        style={{ transform: flip }}
      />

      {/* Tinte de estado sobre la silueta del diente (multiplica el color). */}
      {colorPieza && (
        <span
          className="pointer-events-none absolute inset-0"
          style={{
            ...mask,
            backgroundColor: colorPieza,
            opacity: 0.5,
            mixBlendMode: 'multiply',
            transform: flip,
          }}
        />
      )}

      {/* Ausente: X roja. */}
      {ausente && (
        <svg viewBox="0 0 40 52" className="absolute inset-0 h-full w-full">
          <g stroke="#dc2626" strokeWidth={3.4} strokeLinecap="round" opacity={0.9}>
            <line x1="9" y1="9" x2="31" y2="43" />
            <line x1="31" y1="9" x2="9" y2="43" />
          </g>
        </svg>
      )}

      {/* Implante: tornillo gris sobre la raíz. */}
      {implante && (
        <svg viewBox="0 0 40 52" className="absolute inset-0 h-full w-full">
          <g
            transform={flip ? 'translate(0,52) scale(1,-1)' : undefined}
            stroke="#64748b"
            strokeWidth={1.6}
            strokeLinecap="round"
            fill="none"
          >
            <line x1="20" y1="34" x2="20" y2="50" />
            <line x1="15" y1="37" x2="25" y2="39" />
            <line x1="15" y1="41" x2="25" y2="43" />
            <line x1="16" y1="45" x2="24" y2="47" />
          </g>
        </svg>
      )}
    </div>
  )
}
