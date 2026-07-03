import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { X, MessagesSquare } from 'lucide-react'
import ChatWorkspace from './ChatWorkspace'

// Panel deslizante con el chat completo, encima de la pantalla actual.
export default function ChatDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate()

  // Cerrar con Escape.
  useEffect(() => {
    if (!open) return
    const fn = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', fn)
    return () => document.removeEventListener('keydown', fn)
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-[55]">
      <div className="animate-modal-fondo absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className="animate-drawer absolute inset-y-0 right-0 flex w-full max-w-md flex-col bg-white shadow-[-16px_0_50px_-20px_rgba(120,90,10,0.5)]">
        <div className="flex items-center gap-2 border-b-2 border-[#9c7d18] bg-[linear-gradient(180deg,#e6c356,#c9a227_58%,#b8901f)] px-4 py-2.5">
          <MessagesSquare size={20} className="text-white" />
          <span className="flex-1 text-base font-semibold tracking-wide text-white [text-shadow:0_1px_2px_rgba(120,90,10,0.45)]">Chat interno</span>
          <button onClick={onClose} className="rounded-lg p-1.5 text-white hover:bg-white/20" aria-label="Cerrar chat"><X size={20} /></button>
        </div>
        <div className="min-h-0 flex-1">
          <ChatWorkspace enDrawer onAbrirCompleto={() => { onClose(); navigate('/chat') }} />
        </div>
      </div>
    </div>,
    document.body,
  )
}
