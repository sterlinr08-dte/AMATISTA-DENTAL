import { MessagesSquare } from 'lucide-react'
import { useChatNoLeidos } from '../../lib/useChatNoLeidos'

// Burbuja flotante de acceso rápido al chat (esquina inferior derecha).
export function BurbujaChat({ onClick }: { onClick: () => void }) {
  const n = useChatNoLeidos()
  return (
    <button
      onClick={onClick}
      aria-label="Abrir chat"
      className="fixed bottom-5 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-b from-[#e6b93c] to-[#c9a227] text-white shadow-[0_12px_28px_-8px_rgba(176,141,28,0.75),inset_0_1px_0_rgba(255,255,255,0.5)] ring-1 ring-[#9c7d18] transition hover:-translate-y-0.5 hover:shadow-[0_16px_34px_-8px_rgba(176,141,28,0.85)]"
    >
      <MessagesSquare size={24} />
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
