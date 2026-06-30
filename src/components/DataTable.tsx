import { useMemo, useState, useEffect, useRef, ReactNode } from 'react'
import { Search, ArrowUp, ArrowDown, ChevronsUpDown, ChevronLeft, ChevronRight } from 'lucide-react'

export interface Columna<T> {
  /** Texto del encabezado */
  header: string
  /** Contenido de la celda */
  cell: (row: T) => ReactNode
  /** Valor para ordenar (y desempatar). Si se omite, la columna no es ordenable */
  sortValue?: (row: T) => string | number
  align?: 'left' | 'right' | 'center'
  headerClassName?: string
  cellClassName?: string
}

interface Props<T> {
  columns: Columna<T>[]
  rows: T[]
  rowKey: (row: T) => string
  /** Texto concatenado por fila para la búsqueda global */
  searchText?: (row: T) => string
  onRowClick?: (row: T) => void
  pageSize?: number
  searchPlaceholder?: string
  /** Contenido extra a la izquierda de la barra de búsqueda (ej. pestañas) */
  toolbar?: ReactNode
  emptyText?: string
  initialSort?: { index: number; dir: 'asc' | 'desc' }
}

const alineacion = { left: 'text-left', right: 'text-right', center: 'text-center' } as const

export default function DataTable<T>({
  columns,
  rows,
  rowKey,
  searchText,
  onRowClick,
  pageSize = 10,
  searchPlaceholder = 'Buscar…',
  toolbar,
  emptyText = 'Sin registros',
  initialSort,
}: Props<T>) {
  const [busqueda, setBusqueda] = useState('')
  const [sort, setSort] = useState<{ index: number; dir: 'asc' | 'desc' } | null>(initialSort ?? null)
  const [pagina, setPagina] = useState(1)
  const inputBusqueda = useRef<HTMLInputElement>(null)

  // Filtrado por búsqueda global
  const filtradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    if (!q || !searchText) return rows
    return rows.filter((r) => searchText(r).toLowerCase().includes(q))
  }, [rows, busqueda, searchText])

  // Ordenamiento
  const ordenadas = useMemo(() => {
    if (!sort) return filtradas
    const col = columns[sort.index]
    if (!col?.sortValue) return filtradas
    const factor = sort.dir === 'asc' ? 1 : -1
    return [...filtradas].sort((a, b) => {
      const va = col.sortValue!(a)
      const vb = col.sortValue!(b)
      if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * factor
      return String(va).localeCompare(String(vb), 'es', { numeric: true }) * factor
    })
  }, [filtradas, sort, columns])

  const total = ordenadas.length
  const totalPaginas = Math.max(1, Math.ceil(total / pageSize))

  // Si cambia el filtro/orden, volver a la primera página
  useEffect(() => { setPagina(1) }, [busqueda, sort, rows])
  const paginaActual = Math.min(pagina, totalPaginas)
  const desde = total === 0 ? 0 : (paginaActual - 1) * pageSize
  const visibles = ordenadas.slice(desde, desde + pageSize)

  function ordenarPor(index: number) {
    if (!columns[index]?.sortValue) return
    setSort((s) =>
      s && s.index === index ? { index, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { index, dir: 'asc' },
    )
  }

  // Números de página a mostrar (con elipsis)
  const paginas: (number | '…')[] = []
  for (let i = 1; i <= totalPaginas; i++) {
    if (i === 1 || i === totalPaginas || Math.abs(i - paginaActual) <= 1) paginas.push(i)
    else if (paginas[paginas.length - 1] !== '…') paginas.push('…')
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>{toolbar}</div>
        <div className="relative w-full max-w-xs">
          <button
            type="button"
            onClick={() => inputBusqueda.current?.focus()}
            aria-label="Buscar"
            className="absolute left-1 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-slate-600 transition hover:text-brand-600"
          >
            <Search size={16} />
          </button>
          <input ref={inputBusqueda} className="input pl-9" placeholder={searchPlaceholder} value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
        </div>
      </div>

      <div className="overflow-x-auto panel-3d">
        <table className="min-w-full divide-y divide-slate-100 text-sm">
          <thead className="thead-3d">
            <tr>
              {columns.map((c, i) => (
                <th
                  key={i}
                  className={`px-5 py-3 ${alineacion[c.align ?? 'left']} ${c.sortValue ? 'cursor-pointer select-none' : ''} ${c.headerClassName ?? ''}`}
                  onClick={() => ordenarPor(i)}
                >
                  <span className={`inline-flex items-center gap-1 ${c.align === 'right' ? 'flex-row-reverse' : ''}`}>
                    {c.header}
                    {c.sortValue && (
                      sort?.index === i
                        ? (sort.dir === 'asc' ? <ArrowUp size={13} /> : <ArrowDown size={13} />)
                        : <ChevronsUpDown size={13} className="text-slate-500" />
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {visibles.length === 0 ? (
              <tr><td colSpan={columns.length} className="px-5 py-8 text-center text-slate-600">{emptyText}</td></tr>
            ) : (
              visibles.map((row) => (
                <tr
                  key={rowKey(row)}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={onRowClick ? 'cursor-pointer hover:bg-pink-50/50' : ''}
                >
                  {columns.map((c, i) => (
                    <td key={i} className={`px-5 py-3 ${alineacion[c.align ?? 'left']} ${c.cellClassName ?? ''}`}>{c.cell(row)}</td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-slate-500">
        <span>{total === 0 ? 'Sin resultados' : `Mostrando ${desde + 1} a ${Math.min(desde + pageSize, total)} de ${total}`}</span>
        {totalPaginas > 1 && (
          <div className="flex items-center gap-1">
            <button onClick={() => setPagina(Math.max(1, paginaActual - 1))} disabled={paginaActual === 1} className="rounded-lg border border-slate-200 p-1.5 disabled:opacity-40 hover:bg-slate-50">
              <ChevronLeft size={16} />
            </button>
            {paginas.map((p, idx) =>
              p === '…' ? (
                <span key={`e${idx}`} className="px-2 text-slate-600">…</span>
              ) : (
                <button
                  key={p}
                  onClick={() => setPagina(p)}
                  className={`min-w-[34px] rounded-lg border px-2 py-1.5 text-center font-medium ${p === paginaActual ? 'border-brand-500 bg-brand-600 text-white' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                >
                  {p}
                </button>
              ),
            )}
            <button onClick={() => setPagina(Math.min(totalPaginas, paginaActual + 1))} disabled={paginaActual === totalPaginas} className="rounded-lg border border-slate-200 p-1.5 disabled:opacity-40 hover:bg-slate-50">
              <ChevronRight size={16} />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
