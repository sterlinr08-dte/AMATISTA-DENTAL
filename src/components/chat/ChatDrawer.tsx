import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { X, MessagesSquare, Maximize2 } from 'lucide-react'
import ChatWorkspace from './ChatWorkspace'
import { useAjustesChat, TAMANOS } from '../../lib/ajustesChat'

// Ventana flotante del chat (estilo Messenger): compacta, abajo a la derecha,
// encima de la pantalla actual. El tamaño se elige en Configuración → Chat.
export default function ChatDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate()
  const { tamano } = useAjustesChat()
  const s = TAMANOS[tamano] ?? TAMANOS.mediano

  useEffect(() => {
    if (!open) return
    const fn = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', fn)
    return () => document.removeEventListener('keydown', fn)
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <div
      className="animate-modal-panel fixed bottom-[86px] right-4 z-[55] flex flex-col overflow-hidden rounded-2xl bg-white ring-1 ring-amber-100 shadow-[0_28px_60px_-18px_rgba(120,90,10,0.55)]"
      style={{ width: `min(${s.w}px, 94vw)`, height: `min(${s.h}px, 78vh)` }}
    >
      <div className="flex items-center gap-2 border-b-2 border-[#9c7d18] bg-[linear-gradient(180deg,#e6c356,#c9a227_58%,#b8901f)] px-3 py-2">
        <MessagesSquare size={18} className="text-white" />
        <span className="flex-1 text-sm font-semibold tracking-wide text-white [text-shadow:0_1px_2px_rgba(120,90,10,0.45)]">Chat interno</span>
        <button onClick={() => { onClose(); navigate('/chat') }} title="Abrir en pantalla completa" className="rounded-lg p-1.5 text-white hover:bg-white/20"><Maximize2 size={16} /></button>
        <button onClick={onClose} title="Cerrar" className="rounded-lg p-1.5 text-white hover:bg-white/20"><X size={18} /></button>
      </div>
      <div className="min-h-0 flex-1">
        <ChatWorkspace enDrawer onAbrirCompleto={() => { onClose(); navigate('/chat') }} />
      </div>
    </div>,
    document.body,
  )
}
