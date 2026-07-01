import { useEffect, useState } from 'react'
import { Plus, Trash2, Bell, AlertTriangle } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { Alerta, Cliente } from '../types'
import { fechaCorta, codigoCliente } from '../lib/format'
import PageHeader from '../components/PageHeader'
import Cargando from '../components/Cargando'
import Modal from '../components/Modal'
import SelectorPaciente from '../components/SelectorPaciente'

type TipoAlerta = Alerta['tipo']

const TIPOS: { valor: TipoAlerta; etiqueta: string }[] = [
  { valor: 'alergia', etiqueta: 'Alergia' },
  { valor: 'saldo', etiqueta: 'Saldo' },
  { valor: 'medica', etiqueta: 'Médica' },
  { valor: 'importante', etiqueta: 'Importante' },
  { valor: 'otro', etiqueta: 'Otro' },
]

// Colores por tipo: alergia=rojo, saldo=ámbar, medica=morado(amatista),
// importante=dorado, otro=gris.
const ESTILO_TIPO: Record<TipoAlerta, { borde: string; badge: string }> = {
  alergia: { borde: 'border-l-rose-500', badge: 'bg-rose-50 text-rose-700' },
  saldo: { borde: 'border-l-amber-500', badge: 'bg-amber-50 text-amber-700' },
  medica: { borde: 'border-l-purple-500', badge: 'bg-purple-50 text-purple-700' },
  importante: { borde: 'border-l-brand-400', badge: 'bg-brand-50 text-brand-700' },
  otro: { borde: 'border-l-slate-400', badge: 'bg-slate-100 text-slate-600' },
}

function etiquetaTipo(t: TipoAlerta): string {
  return TIPOS.find((x) => x.valor === t)?.etiqueta ?? t
}

const vacio = {
  cliente_id: '',
  tipo: 'importante' as TipoAlerta,
  texto: '',
}

export default function Alertas() {
  const [alertas, setAlertas] = useState<Alerta[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState<'activas' | 'todas'>('activas')
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(vacio)
  const [saving, setSaving] = useState(false)

  async function cargar() {
    setLoading(true)
    const [{ data, error }, { data: cli, error: errCli }] = await Promise.all([
      supabase.from('alertas_paciente').select('*').order('created_at', { ascending: false }),
      supabase.from('clientes').select('*').order('nombre'),
    ])
    if (error) alert('Error al cargar alertas: ' + error.message)
    if (errCli) alert('Error al cargar pacientes: ' + errCli.message)
    setAlertas((data ?? []) as Alerta[])
    setClientes((cli ?? []) as Cliente[])
    setLoading(false)
  }

  useEffect(() => {
    cargar()
  }, [])

  function nombrePaciente(id: string): string {
    const c = clientes.find((x) => x.id === id)
    return c ? `${codigoCliente(c.codigo)} — ${c.nombre}` : '—'
  }

  function abrirNueva() {
    setForm(vacio)
    setOpen(true)
  }

  async function guardar() {
    if (!form.cliente_id) return alert('Selecciona un paciente')
    if (!form.texto.trim()) return alert('El texto de la alerta es obligatorio')
    setSaving(true)
    const { error } = await supabase.from('alertas_paciente').insert({
      cliente_id: form.cliente_id,
      tipo: form.tipo,
      texto: form.texto.trim(),
      activa: true,
    })
    setSaving(false)
    if (error) return alert('Error al guardar: ' + error.message)
    setOpen(false)
    cargar()
  }

  async function desactivar(a: Alerta) {
    const { error } = await supabase.from('alertas_paciente').update({ activa: false }).eq('id', a.id)
    if (error) return alert('Error al desactivar: ' + error.message)
    cargar()
  }

  async function reactivar(a: Alerta) {
    const { error } = await supabase.from('alertas_paciente').update({ activa: true }).eq('id', a.id)
    if (error) return alert('Error al reactivar: ' + error.message)
    cargar()
  }

  async function eliminar(a: Alerta) {
    if (!confirm('¿Eliminar esta alerta?')) return
    const { error } = await supabase.from('alertas_paciente').delete().eq('id', a.id)
    if (error) return alert('Error al eliminar: ' + error.message)
    cargar()
  }

  const visibles = filtro === 'activas' ? alertas.filter((a) => a.activa) : alertas

  return (
    <div>
      <PageHeader
        title="Alertas"
        subtitle="Avisos importantes por paciente"
        action={
          <button className="btn-primary" onClick={abrirNueva}>
            <Plus size={16} /> Nueva alerta
          </button>
        }
      />

      <div className="mb-4 flex gap-2">
        <button
          className={filtro === 'activas' ? 'btn-primary' : 'btn-ghost'}
          onClick={() => setFiltro('activas')}
        >
          Activas
        </button>
        <button
          className={filtro === 'todas' ? 'btn-primary' : 'btn-ghost'}
          onClick={() => setFiltro('todas')}
        >
          Todas
        </button>
      </div>

      {loading ? (
        <Cargando />
      ) : visibles.length === 0 ? (
        <div className="card flex flex-col items-center gap-3 py-12 text-center">
          <Bell className="text-brand-300" size={40} />
          <p className="text-slate-500">
            {filtro === 'activas' ? 'No hay alertas activas.' : 'Aún no hay alertas registradas.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {visibles.map((a) => {
            const estilo = ESTILO_TIPO[a.tipo]
            return (
              <div
                key={a.id}
                className={`card border-l-4 ${estilo.borde} ${a.activa ? '' : 'opacity-60'}`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <span className="font-medium text-slate-800">{nombrePaciente(a.cliente_id)}</span>
                      <span className={`badge ${estilo.badge}`}>{etiquetaTipo(a.tipo)}</span>
                      {!a.activa && (
                        <span className="badge bg-slate-100 text-slate-500">Inactiva</span>
                      )}
                    </div>
                    <p className="whitespace-pre-wrap text-sm text-slate-600">{a.texto}</p>
                    <p className="mt-1 text-xs text-slate-400">{fechaCorta(a.created_at.slice(0, 10))}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    {a.activa ? (
                      <button
                        onClick={() => desactivar(a)}
                        className="rounded-lg px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-800"
                      >
                        Desactivar
                      </button>
                    ) : (
                      <button
                        onClick={() => reactivar(a)}
                        className="rounded-lg px-2 py-1 text-xs font-medium text-brand-600 hover:bg-brand-50"
                      >
                        Reactivar
                      </button>
                    )}
                    <button
                      onClick={() => eliminar(a)}
                      className="rounded-lg p-2 text-slate-600 hover:bg-rose-50 hover:text-rose-600"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <Modal
        open={open}
        title="Nueva alerta"
        onClose={() => setOpen(false)}
        footer={
          <>
            <button className="btn-ghost" onClick={() => setOpen(false)}>Cancelar</button>
            <button className="btn-primary" onClick={guardar} disabled={saving}>
              {saving ? 'Guardando…' : 'Guardar'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="label">Paciente</label>
            <SelectorPaciente
              clientes={clientes}
              value={form.cliente_id}
              onChange={(id) => setForm({ ...form, cliente_id: id })}
            />
          </div>
          <div>
            <label className="label">Tipo</label>
            <select
              className="input"
              value={form.tipo}
              onChange={(e) => setForm({ ...form, tipo: e.target.value as TipoAlerta })}
            >
              {TIPOS.map((t) => (
                <option key={t.valor} value={t.valor}>{t.etiqueta}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Texto de la alerta</label>
            <textarea
              className="input"
              rows={3}
              value={form.texto}
              onChange={(e) => setForm({ ...form, texto: e.target.value })}
              placeholder="Ej. Alérgico a la penicilina"
            />
          </div>
          <p className="flex items-center gap-2 text-xs text-slate-500">
            <AlertTriangle size={14} className="shrink-0 text-brand-400" />
            La alerta se crea como activa y aparecerá en el listado de avisos.
          </p>
        </div>
      </Modal>
    </div>
  )
}
