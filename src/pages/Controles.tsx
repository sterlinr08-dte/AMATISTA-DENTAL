import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Trash2, MessageCircle, Check, CalendarPlus, BellRing, Phone } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { Cliente, Control } from '../types'
import { fechaCorta, hoyISO } from '../lib/format'
import { useNegocio } from '../lib/negocio'
import { TIPOS_CONTROL, labelControl, mesesControl, ESTADO_CONTROL, mensajeControl } from '../lib/controles'
import { linkWhatsApp } from '../lib/mensajeria'
import PageHeader from '../components/PageHeader'
import Cargando from '../components/Cargando'
import Modal from '../components/Modal'
import SelectorPaciente from '../components/SelectorPaciente'

type ControlConCliente = Control & { cliente: Pick<Cliente, 'id' | 'nombre' | 'telefono'> | null }

// Suma meses a una fecha ISO (YYYY-MM-DD) y devuelve ISO local.
function sumarMeses(iso: string, meses: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const base = new Date(y, m - 1 + meses, d)
  const off = base.getTimezoneOffset()
  return new Date(base.getTime() - off * 60000).toISOString().slice(0, 10)
}

export default function Controles() {
  const { negocio } = useNegocio()
  const [items, setItems] = useState<ControlConCliente[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState<'contactar' | 'proximos' | 'todos'>('contactar')

  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ cliente_id: '', tipo: 'limpieza', fecha_programada: sumarMeses(hoyISO(), 6), motivo: '' })
  const [saving, setSaving] = useState(false)

  async function cargar() {
    setLoading(true)
    const [{ data }, { data: cls }] = await Promise.all([
      supabase.from('controles').select('*, cliente:clientes(id,nombre,telefono)').order('fecha_programada'),
      supabase.from('clientes').select('*').order('nombre'),
    ])
    setItems((data as ControlConCliente[]) ?? [])
    setClientes(cls ?? [])
    setLoading(false)
  }
  useEffect(() => { cargar() }, [])

  const hoy = hoyISO()
  const visibles = useMemo(() => {
    const activos = items.filter((c) => c.estado !== 'COMPLETADO')
    if (filtro === 'contactar') return activos.filter((c) => c.fecha_programada <= hoy && c.estado === 'PENDIENTE')
    if (filtro === 'proximos') return activos.filter((c) => c.fecha_programada > hoy)
    return items
  }, [items, filtro, hoy])

  const nPorContactar = items.filter((c) => c.estado === 'PENDIENTE' && c.fecha_programada <= hoy).length

  function nuevo() {
    setForm({ cliente_id: '', tipo: 'limpieza', fecha_programada: sumarMeses(hoyISO(), 6), motivo: '' })
    setOpen(true)
  }
  function elegirTipo(t: string) {
    setForm((f) => ({ ...f, tipo: t, fecha_programada: sumarMeses(hoyISO(), mesesControl(t)) }))
  }
  async function guardar() {
    if (!form.cliente_id) return alert('Selecciona el paciente.')
    setSaving(true)
    const { error } = await supabase.from('controles').insert({
      cliente_id: form.cliente_id, tipo: form.tipo, fecha_programada: form.fecha_programada, motivo: form.motivo || null,
    })
    setSaving(false)
    if (error) return alert('Error al guardar: ' + error.message)
    setOpen(false)
    cargar()
  }

  async function marcar(c: ControlConCliente, estado: Control['estado']) {
    const patch: any = { estado }
    if (estado === 'CONTACTADO') patch.contactado_at = new Date().toISOString()
    await supabase.from('controles').update(patch).eq('id', c.id)
    cargar()
  }
  function recordarWhatsApp(c: ControlConCliente) {
    if (!c.cliente?.telefono) return alert('Este paciente no tiene teléfono registrado.')
    const msg = mensajeControl(c.cliente?.nombre ?? 'paciente', negocio.nombre, labelControl(c.tipo))
    window.open(linkWhatsApp(c.cliente.telefono, msg), '_blank')
    if (c.estado === 'PENDIENTE') marcar(c, 'CONTACTADO')
  }
  async function eliminar(c: ControlConCliente) {
    if (!confirm('¿Eliminar este control?')) return
    await supabase.from('controles').delete().eq('id', c.id)
    cargar()
  }

  return (
    <div>
      <PageHeader
        title="Controles / Recall"
        subtitle={nPorContactar > 0 ? `${nPorContactar} paciente(s) por contactar` : 'Recordatorios de mantenimiento'}
        action={<button className="btn-primary" onClick={nuevo}><Plus size={16} /> Nuevo control</button>}
      />

      <div className="mb-4 flex gap-2">
        {([['contactar', `Por contactar (${nPorContactar})`], ['proximos', 'Próximos'], ['todos', 'Todos']] as const).map(([k, l]) => (
          <button key={k} onClick={() => setFiltro(k)} className={filtro === k ? 'btn-primary' : 'btn-ghost'}>{l}</button>
        ))}
      </div>

      {loading ? (
        <Cargando />
      ) : visibles.length === 0 ? (
        <div className="card flex flex-col items-center gap-3 py-12 text-center">
          <BellRing className="text-brand-300" size={40} />
          <p className="text-slate-500">
            {filtro === 'contactar' ? 'No hay pacientes por contactar hoy. 🎉' : 'No hay controles en esta vista.'}
          </p>
          <button className="btn-primary" onClick={nuevo}><Plus size={16} /> Programar un control</button>
        </div>
      ) : (
        <div className="space-y-2.5">
          {visibles.map((c) => {
            const vencido = c.fecha_programada <= hoy && c.estado === 'PENDIENTE'
            return (
              <div key={c.id} className="card flex flex-wrap items-center gap-3">
                <div className={`flex w-16 shrink-0 flex-col items-center rounded-lg py-2 ${vencido ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'}`}>
                  <span className="text-[10px] font-semibold uppercase">{vencido ? 'Toca' : 'Fecha'}</span>
                  <span className="text-xs font-bold">{fechaCorta(c.fecha_programada)}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-slate-800">{c.cliente?.nombre ?? 'Paciente'}</p>
                  <p className="text-sm text-slate-500">{labelControl(c.tipo)}{c.motivo ? ` · ${c.motivo}` : ''}{c.cliente?.telefono ? ` · ${c.cliente.telefono}` : ''}</p>
                </div>
                <span className={`badge ${ESTADO_CONTROL[c.estado]?.color}`}>{ESTADO_CONTROL[c.estado]?.label}</span>
                <div className="flex flex-wrap items-center gap-1">
                  <button onClick={() => recordarWhatsApp(c)} title="Contactar por WhatsApp" className="inline-flex items-center gap-1 rounded-lg bg-[#25D366]/10 px-2.5 py-1.5 text-xs font-semibold text-[#128C4B] hover:bg-[#25D366]/20">
                    <MessageCircle size={15} /> WhatsApp
                  </button>
                  {c.estado === 'PENDIENTE' && (
                    <button onClick={() => marcar(c, 'CONTACTADO')} title="Marcar contactado" className="rounded-lg p-1.5 text-slate-500 hover:bg-blue-50 hover:text-blue-600"><Phone size={16} /></button>
                  )}
                  <Link to={`/citas?paciente=${c.cliente_id}`} onClick={() => marcar(c, 'AGENDADO')} title="Agendar cita" className="rounded-lg p-1.5 text-slate-500 hover:bg-indigo-50 hover:text-indigo-600"><CalendarPlus size={16} /></Link>
                  <button onClick={() => marcar(c, 'COMPLETADO')} title="Completar" className="rounded-lg p-1.5 text-slate-500 hover:bg-emerald-50 hover:text-emerald-600"><Check size={16} /></button>
                  <button onClick={() => eliminar(c)} title="Eliminar" className="rounded-lg p-1.5 text-slate-500 hover:bg-rose-50 hover:text-rose-600"><Trash2 size={15} /></button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <Modal
        open={open}
        title="Programar control / recall"
        onClose={() => setOpen(false)}
        footer={
          <>
            <button className="btn-ghost" onClick={() => setOpen(false)}>Cancelar</button>
            <button className="btn-primary" onClick={guardar} disabled={saving}>{saving ? 'Guardando…' : 'Guardar'}</button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="label">Paciente</label>
            <SelectorPaciente clientes={clientes} value={form.cliente_id} onChange={(id) => setForm({ ...form, cliente_id: id })} />
          </div>
          <div>
            <label className="label">Tipo de control</label>
            <div className="grid grid-cols-3 gap-2">
              {TIPOS_CONTROL.map((t) => (
                <button key={t.value} type="button" onClick={() => elegirTipo(t.value)}
                  className={`rounded-xl border-2 p-2 text-center transition ${form.tipo === t.value ? 'border-brand-400 bg-brand-50' : 'border-slate-200 hover:bg-slate-50'}`}>
                  <div className="text-lg">{t.icon}</div>
                  <div className="text-[11px] font-semibold text-slate-700">{t.label}</div>
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Fecha del recordatorio</label>
              <input type="date" className="input" value={form.fecha_programada} onChange={(e) => setForm({ ...form, fecha_programada: e.target.value })} />
              <p className="mt-1 text-xs text-slate-500">Se sugiere según el tipo; puedes cambiarla.</p>
            </div>
            <div>
              <label className="label">Nota (opcional)</label>
              <input className="input" value={form.motivo} onChange={(e) => setForm({ ...form, motivo: e.target.value })} placeholder="Ej. controlar resina del 26" />
            </div>
          </div>
        </div>
      </Modal>
    </div>
  )
}
