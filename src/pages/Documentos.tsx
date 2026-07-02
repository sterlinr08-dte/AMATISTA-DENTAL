import { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2, Save, Printer, FileText } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { Cliente, Empleado, Documento } from '../types'
import { fechaCorta, hoyISO } from '../lib/format'
import { useNegocio } from '../lib/negocio'
import { TIPOS_DOCUMENTO, tipoDocDef, labelDoc } from '../lib/documentos'
import PageHeader from '../components/PageHeader'
import Cargando from '../components/Cargando'
import Modal from '../components/Modal'
import SelectorPaciente from '../components/SelectorPaciente'

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

const vacio = { tipo: 'certificado', fecha: hoyISO(), empleado_id: '', titulo: '', destinatario: '', contenido: '' }

export default function Documentos({ pacienteFijo }: { pacienteFijo?: string } = {}) {
  const { negocio } = useNegocio()
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [empleados, setEmpleados] = useState<Empleado[]>([])
  const [pacienteId, setPacienteId] = useState<string>(pacienteFijo ?? '')
  const [items, setItems] = useState<Documento[]>([])
  const [cargando, setCargando] = useState(false)

  const [open, setOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState(vacio)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    Promise.all([
      supabase.from('clientes').select('*').order('nombre'),
      supabase.from('empleados').select('*').eq('activo', true).order('nombre'),
    ]).then(([cl, em]) => { setClientes(cl.data ?? []); setEmpleados(em.data ?? []) })
  }, [])
  useEffect(() => { if (pacienteFijo != null) setPacienteId(pacienteFijo) }, [pacienteFijo])

  async function cargar(pid: string) {
    setCargando(true)
    const { data } = await supabase.from('documentos').select('*').eq('cliente_id', pid).order('fecha', { ascending: false }).order('created_at', { ascending: false })
    setItems((data as Documento[]) ?? [])
    setCargando(false)
  }
  useEffect(() => {
    if (!pacienteId) { setItems([]); return }
    cargar(pacienteId)
  }, [pacienteId])

  function nombrePaciente(): string {
    return clientes.find((c) => c.id === pacienteId)?.nombre ?? 'el/la paciente'
  }
  function nombreEmpleado(id: string | null): string {
    return empleados.find((e) => e.id === id)?.nombre ?? ''
  }

  function elegirTipo(tipo: string) {
    const def = tipoDocDef(tipo)
    setForm((f) => ({ ...f, tipo, titulo: def.titulo, contenido: def.plantilla(nombrePaciente()) }))
  }
  function nuevo() {
    const def = tipoDocDef('certificado')
    setEditId(null)
    setForm({ tipo: 'certificado', fecha: hoyISO(), empleado_id: '', titulo: def.titulo, destinatario: '', contenido: def.plantilla(nombrePaciente()) })
    setOpen(true)
  }
  function editar(d: Documento) {
    setEditId(d.id)
    setForm({ tipo: d.tipo, fecha: d.fecha, empleado_id: d.empleado_id ?? '', titulo: d.titulo, destinatario: d.destinatario ?? '', contenido: d.contenido ?? '' })
    setOpen(true)
  }
  async function guardar() {
    if (!form.titulo.trim()) return alert('El documento necesita un título.')
    setSaving(true)
    const payload = {
      cliente_id: pacienteId,
      empleado_id: form.empleado_id || null,
      tipo: form.tipo,
      fecha: form.fecha,
      titulo: form.titulo.trim(),
      destinatario: form.destinatario || null,
      contenido: form.contenido || null,
    }
    const { error } = editId
      ? await supabase.from('documentos').update(payload).eq('id', editId)
      : await supabase.from('documentos').insert(payload)
    setSaving(false)
    if (error) return alert('Error al guardar: ' + error.message)
    setOpen(false)
    cargar(pacienteId)
  }
  async function eliminar(d: Documento) {
    if (!confirm('¿Eliminar este documento?')) return
    await supabase.from('documentos').delete().eq('id', d.id)
    cargar(pacienteId)
  }

  // Impresión en hoja tamaño carta, con logo, datos de la clínica y firma.
  function imprimir(d: Documento) {
    const w = window.open('', '_blank', 'width=850,height=1100')
    if (!w) return alert('Permite las ventanas emergentes para imprimir.')
    const logoSrc = `${location.origin}${import.meta.env.BASE_URL}${negocio.logo}`
    const paciente = esc(nombrePaciente())
    const doctor = esc(nombreEmpleado(d.empleado_id))
    const cuerpo = esc(d.contenido ?? '').replace(/\n/g, '<br>')
    w.document.write(`<!DOCTYPE html>
<html lang="es"><head><meta charset="utf-8"><title>${esc(d.titulo)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: Georgia,'Times New Roman',serif; color:#1f2937; margin:0; padding:40px 48px; line-height:1.6; }
  .enc { display:flex; align-items:center; gap:18px; border-bottom:2px solid #c9a227; padding-bottom:16px; margin-bottom:20px; }
  .enc img { height:70px; width:auto; object-fit:contain; }
  .clinica { font-size:22px; font-weight:bold; color:#111827; margin:0; }
  .datos { font-size:12px; color:#4b5563; margin-top:4px; line-height:1.4; }
  .titulo { font-size:19px; font-weight:bold; text-align:center; letter-spacing:1px; margin:6px 0 18px; color:#111827; }
  .meta { display:flex; justify-content:space-between; flex-wrap:wrap; gap:8px; font-size:13px; margin-bottom:16px; }
  .meta .k { font-weight:bold; color:#374151; }
  .dest { font-size:13px; margin-bottom:14px; }
  .cuerpo { font-size:14px; text-align:justify; white-space:normal; min-height:180px; }
  .firma { margin-top:70px; text-align:center; }
  .firma .linea { width:280px; border-top:1px solid #374151; margin:0 auto 6px; }
  .firma .nombre { font-weight:bold; }
  .firma .rol { font-size:12px; color:#6b7280; }
  .sello { margin-top:6px; font-size:11px; color:#9ca3af; }
  @page { size: letter; margin: 16mm; }
</style></head><body>
  <div class="enc">
    <img src="${logoSrc}" alt="${esc(negocio.nombre)}">
    <div>
      <p class="clinica">${esc(negocio.nombre)}</p>
      <div class="datos">
        ${negocio.rnc ? `<div>RNC: ${esc(negocio.rnc)}</div>` : ''}
        ${negocio.direccion ? `<div>${esc(negocio.direccion)}</div>` : ''}
        ${negocio.telefono ? `<div>Tel.: ${esc(negocio.telefono)}</div>` : ''}
      </div>
    </div>
  </div>

  <div class="titulo">${esc(d.titulo)}</div>

  <div class="meta">
    <div><span class="k">Paciente:</span> ${paciente}</div>
    <div><span class="k">Fecha:</span> ${esc(fechaCorta(d.fecha))}</div>
  </div>
  ${d.destinatario ? `<div class="dest"><span class="k" style="font-weight:bold">Para:</span> ${esc(d.destinatario)}</div>` : ''}

  <div class="cuerpo">${cuerpo || '&nbsp;'}</div>

  <div class="firma">
    <div class="linea"></div>
    <div class="nombre">${doctor || '&nbsp;'}</div>
    <div class="rol">Firma y sello del profesional</div>
  </div>

  <script>
    window.onload = function () {
      var imgs = Array.prototype.slice.call(document.images)
      Promise.all(imgs.map(function (img) {
        return img.complete ? Promise.resolve() : new Promise(function (res) { img.onload = img.onerror = res })
      })).then(function () { setTimeout(function () { window.focus(); window.print() }, 150) })
    }
  </script>
</body></html>`)
    w.document.close()
    w.focus()
  }

  const usaDestinatario = tipoDocDef(form.tipo).usaDestinatario

  return (
    <div>
      {!pacienteFijo && (
        <>
          <PageHeader title="Documentos" subtitle="Certificados, referimientos y órdenes" />
          <div className="card mb-6 max-w-md">
            <label className="label">Paciente</label>
            <SelectorPaciente clientes={clientes} value={pacienteId} onChange={setPacienteId} />
          </div>
        </>
      )}

      {!pacienteId ? (
        <div className="card flex flex-col items-center gap-3 py-12 text-center">
          <FileText className="text-brand-300" size={40} />
          <p className="text-slate-500">Selecciona un paciente para ver y crear sus documentos.</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-700">{items.length} documento(s)</h3>
            <button className="btn-primary" onClick={nuevo}><Plus size={16} /> Nuevo documento</button>
          </div>

          {cargando ? (
            <Cargando />
          ) : items.length === 0 ? (
            <div className="card flex flex-col items-center gap-3 py-12 text-center">
              <FileText className="text-brand-300" size={40} />
              <p className="text-slate-500">Aún no hay documentos. Crea el primero (certificado, referimiento, orden…).</p>
            </div>
          ) : (
            <div className="space-y-2">
              {items.map((d) => (
                <div key={d.id} className="card flex flex-wrap items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="badge bg-brand-50 text-brand-700">{labelDoc(d.tipo)}</span>
                      <span className="font-semibold text-slate-800">{d.titulo}</span>
                    </div>
                    <p className="mt-0.5 text-xs text-slate-500">{fechaCorta(d.fecha)}{d.empleado_id ? ` · Dr(a). ${nombreEmpleado(d.empleado_id)}` : ''}{d.destinatario ? ` · Para: ${d.destinatario}` : ''}</p>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => imprimir(d)} className="btn-ghost !py-1 text-xs"><Printer size={14} /> Imprimir</button>
                    <button onClick={() => editar(d)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-brand-600"><Pencil size={15} /></button>
                    <button onClick={() => eliminar(d)} className="rounded-lg p-2 text-slate-500 hover:bg-rose-50 hover:text-rose-600"><Trash2 size={15} /></button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <Modal
        open={open}
        title={editId ? 'Editar documento' : 'Nuevo documento'}
        onClose={() => setOpen(false)}
        footer={
          <>
            <button className="btn-ghost" onClick={() => setOpen(false)}>Cancelar</button>
            <button className="btn-primary" onClick={guardar} disabled={saving}><Save size={16} /> {saving ? 'Guardando…' : 'Guardar'}</button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Tipo de documento</label>
              <select className="input" value={form.tipo} onChange={(e) => elegirTipo(e.target.value)}>
                {TIPOS_DOCUMENTO.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Fecha</label>
              <input type="date" className="input" value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Profesional (firma)</label>
              <select className="input" value={form.empleado_id} onChange={(e) => setForm({ ...form, empleado_id: e.target.value })}>
                <option value="">— Sin asignar —</option>
                {empleados.map((em) => <option key={em.id} value={em.id}>{em.nombre}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Título (impreso)</label>
              <input className="input" value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} />
            </div>
          </div>
          {usaDestinatario && (
            <div>
              <label className="label">Dirigido a</label>
              <input className="input" value={form.destinatario} onChange={(e) => setForm({ ...form, destinatario: e.target.value })} placeholder="Dr(a). Nombre — Especialidad / Centro" />
            </div>
          )}
          <div>
            <label className="label">Contenido</label>
            <textarea className="input" rows={9} value={form.contenido} onChange={(e) => setForm({ ...form, contenido: e.target.value })} placeholder="Texto del documento…" />
            <p className="mt-1 text-xs text-slate-500">La plantilla se rellena según el tipo; edítala como necesites.</p>
          </div>
        </div>
      </Modal>
    </div>
  )
}
