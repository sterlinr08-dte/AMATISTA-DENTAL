import { useEffect, useState } from 'react'
import { Plus, Trash2, Save, Printer } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { Cliente, Empleado, Receta, RecetaItem } from '../types'
import { fechaCorta, hoyISO } from '../lib/format'
import { useNegocio } from '../lib/negocio'
import PageHeader from '../components/PageHeader'
import Cargando from '../components/Cargando'
import Modal from '../components/Modal'
import DataTable from '../components/DataTable'
import type { Columna } from '../components/DataTable'
import SelectorPaciente from '../components/SelectorPaciente'

// Renglón temporal de medicamento (en edición, antes de guardar)
interface ItemTmp {
  medicamento: string
  presentacion: string
  indicacion: string
  cantidad: string
}

const itemVacio: ItemTmp = { medicamento: '', presentacion: '', indicacion: '', cantidad: '' }

// Código de receta: R + 4 dígitos
function codigoReceta(codigo: number | null | undefined): string {
  return 'R' + String(codigo ?? 0).padStart(4, '0')
}

// Escapa texto para insertarlo con seguridad en el HTML de impresión
function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export default function Recetas({ pacienteFijo }: { pacienteFijo?: string } = {}) {
  const { negocio } = useNegocio()

  const [recetas, setRecetas] = useState<Receta[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [empleados, setEmpleados] = useState<Empleado[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  // formulario de la receta
  const [editId, setEditId] = useState<string | null>(null)
  const [clienteId, setClienteId] = useState('')
  const [empleadoId, setEmpleadoId] = useState('')
  const [fecha, setFecha] = useState(hoyISO())
  const [indicaciones, setIndicaciones] = useState('')
  const [items, setItems] = useState<ItemTmp[]>([])

  async function cargar() {
    setLoading(true)
    let q = supabase.from('recetas').select('*').order('codigo', { ascending: false })
    if (pacienteFijo) q = q.eq('cliente_id', pacienteFijo)
    const [{ data }, { data: cls }] = await Promise.all([
      q,
      supabase.from('clientes').select('*').order('nombre'),
    ])
    setRecetas(data ?? [])
    setClientes(cls ?? [])
    setLoading(false)
  }

  async function cargarCatalogos() {
    const em = await supabase.from('empleados').select('*').eq('activo', true).order('nombre')
    setEmpleados(em.data ?? [])
  }

  useEffect(() => {
    cargar()
    cargarCatalogos()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pacienteFijo])

  function nombreCliente(id: string | null): string {
    if (!id) return 'Sin paciente'
    return clientes.find((c) => c.id === id)?.nombre ?? 'Paciente'
  }

  function nombreDoctor(id: string | null): string {
    if (!id) return 'Sin asignar'
    return empleados.find((e) => e.id === id)?.nombre ?? 'Doctor(a)'
  }

  function nuevo() {
    setEditId(null)
    setClienteId(pacienteFijo ?? '')
    setEmpleadoId('')
    setFecha(hoyISO())
    setIndicaciones('')
    setItems([{ ...itemVacio }])
    setOpen(true)
  }

  async function abrirEditar(r: Receta) {
    const { data, error } = await supabase
      .from('receta_items')
      .select('*')
      .eq('receta_id', r.id)
      .order('id')
    if (error) return alert('Error al cargar la receta: ' + error.message)
    setEditId(r.id)
    setClienteId(r.cliente_id ?? '')
    setEmpleadoId(r.empleado_id ?? '')
    setFecha(r.fecha)
    setIndicaciones(r.indicaciones ?? '')
    setItems(
      ((data as RecetaItem[]) ?? []).map((it) => ({
        medicamento: it.medicamento ?? '',
        presentacion: it.presentacion ?? '',
        indicacion: it.indicacion ?? '',
        cantidad: it.cantidad ?? '',
      })),
    )
    setOpen(true)
  }

  function setItem(i: number, patch: Partial<ItemTmp>) {
    setItems((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)))
  }

  function agregarItem() {
    setItems((prev) => [...prev, { ...itemVacio }])
  }

  function quitarItem(i: number) {
    setItems((prev) => prev.filter((_, idx) => idx !== i))
  }

  // Renglones válidos (al menos con nombre del medicamento)
  function itemsValidos(): ItemTmp[] {
    return items.filter((l) => l.medicamento.trim())
  }

  async function guardar() {
    const validos = itemsValidos()
    if (!clienteId) return alert('Selecciona el paciente.')
    if (validos.length === 0) return alert('Agrega al menos un medicamento.')
    setSaving(true)

    const datos = {
      cliente_id: clienteId || null,
      empleado_id: empleadoId || null,
      fecha,
      indicaciones: indicaciones || null,
    }

    let recetaId = editId
    if (editId) {
      const { error } = await supabase.from('recetas').update(datos).eq('id', editId)
      if (error) {
        setSaving(false)
        return alert('Error al actualizar la receta: ' + error.message)
      }
      // Reemplazar los renglones
      const { error: eDel } = await supabase.from('receta_items').delete().eq('receta_id', editId)
      if (eDel) {
        setSaving(false)
        return alert('Error al actualizar el detalle: ' + eDel.message)
      }
    } else {
      const { data, error } = await supabase
        .from('recetas')
        .insert(datos)
        .select()
        .single()
      if (error || !data) {
        setSaving(false)
        return alert('Error al crear la receta: ' + error?.message)
      }
      recetaId = (data as Receta).id
    }

    const payload = validos.map((l) => ({
      receta_id: recetaId,
      medicamento: l.medicamento.trim(),
      presentacion: l.presentacion.trim() || null,
      indicacion: l.indicacion.trim() || null,
      cantidad: l.cantidad.trim() || null,
    }))
    const { error: e2 } = await supabase.from('receta_items').insert(payload)
    if (e2) {
      setSaving(false)
      return alert('Receta guardada pero falló el detalle: ' + e2.message)
    }
    setSaving(false)
    setOpen(false)
    await cargar()
  }

  // Imprime la receta en una HOJA NORMAL abriendo una ventana autónoma.
  async function imprimir(r: Receta) {
    // Cargar los medicamentos de la receta
    const { data, error } = await supabase
      .from('receta_items')
      .select('*')
      .eq('receta_id', r.id)
      .order('id')
    if (error) return alert('Error al cargar la receta: ' + error.message)
    const meds = (data as RecetaItem[]) ?? []

    const w = window.open('', '_blank', 'width=800,height=900')
    if (!w) return alert('Permite las ventanas emergentes para imprimir.')

    const logoSrc = `${location.origin}${import.meta.env.BASE_URL}${negocio.logo}`
    const paciente = esc(nombreCliente(r.cliente_id))
    const doctor = esc(nombreDoctor(r.empleado_id))

    const filasMeds = meds
      .map((m) => {
        const partes = [
          esc(m.medicamento ?? ''),
          m.presentacion ? esc(m.presentacion) : '',
          m.indicacion ? esc(m.indicacion) : '',
          m.cantidad ? esc(m.cantidad) : '',
        ].filter((p) => p)
        return `<li><span class="med-nombre">${esc(m.medicamento ?? '')}</span>${
          partes.length > 1 ? ` — ${partes.slice(1).join(' — ')}` : ''
        }</li>`
      })
      .join('')

    const indicacionesHtml = r.indicaciones
      ? `<div class="seccion"><div class="seccion-tit">Indicaciones generales</div><p>${esc(
          r.indicaciones,
        ).replace(/\n/g, '<br>')}</p></div>`
      : ''

    w.document.write(`<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>${esc(codigoReceta(r.codigo))} — Receta</title>
<style>
  * { box-sizing: border-box; }
  body {
    font-family: Georgia, 'Times New Roman', serif;
    color: #1f2937;
    margin: 0;
    padding: 40px 48px;
    line-height: 1.5;
  }
  .encabezado {
    display: flex;
    align-items: center;
    gap: 18px;
    border-bottom: 2px solid #c9a227;
    padding-bottom: 18px;
    margin-bottom: 22px;
  }
  .encabezado img { height: 70px; width: auto; object-fit: contain; }
  .clinica-nombre { font-size: 22px; font-weight: bold; color: #111827; margin: 0; }
  .clinica-datos { font-size: 12px; color: #4b5563; margin-top: 4px; }
  .clinica-datos div { line-height: 1.4; }
  .meta {
    display: flex;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 8px;
    font-size: 14px;
    margin-bottom: 18px;
  }
  .meta .campo { min-width: 45%; }
  .meta .etiqueta { font-weight: bold; color: #374151; }
  .titulo-rx {
    font-size: 30px;
    font-weight: bold;
    letter-spacing: 2px;
    color: #c9a227;
    border-top: 1px solid #e5e7eb;
    border-bottom: 1px solid #e5e7eb;
    padding: 10px 0;
    margin: 10px 0 20px;
  }
  ol.medicamentos { padding-left: 22px; margin: 0 0 20px; }
  ol.medicamentos li { margin-bottom: 12px; font-size: 15px; }
  .med-nombre { font-weight: bold; }
  .seccion { margin-top: 18px; }
  .seccion-tit { font-weight: bold; color: #374151; margin-bottom: 4px; font-size: 14px; }
  .seccion p { margin: 0; font-size: 14px; }
  .firma {
    margin-top: 70px;
    text-align: center;
  }
  .firma .linea {
    width: 260px;
    border-top: 1px solid #374151;
    margin: 0 auto 6px;
  }
  .firma .nombre { font-weight: bold; }
  @page { size: auto; margin: 12mm; }
</style>
</head>
<body>
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

  <div class="meta">
    <div class="campo"><span class="etiqueta">Paciente:</span> ${paciente}</div>
    <div class="campo"><span class="etiqueta">Fecha:</span> ${esc(fechaCorta(r.fecha))}</div>
    <div class="campo"><span class="etiqueta">Dr(a).:</span> ${doctor}</div>
    <div class="campo"><span class="etiqueta">Receta:</span> ${esc(codigoReceta(r.codigo))}</div>
  </div>

  <div class="titulo-rx">RECETA</div>

  ${
    filasMeds
      ? `<ol class="medicamentos">${filasMeds}</ol>`
      : '<p>Sin medicamentos.</p>'
  }

  ${indicacionesHtml}

  <div class="firma">
    <div class="linea"></div>
    <div class="nombre">${doctor}</div>
    <div style="font-size:12px;color:#6b7280;">Firma del doctor(a)</div>
  </div>
</body>
</html>`)
    w.document.close()
    w.focus()
    w.print()
  }

  const columnas: Columna<Receta>[] = [
    {
      header: 'Código',
      cell: (r) => <span className="font-mono font-semibold text-slate-700">{codigoReceta(r.codigo)}</span>,
      sortValue: (r) => r.codigo,
    },
    {
      header: 'Paciente',
      cell: (r) => <span className="font-medium text-slate-800">{nombreCliente(r.cliente_id)}</span>,
      sortValue: (r) => nombreCliente(r.cliente_id),
    },
    {
      header: 'Doctor(a)',
      cell: (r) => <span className="text-slate-600">{nombreDoctor(r.empleado_id)}</span>,
      sortValue: (r) => nombreDoctor(r.empleado_id),
    },
    {
      header: 'Fecha',
      cell: (r) => <span className="text-slate-600">{fechaCorta(r.fecha)}</span>,
      sortValue: (r) => r.fecha,
    },
    {
      header: '',
      align: 'right',
      cell: (r) => (
        <button
          className="btn-ghost"
          onClick={(e) => {
            e.stopPropagation()
            imprimir(r)
          }}
        >
          <Printer size={14} /> Imprimir
        </button>
      ),
    },
  ]

  return (
    <div>
      {pacienteFijo ? (
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-700">{recetas.length} receta(s) médica(s)</h3>
          <button className="btn-primary" onClick={nuevo}>
            <Plus size={16} /> Nueva receta
          </button>
        </div>
      ) : (
        <PageHeader
          title="Recetas"
          subtitle={`${recetas.length} receta(s) médica(s)`}
          action={
            <button className="btn-primary" onClick={nuevo}>
              <Plus size={16} /> Nueva receta
            </button>
          }
        />
      )}

      {loading ? (
        <Cargando />
      ) : (
        <DataTable
          rows={recetas}
          rowKey={(r) => r.id}
          columns={columnas}
          onRowClick={abrirEditar}
          searchText={(r) => `${codigoReceta(r.codigo)} ${nombreCliente(r.cliente_id)}`}
          searchPlaceholder="Buscar por paciente o código…"
          emptyText="Aún no hay recetas. Crea la primera."
          initialSort={{ index: 0, dir: 'desc' }}
        />
      )}

      {/* MODAL crear / editar receta */}
      <Modal
        open={open}
        title={editId ? 'Editar receta' : 'Nueva receta'}
        onClose={() => setOpen(false)}
        footer={
          <>
            <button className="btn-ghost" onClick={() => setOpen(false)}>Cancelar</button>
            <button className="btn-primary" onClick={guardar} disabled={saving}>
              <Save size={16} /> {saving ? 'Guardando…' : 'Guardar'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          {/* Cabecera */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Paciente</label>
              {pacienteFijo ? (
                <input className="input bg-slate-50" value={nombreCliente(clienteId)} readOnly />
              ) : (
                <SelectorPaciente clientes={clientes} value={clienteId} onChange={setClienteId} />
              )}
            </div>
            <div>
              <label className="label">Doctor(a)</label>
              <select className="input" value={empleadoId} onChange={(e) => setEmpleadoId(e.target.value)}>
                <option value="">— Sin asignar —</option>
                {empleados.map((em) => (
                  <option key={em.id} value={em.id}>{em.nombre}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="label">Fecha</label>
            <input type="date" className="input w-48" value={fecha} onChange={(e) => setFecha(e.target.value)} />
          </div>

          {/* Renglones (medicamentos) */}
          <div>
            <label className="label">Medicamentos</label>
            {items.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-6 text-center text-sm text-slate-600">
                Agrega los medicamentos de la receta.
              </div>
            ) : (
              <div className="space-y-3">
                {items.map((l, i) => (
                  <div key={i} className="rounded-xl border-2 border-slate-200 bg-white p-3 shadow-sm">
                    <div className="flex items-start gap-2">
                      <div className="flex-1">
                        <span className="text-xs font-medium text-slate-600">Medicamento</span>
                        <input
                          className="input"
                          placeholder="Ej. Amoxicilina"
                          value={l.medicamento}
                          onChange={(e) => setItem(i, { medicamento: e.target.value })}
                        />
                      </div>
                      <button onClick={() => quitarItem(i)} title="Quitar medicamento" className="mt-5 rounded-lg p-1.5 text-slate-600 hover:bg-rose-50 hover:text-rose-600">
                        <Trash2 size={16} />
                      </button>
                    </div>

                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <div>
                        <span className="text-xs font-medium text-slate-600">Presentación</span>
                        <input
                          className="input"
                          placeholder="Ej. Tabletas 500mg"
                          value={l.presentacion}
                          onChange={(e) => setItem(i, { presentacion: e.target.value })}
                        />
                      </div>
                      <div>
                        <span className="text-xs font-medium text-slate-600">Cantidad</span>
                        <input
                          className="input"
                          placeholder="Ej. #21"
                          value={l.cantidad}
                          onChange={(e) => setItem(i, { cantidad: e.target.value })}
                        />
                      </div>
                    </div>

                    <div className="mt-2">
                      <span className="text-xs font-medium text-slate-600">Indicación</span>
                      <input
                        className="input"
                        placeholder="Ej. 1 cada 8 horas por 7 días"
                        value={l.indicacion}
                        onChange={(e) => setItem(i, { indicacion: e.target.value })}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-2">
              <button className="btn-ghost" onClick={agregarItem}>
                <Plus size={14} /> Agregar medicamento
              </button>
            </div>
          </div>

          {/* Indicaciones generales */}
          <div>
            <label className="label">Indicaciones generales</label>
            <textarea
              className="input"
              rows={3}
              placeholder="Recomendaciones adicionales para el paciente"
              value={indicaciones}
              onChange={(e) => setIndicaciones(e.target.value)}
            />
          </div>

          {/* Imprimir (solo en edición: la receta ya existe) */}
          {editId && (
            <button
              type="button"
              onClick={() => {
                const r = recetas.find((x) => x.id === editId)
                if (r) imprimir(r)
              }}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-brand-200 bg-brand-50 px-3 py-2 text-sm font-semibold text-brand-700 hover:bg-brand-100"
            >
              <Printer size={16} /> Imprimir receta
            </button>
          )}
        </div>
      </Modal>
    </div>
  )
}
