import { useEffect, useRef, useState } from 'react'
import { Search, X } from 'lucide-react'
import { Cliente } from '../types'
import { codigoCliente } from '../lib/format'

interface Props {
  clientes: Cliente[]
  value: string
  onChange: (id: string) => void
  placeholder?: string
}

// Buscador de paciente (un solo campo): escribes en el input con lupa y abajo
// aparecen los resultados; al elegir uno queda mostrado en el mismo campo.
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

  // Texto mostrado: mientras está abierto se ve lo que escribes; cerrado, el paciente elegido.
  const textoInput = open ? q : sel ? `${codigoCliente(sel.codigo)} · ${sel.nombre}` : ''

  function elegir(id: string) {
    onChange(id)
    setOpen(false)
    setQ('')
  }

  return (
    <div className="relative" ref={ref}>
      <div className="relative">
        <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-amber-500" />
        <input
          className="input pl-9 pr-8"
          value={textoInput}
          placeholder={placeholder}
          onFocus={() => {
            setOpen(true)
            setQ('')
          }}
          onChange={(e) => {
            setQ(e.target.value)
            setOpen(true)
          }}
        />
        {sel && !open && (
          <button
            type="button"
            onClick={() => elegir('')}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-400 hover:text-rose-500"
            title="Quitar"
          >
            <X size={15} />
          </button>
        )}
      </div>

      {open && (
        <div className="absolute z-30 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-amber-100 bg-white py-1 shadow-xl">
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
      )}
    </div>
  )
}
