import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

// Paginación de listas "de 10 en 10" (reutilizable). Mantiene el mismo estilo
// que la tabla (DataTable): botones anterior/siguiente + números con elipsis.
export function usePaginacion<T>(rows: T[], pageSize = 10) {
  const [pagina, setPagina] = useState(1)
  const total = rows.length
  const totalPaginas = Math.max(1, Math.ceil(total / pageSize))

  // Si cambia la cantidad de filas, no quedarse en una página inexistente.
  useEffect(() => {
    setPagina((p) => Math.min(p, totalPaginas))
  }, [totalPaginas])

  const paginaActual = Math.min(pagina, totalPaginas)
  const desde = total === 0 ? 0 : (paginaActual - 1) * pageSize
  const visibles = useMemo(() => rows.slice(desde, desde + pageSize), [rows, desde, pageSize])

  return { visibles, pagina: paginaActual, setPagina, totalPaginas, total, desde, pageSize }
}

interface Props {
  pagina: number
  totalPaginas: number
  total: number
  desde: number
  pageSize: number
  onPagina: (n: number) => void
}

export default function Paginacion({ pagina, totalPaginas, total, desde, pageSize, onPagina }: Props) {
  if (total === 0) return null

  const paginas: (number | '…')[] = []
  for (let i = 1; i <= totalPaginas; i++) {
    if (i === 1 || i === totalPaginas || Math.abs(i - pagina) <= 1) paginas.push(i)
    else if (paginas[paginas.length - 1] !== '…') paginas.push('…')
  }

  return (
    <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-500">
      <span>Mostrando {desde + 1} a {Math.min(desde + pageSize, total)} de {total}</span>
      {totalPaginas > 1 && (
        <div className="flex items-center gap-1">
          <button
            onClick={() => onPagina(Math.max(1, pagina - 1))}
            disabled={pagina === 1}
            aria-label="Anterior"
            className="rounded-lg border border-slate-200 p-1.5 hover:bg-slate-50 disabled:opacity-40"
          >
            <ChevronLeft size={16} />
          </button>
          {paginas.map((p, idx) =>
            p === '…' ? (
              <span key={`e${idx}`} className="px-2 text-slate-600">…</span>
            ) : (
              <button
                key={p}
                onClick={() => onPagina(p)}
                className={`min-w-[34px] rounded-lg border px-2 py-1.5 text-center font-medium ${p === pagina ? 'border-brand-500 bg-brand-600 text-white' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}
              >
                {p}
              </button>
            ),
          )}
          <button
            onClick={() => onPagina(Math.min(totalPaginas, pagina + 1))}
            disabled={pagina === totalPaginas}
            aria-label="Siguiente"
            className="rounded-lg border border-slate-200 p-1.5 hover:bg-slate-50 disabled:opacity-40"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      )}
    </div>
  )
}
