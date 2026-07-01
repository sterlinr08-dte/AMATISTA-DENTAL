import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  User, Camera, Pencil, CalendarPlus, FileText, Receipt, AlertTriangle,
  HeartPulse, Pill, Baby, Cigarette, Wallet, Bell, ExternalLink,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { Cliente } from '../types'
import { codigoCliente, money, fechaCorta } from '../lib/format'
import PageHeader from '../components/PageHeader'
import Cargando from '../components/Cargando'
import SelectorPaciente from '../components/SelectorPaciente'
import HistoriaClinica from './HistoriaClinica'
import Odontograma from './Odontograma'
import Periodontograma from './Periodontograma'
import ImagenesPaciente from './ImagenesPaciente'

const BUCKET = 'pacientes'

interface Historia {
  antecedentes: string | null
  alergias: string | null
  medicamentos: string | null
  enfermedades: string | null
  grupo_sanguineo: string | null
  embarazada: boolean
  fumador: boolean
}

function edadDe(fecha: string | null): number | null {
  if (!fecha) return null
  const n = new Date(fecha)
  if (isNaN(n.getTime())) return null
  const hoy = new Date()
  let e = hoy.getFullYear() - n.getFullYear()
  const m = hoy.getMonth() - n.getMonth()
  if (m < 0 || (m === 0 && hoy.getDate() < n.getDate())) e--
  return e >= 0 && e < 130 ? e : null
}

function iniciales(nombre: string): string {
  const p = nombre.trim().split(/\s+/)
  return ((p[0]?.[0] ?? '') + (p[1]?.[0] ?? '')).toUpperCase() || '?'
}

type TabKey =
  | 'datos' | 'clinica' | 'odonto' | 'perio' | 'presupuestos'
  | 'facturacion' | 'imagenes' | 'recetas' | 'consentimientos'

const TABS: { key: TabKey; label: string }[] = [
  { key: 'datos', label: 'Datos personales' },
  { key: 'clinica', label: 'Ficha clínica' },
  { key: 'odonto', label: 'Odontograma' },
  { key: 'perio', label: 'Periodontograma' },
  { key: 'presupuestos', label: 'Planes / Presupuestos' },
  { key: 'facturacion', label: 'Facturación' },
  { key: 'imagenes', label: 'Imágenes / Rx' },
  { key: 'recetas', label: 'Recetas' },
  { key: 'consentimientos', label: 'Consentimientos' },
]

export default function FichaPaciente() {
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [pacienteId, setPacienteId] = useState('')
  const [cliente, setCliente] = useState<Cliente | null>(null)
  const [historia, setHistoria] = useState<Historia | null>(null)
  const [alertas, setAlertas] = useState<{ id: string; texto: string }[]>([])
  const [saldo, setSaldo] = useState(0)
  const [fotoUrl, setFotoUrl] = useState<string | null>(null)
  const [tab, setTab] = useState<TabKey>('datos')
  const [loading, setLoading] = useState(true)
  const fotoInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    supabase.from('clientes').select('*').order('nombre').then(({ data }) => {
      setClientes(data ?? [])
      setLoading(false)
    })
  }, [])

  async function cargarPaciente(id: string) {
    setCliente(null); setHistoria(null); setAlertas([]); setSaldo(0); setFotoUrl(null)
    if (!id) return
    const [{ data: c }, { data: h }, { data: al }, { data: fac }] = await Promise.all([
      supabase.from('clientes').select('*').eq('id', id).single(),
      supabase.from('historias_clinicas').select('*').eq('cliente_id', id).maybeSingle(),
      supabase.from('alertas_paciente').select('id, texto').eq('cliente_id', id).eq('activa', true),
      supabase.from('facturas').select('total').eq('cliente_id', id).eq('estado', 'PENDIENTE'),
    ])
    setCliente((c as Cliente) ?? null)
    setHistoria((h as Historia) ?? null)
    setAlertas((al as any[]) ?? [])
    setSaldo(((fac as any[]) ?? []).reduce((s, f) => s + Number(f.total || 0), 0))
    const path = (c as Cliente)?.foto_url
    if (path) {
      const { data: signed } = await supabase.storage.from(BUCKET).createSignedUrl(path, 3600)
      setFotoUrl(signed?.signedUrl ?? null)
    }
  }

  useEffect(() => {
    cargarPaciente(pacienteId)
    setTab('datos')
  }, [pacienteId])

  async function subirFoto(file: File) {
    if (!cliente) return
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
    const path = `fotos/${cliente.id}-${Date.now()}.${ext}`
    const { error } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: true })
    if (error) return alert('Error al subir la foto: ' + error.message)
    await supabase.from('clientes').update({ foto_url: path }).eq('id', cliente.id)
    const { data: signed } = await supabase.storage.from(BUCKET).createSignedUrl(path, 3600)
    setFotoUrl(signed?.signedUrl ?? null)
  }

  const edad = edadDe(cliente?.fecha_nacimiento ?? null)

  if (loading) return <Cargando />

  return (
    <div>
      <PageHeader title="Ficha del paciente" subtitle="Todo el paciente en un solo lugar" />

      {!cliente ? (
        <>
          <div className="mb-6 max-w-md">
            <label className="label">Paciente</label>
            <SelectorPaciente clientes={clientes} value={pacienteId} onChange={setPacienteId} />
          </div>
          <div className="card flex flex-col items-center gap-3 py-12 text-center">
            <User className="text-brand-300" size={40} />
            <p className="text-slate-500">Elige un paciente para abrir su ficha completa.</p>
          </div>
        </>
      ) : (
        <div className="space-y-4">
          {/* Encabezado del paciente */}
          <div className="overflow-hidden rounded-2xl border border-amber-100 bg-gradient-to-r from-[#f7ecca] to-[#f3e4b0] shadow-sm">
            <div className="flex flex-wrap items-center gap-4 p-4">
              {/* Avatar */}
              <div className="relative">
                {fotoUrl ? (
                  <img src={fotoUrl} alt="" className="h-20 w-20 rounded-full object-cover ring-[3px] ring-white shadow-md" />
                ) : (
                  <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[#c9a227] text-2xl font-bold text-white ring-[3px] ring-white shadow-md">
                    {iniciales(cliente.nombre)}
                  </div>
                )}
                <button
                  onClick={() => fotoInput.current?.click()}
                  title="Cambiar foto"
                  className="absolute -bottom-1 -right-1 rounded-full bg-white p-1.5 text-amber-600 shadow ring-1 ring-amber-200 hover:bg-amber-50"
                >
                  <Camera size={14} />
                </button>
                <input ref={fotoInput} type="file" accept="image/*" className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) subirFoto(f); e.target.value = '' }} />
              </div>

              {/* Datos + banderas */}
              <div className="min-w-0 flex-1">
                <h2 className="text-xl font-bold text-[#3a2f10]">{cliente.nombre}</h2>
                <p className="text-sm text-[#7a6a2f]">
                  {codigoCliente(cliente.codigo)}
                  {edad != null && ` · ${edad} años`}
                  {cliente.sexo && ` · ${cliente.sexo}`}
                  {cliente.cedula && ` · Céd. ${cliente.cedula}`}
                  {cliente.telefono && ` · ${cliente.telefono}`}
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {historia?.alergias && <Bandera color="red" icon={<AlertTriangle size={12} />} texto={`Alergia: ${historia.alergias}`} />}
                  {historia?.enfermedades && <Bandera color="orange" icon={<HeartPulse size={12} />} texto={historia.enfermedades} />}
                  {historia?.medicamentos && <Bandera color="blue" icon={<Pill size={12} />} texto={historia.medicamentos} />}
                  {historia?.embarazada && <Bandera color="pink" icon={<Baby size={12} />} texto="Embarazada" />}
                  {historia?.fumador && <Bandera color="gray" icon={<Cigarette size={12} />} texto="Fumador" />}
                  {cliente.seguro_ars && <Bandera color="amber" icon={<HeartPulse size={12} />} texto={`Seguro: ${cliente.seguro_ars}`} />}
                  {saldo > 0 && <Bandera color="red" icon={<Wallet size={12} />} texto={`Saldo: ${money(saldo)}`} />}
                  {alertas.map((a) => <Bandera key={a.id} color="amber" icon={<Bell size={12} />} texto={a.texto} />)}
                  {!historia?.alergias && !historia?.enfermedades && !historia?.medicamentos && saldo === 0 && alertas.length === 0 && (
                    <span className="text-xs text-[#7a6a2f]/70">Sin alertas registradas.</span>
                  )}
                </div>
              </div>

              {/* Acciones rápidas */}
              <div className="flex flex-wrap gap-2">
                <Link to="/citas" className="flex items-center gap-1 rounded-lg bg-white px-3 py-2 text-xs font-bold text-amber-800 ring-1 ring-amber-200 hover:bg-amber-50">
                  <CalendarPlus size={14} /> Cita
                </Link>
                <button onClick={() => setTab('presupuestos')} className="flex items-center gap-1 rounded-lg bg-white px-3 py-2 text-xs font-bold text-amber-800 ring-1 ring-amber-200 hover:bg-amber-50">
                  <FileText size={14} /> Presupuesto
                </button>
                <button onClick={() => setTab('facturacion')} className="flex items-center gap-1 rounded-lg bg-gradient-to-b from-[#e6b93c] to-[#c9a227] px-3 py-2 text-xs font-bold text-white shadow">
                  <Receipt size={14} /> Facturar
                </button>
              </div>
            </div>
          </div>

          {/* Pestañas */}
          <div className="flex gap-1 overflow-x-auto border-b border-slate-200">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`whitespace-nowrap border-b-[3px] px-3.5 py-2.5 text-sm font-semibold transition ${
                  tab === t.key ? 'border-amber-500 text-amber-800' : 'border-transparent text-slate-500 hover:text-amber-700'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Contenido de la pestaña */}
          <div>
            {tab === 'datos' && <TabDatos cliente={cliente} edad={edad} />}
            {tab === 'clinica' && <HistoriaClinica pacienteFijo={pacienteId} />}
            {tab === 'odonto' && <Odontograma pacienteFijo={pacienteId} />}
            {tab === 'perio' && <Periodontograma pacienteFijo={pacienteId} />}
            {tab === 'imagenes' && <ImagenesPaciente pacienteFijo={pacienteId} />}
            {tab === 'presupuestos' && <ListaSimple pacienteId={pacienteId} tabla="presupuestos" ruta="/presupuestos" titulo="Presupuestos" />}
            {tab === 'facturacion' && <ListaSimple pacienteId={pacienteId} tabla="facturas" ruta="/facturacion" titulo="Facturas" saldo={saldo} />}
            {tab === 'recetas' && <ListaSimple pacienteId={pacienteId} tabla="recetas" ruta="/recetas" titulo="Recetas" />}
            {tab === 'consentimientos' && <ListaSimple pacienteId={pacienteId} tabla="consentimientos" ruta="/consentimientos" titulo="Consentimientos" />}
          </div>
        </div>
      )}
    </div>
  )
}

function Bandera({ color, icon, texto }: { color: string; icon: React.ReactNode; texto: string }) {
  const tonos: Record<string, string> = {
    red: 'bg-rose-100 text-rose-700', orange: 'bg-orange-100 text-orange-700',
    blue: 'bg-blue-100 text-blue-700', pink: 'bg-pink-100 text-pink-700',
    gray: 'bg-slate-200 text-slate-600', amber: 'bg-amber-100 text-amber-800',
  }
  return (
    <span className={`inline-flex max-w-[16rem] items-center gap-1 truncate rounded-full px-2.5 py-1 text-xs font-semibold ${tonos[color]}`}>
      {icon}<span className="truncate">{texto}</span>
    </span>
  )
}

function Dato({ etq, val }: { etq: string; val: string | null | undefined }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{etq}</p>
      <p className="border-b border-slate-100 pb-1.5 text-sm text-slate-700">{val || '—'}</p>
    </div>
  )
}

function TabDatos({ cliente, edad }: { cliente: Cliente; edad: number | null }) {
  return (
    <div className="card">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-700">Datos personales</h3>
        <Link to="/clientes" className="btn-ghost !py-1 text-xs"><Pencil size={13} /> Editar en Pacientes</Link>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Dato etq="Nombre completo" val={cliente.nombre} />
        <Dato etq="Cédula / documento" val={cliente.cedula} />
        <Dato etq="Fecha de nacimiento" val={cliente.fecha_nacimiento ? `${fechaCorta(cliente.fecha_nacimiento)}${edad != null ? ` (${edad} años)` : ''}` : null} />
        <Dato etq="Sexo" val={cliente.sexo} />
        <Dato etq="Teléfono" val={cliente.telefono} />
        <Dato etq="Email" val={cliente.email} />
        <Dato etq="Dirección" val={cliente.direccion} />
        <Dato etq="Seguro / ARS" val={cliente.seguro_ars} />
        <Dato etq="Contacto de emergencia" val={cliente.contacto_emergencia} />
        <Dato etq="Tel. de emergencia" val={cliente.telefono_emergencia} />
        <Dato etq="Ocupación" val={cliente.ocupacion} />
        <Dato etq="Referido por" val={cliente.referido_por} />
      </div>
      {cliente.notas && (
        <div className="mt-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Notas</p>
          <p className="text-sm text-slate-700">{cliente.notas}</p>
        </div>
      )}
    </div>
  )
}

// Lista de solo lectura por paciente (presupuestos, facturas, recetas, consentimientos).
function ListaSimple({ pacienteId, tabla, ruta, titulo, saldo }: { pacienteId: string; tabla: string; ruta: string; titulo: string; saldo?: number }) {
  const [rows, setRows] = useState<any[]>([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    setCargando(true)
    supabase.from(tabla).select('*').eq('cliente_id', pacienteId).order('created_at', { ascending: false })
      .then(({ data }) => { setRows(data ?? []); setCargando(false) })
  }, [pacienteId, tabla])

  function tituloFila(r: any): string {
    if (tabla === 'facturas') return `Factura #${r.numero ?? ''}`
    if (tabla === 'presupuestos') return `Presupuesto P${String(r.codigo ?? 0).padStart(4, '0')}`
    if (tabla === 'recetas') return `Receta R${String(r.codigo ?? 0).padStart(4, '0')}`
    if (tabla === 'consentimientos') return r.titulo ?? 'Consentimiento'
    return r.id
  }

  return (
    <div className="card">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-700">{titulo}</h3>
        <Link to={ruta} className="btn-ghost !py-1 text-xs"><ExternalLink size={13} /> Abrir módulo</Link>
      </div>
      {saldo != null && saldo > 0 && (
        <div className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">
          Saldo pendiente: {money(saldo)}
        </div>
      )}
      {cargando ? (
        <Cargando texto="Cargando…" />
      ) : rows.length === 0 ? (
        <p className="py-6 text-center text-sm text-slate-400">Este paciente no tiene {titulo.toLowerCase()}.</p>
      ) : (
        <div className="divide-y divide-slate-50">
          {rows.map((r) => (
            <div key={r.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
              <span className="text-slate-700">{tituloFila(r)}</span>
              <span className="flex items-center gap-3 text-slate-500">
                {r.fecha && <span className="text-xs">{fechaCorta(r.fecha)}</span>}
                {r.estado && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium">{r.estado}</span>}
                {r.total != null && <span className="font-semibold text-slate-700">{money(Number(r.total))}</span>}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
