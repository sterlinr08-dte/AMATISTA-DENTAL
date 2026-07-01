import { useEffect, useRef, useState } from 'react'
import { Search, ChevronDown, X } from 'lucide-react'
import { Cliente } from '../types'
import { codigoCliente } from '../lib/format'

interface Props {
  clientes: Cliente[]
  value: string
  onChange: (id: string) => void
  placeholder?: string
}

// Buscador de paciente: input con lupa; al hacer clic se abre la lista con su
// propio buscador (nombre, código o teléfono). Reemplaza el <select> nativo.
export default function SelectorPaciente({ clientes, value, onChange, placeholder = 'Buscar paciente…' }: Props) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const sel = clientes.find((c) => c.id === value) || null
  const term = q.trim().toLowerCase()
  const filtrados = term
    ? clientes.filter((c) =>
        `${codigoCliente(c.codigo)} ${c.nombre} ${c.telefono ?? ''}`.toLowerCase().includes(term),
      )
    : clientes
  const lista = filtrados.slice(0, 50)

  function elegir(id: string) {
    onChange(id)
    setOpen(false)
    setQ('')
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="input flex w-full items-center gap-2 text-left"
      >
        <Search size={16} className="shrink-0 text-amber-500" />
        <span className={`flex-1 truncate ${sel ? 'text-slate-800' : 'text-slate-400'}`}>
          {sel ? `${codigoCliente(sel.codigo)} · ${sel.nombre}` : placeholder}
        </span>
        {sel && (
          <span
            role="button"
            onClick={(e) => {
              e.stopPropagation()
              elegir('')
            }}
            className="rounded p-0.5 text-slate-400 hover:text-rose-500"
            title="Quitar"
          >
            <X size={15} />
          </span>
        )}
        <ChevronDown size={16} className="shrink-0 text-slate-400" />
      </button>

      {open && (
        <div className="absolute z-30 mt-1 w-full overflow-hidden rounded-xl border border-amber-100 bg-white shadow-xl">
          <div className="border-b border-slate-100 p-2">
            <div className="relative">
              <Search size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                autoFocus
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Escribe nombre, código o teléfono…"
                className="w-full rounded-lg border border-slate-200 py-1.5 pl-8 pr-2 text-sm focus:border-amber-300 focus:outline-none"
              />
            </div>
          </div>
          <div className="max-h-64 overflow-y-auto py-1">
            {lista.length === 0 ? (
              <p className="px-3 py-3 text-center text-sm text-slate-400">Sin pacientes</p>
            ) : (
              lista.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => elegir(c.id)}
                  className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-amber-50 ${
                    c.id === value ? 'bg-amber-50 font-semibold text-amber-800' : 'text-slate-700'
                  }`}
                >
                  <span className="font-mono text-xs text-slate-400">{codigoCliente(c.codigo)}</span>
                  <span className="truncate">{c.nombre}</span>
                </button>
              ))
            )}
            {filtrados.length > lista.length && (
              <p className="px-3 py-1.5 text-center text-xs text-slate-400">
                Mostrando {lista.length} de {filtrados.length}. Escribe para afinar.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
