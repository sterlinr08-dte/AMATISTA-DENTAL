import { ReactNode, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

interface ModalProps {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
}

// Contador de modales abiertos: permite modales anidados (una subventana
// dentro de un formulario) sin que al cerrar una se pierda el efecto de la otra.
let abiertos = 0

export default function Modal({ open, title, onClose, children, footer }: ModalProps) {
  // Mientras haya una subventana abierta, el contenido de fondo (la ficha)
  // se desliza un poco a la izquierda (ver `.contenido-principal` en index.css).
  useEffect(() => {
    if (!open) return
    abiertos += 1
    document.body.classList.add('modal-abierto')
    return () => {
      abiertos -= 1
      if (abiertos <= 0) {
        abiertos = 0
        document.body.classList.remove('modal-abierto')
      }
    }
  }, [open])

  if (!open) return null

  // Se renderiza con portal en <body> para que `position: fixed` se posicione
  // respecto a la pantalla y NO respecto al contenido de fondo (que está
  // desplazado con transform; un ancestro con transform rompería el fixed).
  return createPortal(
    <div className="animate-modal-fondo fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4 backdrop-blur-sm sm:items-center">
      <div className="animate-modal-panel w-full max-w-2xl rounded-2xl bg-white ring-1 ring-amber-100 shadow-[0_28px_60px_-18px_rgba(201,162,39,0.38)]">
        <div className="flex items-center justify-between border-b border-amber-100 px-5 py-4">
          <h2 className="font-display text-lg font-bold text-slate-800">{title}</h2>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-600 hover:bg-slate-100 hover:text-slate-600">
            <X size={20} />
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-4">{footer}</div>}
      </div>
    </div>,
    document.body,
  )
}
