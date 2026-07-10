import { useEffect, useState } from 'react'

// Señal global y ligera: alguna pantalla (ej. Nueva venta) está ocupando toda
// la vista en móvil y no quiere que la burbuja de chat flote encima de sus
// campos o botones.
let abierta = false
const listeners = new Set<() => void>()

export function setPantallaCompletaAbierta(v: boolean) {
  if (abierta === v) return
  abierta = v
  listeners.forEach((l) => l())
}

export function usePantallaCompletaAbierta(): boolean {
  const [v, setV] = useState(abierta)
  useEffect(() => {
    const l = () => setV(abierta)
    listeners.add(l)
    return () => { listeners.delete(l) }
  }, [])
  return v
}
