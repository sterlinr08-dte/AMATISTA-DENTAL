import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Plus, Pencil, Trash2, UserPlus, ShieldCheck, Users as UsersIcon, Store, Tags, Truck, ScrollText, Percent, Hash, Printer, Download, ReceiptText, MessagesSquare } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { MODULOS, ACCIONES, etiquetaPermiso, Rol } from '../lib/permisos'
import { Empleado, Proveedor, Auditoria, SecuenciaNcf } from '../types'
import { fechaHora, conPrefijo } from '../lib/format'
import { PREFIJOS_DEFAULT } from '../lib/constants'
import { imprimirHTML } from '../lib/impresora'
import { useAuth } from '../lib/auth'
import { useNegocio } from '../lib/negocio'
import PageHeader from '../components/PageHeader'
import Cargando from '../components/Cargando'
import Modal from '../components/Modal'
import DataTable from '../components/DataTable'
import AjustesChat from '../components/AjustesChat'
import Paginacion, { usePaginacion } from '../components/Paginacion'

const MODULO_LABEL: Record<string, string> = {
  facturas: 'Facturación', compras: 'Compras', pagos_empleados: 'Pagos a empleados', caja_sesiones: 'Caja',
  factura_abonos: 'Cobros a crédito', compra_abonos: 'Pagos a proveedor', gastos: 'Gastos', articulos: 'Artículos',
  clientes: 'Clientes', servicios: 'Servicios', empleados: 'Empleados', proveedores: 'Proveedores', perfiles: 'Usuarios',
}

interface UsuarioRow {
  id: string
  nombre: string | null
  username: string | null
  email: string | null
  rol_key: string | null
  empleado_id: string | null
  activo: boolean
  roles: { nombre: string } | null
}

export default function Configuracion() {
  const { perfil, recargarPerfil } = useAuth()
  const { negocio, recargarNegocio } = useNegocio()
  const [params] = useSearchParams()
  const [tab, setTab] = useState<'usuarios' | 'roles' | 'proveedores' | 'negocio' | 'prefijos' | 'impresora' | 'comprobantes' | 'categorias' | 'comisiones' | 'chat' | 'auditoria'>(params.get('tab') === 'impresora' ? 'impresora' : params.get('tab') === 'comprobantes' ? 'comprobantes' : params.get('tab') === 'chat' ? 'chat' : 'usuarios')
  const [pruebaOpen, setPruebaOpen] = useState(false)
  const [qzMsg, setQzMsg] = useState<{ ok: boolean; texto: string } | null>(null)
  const [qzProbando, setQzProbando] = useState(false)

  async function probarQZ() {
    setQzProbando(true)
    setQzMsg(null)
    const ancho = Number(formNeg.ancho_ticket) || 58
    const html = `<div style="width:${ancho}mm;margin:0 auto;text-align:center;font-family:Arial,sans-serif;font-size:12px;color:#000">`
      + `<div style="font-size:15px;font-weight:bold">${negocio.nombre}</div>`
      + `<div style="margin-top:4px;font-weight:bold">PRUEBA DE IMPRESIÓN DIRECTA</div>`
      + `<div>QZ Tray · ${ancho} mm</div>`
      + `<div style="margin:6px 0">Si esto salió SIN ningún cuadro,<br/>¡la impresión directa quedó lista! ✅</div>`
      + `<div style="font-size:10px">${negocio.direccion || ''}</div></div>`
    try {
      await imprimirHTML(html, ancho)
      setQzMsg({ ok: true, texto: 'Enviado a la impresora vía QZ Tray. Revisa que haya salido el ticket.' })
    } catch (e) {
      setQzMsg({ ok: false, texto: 'No se pudo imprimir por QZ Tray: ' + (e instanceof Error ? e.message : String(e)) + '. ¿Está instalado, abierto y con el certificado puesto?' })
    } finally {
      setQzProbando(false)
    }
  }
  const [auditoria, setAuditoria] = useState<Auditoria[]>([])
  const [usuarios, setUsuarios] = useState<UsuarioRow[]>([])
  const [roles, setRoles] = useState<Rol[]>([])
  const [empleados, setEmpleados] = useState<Empleado[]>([])
  const [loading, setLoading] = useState(true)

  // proveedores
  const [proveedores, setProveedores] = useState<Proveedor[]>([])
  const [openP, setOpenP] = useState(false)
  const [editP, setEditP] = useState<Proveedor | null>(null)
  const [formP, setFormP] = useState({ nombre: '', telefono: '', contacto: '', notas: '', activo: true })
  const [savingP, setSavingP] = useState(false)
  const pagProv = usePaginacion(proveedores, 10)

  // datos del negocio
  const [formNeg, setFormNeg] = useState({ nombre: '', direccion: '', referencia: '', telefono: '', whatsapp: '', instagram: '', rnc: '', razon_social: '', comprobantes_activos: false, modo_comprobante: 'tradicional' as 'tradicional' | 'electronico', ecf_proveedor: '', ecf_api_url: '', ecf_api_token: '', ecf_ambiente: 'prueba' as 'prueba' | 'produccion', ecf_emision_auto: false, wa_plantilla: '', ancho_ticket: 58, auto_imprimir: true, descuento_limite_pct: 100, ...PREFIJOS_DEFAULT })
  const [savingNeg, setSavingNeg] = useState(false)

  // comprobantes fiscales (secuencias NCF / e-CF)
  const [secuencias, setSecuencias] = useState<SecuenciaNcf[]>([])
  const [openS, setOpenS] = useState(false)
  const [editS, setEditS] = useState<SecuenciaNcf | null>(null)
  const [formS, setFormS] = useState({ prefijo: '', secuencia_desde: '', secuencia_hasta: '', secuencia_actual: '', vencimiento: '', activo: false })
  const [savingS, setSavingS] = useState(false)

  // categorías
  const [categorias, setCategorias] = useState<{ id: string; nombre: string; tipo: string }[]>([])
  const [catNombre, setCatNombre] = useState('')
  const [catTipo, setCatTipo] = useState<'articulo' | 'servicio'>('articulo')

  // comisiones (% por empleado y por servicio, editables en una sola pantalla)
  const [servicios, setServicios] = useState<{ id: string; nombre: string; categoria: string; comision_pct: number | null }[]>([])
  const [comEmp, setComEmp] = useState<Record<string, string>>({})
  const [comServ, setComServ] = useState<Record<string, string>>({})
  const [savingCom, setSavingCom] = useState(false)

  // modal usuario
  const [openU, setOpenU] = useState(false)
  const [editU, setEditU] = useState<UsuarioRow | null>(null)
  const [formU, setFormU] = useState({ nombre: '', usuario: '', password: '', rol_key: '', empleado_id: '', activo: true })
  const [savingU, setSavingU] = useState(false)

  // modal rol
  const [openR, setOpenR] = useState(false)
  const [editR, setEditR] = useState<Rol | null>(null)
  const [formR, setFormR] = useState<{ key: string; nombre: string; permisos: string[] }>({ key: '', nombre: '', permisos: [] })
  const [savingR, setSavingR] = useState(false)

  async function cargar() {
    setLoading(true)
    const [u, r, e] = await Promise.all([
      supabase.from('perfiles').select('id,nombre,username,email,rol_key,empleado_id,activo, roles(nombre)').order('nombre'),
      supabase.from('roles').select('*').order('nombre'),
      supabase.from('empleados').select('*').eq('activo', true).order('nombre'),
    ])
    setUsuarios((u.data as any) ?? [])
    setRoles((r.data as any) ?? [])
    const emps = (e.data as Empleado[]) ?? []
    setEmpleados(emps)
    setComEmp(Object.fromEntries(emps.map((emp) => [emp.id, String(Number(emp.comision_pct ?? 0))])))
    const { data: servs } = await supabase.from('servicios').select('id,nombre,categoria,comision_pct').eq('activo', true).order('categoria').order('nombre')
    const sl = (servs as any[]) ?? []
    setServicios(sl)
    setComServ(Object.fromEntries(sl.map((s) => [s.id, s.comision_pct == null ? '' : String(Number(s.comision_pct))])))
    const { data: neg } = await supabase.from('ajustes_negocio').select('*').maybeSingle()
    if (neg) setFormNeg({
      nombre: neg.nombre ?? '', direccion: neg.direccion ?? '', referencia: neg.referencia ?? '',
      telefono: neg.telefono ?? '', whatsapp: neg.whatsapp ?? '', instagram: neg.instagram ?? '', rnc: neg.rnc ?? '',
      razon_social: neg.razon_social ?? '',
      comprobantes_activos: neg.comprobantes_activos ?? false,
      modo_comprobante: (neg.modo_comprobante === 'electronico' ? 'electronico' : 'tradicional'),
      ecf_proveedor: neg.ecf_proveedor ?? '',
      ecf_api_url: neg.ecf_api_url ?? '',
      ecf_api_token: neg.ecf_api_token ?? '',
      ecf_ambiente: (neg.ecf_ambiente === 'produccion' ? 'produccion' : 'prueba'),
      ecf_emision_auto: neg.ecf_emision_auto ?? false,
      wa_plantilla: neg.wa_plantilla ?? '',
      ancho_ticket: Number(neg.ancho_ticket ?? 58),
      auto_imprimir: neg.auto_imprimir ?? true,
      descuento_limite_pct: Number(neg.descuento_limite_pct ?? 100),
      prefijo_caja: neg.prefijo_caja ?? PREFIJOS_DEFAULT.prefijo_caja,
      prefijo_gasto: neg.prefijo_gasto ?? PREFIJOS_DEFAULT.prefijo_gasto,
      prefijo_pago: neg.prefijo_pago ?? PREFIJOS_DEFAULT.prefijo_pago,
      prefijo_cita: neg.prefijo_cita ?? PREFIJOS_DEFAULT.prefijo_cita,
      prefijo_compra: neg.prefijo_compra ?? PREFIJOS_DEFAULT.prefijo_compra,
      prefijo_cliente: neg.prefijo_cliente ?? PREFIJOS_DEFAULT.prefijo_cliente,
      prefijo_proveedor: neg.prefijo_proveedor ?? PREFIJOS_DEFAULT.prefijo_proveedor,
      prefijo_articulo: neg.prefijo_articulo ?? PREFIJOS_DEFAULT.prefijo_articulo,
      prefijo_mobiliario: neg.prefijo_mobiliario ?? PREFIJOS_DEFAULT.prefijo_mobiliario,
    })
    const { data: cats } = await supabase.from('categorias').select('id,nombre,tipo').order('tipo').order('nombre')
    setCategorias((cats as any) ?? [])
    const { data: prov } = await supabase.from('proveedores').select('*').order('nombre')
    setProveedores((prov as any) ?? [])
    const { data: secs } = await supabase.from('secuencias_ncf').select('*').order('electronico').order('tipo')
    setSecuencias((secs as any) ?? [])
    const { data: aud } = await supabase.from('auditoria').select('id,fecha,usuario,modulo,accion,descripcion,registro_id').order('fecha', { ascending: false }).limit(1000)
    setAuditoria((aud as any) ?? [])
    setLoading(false)
  }

  // ---------- PROVEEDORES ----------
  function nuevoProveedor() {
    setEditP(null)
    setFormP({ nombre: '', telefono: '', contacto: '', notas: '', activo: true })
    setOpenP(true)
  }
  function editarProveedor(p: Proveedor) {
    setEditP(p)
    setFormP({ nombre: p.nombre, telefono: p.telefono ?? '', contacto: p.contacto ?? '', notas: p.notas ?? '', activo: p.activo })
    setOpenP(true)
  }
  async function guardarProveedor() {
    if (!formP.nombre.trim()) return alert('El nombre del proveedor es obligatorio')
    setSavingP(true)
    const payload = {
      nombre: formP.nombre.trim(),
      telefono: formP.telefono || null,
      contacto: formP.contacto || null,
      notas: formP.notas || null,
      activo: formP.activo,
    }
    const { error } = editP
      ? await supabase.from('proveedores').update(payload).eq('id', editP.id)
      : await supabase.from('proveedores').insert(payload)
    setSavingP(false)
    if (error) return alert('Error: ' + error.message)
    setOpenP(false)
    cargar()
  }
  async function eliminarProveedor(p: Proveedor) {
    if (!confirm(`¿Eliminar al proveedor "${p.nombre}"? Las compras ya registradas no cambian.`)) return
    const { error } = await supabase.from('proveedores').delete().eq('id', p.id)
    if (error) return alert('Error: ' + error.message)
    cargar()
  }

  async function agregarCategoria() {
    if (!catNombre.trim()) return alert('Escribe el nombre de la categoría')
    const { error } = await supabase.from('categorias').insert({ nombre: catNombre.trim(), tipo: catTipo })
    if (error) return alert(error.message.includes('duplicate') ? 'Esa categoría ya existe' : 'Error: ' + error.message)
    setCatNombre('')
    cargar()
  }

  async function eliminarCategoria(id: string) {
    if (!confirm('¿Eliminar esta categoría? Los registros que ya la usan no cambian.')) return
    const { error } = await supabase.from('categorias').delete().eq('id', id)
    if (error) return alert('Error: ' + error.message)
    cargar()
  }

  // ---------- COMISIONES ----------
  // Valida un % escrito: '' permitido (en servicios = heredar). Devuelve número o null, o false si inválido.
  function parsePct(valor: string, permitirVacio: boolean): number | null | false {
    const v = valor.trim()
    if (v === '') return permitirVacio ? null : 0
    const n = Number(v)
    if (!Number.isFinite(n) || n < 0 || n > 100) return false
    return n
  }

  async function guardarComisiones() {
    // Empleados: vacío = 0%. Servicios: vacío = hereda del empleado.
    const empUpd: { id: string; comision_pct: number }[] = []
    for (const emp of empleados) {
      const p = parsePct(comEmp[emp.id] ?? '', false)
      if (p === false) return alert(`El % de ${emp.nombre} debe ser un número entre 0 y 100.`)
      empUpd.push({ id: emp.id, comision_pct: p as number })
    }
    const servUpd: { id: string; comision_pct: number | null }[] = []
    for (const s of servicios) {
      const p = parsePct(comServ[s.id] ?? '', true)
      if (p === false) return alert(`El % de "${s.nombre}" debe estar entre 0 y 100, o vacío para heredar.`)
      servUpd.push({ id: s.id, comision_pct: p as number | null })
    }
    setSavingCom(true)
    const res = await Promise.all([
      ...empUpd.map((u) => supabase.from('empleados').update({ comision_pct: u.comision_pct }).eq('id', u.id)),
      ...servUpd.map((u) => supabase.from('servicios').update({ comision_pct: u.comision_pct }).eq('id', u.id)),
    ])
    setSavingCom(false)
    const err = res.find((r) => r.error)
    if (err?.error) return alert('Error al guardar: ' + err.error.message)
    cargar()
    alert('Comisiones actualizadas ✓')
  }

  async function guardarNegocio() {
    if (!formNeg.nombre.trim()) return alert('El nombre del negocio es obligatorio')
    setSavingNeg(true)
    const { error } = await supabase.from('ajustes_negocio').update({ ...formNeg, updated_at: new Date().toISOString() }).eq('id', true)
    setSavingNeg(false)
    if (error) return alert('Error: ' + error.message)
    await recargarNegocio()
    alert('Datos del negocio actualizados ✓')
  }

  // ---------- COMPROBANTES (secuencias NCF / e-CF) ----------
  function editarSecuencia(s: SecuenciaNcf) {
    setEditS(s)
    setFormS({
      prefijo: s.prefijo ?? s.tipo,
      secuencia_desde: s.secuencia_desde == null ? '' : String(s.secuencia_desde),
      secuencia_hasta: s.secuencia_hasta == null ? '' : String(s.secuencia_hasta),
      secuencia_actual: s.secuencia_actual == null ? '' : String(s.secuencia_actual),
      vencimiento: s.vencimiento ?? '',
      activo: s.activo,
    })
    setOpenS(true)
  }

  async function guardarSecuencia() {
    if (!editS) return
    const desde = formS.secuencia_desde.trim() === '' ? null : Number(formS.secuencia_desde)
    const hasta = formS.secuencia_hasta.trim() === '' ? null : Number(formS.secuencia_hasta)
    const actual = formS.secuencia_actual.trim() === '' ? (desde ?? null) : Number(formS.secuencia_actual)
    if (formS.activo) {
      if (!formS.prefijo.trim()) return alert('El prefijo es obligatorio (ej. B02 o E32).')
      if (desde == null || hasta == null) return alert('Indica el rango autorizado (desde y hasta).')
      if (desde < 1 || hasta < desde) return alert('El rango no es válido: "hasta" debe ser mayor o igual que "desde".')
      if (actual == null || actual < desde || actual > hasta) return alert('El "próximo" debe estar dentro del rango autorizado.')
    }
    setSavingS(true)
    const { error } = await supabase.from('secuencias_ncf').update({
      prefijo: formS.prefijo.trim() || editS.tipo,
      secuencia_desde: desde,
      secuencia_hasta: hasta,
      secuencia_actual: actual,
      vencimiento: formS.vencimiento || null,
      activo: formS.activo,
      updated_at: new Date().toISOString(),
    }).eq('id', editS.id)
    setSavingS(false)
    if (error) return alert('Error al guardar la secuencia: ' + error.message)
    setOpenS(false)
    cargar()
  }

  useEffect(() => {
    cargar()
  }, [])

  // ---------- USUARIOS ----------
  function nuevoUsuario() {
    setEditU(null)
    setFormU({ nombre: '', usuario: '', password: '', rol_key: roles[0]?.key ?? '', empleado_id: '', activo: true })
    setOpenU(true)
  }
  function editarUsuario(u: UsuarioRow) {
    setEditU(u)
    setFormU({ nombre: u.nombre ?? '', usuario: u.username ?? '', password: '', rol_key: u.rol_key ?? '', empleado_id: u.empleado_id ?? '', activo: u.activo })
    setOpenU(true)
  }

  function elegirEmpleado(id: string) {
    const emp = empleados.find((e) => e.id === id)
    setFormU((f) => ({ ...f, empleado_id: id, nombre: emp ? emp.nombre : f.nombre }))
  }

  async function guardarUsuario() {
    if (!editU && !formU.empleado_id) return alert('Selecciona el empleado')
    if (!editU && (!formU.usuario || !formU.password)) return alert('Usuario y contraseña son obligatorios')
    if (!editU && formU.password.length < 6) return alert('La contraseña debe tener al menos 6 caracteres')
    setSavingU(true)
    const accion = editU ? 'actualizar' : 'crear'
    const payload: any = editU
      ? { accion, id: editU.id, nombre: formU.nombre, rol_key: formU.rol_key, empleado_id: formU.empleado_id || null, activo: formU.activo }
      : { accion, username: formU.usuario, password: formU.password, nombre: formU.nombre, rol_key: formU.rol_key, empleado_id: formU.empleado_id || null }
    if (editU && formU.password) payload.password = formU.password
    const { data, error } = await supabase.functions.invoke('gestionar-usuarios', { body: payload })
    setSavingU(false)
    if (error || (data as any)?.error) return alert('Error: ' + (((data as any)?.error) || error?.message))
    setOpenU(false)
    cargar()
    if (editU?.id === perfil?.id) recargarPerfil()
  }

  async function eliminarUsuario(u: UsuarioRow) {
    if (u.id === perfil?.id) return alert('No puedes eliminar tu propio usuario')
    if (!confirm(`¿Eliminar al usuario "${u.nombre || u.email}"? No podrá iniciar sesión.`)) return
    const { data, error } = await supabase.functions.invoke('gestionar-usuarios', { body: { accion: 'eliminar', id: u.id } })
    if (error || (data as any)?.error) return alert('Error: ' + (((data as any)?.error) || error?.message))
    cargar()
  }

  // ---------- ROLES ----------
  function nuevoRol() {
    setEditR(null)
    setFormR({ key: '', nombre: '', permisos: ['panel'] })
    setOpenR(true)
  }
  function editarRol(r: Rol) {
    setEditR(r)
    setFormR({ key: r.key, nombre: r.nombre, permisos: r.permisos ?? [] })
    setOpenR(true)
  }
  function toggleModulo(m: string) {
    setFormR((f) => ({
      ...f,
      permisos: f.permisos.includes(m) ? f.permisos.filter((x) => x !== m) : [...f.permisos, m],
    }))
  }

  async function guardarRol() {
    if (!formR.nombre.trim()) return alert('El nombre del rol es obligatorio')
    setSavingR(true)
    let error
    if (editR) {
      ;({ error } = await supabase.from('roles').update({ nombre: formR.nombre, permisos: formR.permisos }).eq('key', editR.key))
    } else {
      const key = formR.nombre.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
      ;({ error } = await supabase.from('roles').insert({ key, nombre: formR.nombre, permisos: formR.permisos }))
    }
    setSavingR(false)
    if (error) return alert('Error: ' + error.message)
    setOpenR(false)
    cargar()
    recargarPerfil()
  }

  async function eliminarRol(r: Rol) {
    if (r.protegido) return alert('Este rol no se puede eliminar')
    if (!confirm(`¿Eliminar el rol "${r.nombre}"?`)) return
    const { error } = await supabase.from('roles').delete().eq('key', r.key)
    if (error) return alert('Error: ' + error.message)
    cargar()
  }

  return (
    <div>
      <PageHeader title="Configuración" subtitle="Usuarios, roles y niveles de acceso" />

      <div className="mb-5 flex gap-2">
        <button onClick={() => setTab('usuarios')} className={tab === 'usuarios' ? 'btn-primary' : 'btn-ghost'}>
          <UsersIcon size={16} /> Usuarios
        </button>
        <button onClick={() => setTab('roles')} className={tab === 'roles' ? 'btn-primary' : 'btn-ghost'}>
          <ShieldCheck size={16} /> Roles y permisos
        </button>
        <button onClick={() => setTab('proveedores')} className={tab === 'proveedores' ? 'btn-primary' : 'btn-ghost'}>
          <Truck size={16} /> Proveedores
        </button>
        <button onClick={() => setTab('negocio')} className={tab === 'negocio' ? 'btn-primary' : 'btn-ghost'}>
          <Store size={16} /> Negocio
        </button>
        <button onClick={() => setTab('prefijos')} className={tab === 'prefijos' ? 'btn-primary' : 'btn-ghost'}>
          <Hash size={16} /> Prefijos
        </button>
        <button onClick={() => setTab('impresora')} className={tab === 'impresora' ? 'btn-primary' : 'btn-ghost'}>
          <Printer size={16} /> Impresora
        </button>
        <button onClick={() => setTab('comprobantes')} className={tab === 'comprobantes' ? 'btn-primary' : 'btn-ghost'}>
          <ReceiptText size={16} /> Comprobantes DGII
        </button>
        <button onClick={() => setTab('categorias')} className={tab === 'categorias' ? 'btn-primary' : 'btn-ghost'}>
          <Tags size={16} /> Categorías
        </button>
        <button onClick={() => setTab('comisiones')} className={tab === 'comisiones' ? 'btn-primary' : 'btn-ghost'}>
          <Percent size={16} /> Comisiones
        </button>
        <button onClick={() => setTab('chat')} className={tab === 'chat' ? 'btn-primary' : 'btn-ghost'}>
          <MessagesSquare size={16} /> Chat
        </button>
        {perfil?.es_admin && (
          <button onClick={() => setTab('auditoria')} className={tab === 'auditoria' ? 'btn-primary' : 'btn-ghost'}>
            <ScrollText size={16} /> Auditoría
          </button>
        )}
      </div>

      {loading ? (
        <Cargando />
      ) : tab === 'usuarios' ? (
        <div>
          <div className="mb-4 flex justify-end">
            <button className="btn-primary" onClick={nuevoUsuario}>
              <UserPlus size={16} /> Nuevo usuario
            </button>
          </div>
          <div className="overflow-x-auto panel-3d">
            <table className="min-w-full divide-y divide-slate-100 text-sm">
              <thead className="thead-3d">
                <tr>
                  <th className="px-5 py-3">Nombre</th>
                  <th className="px-5 py-3">Usuario</th>
                  <th className="px-5 py-3">Rol</th>
                  <th className="px-5 py-3">Estado</th>
                  <th className="px-5 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {usuarios.map((u) => (
                  <tr key={u.id}>
                    <td className="px-5 py-3 font-medium text-slate-800">{u.nombre || '—'}</td>
                    <td className="px-5 py-3 font-mono text-slate-600">{u.username || '—'}</td>
                    <td className="px-5 py-3"><span className="badge bg-brand-50 text-brand-700">{u.roles?.nombre || u.rol_key || '—'}</span></td>
                    <td className="px-5 py-3">
                      <span className={`badge ${u.activo ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                        {u.activo ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex justify-end gap-1">
                        <button onClick={() => editarUsuario(u)} className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 hover:text-brand-600"><Pencil size={16} /></button>
                        <button onClick={() => eliminarUsuario(u)} className="rounded-lg p-2 text-slate-600 hover:bg-rose-50 hover:text-rose-600"><Trash2 size={16} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : tab === 'roles' ? (
        <div>
          <div className="mb-4 flex justify-end">
            <button className="btn-primary" onClick={nuevoRol}>
              <Plus size={16} /> Nuevo rol
            </button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {roles.map((r) => (
              <div key={r.key} className="card">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold text-slate-800">{r.nombre}</p>
                    {r.es_admin && <span className="badge mt-1 bg-gold-400/20 text-gold-600">Acceso total</span>}
                  </div>
                  <div className="flex gap-1">
                    {!r.es_admin && (
                      <button onClick={() => editarRol(r)} className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 hover:text-brand-600"><Pencil size={16} /></button>
                    )}
                    {!r.protegido && (
                      <button onClick={() => eliminarRol(r)} className="rounded-lg p-2 text-slate-600 hover:bg-rose-50 hover:text-rose-600"><Trash2 size={16} /></button>
                    )}
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-1">
                  {(r.es_admin ? MODULOS.map((m) => m.key) : r.permisos).map((m) => (
                    <span key={m} className="badge bg-slate-100 text-slate-600">{etiquetaPermiso(m)}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : tab === 'proveedores' ? (
        <div>
          <div className="mb-4 flex justify-end">
            <button className="btn-primary" onClick={nuevoProveedor}>
              <Plus size={16} /> Nuevo proveedor
            </button>
          </div>
          {proveedores.length === 0 ? (
            <div className="card flex flex-col items-center gap-3 py-12 text-center">
              <Truck className="text-brand-300" size={40} />
              <p className="text-slate-500">Aún no hay proveedores. Crea el primero para elegirlo en Compras.</p>
            </div>
          ) : (
            <div className="overflow-x-auto panel-3d">
              <table className="min-w-full divide-y divide-slate-100 text-sm">
                <thead className="thead-3d">
                  <tr>
                    <th className="px-5 py-3">Código</th>
                    <th className="px-5 py-3">Proveedor</th>
                    <th className="px-5 py-3">Teléfono</th>
                    <th className="px-5 py-3">Contacto</th>
                    <th className="px-5 py-3">Estado</th>
                    <th className="px-5 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {pagProv.visibles.map((p) => (
                    <tr key={p.id} className={p.activo ? '' : 'opacity-60'}>
                      <td className="px-5 py-3"><span className="font-mono font-semibold text-brand-700">{conPrefijo(negocio.prefijo_proveedor, p.codigo)}</span></td>
                      <td className="px-5 py-3 font-medium text-slate-800">{p.nombre}</td>
                      <td className="px-5 py-3 text-slate-600">{p.telefono || '—'}</td>
                      <td className="px-5 py-3 text-slate-600">{p.contacto || '—'}</td>
                      <td className="px-5 py-3">
                        <span className={`badge ${p.activo ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                          {p.activo ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex justify-end gap-1">
                          <button onClick={() => editarProveedor(p)} className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 hover:text-brand-600"><Pencil size={16} /></button>
                          <button onClick={() => eliminarProveedor(p)} className="rounded-lg p-2 text-slate-600 hover:bg-rose-50 hover:text-rose-600"><Trash2 size={16} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <Paginacion pagina={pagProv.pagina} totalPaginas={pagProv.totalPaginas} total={pagProv.total} desde={pagProv.desde} pageSize={pagProv.pageSize} onPagina={pagProv.setPagina} />
            </div>
          )}
        </div>
      ) : tab === 'negocio' ? (
        <div className="max-w-2xl">
          <div className="card space-y-4">
            <div>
              <label className="label">Nombre del negocio</label>
              <input className="input" value={formNeg.nombre} onChange={(e) => setFormNeg({ ...formNeg, nombre: e.target.value })} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label">RNC</label>
                <input className="input" value={formNeg.rnc} onChange={(e) => setFormNeg({ ...formNeg, rnc: e.target.value })} placeholder="Aparece en los tickets" />
              </div>
              <div>
                <label className="label">Teléfono</label>
                <input className="input" value={formNeg.telefono} onChange={(e) => setFormNeg({ ...formNeg, telefono: e.target.value })} />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label">WhatsApp</label>
                <input className="input" value={formNeg.whatsapp} onChange={(e) => setFormNeg({ ...formNeg, whatsapp: e.target.value })} />
              </div>
              <div>
                <label className="label">Instagram</label>
                <input className="input" value={formNeg.instagram} onChange={(e) => setFormNeg({ ...formNeg, instagram: e.target.value })} />
              </div>
            </div>
            <div>
              <label className="label">Dirección</label>
              <input className="input" value={formNeg.direccion} onChange={(e) => setFormNeg({ ...formNeg, direccion: e.target.value })} />
            </div>
            <div>
              <label className="label">Referencia</label>
              <input className="input" value={formNeg.referencia} onChange={(e) => setFormNeg({ ...formNeg, referencia: e.target.value })} placeholder="Ej: Frente a Banco Popular" />
            </div>
            <p className="text-xs text-slate-600">Estos datos aparecen en los tickets de cobro, facturas, comprobantes de cierre, el panel y el inicio de sesión. La configuración de impresora está en la pestaña <b>Impresora</b>.</p>

            <div className="rounded-xl border border-amber-100 bg-amber-50/40 p-3">
              <label className="label">Límite de descuento sin autorización (%)</label>
              <input
                type="number" min={0} max={100} step={1}
                className="input w-32"
                value={formNeg.descuento_limite_pct}
                onChange={(e) => setFormNeg({ ...formNeg, descuento_limite_pct: Math.min(100, Math.max(0, Number(e.target.value))) })}
              />
              <p className="mt-1 text-xs text-slate-600">
                En Facturación, un descuento mayor a este porcentaje del subtotal solo lo puede aplicar quien tenga el permiso
                "Aplicar descuentos superiores al límite configurado".
              </p>
            </div>

            <div className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-3">
              <label className="label">Mensaje de recordatorio de cita (WhatsApp)</label>
              <textarea
                className="input"
                rows={3}
                value={formNeg.wa_plantilla}
                onChange={(e) => setFormNeg({ ...formNeg, wa_plantilla: e.target.value })}
                placeholder="Hola {paciente} 👋, le recordamos su cita en {clinica} el {fecha} a las {hora}. Por favor confirme respondiendo *Sí*. ¡Gracias!"
              />
              <p className="mt-1 text-xs text-slate-600">
                Usa <b>{'{paciente}'}</b>, <b>{'{clinica}'}</b>, <b>{'{fecha}'}</b> y <b>{'{hora}'}</b>; se reemplazan solos. Si lo dejas vacío, se usa un mensaje por defecto.
              </p>
            </div>

            <div className="flex justify-end">
              <button className="btn-primary" onClick={guardarNegocio} disabled={savingNeg}>{savingNeg ? 'Guardando…' : 'Guardar cambios'}</button>
            </div>
          </div>
        </div>
      ) : tab === 'prefijos' ? (
        <div className="max-w-2xl">
          <div className="card space-y-4">
            <p className="text-sm text-slate-600">
              Prefijo de cada secuencia. Se muestra como <b>PREFIJO + 4 dígitos</b> (ej. <span className="font-mono">CJ0001</span>).
              Si dejas un prefijo <b>vacío</b>, esa secuencia se muestra solo con el número (<span className="font-mono">0001</span>).
              Las facturas conservan su propio prefijo por tipo (CO / CR).
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              {([
                ['prefijo_caja', 'Caja'],
                ['prefijo_gasto', 'Gastos'],
                ['prefijo_pago', 'Pagos a empleados'],
                ['prefijo_cita', 'Citas'],
                ['prefijo_compra', 'Compras'],
                ['prefijo_cliente', 'Clientes'],
                ['prefijo_proveedor', 'Proveedores'],
                ['prefijo_articulo', 'Artículos'],
                ['prefijo_mobiliario', 'Mobiliario y equipos'],
              ] as const).map(([campo, etiqueta]) => (
                <div key={campo}>
                  <label className="label">{etiqueta}</label>
                  <div className="flex items-center gap-2">
                    <input
                      className="input w-24 uppercase"
                      value={formNeg[campo]}
                      maxLength={6}
                      onChange={(e) => setFormNeg({ ...formNeg, [campo]: e.target.value.toUpperCase() })}
                    />
                    <span className="font-mono text-sm text-slate-500">{conPrefijo(formNeg[campo], 1)}</span>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-xs text-slate-600">El prefijo no cambia los números ya asignados, solo cómo se muestran.</p>
            <div className="flex justify-end">
              <button className="btn-primary" onClick={guardarNegocio} disabled={savingNeg}>{savingNeg ? 'Guardando…' : 'Guardar prefijos'}</button>
            </div>
          </div>
        </div>
      ) : tab === 'impresora' ? (
        <div className="max-w-2xl space-y-4">
          {/* Tamaño del ticket */}
          <div className="card space-y-3">
            <h3 className="font-display text-lg font-bold text-slate-800">Tamaño del ticket</h3>
            <div>
              <label className="label">Ancho del papel</label>
              <select className="input w-64" value={formNeg.ancho_ticket} onChange={(e) => setFormNeg({ ...formNeg, ancho_ticket: Number(e.target.value) })}>
                <option value={58}>58 mm (portátil, ej. 2 Connect)</option>
                <option value={80}>80 mm (estándar de mostrador)</option>
              </select>
              <p className="mt-1 text-xs text-slate-600">Ajusta el tamaño de recibos y comprobantes para tu impresora térmica. Guarda y luego usa “Imprimir prueba”.</p>
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={formNeg.auto_imprimir} onChange={(e) => setFormNeg({ ...formNeg, auto_imprimir: e.target.checked })} />
              Imprimir el recibo <b>automáticamente</b> al cobrar
            </label>
            <p className="-mt-1 text-xs text-slate-500">Con la impresión directa activada, el recibo sale solo al registrar el cobro (sin tocar “Imprimir”).</p>
            <div className="flex flex-wrap gap-2">
              <button className="btn-ghost" onClick={() => setPruebaOpen(true)}><Printer size={16} /> Imprimir prueba</button>
              <button className="btn-primary" onClick={guardarNegocio} disabled={savingNeg}>{savingNeg ? 'Guardando…' : 'Guardar'}</button>
            </div>
          </div>

          {/* Impresión directa (sin cuadros) — QZ Tray */}
          <div className="card space-y-3">
            <h3 className="font-display text-lg font-bold text-slate-800">Impresión directa (sin cuadros)</h3>
            <p className="text-sm text-slate-600">
              Para que los recibos salgan <b>solos</b> en la impresora térmica, <b>sin ningún cuadro</b> y
              <b> abras la app como la abras</b>, se usa <b>QZ Tray</b> (gratis). Se instala una vez por PC.
            </p>
            <ol className="ml-5 list-decimal space-y-1.5 text-sm text-slate-700">
              <li>Pon tu impresora térmica como <b>predeterminada</b> en Windows.</li>
              <li>Instala <b>QZ Tray</b> (asistente normal: Siguiente → Siguiente → Finalizar).</li>
              <li>Abre (doble clic) el <b>configurador</b> de abajo: deja el certificado puesto y todo listo, <b>automático</b>.</li>
              <li>Pulsa <b>“Probar impresión directa”</b>. Si sale el ticket sin cuadros, ¡quedó! 🎉</li>
            </ol>
            <div className="flex flex-wrap gap-2">
              <a href="https://qz.io/download/" target="_blank" rel="noreferrer" className="btn-primary">
                <Download size={16} /> Descargar QZ Tray
              </a>
              <a href={`${import.meta.env.BASE_URL}impresion-directa/configurar-impresion-directa.bat`} download className="btn-ghost">
                <Download size={16} /> Configurador (certificado)
              </a>
              <a href={`${import.meta.env.BASE_URL}impresion-directa/LEEME-impresion-directa.txt`} download className="btn-ghost">
                <Download size={16} /> Guía
              </a>
            </div>
            <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
              <button className="btn-ghost" onClick={probarQZ} disabled={qzProbando}>
                <Printer size={16} /> {qzProbando ? 'Probando…' : 'Probar impresión directa'}
              </button>
              {qzMsg && (
                <span className={`text-xs font-medium ${qzMsg.ok ? 'text-emerald-700' : 'text-rose-600'}`}>{qzMsg.texto}</span>
              )}
            </div>
            <p className="text-xs text-slate-500">
              El configurador necesita permiso de administrador (para dejar el certificado en QZ Tray). El cliente
              no toca certificados: solo instalar QZ Tray y abrir el configurador.
            </p>
          </div>
        </div>
      ) : tab === 'comprobantes' ? (
        <div className="max-w-4xl space-y-4">
          {/* Ajustes generales */}
          <div className="card space-y-4">
            <div className="flex items-center gap-2">
              <ReceiptText className="text-brand-500" size={20} />
              <h3 className="font-display text-lg font-bold text-slate-800">Comprobantes fiscales (DGII)</h3>
            </div>
            <p className="text-sm text-slate-600">
              Configura los comprobantes fiscales. Mientras esté <b>desactivado</b>, las facturas salen normales (sin NCF).
              Cuando la DGII te autorice, carga los rangos abajo, activa el tipo y enciende el interruptor.
            </p>

            <label className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50/60 px-4 py-3">
              <input type="checkbox" className="h-4 w-4" checked={formNeg.comprobantes_activos} onChange={(e) => setFormNeg({ ...formNeg, comprobantes_activos: e.target.checked })} />
              <span className="text-sm font-semibold text-slate-800">Emitir comprobantes fiscales (asignar NCF a las facturas)</span>
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label">Modo de comprobante</label>
                <select className="input" value={formNeg.modo_comprobante} onChange={(e) => setFormNeg({ ...formNeg, modo_comprobante: e.target.value as 'tradicional' | 'electronico' })}>
                  <option value="tradicional">NCF tradicional (B01, B02, B04)</option>
                  <option value="electronico">e-CF electrónico (E31, E32, E34)</option>
                </select>
                <p className="mt-1 text-xs text-slate-500">Determina qué comprobante se usa al facturar. Cambia a e-CF cuando la DGII te autorice como emisor electrónico.</p>
              </div>
              <div>
                <label className="label">RNC de la clínica</label>
                <input className="input" value={formNeg.rnc} onChange={(e) => setFormNeg({ ...formNeg, rnc: e.target.value })} placeholder="1-31-XXXXX-X" />
              </div>
            </div>
            <div>
              <label className="label">Razón social (nombre fiscal)</label>
              <input className="input" value={formNeg.razon_social} onChange={(e) => setFormNeg({ ...formNeg, razon_social: e.target.value })} placeholder="Ej. Amatista Dental Center SRL" />
            </div>
            <div className="flex justify-end">
              <button className="btn-primary" onClick={guardarNegocio} disabled={savingNeg}>{savingNeg ? 'Guardando…' : 'Guardar ajustes'}</button>
            </div>
          </div>

          {/* Secuencias */}
          <div className="card">
            <h3 className="mb-1 font-display text-lg font-bold text-slate-800">Secuencias autorizadas</h3>
            <p className="mb-3 text-sm text-slate-600">
              Carga aquí los rangos que la DGII te autorice para cada tipo. Solo se usan los que estén <b>activos</b> y en el modo elegido arriba.
            </p>
            <div className="overflow-x-auto panel-3d">
              <table className="min-w-full divide-y divide-slate-100 text-sm">
                <thead className="thead-3d">
                  <tr>
                    <th className="px-4 py-3">Tipo</th>
                    <th className="px-4 py-3">Comprobante</th>
                    <th className="px-4 py-3">Prefijo</th>
                    <th className="px-4 py-3 text-right">Rango</th>
                    <th className="px-4 py-3 text-right">Próximo</th>
                    <th className="px-4 py-3 text-right">Disponibles</th>
                    <th className="px-4 py-3">Vence</th>
                    <th className="px-4 py-3">Estado</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {secuencias.map((s) => {
                    const disp = s.secuencia_actual != null && s.secuencia_hasta != null ? Math.max(0, s.secuencia_hasta - s.secuencia_actual + 1) : null
                    const vencida = s.vencimiento ? new Date(s.vencimiento) < new Date(new Date().toDateString()) : false
                    return (
                      <tr key={s.id}>
                        <td className="px-4 py-3"><span className="font-mono font-semibold text-brand-700">{s.tipo}</span></td>
                        <td className="px-4 py-3 text-slate-700">{s.descripcion}{s.electronico && <span className="ml-1 badge bg-blue-50 text-blue-700">e-CF</span>}</td>
                        <td className="px-4 py-3 font-mono text-slate-600">{s.prefijo}</td>
                        <td className="px-4 py-3 text-right font-mono text-slate-600">{s.secuencia_desde != null && s.secuencia_hasta != null ? `${s.secuencia_desde} – ${s.secuencia_hasta}` : '—'}</td>
                        <td className="px-4 py-3 text-right font-mono text-slate-600">{s.secuencia_actual ?? '—'}</td>
                        <td className="px-4 py-3 text-right">{disp == null ? '—' : <span className={disp <= 20 ? 'font-semibold text-rose-600' : 'text-slate-600'}>{disp}</span>}</td>
                        <td className="px-4 py-3">{s.vencimiento ? <span className={vencida ? 'font-semibold text-rose-600' : 'text-slate-600'}>{s.vencimiento}</span> : '—'}</td>
                        <td className="px-4 py-3">
                          <span className={`badge ${s.activo ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{s.activo ? 'Activo' : 'Inactivo'}</span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button onClick={() => editarSecuencia(s)} className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 hover:text-brand-600"><Pencil size={16} /></button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-xs text-slate-500">
              Los comprobantes electrónicos (e-CF) además requieren autorización como emisor y firma digital; esa transmisión a la DGII se conecta cuando tengas el certificado. Todo lo demás ya queda listo.
            </p>
          </div>

          {/* Emisor electrónico (e-CF) — se activa cuando la DGII apruebe */}
          <div className="card space-y-4">
            <h3 className="font-display text-lg font-bold text-slate-800">Emisor electrónico (e-CF)</h3>
            <p className="text-sm text-slate-600">
              Cuando la DGII te autorice como emisor electrónico, aquí conectas tu <b>proveedor de facturación electrónica</b>
              (o el Facturador Gratuito). El sistema ya asigna el e-NCF e imprime el QR; solo falta este enlace para que la
              factura se <b>envíe sola</b> a la DGII.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label">Proveedor</label>
                <input className="input" value={formNeg.ecf_proveedor} onChange={(e) => setFormNeg({ ...formNeg, ecf_proveedor: e.target.value })} placeholder="Nombre del proveedor / Facturador Gratuito" />
              </div>
              <div>
                <label className="label">Ambiente</label>
                <select className="input" value={formNeg.ecf_ambiente} onChange={(e) => setFormNeg({ ...formNeg, ecf_ambiente: e.target.value as 'prueba' | 'produccion' })}>
                  <option value="prueba">Prueba / Certificación</option>
                  <option value="produccion">Producción</option>
                </select>
              </div>
            </div>
            <div>
              <label className="label">URL de la API del proveedor</label>
              <input className="input font-mono text-sm" value={formNeg.ecf_api_url} onChange={(e) => setFormNeg({ ...formNeg, ecf_api_url: e.target.value })} placeholder="https://api.proveedor.com/ecf/emitir" />
            </div>
            <div>
              <label className="label">Token / clave de la API</label>
              <input type="password" className="input font-mono text-sm" value={formNeg.ecf_api_token} onChange={(e) => setFormNeg({ ...formNeg, ecf_api_token: e.target.value })} placeholder="Se lo da tu proveedor" />
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={formNeg.ecf_emision_auto} onChange={(e) => setFormNeg({ ...formNeg, ecf_emision_auto: e.target.checked })} />
              Enviar el e-CF a la DGII <b>automáticamente</b> al guardar la factura
            </label>
            <p className="text-xs text-slate-500">
              Mientras esto esté vacío, las facturas electrónicas quedan con su e-NCF y en estado <b>“Pendiente de envío”</b>.
              El certificado digital y la firma se gestionan con el proveedor.
            </p>
            <div className="flex justify-end">
              <button className="btn-primary" onClick={guardarNegocio} disabled={savingNeg}>{savingNeg ? 'Guardando…' : 'Guardar emisor'}</button>
            </div>
          </div>
        </div>
      ) : tab === 'auditoria' ? (
        <DataTable
          rows={auditoria}
          rowKey={(a) => a.id}
          searchText={(a) => `${a.usuario ?? ''} ${MODULO_LABEL[a.modulo] ?? a.modulo} ${a.accion} ${a.descripcion ?? ''}`}
          searchPlaceholder="Buscar por usuario, módulo, acción o detalle…"
          emptyText="Sin movimientos registrados."
          pageSize={15}
          columns={[
            { header: 'Fecha y hora', cell: (a) => <span className="text-slate-600">{fechaHora(a.fecha)}</span>, sortValue: (a) => a.fecha },
            { header: 'Usuario', cell: (a) => <span className="font-medium text-slate-800">{a.usuario || '—'}</span>, sortValue: (a) => a.usuario ?? '' },
            { header: 'Módulo', cell: (a) => <span className="badge bg-slate-100 text-slate-600">{MODULO_LABEL[a.modulo] ?? a.modulo}</span>, sortValue: (a) => MODULO_LABEL[a.modulo] ?? a.modulo },
            {
              header: 'Acción', sortValue: (a) => a.accion, cell: (a) => (
                <span className={`badge ${a.accion === 'CREÓ' ? 'bg-emerald-50 text-emerald-700' : a.accion === 'ELIMINÓ' ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-700'}`}>{a.accion}</span>
              ),
            },
            { header: 'Detalle', cell: (a) => <span className="text-slate-600">{a.descripcion}</span>, sortValue: (a) => a.descripcion ?? '' },
          ]}
        />
      ) : tab === 'chat' ? (
        <AjustesChat />
      ) : tab === 'comisiones' ? (
        <div className="space-y-5">
          <p className="text-sm text-slate-600">
            Define cuánto gana cada empleado por su trabajo. Solo los <strong>servicios</strong> pagan comisión (los productos no).
            Si un servicio tiene su propio %, ese manda; si lo dejas vacío, usa el % del empleado que lo realiza.
          </p>

          <div className="card">
            <h3 className="mb-3 font-display font-bold text-slate-800">% por empleado</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-100 text-sm">
                <thead className="thead-3d">
                  <tr>
                    <th className="px-5 py-3">Empleado</th>
                    <th className="px-5 py-3">Puesto</th>
                    <th className="px-5 py-3 text-right">% Comisión</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {empleados.map((emp) => (
                    <tr key={emp.id}>
                      <td className="px-5 py-3 font-medium text-slate-800">{emp.nombre}</td>
                      <td className="px-5 py-3 text-slate-600">{emp.puesto}</td>
                      <td className="px-5 py-3">
                        <div className="ml-auto flex w-28 items-center gap-1">
                          <input
                            type="number" min={0} max={100} step={1}
                            className="input text-right"
                            value={comEmp[emp.id] ?? ''}
                            onChange={(e) => setComEmp({ ...comEmp, [emp.id]: e.target.value })}
                          />
                          <span className="text-slate-500">%</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card">
            <h3 className="mb-3 font-display font-bold text-slate-800">% por servicio <span className="font-normal text-slate-500">(opcional)</span></h3>
            {servicios.length === 0 ? (
              <p className="text-sm text-slate-600">No hay servicios activos.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-100 text-sm">
                  <thead className="thead-3d">
                    <tr>
                      <th className="px-5 py-3">Servicio</th>
                      <th className="px-5 py-3">Categoría</th>
                      <th className="px-5 py-3 text-right">% Comisión</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {servicios.map((s) => (
                      <tr key={s.id}>
                        <td className="px-5 py-3 font-medium text-slate-800">{s.nombre}</td>
                        <td className="px-5 py-3"><span className="badge bg-brand-50 text-brand-700">{s.categoria}</span></td>
                        <td className="px-5 py-3">
                          <div className="ml-auto flex w-40 items-center gap-1">
                            <input
                              type="number" min={0} max={100} step={1}
                              className="input text-right"
                              placeholder="Empleado"
                              value={comServ[s.id] ?? ''}
                              onChange={(e) => setComServ({ ...comServ, [s.id]: e.target.value })}
                            />
                            <span className="text-slate-500">%</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="mt-3 text-xs text-slate-500">Deja el campo vacío para que el servicio use el % del empleado.</p>
              </div>
            )}
          </div>

          <div className="flex justify-end">
            <button className="btn-primary" onClick={guardarComisiones} disabled={savingCom}>
              {savingCom ? 'Guardando…' : 'Guardar comisiones'}
            </button>
          </div>
        </div>
      ) : (
        <div className="max-w-2xl space-y-4">
          <div className="card space-y-3">
            <label className="label">Nueva categoría</label>
            <div className="flex flex-wrap gap-2">
              <input className="input flex-1" placeholder="Ej: Bebidas, Spa, Barbería…" value={catNombre} onChange={(e) => setCatNombre(e.target.value)} />
              <select className="input w-auto" value={catTipo} onChange={(e) => setCatTipo(e.target.value as 'articulo' | 'servicio')}>
                <option value="articulo">Artículo</option>
                <option value="servicio">Servicio</option>
              </select>
              <button className="btn-primary" onClick={agregarCategoria}><Plus size={16} /> Agregar</button>
            </div>
          </div>
          {(['articulo', 'servicio'] as const).map((t) => (
            <div key={t} className="card">
              <h3 className="mb-3 font-display font-bold text-slate-800">{t === 'articulo' ? 'Categorías de artículos' : 'Categorías de servicios'}</h3>
              <div className="flex flex-wrap gap-2">
                {categorias.filter((c) => c.tipo === t).map((c) => (
                  <span key={c.id} className="badge flex items-center gap-1 bg-slate-100 text-slate-600">
                    {c.nombre}
                    <button onClick={() => eliminarCategoria(c.id)} className="text-slate-600 hover:text-rose-600"><Trash2 size={12} /></button>
                  </span>
                ))}
                {categorias.filter((c) => c.tipo === t).length === 0 && <p className="text-sm text-slate-600">Sin categorías.</p>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* MODAL USUARIO */}
      <Modal
        open={openU}
        title={editU ? 'Editar usuario' : 'Nuevo usuario'}
        onClose={() => setOpenU(false)}
        footer={
          <>
            <button className="btn-ghost" onClick={() => setOpenU(false)}>Cancelar</button>
            <button className="btn-primary" onClick={guardarUsuario} disabled={savingU}>{savingU ? 'Guardando…' : 'Guardar'}</button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="label">Empleado</label>
            <select className="input" value={formU.empleado_id} onChange={(e) => elegirEmpleado(e.target.value)}>
              <option value="">— Selecciona el empleado —</option>
              {empleados.map((emp) => (
                <option key={emp.id} value={emp.id}>{emp.nombre}{emp.puesto ? ` (${emp.puesto})` : ''}</option>
              ))}
            </select>
            {empleados.length === 0 && (
              <p className="mt-1 text-xs text-amber-600">No hay empleados activos. Agrégalos primero en el módulo Empleados.</p>
            )}
          </div>
          <div>
            <label className="label">Usuario (para iniciar sesión)</label>
            <input type="text" className="input lowercase disabled:bg-slate-100" value={formU.usuario} disabled={!!editU} autoCapitalize="none" autoCorrect="off" onChange={(e) => setFormU({ ...formU, usuario: e.target.value })} placeholder="ej: maria" />
            {editU ? <p className="mt-1 text-xs text-slate-600">El usuario no se puede cambiar.</p> : <p className="mt-1 text-xs text-slate-600">Sin espacios. No importa mayúsculas/minúsculas.</p>}
          </div>
          <div>
            <label className="label">{editU ? 'Nueva contraseña (opcional)' : 'Contraseña'}</label>
            <input type="text" className="input" value={formU.password} onChange={(e) => setFormU({ ...formU, password: e.target.value })} placeholder={editU ? 'Dejar en blanco para no cambiar' : 'Mínimo 6 caracteres'} />
          </div>
          <div>
            <label className="label">Rol</label>
            <select className="input" value={formU.rol_key} onChange={(e) => setFormU({ ...formU, rol_key: e.target.value })}>
              <option value="">— Sin rol —</option>
              {roles.map((r) => <option key={r.key} value={r.key}>{r.nombre}</option>)}
            </select>
          </div>
          {editU && (
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input type="checkbox" checked={formU.activo} onChange={(e) => setFormU({ ...formU, activo: e.target.checked })} />
              Usuario activo (puede iniciar sesión)
            </label>
          )}
        </div>
      </Modal>

      {/* MODAL ROL */}
      <Modal
        open={openR}
        title={editR ? `Editar rol: ${editR.nombre}` : 'Nuevo rol'}
        onClose={() => setOpenR(false)}
        footer={
          <>
            <button className="btn-ghost" onClick={() => setOpenR(false)}>Cancelar</button>
            <button className="btn-primary" onClick={guardarRol} disabled={savingR}>{savingR ? 'Guardando…' : 'Guardar'}</button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="label">Nombre del rol</label>
            <input className="input" value={formR.nombre} onChange={(e) => setFormR({ ...formR, nombre: e.target.value })} placeholder="Ej: Cajera" />
          </div>
          <div>
            <label className="label">Módulos a los que tiene acceso</label>
            <div className="grid grid-cols-2 gap-2">
              {MODULOS.map((m) => (
                <label key={m.key} className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600">
                  <input type="checkbox" checked={formR.permisos.includes(m.key)} onChange={() => toggleModulo(m.key)} />
                  {m.label}
                </label>
              ))}
            </div>
          </div>
          <div>
            <label className="label">Funciones permitidas (control de acciones)</label>
            <p className="mb-2 text-xs text-slate-600">Activa solo lo que este rol está autorizado a hacer. Lo demás queda bloqueado.</p>
            <div className="space-y-2">
              {ACCIONES.map((a) => (
                <label key={a.key} className="flex items-center gap-2 rounded-lg border border-pink-100 bg-pink-50/30 px-3 py-2 text-sm text-slate-600">
                  <input type="checkbox" checked={formR.permisos.includes(a.key)} onChange={() => toggleModulo(a.key)} />
                  <span>{a.label}</span>
                  <span className="ml-auto badge bg-slate-100 text-slate-500">{etiquetaPermiso(a.modulo)}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      </Modal>

      {/* MODAL PROVEEDOR */}
      <Modal
        open={openP}
        title={editP ? 'Editar proveedor' : 'Nuevo proveedor'}
        onClose={() => setOpenP(false)}
        footer={
          <>
            <button className="btn-ghost" onClick={() => setOpenP(false)}>Cancelar</button>
            <button className="btn-primary" onClick={guardarProveedor} disabled={savingP}>{savingP ? 'Guardando…' : 'Guardar'}</button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="label">Nombre del proveedor</label>
            <input className="input" value={formP.nombre} onChange={(e) => setFormP({ ...formP, nombre: e.target.value })} placeholder="Ej: Distribuidora Bella" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Teléfono</label>
              <input className="input" value={formP.telefono} onChange={(e) => setFormP({ ...formP, telefono: e.target.value })} />
            </div>
            <div>
              <label className="label">Contacto</label>
              <input className="input" value={formP.contacto} onChange={(e) => setFormP({ ...formP, contacto: e.target.value })} placeholder="Persona / vendedor" />
            </div>
          </div>
          <div>
            <label className="label">Notas</label>
            <textarea className="input" rows={2} value={formP.notas} onChange={(e) => setFormP({ ...formP, notas: e.target.value })} />
          </div>
          {editP && (
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input type="checkbox" checked={formP.activo} onChange={(e) => setFormP({ ...formP, activo: e.target.checked })} />
              Proveedor activo
            </label>
          )}
        </div>
      </Modal>

      {/* MODAL SECUENCIA NCF */}
      <Modal
        open={openS}
        title={editS ? `Secuencia ${editS.tipo} · ${editS.descripcion}` : 'Secuencia'}
        onClose={() => setOpenS(false)}
        footer={
          <>
            <button className="btn-ghost" onClick={() => setOpenS(false)}>Cancelar</button>
            <button className="btn-primary" onClick={guardarSecuencia} disabled={savingS}>{savingS ? 'Guardando…' : 'Guardar'}</button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Carga el rango tal como lo autorizó la DGII. El sistema irá asignando el <b>próximo</b> número a cada factura de este tipo.
          </p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Prefijo</label>
              <input className="input font-mono uppercase" value={formS.prefijo} maxLength={4} onChange={(e) => setFormS({ ...formS, prefijo: e.target.value.toUpperCase() })} placeholder={editS?.tipo} />
            </div>
            <div>
              <label className="label">Vence (opcional)</label>
              <input type="date" className="input" value={formS.vencimiento} onChange={(e) => setFormS({ ...formS, vencimiento: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="label">Desde</label>
              <input type="number" min={1} className="input" value={formS.secuencia_desde} onChange={(e) => setFormS({ ...formS, secuencia_desde: e.target.value })} placeholder="1" />
            </div>
            <div>
              <label className="label">Hasta</label>
              <input type="number" min={1} className="input" value={formS.secuencia_hasta} onChange={(e) => setFormS({ ...formS, secuencia_hasta: e.target.value })} placeholder="1000" />
            </div>
            <div>
              <label className="label">Próximo</label>
              <input type="number" min={1} className="input" value={formS.secuencia_actual} onChange={(e) => setFormS({ ...formS, secuencia_actual: e.target.value })} placeholder="= Desde" />
            </div>
          </div>
          <p className="text-xs text-slate-500">
            Ejemplo: rango <span className="font-mono">1</span> a <span className="font-mono">1000</span> con prefijo <span className="font-mono">{editS?.electronico ? 'E32' : 'B02'}</span> genera <span className="font-mono">{editS?.electronico ? 'E320000000001' : 'B0200000001'}</span> en adelante.
          </p>
          <label className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700">
            <input type="checkbox" checked={formS.activo} onChange={(e) => setFormS({ ...formS, activo: e.target.checked })} />
            Secuencia activa (disponible para facturar)
          </label>
        </div>
      </Modal>

      {/* PÁGINA DE PRUEBA DE IMPRESIÓN */}
      <Modal open={pruebaOpen} title="Página de prueba" onClose={() => setPruebaOpen(false)}>
        <div className="space-y-3">
          <div className="print-area space-y-1 rounded-xl border border-slate-100 p-3 text-center text-sm">
            <img src={`${import.meta.env.BASE_URL}${negocio.logo}`} alt={negocio.nombre} className="mx-auto mb-1 h-14 rounded-lg bg-white object-contain" />
            <p className="font-display text-base font-bold text-brand-800">{negocio.nombre}</p>
            <p className="text-xs font-semibold text-slate-600">PRUEBA DE IMPRESIÓN</p>
            <p className="text-xs text-slate-600">Ancho configurado: {negocio.ancho_ticket} mm</p>
            <p className="text-xs text-slate-600">Si lees esto completo y centrado, la impresora quedó bien. ✅</p>
            <p className="text-xs text-slate-500">{negocio.direccion} · {negocio.telefono}</p>
          </div>
          <p className="text-xs text-slate-500 no-print">Si cambiaste el ancho, pulsa <b>Guardar</b> antes de imprimir la prueba.</p>
          <div className="no-print flex gap-2">
            <button className="btn-ghost flex-1" onClick={() => setPruebaOpen(false)}>Cerrar</button>
            <button className="btn-primary flex-1" onClick={() => window.print()}><Printer size={16} /> Imprimir</button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
