import { ReactNode } from 'react'
import { X } from 'lucide-react'

interface ModalProps {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
}

export default function Modal({ open, title, onClose, children, footer }: ModalProps) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4 backdrop-blur-sm sm:items-center">
      <div className="w-full max-w-lg rounded-2xl bg-gradient-to-b from-white to-pink-50/40 ring-1 ring-pink-100/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_30px_60px_-15px_rgba(236,72,153,0.45)]">
        <div className="flex items-center justify-between border-b border-pink-100/70 px-5 py-4">
          <h2 className="font-display text-lg font-bold uppercase text-slate-800">{title}</h2>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-600 hover:bg-slate-100 hover:text-slate-600">
            <X size={20} />
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-4">{footer}</div>}
      </div>
    </div>
  )
}
