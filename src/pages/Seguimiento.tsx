import { useEffect, useMemo, useState } from 'react'
import { ClipboardCheck, CheckCircle2, Circle, Ban } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { Cliente, Presupuesto, PresupuestoItem, EstadoPresupuestoItem } from '../types'
import { money, fechaCorta } from '../lib/format'
import { estadoPresupuestoDef } from '../lib/dental'
import PageHeader from '../components/PageHeader'
import Cargando from '../components/Cargando'
import Modal from '../components/Modal'
import DataTable from '../components/DataTable'
import type { Columna } from '../components/DataTable'

// Estados de cada tratamiento dentro del plan.
const ESTADOS_ITEM: { value: EstadoPresupuestoItem; label: string }[] = [
  { value: 'PENDIENTE', label: 'Pendiente' },
  { value: 'APROBADO', label: 'Aprobado' },
  { value: 'REALIZADO', label: 'Realizado' },
  { value: 'CANCELADO', label: 'No se realizará' },
]

// Código de plan: P + 4 dígitos
function codigoPlan(codigo: number | null | undefined): string {
  return 'P' + String(codigo ?? 0).padStart(4, '0')
}

// Avance de un plan: realizados / total.
interface Avance {
  realizados: number
  total: number
  pct: number
}

function calcularAvance(items: PresupuestoItem[]): Avance {
  // Los cancelados ("No se realizará") no cuentan para el avance.
  const cuentan = items.filter((it) => it.estado !== 'CANCELADO')
  const total = cuentan.length
  const realizados = cuentan.filter((it) => it.estado === 'REALIZADO').length
  const pct = total === 0 ? 0 : Math.round((realizados / total) * 100)
  return { realizados, total, pct }
}

// Barra de progreso dorada reutilizable.
function BarraAvance({ avance }: { avance: Avance }) {
  return (
    <div>
      <div className="flex items-center justify-between text-xs font-medium text-slate-600">
        <span>{avance.realizados} de {avance.total} realizados</span>
        <span className="text-amber-600">{avance.pct}%</span>
      </div>
      <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-amber-400 transition-all"
          style={{ width: `${avance.pct}%` }}
        />
      </div>
    </div>
  )
}

export default function Seguimiento() {
  const [planes, setPlanes] = useState<Presupuesto[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  // Todos los items de los planes cargados, indexados por presupuesto_id.
  const [itemsPorPlan, setItemsPorPlan] = useState<Record<string, PresupuestoItem[]>>({})
  const [loading, setLoading] = useState(true)

  // Detalle del plan seleccionado.
  const [open, setOpen] = useState(false)
  const [planSel, setPlanSel] = useState<Presupuesto | null>(null)
  const [guardando, setGuardando] = useState<string | null>(null)

  async function cargar() {
    setLoading(true)
    const [{ data: pls }, { data: cls }] = await Promise.all([
      supabase
        .from('presupuestos')
        .select('*')
        .in('estado', ['BORRADOR', 'PRESENTADO', 'APROBADO', 'FACTURADO'])
        .order('codigo', { ascending: false }),
      supabase.from('clientes').select('*').order('nombre'),
    ])
    const listaPlanes = (pls as Presupuesto[]) ?? []
    setPlanes(listaPlanes)
    setClientes((cls as Cliente[]) ?? [])

    // Cargar de una vez los tratamientos de todos los planes visibles.
    const ids = listaPlanes.map((p) => p.id)
    if (ids.length > 0) {
      const { data: its } = await supabase
        .from('presupuesto_items')
        .select('*')
        .in('presupuesto_id', ids)
        .order('id')
      const mapa: Record<string, PresupuestoItem[]> = {}
      for (const it of (its as PresupuestoItem[]) ?? []) {
        ;(mapa[it.presupuesto_id] ??= []).push(it)
      }
      setItemsPorPlan(mapa)
    } else {
      setItemsPorPlan({})
    }
    setLoading(false)
  }

  useEffect(() => {
    cargar()
  }, [])

  function nombreCliente(id: string | null): string {
    if (!id) return 'Sin paciente'
    return clientes.find((c) => c.id === id)?.nombre ?? 'Paciente'
  }

  function avanceDe(planId: string): Avance {
    return calcularAvance(itemsPorPlan[planId] ?? [])
  }

  function abrirDetalle(p: Presupuesto) {
    setPlanSel(p)
    setOpen(true)
  }

  // Cambiar el estado de un tratamiento y refrescar el avance.
  async function cambiarEstadoItem(itemId: string, planId: string, estado: EstadoPresupuestoItem) {
    setGuardando(itemId)
    const { error } = await supabase.from('presupuesto_items').update({ estado }).eq('id', itemId)
    setGuardando(null)
    if (error) {
      alert('Error al actualizar el tratamiento: ' + error.message)
      return
    }
    // Actualizar el estado local del item para recalcular el avance sin recargar todo.
    setItemsPorPlan((prev) => {
      const lista = (prev[planId] ?? []).map((it) => (it.id === itemId ? { ...it, estado } : it))
      return { ...prev, [planId]: lista }
    })
  }

  const itemsSel = planSel ? itemsPorPlan[planSel.id] ?? [] : []
  const avanceSel = useMemo(() => calcularAvance(itemsSel), [itemsSel])

  const columnas: Columna<Presupuesto>[] = [
    { header: 'Código', cell: (p) => <span className="font-mono font-semibold text-slate-700">{codigoPlan(p.codigo)}</span>, sortValue: (p) => p.codigo },
    { header: 'Paciente', cell: (p) => <span className="font-medium text-slate-800">{nombreCliente(p.cliente_id)}</span>, sortValue: (p) => nombreCliente(p.cliente_id) },
    { header: 'Fecha', cell: (p) => <span className="text-slate-600">{fechaCorta(p.fecha)}</span>, sortValue: (p) => p.fecha },
    { header: 'Estado', cell: (p) => <span className={`badge ${estadoPresupuestoDef(p.estado).color}`}>{estadoPresupuestoDef(p.estado).label}</span>, sortValue: (p) => p.estado },
    { header: 'Total', align: 'right', cell: (p) => <span className="font-semibold text-slate-800">{money(p.total)}</span>, sortValue: (p) => p.total },
    {
      header: 'Avance',
      cell: (p) => <div className="min-w-[160px]"><BarraAvance avance={avanceDe(p.id)} /></div>,
      sortValue: (p) => avanceDe(p.id).pct,
    },
  ]

  return (
    <div>
      <PageHeader
        title="Seguimiento de planes"
        subtitle={`${planes.length} plan(es) en curso`}
      />

      {loading ? (
        <Cargando />
      ) : (
        <DataTable
          rows={planes}
          rowKey={(p) => p.id}
          columns={columnas}
          onRowClick={abrirDetalle}
          searchText={(p) => `${codigoPlan(p.codigo)} ${nombreCliente(p.cliente_id)} ${p.estado}`}
          searchPlaceholder="Buscar por paciente o código…"
          emptyText="No hay planes en seguimiento."
          initialSort={{ index: 0, dir: 'desc' }}
        />
      )}

      {/* MODAL detalle / avance del plan */}
      <Modal
        open={open}
        title={planSel ? `Plan ${codigoPlan(planSel.codigo)} — ${nombreCliente(planSel.cliente_id)}` : 'Plan'}
        onClose={() => setOpen(false)}
        footer={<button className="btn-ghost" onClick={() => setOpen(false)}>Cerrar</button>}
      >
        {planSel && (
          <div className="space-y-4">
            {/* Avance recalculado */}
            <div className="card p-3">
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700">
                <ClipboardCheck size={16} className="text-amber-500" /> Avance del plan
              </div>
              <BarraAvance avance={avanceSel} />
            </div>

            {/* Tratamientos con selector de estado */}
            <div>
              <span className="label">Tratamientos</span>
              {itemsSel.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-6 text-center text-sm text-slate-600">
                  Este plan no tiene tratamientos.
                </div>
              ) : (
                <div className="space-y-2">
                  {itemsSel.map((it) => {
                    const realizado = it.estado === 'REALIZADO'
                    const cancelado = it.estado === 'CANCELADO'
                    return (
                      <div key={it.id} className={`flex items-start gap-3 rounded-xl border-2 p-3 shadow-sm ${cancelado ? 'border-slate-200 bg-slate-50' : 'border-slate-200 bg-white'}`}>
                        <div className="mt-0.5 shrink-0">
                          {realizado
                            ? <CheckCircle2 size={18} className="text-amber-500" />
                            : cancelado
                              ? <Ban size={18} className="text-slate-400" />
                              : <Circle size={18} className="text-slate-300" />}
                        </div>
                        <div className="flex-1">
                          <div className={`text-sm font-medium ${cancelado ? 'text-slate-400 line-through' : 'text-slate-800'}`}>{it.descripcion}</div>
                          <div className="mt-0.5 text-xs text-slate-500">
                            {it.diente != null && <span className="mr-2">Diente {it.diente}</span>}
                            <span className={cancelado ? 'line-through' : ''}>{money(it.precio_unit)}</span>
                          </div>
                        </div>
                        <select
                          className="input w-36"
                          value={it.estado}
                          disabled={guardando === it.id}
                          onChange={(e) => cambiarEstadoItem(it.id, planSel.id, e.target.value as EstadoPresupuestoItem)}
                        >
                          {ESTADOS_ITEM.map((s) => (
                            <option key={s.value} value={s.value}>{s.label}</option>
                          ))}
                        </select>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
