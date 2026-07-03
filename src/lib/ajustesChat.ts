import { useEffect, useState } from 'react'

// Preferencias del chat guardadas en ESTE dispositivo (no en la base).
export type TamanoChat = 'compacto' | 'mediano' | 'grande'

export interface AjustesChat {
  tamano: TamanoChat
  burbuja: boolean   // mostrar la burbuja flotante
  sonido: boolean    // sonido al llegar un aviso
}

export const TAMANOS: Record<TamanoChat, { label: string; w: number; h: number }> = {
  compacto: { label: 'Compacto', w: 320, h: 440 },
  mediano: { label: 'Mediano', w: 384, h: 560 },
  grande: { label: 'Grande', w: 440, h: 660 },
}

const KEY = 'amatista_chat_ajustes'
const DEFAULT: AjustesChat = { tamano: 'mediano', burbuja: true, sonido: true }

export function leerAjustesChat(): AjustesChat {
  try { return { ...DEFAULT, ...JSON.parse(localStorage.getItem(KEY) || '{}') } } catch { return DEFAULT }
}

export function guardarAjustesChat(a: AjustesChat) {
  localStorage.setItem(KEY, JSON.stringify(a))
  window.dispatchEvent(new Event('ajustes-chat'))
}

// Hook reactivo: se actualiza cuando cambian los ajustes (misma o otra pestaña).
export function useAjustesChat(): AjustesChat {
  const [a, setA] = useState<AjustesChat>(leerAjustesChat)
  useEffect(() => {
    const fn = () => setA(leerAjustesChat())
    window.addEventListener('ajustes-chat', fn)
    window.addEventListener('storage', fn)
    return () => { window.removeEventListener('ajustes-chat', fn); window.removeEventListener('storage', fn) }
  }, [])
  return a
}
