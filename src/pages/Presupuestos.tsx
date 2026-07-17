import { useEffect, useState } from 'react'
import { Plus, Trash2, Save, FileText, Check, Printer, MessageCircle } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { Cliente, Empleado, Servicio, Presupuesto, PresupuestoItem, EstadoPresupuesto } from '../types'
import { money, fechaCorta, hoyISO } from '../lib/format'
import { ESTADOS_PRESUPUESTO, estadoPresupuestoDef } from '../lib/dental'
import { useNegocio } from '../lib/negocio'
import PageHeader from '../components/PageHeader'
import Cargando from '../components/Cargando'
import Modal from '../components/Modal'
import DataTable from '../components/DataTable'
import type { Columna } from '../components/DataTable'
import SelectorPaciente from '../components/SelectorPaciente'

// Datos ya resueltos (cliente, odontólogo, renglones) para imprimir o enviar un presupuesto.
interface DatosPresupuestoImprimir {
  codigo: number | null
  fecha: string
  estado: EstadoPresupuesto
  cliente: Cliente | null
  empleado: Empleado | null
  renglones: { descripcion: string; diente: string; cantidad: number; precio_unit: number }[]
  subtotal: number
  descuento: number
  total: number
  notas: string
}

// Renglón temporal del presupuesto (en edición, antes de guardar)
interface ItemTmp {
  servicio_id: string
  diente: string        // FDI, opcional (texto para permitir vacío)
  descripcion: string
  cantidad: number
  precio_unit: number
}

const itemVacio: ItemTmp = { servicio_id: '', diente: '', descripcion: '', cantidad: 1, precio_unit: 0 }

// Código de presupuesto: P + 4 dígitos
function codigoPresupuesto(codigo: number | null | undefined): string {
  return 'P' + String(codigo ?? 0).padStart(4, '0')
}

export default function Presupuestos({ pacienteFijo }: { pacienteFijo?: string } = {}) {
  const { negocio } = useNegocio()
  const [presupuestos, setPresupuestos] = useState<Presupuesto[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [empleados, setEmpleados] = useState<Empleado[]>([])
  const [servicios, setServicios] = useState<Servicio[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [convirtiendo, setConvirtiendo] = useState(false)

  // formulario del presupuesto
  const [editId, setEditId] = useState<string | null>(null)
  const [editCodigo, setEditCodigo] = useState<number | null>(null)
  const [editEstado, setEditEstado] = useState<EstadoPresupuesto>('BORRADOR')
  const [editFacturaId, setEditFacturaId] = useState<string | null>(null)
  const [clienteId, setClienteId] = useState('')
  const [empleadoId, setEmpleadoId] = useState('')
  const [fecha, setFecha] = useState(hoyISO())
  const [estado, setEstado] = useState<EstadoPresupuesto>('BORRADOR')
  const [descuento, setDescuento] = useState(0)
  const [notas, setNotas] = useState('')
  const [items, setItems] = useState<ItemTmp[]>([])

  // Confirmación antes de enviar por WhatsApp (revisar/corregir el número del paciente)
  const [whatsappDatos, setWhatsappDatos] = useState<DatosPresupuestoImprimir | null>(null)
  const [whatsappTelefono, setWhatsappTelefono] = useState('')
  // Paso 1 (guardar/imprimir el PDF) completado: WhatsApp NO adjunta archivos solo,
  // hay que abrir el PDF primero y luego adjuntarlo a mano en la conversación.
  const [whatsappPdfListo, setWhatsappPdfListo] = useState(false)

  async function cargar() {
    setLoading(true)
    let q = supabase.from('presupuestos').select('*').order('codigo', { ascending: false })
    if (pacienteFijo) q = q.eq('cliente_id', pacienteFijo)
    const [{ data }, { data: cls }] = await Promise.all([
      q,
      supabase.from('clientes').select('*').order('nombre'),
    ])
    setPresupuestos(data ?? [])
    setClientes(cls ?? [])
    setLoading(false)
  }

  async function cargarCatalogos() {
    const [em, se] = await Promise.all([
      supabase.from('empleados').select('*').eq('activo', true).order('nombre'),
      supabase.from('servicios').select('*').eq('activo', true).order('nombre'),
    ])
    setEmpleados(em.data ?? [])
    setServicios(se.data ?? [])
  }

  useEffect(() => {
    cargar()
    cargarCatalogos()
  }, [pacienteFijo])

  function nombreCliente(id: string | null): string {
    if (!id) return 'Sin paciente'
    return clientes.find((c) => c.id === id)?.nombre ?? 'Paciente'
  }

  // Abre una ventana con el plan de tratamiento en formato imprimible (hoja carta).
  // Desde el diálogo de impresión del navegador se puede elegir "Guardar como PDF".
  function imprimirDatosPresupuesto(datos: DatosPresupuestoImprimir) {
    const w = window.open('', '_blank', 'width=850,height=1100')
    if (!w) return alert('Permite las ventanas emergentes para imprimir.')
    const esc = (s: unknown) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
    const filas = datos.renglones
      .map(
        (it) => `<tr>
          <td>${esc(it.descripcion)}${it.diente ? `<div class="por">Diente ${esc(it.diente)}</div>` : ''}</td>
          <td class="c">${it.cantidad}</td>
          <td class="r">${money(it.precio_unit)}</td>
          <td class="r">${money(it.cantidad * it.precio_unit)}</td>
        </tr>`,
      )
      .join('')
    const logoSrc = `${location.origin}${import.meta.env.BASE_URL}${negocio.logo}`
    w.document.write(`<!DOCTYPE html>
<html lang="es"><head><meta charset="utf-8"><title>${esc(codigoPresupuesto(datos.codigo))} — Plan de tratamiento</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; color:#1f2937; margin:0; padding:40px 48px; font-size:13px; }
  .enc { display:flex; align-items:center; gap:18px; border-bottom:3px solid #c9a227; padding-bottom:16px; margin-bottom:18px; }
  .enc img { height:74px; width:auto; object-fit:contain; }
  .clinica { font-size:22px; font-weight:bold; color:#111827; margin:0; }
  .datos { font-size:11px; color:#4b5563; margin-top:3px; line-height:1.4; }
  .tit { text-align:right; margin-left:auto; }
  .tit .lbl { font-size:18px; font-weight:bold; color:#c9a227; letter-spacing:1px; }
  .tit .num { font-size:14px; font-weight:bold; color:#374151; }
  .meta { display:flex; justify-content:space-between; flex-wrap:wrap; gap:6px 24px; margin-bottom:14px; }
  .meta div { font-size:12.5px; }
  .meta .k { font-weight:bold; color:#374151; }
  table { width:100%; border-collapse:collapse; margin-top:6px; }
  thead th { background:#faf3df; border-bottom:2px solid #c9a227; text-align:left; padding:8px 10px; font-size:11px; text-transform:uppercase; letter-spacing:.5px; color:#6b5a17; }
  thead th.c { text-align:center; } thead th.r { text-align:right; }
  tbody td { border-bottom:1px solid #eee; padding:8px 10px; vertical-align:top; }
  tbody td.c { text-align:center; } tbody td.r { text-align:right; white-space:nowrap; }
  .por { font-size:11px; color:#6b7280; margin-top:2px; }
  .tot { margin-top:14px; margin-left:auto; width:280px; }
  .tot .fila { display:flex; justify-content:space-between; padding:3px 0; font-size:13px; color:#4b5563; }
  .tot .total { border-top:2px solid #c9a227; margin-top:4px; padding-top:6px; font-size:16px; font-weight:bold; color:#111827; }
  .notas { margin-top:20px; font-size:12px; color:#4b5563; }
  .pie { margin-top:40px; border-top:1px solid #e5e7eb; padding-top:12px; text-align:center; font-size:11px; color:#6b7280; }
  @page { size: letter; margin: 16mm; }
</style></head><body>
  <div class="enc">
    <img src="${logoSrc}" alt="${esc(negocio.nombre)}">
    <div>
      <p class="clinica">${esc(negocio.nombre)}</p>
      <div class="datos">
        ${negocio.rnc ? `<div>RNC: ${esc(negocio.rnc)}</div>` : ''}
        ${negocio.direccion ? `<div>${esc(negocio.direccion)}${negocio.referencia ? ' · ' + esc(negocio.referencia) : ''}</div>` : ''}
        ${negocio.telefono ? `<div>Tel.: ${esc(negocio.telefono)}${negocio.whatsapp ? ' · WhatsApp: ' + esc(negocio.whatsapp) : ''}</div>` : ''}
      </div>
    </div>
    <div class="tit">
      <div class="lbl">PLAN DE TRATAMIENTO</div>
      <div class="num">${esc(codigoPresupuesto(datos.codigo))}</div>
    </div>
  </div>

  <div class="meta">
    <div><span class="k">Paciente:</span> ${esc(datos.cliente?.nombre ?? 'Sin paciente')}</div>
    <div><span class="k">Fecha:</span> ${esc(fechaCorta(datos.fecha))}</div>
    ${datos.empleado ? `<div><span class="k">Odontólogo:</span> ${esc(datos.empleado.nombre)}</div>` : ''}
    <div><span class="k">Estado:</span> ${esc(estadoPresupuestoDef(datos.estado).label)}</div>
  </div>

  <table>
    <thead><tr>
      <th>Tratamiento</th><th class="c">Cant.</th><th class="r">Precio</th><th class="r">Subtotal</th>
    </tr></thead>
    <tbody>${filas || '<tr><td colspan="4" style="text-align:center;color:#9ca3af;padding:16px;">Sin tratamientos</td></tr>'}</tbody>
  </table>

  <div class="tot">
    <div class="fila"><span>Subtotal</span><span>${money(datos.subtotal)}</span></div>
    ${datos.descuento > 0 ? `<div class="fila"><span>Descuento</span><span>- ${money(datos.descuento)}</span></div>` : ''}
    <div class="fila total"><span>Total</span><span>${money(datos.total)}</span></div>
  </div>

  ${datos.notas ? `<div class="notas"><b>Notas:</b> ${esc(datos.notas)}</div>` : ''}

  <div class="pie">
    <p>Este plan de tratamiento es una estimación y puede variar según la evolución clínica.</p>
    <p>¡Gracias por confiar en ${esc(negocio.nombre)}!</p>
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

  // Mensaje que se enviará por WhatsApp (con el número aparte, para poder revisarlo antes).
  function mensajeWhatsApp(datos: DatosPresupuestoImprimir): string {
    return `Hola ${datos.cliente?.nombre ?? ''} 👋, te compartimos tu plan de tratamiento ${codigoPresupuesto(datos.codigo)} de ${negocio.nombre}.\n\nTotal: ${money(datos.total)}\n\nTe adjuntamos el PDF con el detalle de los tratamientos. ¡Gracias por confiar en nosotros!`
  }

  // Abre la ventana de confirmación (revisar/corregir el número) ANTES de abrir WhatsApp.
  // Es información delicada (paciente, tratamientos, monto): mejor revisar el número
  // a mano que confiar ciegamente en el teléfono guardado en la ficha.
  function enviarPorWhatsAppDatos(datos: DatosPresupuestoImprimir) {
    setWhatsappTelefono(datos.cliente?.telefono ?? '')
    setWhatsappPdfListo(false)
    setWhatsappDatos(datos)
  }

  // Abre WhatsApp con el número YA confirmado y el mensaje ya escrito (el PDF se
  // adjunta a mano: WhatsApp no permite adjuntar archivos automáticamente desde
  // una app web sin la API de pago de WhatsApp Business).
  function confirmarEnvioWhatsApp() {
    if (!whatsappDatos) return
    const tel = whatsappTelefono.replace(/\D/g, '')
    if (!tel) return alert('Escribe el número de WhatsApp del paciente.')
    const numero = tel.length === 10 ? '1' + tel : tel
    window.open(`https://wa.me/${numero}?text=${encodeURIComponent(mensajeWhatsApp(whatsappDatos))}`, '_blank')
    setWhatsappDatos(null)
  }

  // Datos del presupuesto EN EDICIÓN (formulario abierto), listos para imprimir/enviar.
  function datosDelFormulario(): DatosPresupuestoImprimir {
    return {
      codigo: editCodigo,
      fecha,
      estado,
      cliente: clientes.find((c) => c.id === clienteId) ?? null,
      empleado: empleados.find((e) => e.id === empleadoId) ?? null,
      renglones: itemsValidos().map((l) => ({ descripcion: l.descripcion, diente: l.diente, cantidad: l.cantidad, precio_unit: l.precio_unit })),
      subtotal,
      descuento: descuentoMonto,
      total,
      notas,
    }
  }

  // Imprimir/enviar un presupuesto de la LISTA (sin abrir el formulario): trae sus renglones primero.
  async function imprimirDesdeLista(p: Presupuesto) {
    const { data, error } = await supabase.from('presupuesto_items').select('*').eq('presupuesto_id', p.id).order('id')
    if (error) return alert('Error al cargar los tratamientos: ' + error.message)
    imprimirDatosPresupuesto({
      codigo: p.codigo,
      fecha: p.fecha,
      estado: p.estado,
      cliente: clientes.find((c) => c.id === p.cliente_id) ?? null,
      empleado: empleados.find((e) => e.id === p.empleado_id) ?? null,
      renglones: ((data as PresupuestoItem[]) ?? []).map((it) => ({ descripcion: it.descripcion, diente: it.diente == null ? '' : String(it.diente), cantidad: Number(it.cantidad), precio_unit: Number(it.precio_unit) })),
      subtotal: Number(p.subtotal),
      descuento: Number(p.descuento),
      total: Number(p.total),
      notas: p.notas ?? '',
    })
  }

  async function enviarPorWhatsAppDesdeLista(p: Presupuesto) {
    const cliente = clientes.find((c) => c.id === p.cliente_id) ?? null
    enviarPorWhatsAppDatos({
      codigo: p.codigo,
      fecha: p.fecha,
      estado: p.estado,
      cliente,
      empleado: empleados.find((e) => e.id === p.empleado_id) ?? null,
      renglones: [],
      subtotal: Number(p.subtotal),
      descuento: Number(p.descuento),
      total: Number(p.total),
      notas: p.notas ?? '',
    })
  }

  function nuevo() {
    setEditId(null)
    setEditCodigo(null)
    setEditEstado('BORRADOR')
    setEditFacturaId(null)
    setClienteId(pacienteFijo ?? '')
    setEmpleadoId('')
    setFecha(hoyISO())
    setEstado('BORRADOR')
    setDescuento(0)
    setNotas('')
    setItems([{ ...itemVacio }])
    setOpen(true)
  }

  async function abrirEditar(p: Presupuesto) {
    const { data, error } = await supabase
      .from('presupuesto_items')
      .select('*')
      .eq('presupuesto_id', p.id)
      .order('id')
    if (error) return alert('Error al cargar el presupuesto: ' + error.message)
    setEditId(p.id)
    setEditCodigo(p.codigo)
    setEditEstado(p.estado)
    setEditFacturaId(p.factura_id)
    setClienteId(p.cliente_id ?? '')
    setEmpleadoId(p.empleado_id ?? '')
    setFecha(p.fecha)
    setEstado(p.estado)
    setDescuento(Number(p.descuento))
    setNotas(p.notas ?? '')
    setItems(
      ((data as PresupuestoItem[]) ?? []).map((it) => ({
        servicio_id: it.servicio_id ?? '',
        diente: it.diente == null ? '' : String(it.diente),
        descripcion: it.descripcion,
        cantidad: Number(it.cantidad),
        precio_unit: Number(it.precio_unit),
      })),
    )
    setOpen(true)
  }

  function setItem(i: number, patch: Partial<ItemTmp>) {
    setItems((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)))
  }

  // Al elegir un tratamiento, autocompletar descripción y precio
  function elegirServicio(i: number, servicioId: string) {
    const s = servicios.find((x) => x.id === servicioId)
    if (s) {
      setItem(i, { servicio_id: servicioId, descripcion: s.nombre, precio_unit: Number(s.precio) })
    } else {
      setItem(i, { servicio_id: '' })
    }
  }

  function agregarItem() {
    setItems((prev) => [...prev, { ...itemVacio }])
  }

  function quitarItem(i: number) {
    setItems((prev) => prev.filter((_, idx) => idx !== i))
  }

  const subtotal = items.reduce((s, l) => s + l.cantidad * l.precio_unit, 0)
  const descuentoMonto = Math.min(subtotal, Math.max(0, descuento))
  const total = Math.max(0, subtotal - descuentoMonto)

  // Renglones válidos (con descripción y cantidad)
  function itemsValidos(): ItemTmp[] {
    return items.filter((l) => l.descripcion.trim() && l.cantidad > 0)
  }

  async function guardar() {
    const validos = itemsValidos()
    if (!clienteId) return alert('Selecciona el paciente.')
    if (validos.length === 0) return alert('Agrega al menos un tratamiento.')
    setSaving(true)

    const datos = {
      cliente_id: clienteId || null,
      empleado_id: empleadoId || null,
      fecha,
      estado,
      subtotal,
      descuento: descuentoMonto,
      total,
      notas: notas || null,
    }

    let presupuestoId = editId
    if (editId) {
      const { error } = await supabase.from('presupuestos').update(datos).eq('id', editId)
      if (error) {
        setSaving(false)
        return alert('Error al actualizar el presupuesto: ' + error.message)
      }
      // Reemplazar los renglones
      const { error: eDel } = await supabase.from('presupuesto_items').delete().eq('presupuesto_id', editId)
      if (eDel) {
        setSaving(false)
        return alert('Error al actualizar el detalle: ' + eDel.message)
      }
    } else {
      const { data, error } = await supabase
        .from('presupuestos')
        .insert(datos)
        .select()
        .single()
      if (error || !data) {
        setSaving(false)
        return alert('Error al crear el presupuesto: ' + error?.message)
      }
      presupuestoId = (data as Presupuesto).id
    }

    const payload = validos.map((l) => ({
      presupuesto_id: presupuestoId,
      servicio_id: l.servicio_id || null,
      diente: l.diente.trim() ? Number(l.diente) : null,
      descripcion: l.descripcion,
      cantidad: l.cantidad,
      precio_unit: l.precio_unit,
      subtotal: l.cantidad * l.precio_unit,
      estado: 'PENDIENTE',
    }))
    const { error: e2 } = await supabase.from('presupuesto_items').insert(payload)
    if (e2) {
      setSaving(false)
      return alert('Presupuesto guardado pero falló el detalle: ' + e2.message)
    }
    setSaving(false)
    setOpen(false)
    await cargar()
  }

  // Botones rápidos de estado (solo en edición): actualiza estado en la base
  async function marcarEstado(nuevoEstado: EstadoPresupuesto) {
    if (!editId) {
      setEstado(nuevoEstado)
      return
    }
    const { error } = await supabase.from('presupuestos').update({ estado: nuevoEstado }).eq('id', editId)
    if (error) return alert('Error al cambiar el estado: ' + error.message)
    setEstado(nuevoEstado)
    setEditEstado(nuevoEstado)
    await cargar()
  }

  // Convertir un presupuesto APROBADO en una factura de contado.
  // Factura los tratamientos guardados del plan, EXCLUYENDO los cancelados
  // ("No se realizará") y los que ya se facturaron por el panel por visita.
  async function convertirAFactura() {
    if (!editId) return
    if (estado !== 'APROBADO') return alert('Solo se puede facturar un presupuesto aprobado.')

    const { data: dbItems, error: eItems } = await supabase
      .from('presupuesto_items')
      .select('id, servicio_id, descripcion, cantidad, precio_unit, estado, facturado')
      .eq('presupuesto_id', editId)
    if (eItems) return alert('Error al leer los tratamientos: ' + eItems.message)
    const aFacturar = (dbItems ?? []).filter((it: any) => it.estado !== 'CANCELADO' && !it.facturado)
    if (aFacturar.length === 0) {
      return alert('No hay tratamientos para facturar (todos están cancelados o ya facturados).')
    }
    if (!confirm(`¿Crear una factura de contado con ${aFacturar.length} tratamiento(s)?`)) return
    setConvirtiendo(true)

    const sub = aFacturar.reduce((s: number, it: any) => s + Number(it.cantidad) * Number(it.precio_unit), 0)
    const desc = Math.min(sub, Math.max(0, descuento))
    const tot = Math.max(0, sub - desc)

    const { data: factura, error } = await supabase
      .from('facturas')
      .insert({
        cliente_id: clienteId || null,
        cliente_nombre: nombreCliente(clienteId),
        fecha: hoyISO(),
        subtotal: sub,
        descuento: desc,
        itbis: 0,
        total: tot,
        estado: 'PENDIENTE',
        tipo_venta: 'CONTADO',
      })
      .select()
      .single()
    if (error || !factura) {
      setConvirtiendo(false)
      return alert('Error al crear la factura: ' + error?.message)
    }
    const facturaId = (factura as { id: string }).id

    const payload = aFacturar.map((it: any) => ({
      factura_id: facturaId,
      servicio_id: it.servicio_id || null,
      descripcion: it.descripcion,
      cantidad: it.cantidad,
      precio_unit: it.precio_unit,
      importe: Number(it.cantidad) * Number(it.precio_unit),
    }))
    const { error: e2 } = await supabase.from('factura_items').insert(payload)
    if (e2) {
      // No dejar una factura huérfana sin renglones: se elimina.
      await supabase.from('facturas').delete().eq('id', facturaId)
      setConvirtiendo(false)
      return alert('No se pudo crear la factura (falló el detalle): ' + e2.message)
    }

    // Marcar esos tratamientos como facturados (para que el panel por visita no los reofrezca).
    const { error: eMarcar } = await supabase
      .from('presupuesto_items')
      .update({ facturado: true, factura_id: facturaId })
      .in('id', aFacturar.map((it: any) => it.id))
    if (eMarcar) {
      setConvirtiendo(false)
      return alert('La factura se creó, pero no se pudo marcar el plan como facturado. Avisa a administración para evitar doble cobro: ' + eMarcar.message)
    }

    const { error: e3 } = await supabase
      .from('presupuestos')
      .update({ estado: 'FACTURADO', factura_id: facturaId })
      .eq('id', editId)
    if (e3) {
      setConvirtiendo(false)
      return alert('Factura creada pero no se pudo marcar el presupuesto: ' + e3.message)
    }
    setConvirtiendo(false)
    setEstado('FACTURADO')
    setEditEstado('FACTURADO')
    setEditFacturaId(facturaId)
    setOpen(false)
    await cargar()
    alert('Presupuesto convertido a factura correctamente.')
  }

  const columnas: Columna<Presupuesto>[] = [
    { header: 'Código', cell: (p) => <span className="font-mono font-semibold text-slate-700">{codigoPresupuesto(p.codigo)}</span>, sortValue: (p) => p.codigo },
    { header: 'Paciente', cell: (p) => <span className="font-medium text-slate-800">{nombreCliente(p.cliente_id)}</span>, sortValue: (p) => nombreCliente(p.cliente_id) },
    { header: 'Fecha', cell: (p) => <span className="text-slate-600">{fechaCorta(p.fecha)}</span>, sortValue: (p) => p.fecha },
    { header: 'Estado', cell: (p) => <span className={`badge ${estadoPresupuestoDef(p.estado).color}`}>{estadoPresupuestoDef(p.estado).label}</span>, sortValue: (p) => p.estado },
    { header: 'Total', align: 'right', cell: (p) => <span className="font-semibold text-slate-800">{money(p.total)}</span>, sortValue: (p) => p.total },
    {
      header: '', align: 'right', cell: (p) => (
        <div className="flex justify-end gap-1">
          <button title="Imprimir / Guardar como PDF" onClick={(e) => { e.stopPropagation(); imprimirDesdeLista(p) }} className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 hover:text-brand-600">
            <Printer size={16} />
          </button>
          <button title="Enviar por WhatsApp" onClick={(e) => { e.stopPropagation(); enviarPorWhatsAppDesdeLista(p) }} className="rounded-lg p-2 text-slate-600 hover:bg-emerald-50 hover:text-emerald-600">
            <MessageCircle size={16} />
          </button>
        </div>
      ),
    },
  ]

  const facturado = editEstado === 'FACTURADO' || !!editFacturaId

  return (
    <div>
      {pacienteFijo ? (
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-700">{presupuestos.length} plan(es) de tratamiento</h3>
          <button className="btn-primary" onClick={nuevo}>
            <Plus size={16} /> Nuevo presupuesto
          </button>
        </div>
      ) : (
        <PageHeader
          title="Presupuestos"
          subtitle={`${presupuestos.length} plan(es) de tratamiento`}
          action={
            <button className="btn-primary" onClick={nuevo}>
              <Plus size={16} /> Nuevo presupuesto
            </button>
          }
        />
      )}

      {loading ? (
        <Cargando />
      ) : (
        <DataTable
          rows={presupuestos}
          rowKey={(p) => p.id}
          columns={columnas}
          onRowClick={abrirEditar}
          searchText={(p) => `${codigoPresupuesto(p.codigo)} ${nombreCliente(p.cliente_id)} ${p.estado}`}
          searchPlaceholder="Buscar por paciente o código…"
          emptyText="Aún no hay presupuestos. Crea el primero."
          initialSort={{ index: 0, dir: 'desc' }}
        />
      )}

      {/* MODAL crear / editar presupuesto */}
      <Modal
        open={open}
        title={editId ? 'Editar presupuesto' : 'Nuevo presupuesto'}
        onClose={() => setOpen(false)}
        footer={
          <>
            {editId && (
              <>
                <button className="btn-ghost" onClick={() => imprimirDatosPresupuesto(datosDelFormulario())} title="Imprimir o guardar como PDF">
                  <Printer size={16} /> Imprimir / PDF
                </button>
                <button className="btn-ghost !text-emerald-700" onClick={() => enviarPorWhatsAppDatos(datosDelFormulario())} title="Enviar por WhatsApp">
                  <MessageCircle size={16} /> WhatsApp
                </button>
              </>
            )}
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
              <label className="label">Odontólogo</label>
              <select className="input" value={empleadoId} onChange={(e) => setEmpleadoId(e.target.value)}>
                <option value="">— Sin asignar —</option>
                {empleados.map((em) => (
                  <option key={em.id} value={em.id}>{em.nombre}</option>
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
              <label className="label">Estado</label>
              <select className="input" value={estado} onChange={(e) => setEstado(e.target.value as EstadoPresupuesto)}>
                {ESTADOS_PRESUPUESTO.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Acciones rápidas de estado (solo en edición) */}
          {editId && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium text-slate-600">Marcar como:</span>
              {([
                ['PRESENTADO', 'Presentado', 'bg-blue-600 text-white ring-blue-300', 'bg-blue-50 text-blue-700 hover:bg-blue-100'],
                ['APROBADO', 'Aprobado', 'bg-emerald-600 text-white ring-emerald-300', 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'],
                ['RECHAZADO', 'Rechazado', 'bg-rose-600 text-white ring-rose-300', 'bg-rose-50 text-rose-700 hover:bg-rose-100'],
              ] as const).map(([val, label, activo, inactivo]) => {
                const sel = estado === val
                return (
                  <button key={val} type="button" onClick={() => marcarEstado(val)}
                    aria-pressed={sel}
                    className={`inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold shadow-sm transition ${sel ? `${activo} ring-2` : inactivo}`}>
                    {sel && <Check size={13} strokeWidth={3} />}
                    {label}
                  </button>
                )
              })}
            </div>
          )}

          {/* Renglones (tratamientos) */}
          <div>
            <label className="label">Tratamientos</label>
            {items.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-6 text-center text-sm text-slate-600">
                Agrega los tratamientos del plan.
              </div>
            ) : (
              <div className="space-y-3">
                {items.map((l, i) => (
                  <div key={i} className="rounded-xl border-2 border-slate-200 bg-white p-3 shadow-sm">
                    <div className="flex items-start gap-2">
                      <div className="flex-1">
                        <span className="text-xs font-medium text-slate-600">Tratamiento</span>
                        <select className="input" value={l.servicio_id} onChange={(e) => elegirServicio(i, e.target.value)}>
                          <option value="">— Selecciona o escribe abajo —</option>
                          {servicios.map((s) => (
                            <option key={s.id} value={s.id}>{s.nombre}</option>
                          ))}
                        </select>
                      </div>
                      <button onClick={() => quitarItem(i)} title="Quitar tratamiento" className="mt-5 rounded-lg p-1.5 text-slate-600 hover:bg-rose-50 hover:text-rose-600">
                        <Trash2 size={16} />
                      </button>
                    </div>

                    <div className="mt-2">
                      <span className="text-xs font-medium text-slate-600">Descripción</span>
                      <input
                        className="input"
                        placeholder="Descripción del tratamiento"
                        value={l.descripcion}
                        onChange={(e) => setItem(i, { descripcion: e.target.value })}
                      />
                    </div>

                    <div className="mt-2 grid grid-cols-4 gap-2">
                      <div>
                        <span className="text-xs font-medium text-slate-600">Diente</span>
                        <input type="number" className="input" placeholder="FDI" value={l.diente} onChange={(e) => setItem(i, { diente: e.target.value })} />
                      </div>
                      <div>
                        <span className="text-xs font-medium text-slate-600">Cant.</span>
                        <input type="number" min={1} className="input" value={l.cantidad || ''} onChange={(e) => setItem(i, { cantidad: Number(e.target.value) })} />
                      </div>
                      <div>
                        <span className="text-xs font-medium text-slate-600">Precio</span>
                        <input type="number" min={0} step={50} className="input" value={l.precio_unit || ''} onChange={(e) => setItem(i, { precio_unit: Number(e.target.value) })} />
                      </div>
                      <div>
                        <span className="text-xs font-medium text-slate-600">Subtotal</span>
                        <input className="input bg-slate-50" value={money(l.cantidad * l.precio_unit)} readOnly />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-2">
              <button className="btn-ghost" onClick={agregarItem}>
                <Plus size={14} /> Agregar tratamiento
              </button>
            </div>
          </div>

          {/* Descuento */}
          <div>
            <label className="label">Descuento (RD$)</label>
            <input type="number" min={0} step={50} className="input w-40" value={descuento || ''} onChange={(e) => setDescuento(Number(e.target.value))} />
          </div>

          {/* Totales */}
          <div className="rounded-lg bg-slate-50 p-3 text-sm">
            <div className="flex justify-between text-slate-600"><span>Subtotal</span><span>{money(subtotal)}</span></div>
            {descuentoMonto > 0 && <div className="flex justify-between text-slate-600"><span>Descuento</span><span>- {money(descuentoMonto)}</span></div>}
            <div className="mt-1 flex justify-between border-t border-slate-200 pt-1 text-base font-bold text-slate-800"><span>Total</span><span>{money(total)}</span></div>
          </div>

          {/* Notas */}
          <div>
            <label className="label">Notas</label>
            <textarea className="input" rows={2} value={notas} onChange={(e) => setNotas(e.target.value)} />
          </div>

          {/* Convertir a factura (solo APROBADO y aún no facturado) */}
          {editId && estado === 'APROBADO' && !facturado && (
            <button type="button" onClick={convertirAFactura} disabled={convirtiendo} className="flex w-full items-center justify-center gap-2 rounded-xl border border-brand-200 bg-brand-50 px-3 py-2 text-sm font-semibold text-brand-700 hover:bg-brand-100 disabled:opacity-60">
              <FileText size={16} /> {convirtiendo ? 'Convirtiendo…' : 'Convertir a factura'}
            </button>
          )}
          {facturado && (
            <p className="flex items-center justify-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800">
              <FileText size={16} /> Este presupuesto ya fue facturado.
            </p>
          )}
        </div>
      </Modal>

      {/* Confirmación antes de enviar por WhatsApp: revisar número + guiar el adjunto del PDF */}
      <Modal
        open={!!whatsappDatos}
        title="Enviar por WhatsApp"
        onClose={() => setWhatsappDatos(null)}
        footer={
          <>
            <button className="btn-ghost" onClick={() => setWhatsappDatos(null)}>Cancelar</button>
            <button className="btn-primary !bg-emerald-600" onClick={confirmarEnvioWhatsApp}>
              <MessageCircle size={16} /> 2. Abrir WhatsApp
            </button>
          </>
        }
      >
        {whatsappDatos && (
          <div className="space-y-4">
            <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">
              WhatsApp no permite que ninguna app adjunte un archivo solo. Por eso son 2 pasos: primero guardas el PDF, luego lo adjuntas tú misma en la conversación (con el clip 📎).
            </p>

            <div className="rounded-xl border border-slate-200 p-3">
              <p className="mb-2 text-sm font-semibold text-slate-800">Paso 1 · Guarda el PDF</p>
              <button
                type="button"
                className="btn-ghost w-full"
                onClick={() => { imprimirDatosPresupuesto(whatsappDatos); setWhatsappPdfListo(true) }}
              >
                <Printer size={16} /> Imprimir / guardar como PDF
              </button>
              {whatsappPdfListo && (
                <p className="mt-2 flex items-center gap-1 text-xs font-medium text-emerald-600">
                  <Check size={13} strokeWidth={3} /> Listo, ya se abrió el PDF. Guárdalo (o imprímelo) desde ahí.
                </p>
              )}
            </div>

            <div>
              <label className="label">Paciente</label>
              <input className="input bg-slate-50" value={whatsappDatos.cliente?.nombre ?? 'Sin paciente'} readOnly />
            </div>
            <div>
              <label className="label">Número de WhatsApp</label>
              <input
                className="input"
                value={whatsappTelefono}
                onChange={(e) => setWhatsappTelefono(e.target.value)}
                placeholder="Ej: 809-555-1234"
              />
              {!whatsappDatos.cliente?.telefono && (
                <p className="mt-1 text-xs text-amber-600">Este paciente no tiene teléfono guardado en su ficha. Escríbelo aquí para este envío.</p>
              )}
            </div>
            <div>
              <label className="label">Mensaje</label>
              <textarea className="input" rows={5} readOnly value={mensajeWhatsApp(whatsappDatos)} />
            </div>

            <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3">
              <p className="text-sm font-semibold text-slate-800">Paso 2 · Abre WhatsApp y adjunta el PDF</p>
              <p className="mt-1 text-xs text-slate-600">
                Al tocar "2. Abrir WhatsApp" se abre la conversación con el mensaje ya escrito. Ahí toca el <b>clip 📎</b> (o el ícono de adjuntar documento) y elige el PDF que guardaste en el Paso 1.
              </p>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
