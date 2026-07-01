import { useEffect, useRef, useState } from 'react'
import { Plus, Save, Printer, Eraser, CheckCircle2, Circle } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { Cliente, Empleado, Consentimiento } from '../types'
import { fechaCorta, hoyISO } from '../lib/format'
import { useNegocio } from '../lib/negocio'
import { CONSENTIMIENTOS_PLANTILLAS } from '../lib/consentimientos'
import PageHeader from '../components/PageHeader'
import Cargando from '../components/Cargando'
import Modal from '../components/Modal'
import DataTable from '../components/DataTable'
import type { Columna } from '../components/DataTable'

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

export default function Consentimientos() {
  const { negocio } = useNegocio()

  const [lista, setLista] = useState<Consentimiento[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [empleados, setEmpleados] = useState<Empleado[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  // formulario
  const [editId, setEditId] = useState<string | null>(null)
  const [clienteId, setClienteId] = useState('')
  const [empleadoId, setEmpleadoId] = useState('')
  const [fecha, setFecha] = useState(hoyISO())
  const [tipo, setTipo] = useState('')
  const [titulo, setTitulo] = useState('')
  const [texto, setTexto] = useState('')
  const [firmante, setFirmante] = useState('')
  const [haFirmado, setHaFirmado] = useState(false)

  // canvas de firma
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const dibujando = useRef(false)

  async function cargar() {
    setLoading(true)
    const [{ data }, { data: cls }, { data: em }] = await Promise.all([
      supabase.from('consentimientos').select('*').order('fecha', { ascending: false }),
      supabase.from('clientes').select('*').order('nombre'),
      supabase.from('empleados').select('*').eq('activo', true).order('nombre'),
    ])
    setLista(data ?? [])
    setClientes(cls ?? [])
    setEmpleados(em ?? [])
    setLoading(false)
  }

  useEffect(() => {
    cargar()
  }, [])

  function nombreCliente(id: string | null): string {
    if (!id) return 'Sin paciente'
    return clientes.find((c) => c.id === id)?.nombre ?? 'Paciente'
  }
  function nombreDoctor(id: string | null): string {
    if (!id) return 'Sin asignar'
    return empleados.find((e) => e.id === id)?.nombre ?? 'Doctor(a)'
  }

  // ---- Firma (canvas) ----
  function ctx() {
    const c = canvasRef.current
    if (!c) return null
    const g = c.getContext('2d')
    if (!g) return null
    g.lineWidth = 2.5
    g.lineCap = 'round'
    g.lineJoin = 'round'
    g.strokeStyle = '#1f2937'
    return g
  }
  function coords(e: React.PointerEvent<HTMLCanvasElement>) {
    const c = canvasRef.current!
    const r = c.getBoundingClientRect()
    return { x: (e.clientX - r.left) * (c.width / r.width), y: (e.clientY - r.top) * (c.height / r.height) }
  }
  function onDown(e: React.PointerEvent<HTMLCanvasElement>) {
    const g = ctx()
    if (!g) return
    dibujando.current = true
    canvasRef.current?.setPointerCapture(e.pointerId)
    const { x, y } = coords(e)
    g.beginPath()
    g.moveTo(x, y)
  }
  function onMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!dibujando.current) return
    const g = ctx()
    if (!g) return
    const { x, y } = coords(e)
    g.lineTo(x, y)
    g.stroke()
    setHaFirmado(true)
  }
  function onUp() {
    dibujando.current = false
  }
  function limpiarFirma() {
    const c = canvasRef.current
    const g = c?.getContext('2d')
    if (c && g) g.clearRect(0, 0, c.width, c.height)
    setHaFirmado(false)
  }

  function abrirModal() {
    // Espera a que el canvas se monte para poder limpiarlo / precargarlo.
    requestAnimationFrame(() => {
      const c = canvasRef.current
      const g = c?.getContext('2d')
      if (c && g) g.clearRect(0, 0, c.width, c.height)
      const firmaPrevia = editId ? lista.find((x) => x.id === editId)?.firma : null
      if (c && g && firmaPrevia) {
        const img = new Image()
        img.onload = () => g.drawImage(img, 0, 0, c.width, c.height)
        img.src = firmaPrevia
        setHaFirmado(true)
      } else {
        setHaFirmado(false)
      }
    })
    setOpen(true)
  }

  function nuevo() {
    setEditId(null)
    setClienteId('')
    setEmpleadoId('')
    setFecha(hoyISO())
    setTipo('')
    setTitulo('')
    setTexto('')
    setFirmante('')
    abrirModal()
  }

  function abrirEditar(c: Consentimiento) {
    setEditId(c.id)
    setClienteId(c.cliente_id)
    setEmpleadoId(c.empleado_id ?? '')
    setFecha(c.fecha)
    setTipo(c.tipo ?? '')
    setTitulo(c.titulo)
    setTexto(c.texto)
    setFirmante(c.firmante ?? '')
    abrirModal()
  }

  function aplicarPlantilla(t: string) {
    setTipo(t)
    const p = CONSENTIMIENTOS_PLANTILLAS.find((x) => x.tipo === t)
    if (p) {
      setTitulo(p.titulo)
      setTexto(p.texto)
    }
  }

  async function guardar() {
    if (!clienteId) return alert('Selecciona el paciente.')
    if (!titulo.trim()) return alert('El consentimiento necesita un título.')
    if (!texto.trim()) return alert('El consentimiento necesita un texto.')
    setSaving(true)

    // Firma actual del canvas (si hay trazo)
    let firma: string | null = null
    if (haFirmado && canvasRef.current) {
      firma = canvasRef.current.toDataURL('image/png')
    }

    const datos = {
      cliente_id: clienteId,
      empleado_id: empleadoId || null,
      fecha,
      tipo: tipo || null,
      titulo: titulo.trim(),
      texto: texto.trim(),
      firmante: firmante.trim() || null,
      firma,
      firmado_at: firma ? new Date().toISOString() : null,
    }

    const { error } = editId
      ? await supabase.from('consentimientos').update(datos).eq('id', editId)
      : await supabase.from('consentimientos').insert(datos)
    setSaving(false)
    if (error) return alert('Error al guardar: ' + error.message)
    setOpen(false)
    await cargar()
  }

  async function eliminar(c: Consentimiento) {
    if (!confirm('¿Eliminar este consentimiento?')) return
    const { error } = await supabase.from('consentimientos').delete().eq('id', c.id)
    if (error) return alert('Error al eliminar: ' + error.message)
    await cargar()
  }

  // Impresión en hoja normal.
  function imprimir(c: Consentimiento) {
    const w = window.open('', '_blank', 'width=800,height=1000')
    if (!w) return alert('Permite las ventanas emergentes para imprimir.')
    const logoSrc = `${location.origin}${import.meta.env.BASE_URL}${negocio.logo}`
    const paciente = esc(nombreCliente(c.cliente_id))
    const doctor = esc(nombreDoctor(c.empleado_id))
    const cuerpo = esc(c.texto).replace(/\n/g, '<br>')
    const firmaImg = c.firma
      ? `<img class="firma-img" src="${c.firma}" alt="Firma">`
      : '<div class="firma-vacia"></div>'
    const nombreFirmante = esc(c.firmante || nombreCliente(c.cliente_id))

    w.document.write(`<!DOCTYPE html>
<html lang="es"><head><meta charset="utf-8"><title>${esc(c.titulo)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: Georgia,'Times New Roman',serif; color:#1f2937; margin:0; padding:40px 48px; line-height:1.6; }
  .encabezado { display:flex; align-items:center; gap:18px; border-bottom:2px solid #c9a227; padding-bottom:18px; margin-bottom:22px; }
  .encabezado img { height:70px; width:auto; object-fit:contain; }
  .clinica-nombre { font-size:22px; font-weight:bold; color:#111827; margin:0; }
  .clinica-datos { font-size:12px; color:#4b5563; margin-top:4px; }
  .titulo { font-size:19px; font-weight:bold; text-align:center; margin:8px 0 20px; color:#111827; }
  .meta { display:flex; justify-content:space-between; flex-wrap:wrap; gap:8px; font-size:13px; margin-bottom:16px; }
  .meta .etiqueta { font-weight:bold; color:#374151; }
  .cuerpo { font-size:14px; text-align:justify; margin-bottom:30px; }
  .firmas { display:flex; justify-content:space-around; gap:30px; margin-top:60px; }
  .firma-bloque { text-align:center; width:45%; }
  .firma-img { max-height:80px; max-width:220px; object-fit:contain; display:block; margin:0 auto 2px; }
  .firma-vacia { height:80px; }
  .linea { border-top:1px solid #374151; margin:0 auto 6px; }
  .firma-nombre { font-weight:bold; font-size:14px; }
  .firma-rol { font-size:12px; color:#6b7280; }
  @page { size:auto; margin:14mm; }
</style></head><body>
  <div class="encabezado">
    <img src="${logoSrc}" alt="${esc(negocio.nombre)}">
    <div>
      <p class="clinica-nombre">${esc(negocio.nombre)}</p>
      <div class="clinica-datos">
        ${negocio.direccion ? `<div>${esc(negocio.direccion)}</div>` : ''}
        ${negocio.telefono ? `<div>Tel.: ${esc(negocio.telefono)}</div>` : ''}
        ${negocio.rnc ? `<div>RNC: ${esc(negocio.rnc)}</div>` : ''}
      </div>
    </div>
  </div>

  <div class="titulo">${esc(c.titulo)}</div>

  <div class="meta">
    <div><span class="etiqueta">Paciente:</span> ${paciente}</div>
    <div><span class="etiqueta">Fecha:</span> ${esc(fechaCorta(c.fecha))}</div>
    <div><span class="etiqueta">Profesional:</span> ${doctor}</div>
  </div>

  <div class="cuerpo">${cuerpo}</div>

  <div class="firmas">
    <div class="firma-bloque">
      ${firmaImg}
      <div class="linea"></div>
      <div class="firma-nombre">${nombreFirmante}</div>
      <div class="firma-rol">Firma del paciente / tutor</div>
    </div>
    <div class="firma-bloque">
      <div class="firma-vacia"></div>
      <div class="linea"></div>
      <div class="firma-nombre">${doctor}</div>
      <div class="firma-rol">Firma del profesional</div>
    </div>
  </div>
</body></html>`)
    w.document.close()
    w.focus()
    w.print()
  }

  const columnas: Columna<Consentimiento>[] = [
    {
      header: 'Fecha',
      cell: (c) => <span className="text-slate-600">{fechaCorta(c.fecha)}</span>,
      sortValue: (c) => c.fecha,
    },
    {
      header: 'Paciente',
      cell: (c) => <span className="font-medium text-slate-800">{nombreCliente(c.cliente_id)}</span>,
      sortValue: (c) => nombreCliente(c.cliente_id),
    },
    {
      header: 'Consentimiento',
      cell: (c) => <span className="text-slate-700">{c.titulo}</span>,
      sortValue: (c) => c.titulo,
    },
    {
      header: 'Firmado',
      cell: (c) =>
        c.firma ? (
          <span className="inline-flex items-center gap-1.5 text-emerald-600">
            <CheckCircle2 size={16} /> Firmado
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-slate-400">
            <Circle size={16} /> Sin firmar
          </span>
        ),
      sortValue: (c) => (c.firma ? 1 : 0),
    },
    {
      header: '',
      align: 'right',
      cell: (c) => (
        <div className="flex justify-end gap-1">
          <button
            className="btn-ghost"
            onClick={(e) => {
              e.stopPropagation()
              imprimir(c)
            }}
          >
            <Printer size={14} /> Imprimir
          </button>
          <button
            className="rounded-lg p-2 text-slate-600 hover:bg-rose-50 hover:text-rose-600"
            onClick={(e) => {
              e.stopPropagation()
              eliminar(c)
            }}
          >
            <Eraser size={16} />
          </button>
        </div>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        title="Consentimientos informados"
        subtitle={`${lista.length} consentimiento(s)`}
        action={
          <button className="btn-primary" onClick={nuevo}>
            <Plus size={16} /> Nuevo consentimiento
          </button>
        }
      />

      {loading ? (
        <Cargando />
      ) : (
        <DataTable
          rows={lista}
          rowKey={(c) => c.id}
          columns={columnas}
          onRowClick={abrirEditar}
          searchText={(c) => `${nombreCliente(c.cliente_id)} ${c.titulo}`}
          searchPlaceholder="Buscar por paciente o título…"
          emptyText="Aún no hay consentimientos. Crea el primero."
          initialSort={{ index: 0, dir: 'desc' }}
        />
      )}

      <Modal
        open={open}
        title={editId ? 'Editar consentimiento' : 'Nuevo consentimiento'}
        onClose={() => setOpen(false)}
        footer={
          <>
            <button className="btn-ghost" onClick={() => setOpen(false)}>
              Cancelar
            </button>
            <button className="btn-primary" onClick={guardar} disabled={saving}>
              <Save size={16} /> {saving ? 'Guardando…' : 'Guardar'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Paciente</label>
              <select className="input" value={clienteId} onChange={(e) => setClienteId(e.target.value)}>
                <option value="">— Selecciona —</option>
                {clientes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Profesional</label>
              <select className="input" value={empleadoId} onChange={(e) => setEmpleadoId(e.target.value)}>
                <option value="">— Sin asignar —</option>
                {empleados.map((em) => (
                  <option key={em.id} value={em.id}>
                    {em.nombre}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Fecha</label>
              <input type="date" className="input" value={fecha} onChange={(e) => setFecha(e.target.value)} />
            </div>
            <div>
              <label className="label">Plantilla</label>
              <select className="input" value={tipo} onChange={(e) => aplicarPlantilla(e.target.value)}>
                <option value="">— Elegir plantilla —</option>
                {CONSENTIMIENTOS_PLANTILLAS.map((p) => (
                  <option key={p.tipo} value={p.tipo}>
                    {p.titulo}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="label">Título</label>
            <input
              className="input"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Título del consentimiento"
            />
          </div>

          <div>
            <label className="label">Texto del consentimiento</label>
            <textarea
              className="input"
              rows={8}
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder="Escribe o elige una plantilla…"
            />
          </div>

          <div>
            <label className="label">Nombre de quien firma (paciente o tutor)</label>
            <input
              className="input"
              value={firmante}
              onChange={(e) => setFirmante(e.target.value)}
              placeholder="Por defecto, el nombre del paciente"
            />
          </div>

          {/* Firma */}
          <div>
            <div className="flex items-center justify-between">
              <label className="label mb-0">Firma del paciente</label>
              <button type="button" onClick={limpiarFirma} className="btn-ghost !py-1 text-xs">
                <Eraser size={14} /> Limpiar
              </button>
            </div>
            <div className="mt-1 overflow-hidden rounded-xl border-2 border-dashed border-slate-300 bg-white">
              <canvas
                ref={canvasRef}
                width={500}
                height={180}
                className="h-44 w-full touch-none"
                style={{ touchAction: 'none' }}
                onPointerDown={onDown}
                onPointerMove={onMove}
                onPointerUp={onUp}
                onPointerLeave={onUp}
              />
            </div>
            <p className="mt-1 text-xs text-slate-500">
              {haFirmado ? 'Firma capturada ✓' : 'Firme con el dedo o el mouse dentro del recuadro.'}
            </p>
          </div>

          {editId && (
            <button
              type="button"
              onClick={() => {
                const c = lista.find((x) => x.id === editId)
                if (c) imprimir(c)
              }}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-brand-200 bg-brand-50 px-3 py-2 text-sm font-semibold text-brand-700 hover:bg-brand-100"
            >
              <Printer size={16} /> Imprimir consentimiento
            </button>
          )}
        </div>
      </Modal>
    </div>
  )
}
