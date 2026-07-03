import { MessageCircle, MessagesSquare } from 'lucide-react'
import { useChatNoLeidos } from '../../lib/useChatNoLeidos'

// Burbuja flotante de acceso rápido al chat (esquina inferior derecha).
// Estilo: dorado con anillo que "late" + punto verde de "en línea".
export function BurbujaChat({ onClick }: { onClick: () => void }) {
  const n = useChatNoLeidos()
  return (
    <button
      onClick={onClick}
      aria-label="Abrir chat"
      className="group fixed bottom-5 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-[#f2d873] via-[#c9a227] to-[#b8901f] text-white shadow-[0_12px_28px_-8px_rgba(176,141,28,0.75),inset_0_1px_0_rgba(255,255,255,0.55)] ring-1 ring-[#9c7d18] transition hover:-translate-y-0.5 hover:shadow-[0_16px_34px_-8px_rgba(176,141,28,0.9)]"
    >
      {/* Anillo que late */}
      <span className="pointer-events-none absolute inset-0 rounded-full border-2 border-[#c9a227]/60 animate-ping" />
      <MessageCircle size={25} className="relative" />
      {/* Punto verde: chat activo / en línea */}
      <span className="absolute bottom-1 right-1 h-3.5 w-3.5 rounded-full bg-emerald-500 ring-2 ring-white" />
      {n > 0 && (
        <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-[11px] font-bold text-white ring-2 ring-white">
          {n > 99 ? '99+' : n}
        </span>
      )}
    </button>
  )
}

// Ícono de chat para la barra superior (junto a la campana).
export function IconoChatHeader({ onClick }: { onClick: () => void }) {
  const n = useChatNoLeidos()
  return (
    <button onClick={onClick} aria-label="Abrir chat" className="relative rounded-lg p-1.5 text-white hover:bg-white/20">
      <MessagesSquare size={22} />
      {n > 0 && (
        <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white ring-2 ring-[#c9a227]">
          {n > 9 ? '9+' : n}
        </span>
      )}
    </button>
  )
}
