import { useEffect, useRef, useState } from 'react'
import { Search, X } from 'lucide-react'
import { Cliente } from '../types'
import { codigoCliente } from '../lib/format'
import Modal from './Modal'

interface Props {
  clientes: Cliente[]
  value: string
  onChange: (id: string) => void
  placeholder?: string
}

// Buscador de paciente: un solo campo con lupa. Al escribir salen los resultados
// debajo; al hacer clic en la LUPA se abre una subventana (modal) con un buscador
// grande y la lista completa de pacientes.
export default function SelectorPaciente({ clientes, value, onChange, placeholder = 'Buscar paciente…' }: Props) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [modal, setModal] = useState(false)
  const [mq, setMq] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const sel = clientes.find((c) => c.id === value) || null

  function filtrar(termino: string) {
    const t = termino.trim().toLowerCase()
    return t
      ? clientes.filter((c) =>
          `${codigoCliente(c.codigo)} ${c.nombre} ${c.telefono ?? ''}`.toLowerCase().includes(t),
        )
      : clientes
  }

  const filtrados = filtrar(q)
  const lista = filtrados.slice(0, 50)
  const textoInput = open ? q : sel ? `${codigoCliente(sel.codigo)} · ${sel.nombre}` : ''

  function elegir(id: string) {
    onChange(id)
    setOpen(false)
    setModal(false)
    setQ('')
    setMq('')
  }

  function abrirModal() {
    setMq('')
    setModal(true)
    setOpen(false)
  }

  const listaModal = filtrar(mq)

  return (
    <div className="relative" ref={ref}>
      <div className="relative">
        <button
          type="button"
          onClick={abrirModal}
          title="Abrir buscador de pacientes"
          className="absolute left-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-amber-500 transition hover:bg-amber-50 hover:text-amber-600"
        >
          <Search size={16} />
        </button>
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

      {/* Resultados rápidos en línea */}
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

      {/* Subventana (modal) de búsqueda */}
      <Modal
        open={modal}
        title="Buscar paciente"
        onClose={() => setModal(false)}
        footer={<button className="btn-ghost" onClick={() => setModal(false)}>Cerrar</button>}
      >
        <div className="space-y-3">
          <div className="relative">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-amber-500" />
            <input
              autoFocus
              className="input pl-9"
              placeholder="Escribe nombre, código o teléfono…"
              value={mq}
              onChange={(e) => setMq(e.target.value)}
            />
          </div>
          <div className="max-h-80 divide-y divide-slate-50 overflow-y-auto rounded-xl border border-slate-100">
            {listaModal.length === 0 ? (
              <p className="px-3 py-8 text-center text-sm text-slate-400">Sin pacientes que coincidan</p>
            ) : (
              listaModal.slice(0, 200).map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => elegir(c.id)}
                  className={`flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-sm hover:bg-amber-50 ${
                    c.id === value ? 'bg-amber-50 font-semibold text-amber-800' : 'text-slate-700'
                  }`}
                >
                  <span className="flex items-center gap-2 truncate">
                    <span className="font-mono text-xs text-slate-400">{codigoCliente(c.codigo)}</span>
                    <span className="truncate">{c.nombre}</span>
                  </span>
                  {c.telefono && <span className="shrink-0 text-xs text-slate-400">{c.telefono}</span>}
                </button>
              ))
            )}
          </div>
        </div>
      </Modal>
    </div>
  )
}
