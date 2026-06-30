import { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2, UserCog, KeyRound, Search } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { Empleado } from '../types'
import { useAuth } from '../lib/auth'
import PageHeader from '../components/PageHeader'
import Cargando from '../components/Cargando'
import Modal from '../components/Modal'

const vacio = {
  nombre: '',
  puesto: 'Estilista',
  telefono: '',
  email: '',
  especialidad: '',
  color: '#d946ef',
  comision_pct: 0,
  activo: true,
}

const puestos = ['Estilista', 'Manicurista', 'Esteticista', 'Maquillista', 'Barbero', 'Recepción', 'Gerente']

interface PerfilEmp { id: string; username: string | null; rol_key: string | null; activo: boolean }
interface RolItem { key: string; nombre: string }

// Sugiere un usuario a partir del primer nombre (sin acentos ni símbolos)
function sugerirUsuario(nombre: string): string {
  const first = nombre.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').split(/\s+/)[0] ?? ''
  return first.replace(/[^a-z0-9]/g, '')
}

export default function Empleados() {
  const { perfil } = useAuth()
  const esAdmin = !!perfil?.es_admin

  const [items, setItems] = useState<Empleado[]>([])
  const [busqueda, setBusqueda] = useState('')
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState(vacio)
  const [saving, setSaving] = useState(false)

  const q = busqueda.trim().toLowerCase()
  const filtrados = q
    ? items.filter((e) => e.nombre.toLowerCase().includes(q) || e.puesto.toLowerCase().includes(q) || (e.especialidad ?? '').toLowerCase().includes(q))
    : items

  // Acceso al sistema (usuario y contraseña) por empleado
  const [perfilesByEmp, setPerfilesByEmp] = useState<Record<string, PerfilEmp>>({})
  const [roles, setRoles] = useState<RolItem[]>([])
  const [accesoEmp, setAccesoEmp] = useState<Empleado | null>(null)
  const [accesoPerfil, setAccesoPerfil] = useState<PerfilEmp | null>(null)
  const [formA, setFormA] = useState({ usuario: '', password: '', rol_key: '', activo: true })
  const [savingA, setSavingA] = useState(false)

  async function cargar() {
    setLoading(true)
    const [emp, perf, rol] = await Promise.all([
      supabase.from('empleados').select('*').order('nombre'),
      supabase.from('perfiles').select('id,username,rol_key,activo,empleado_id'),
      supabase.from('roles').select('key,nombre').order('nombre'),
    ])
    if (emp.error) alert('Error al cargar empleados: ' + emp.error.message)
    setItems(emp.data ?? [])
    const map: Record<string, PerfilEmp> = {}
    for (const p of (perf.data ?? []) as any[]) {
      if (p.empleado_id) map[p.empleado_id] = { id: p.id, username: p.username, rol_key: p.rol_key, activo: p.activo }
    }
    setPerfilesByEmp(map)
    setRoles((rol.data as any) ?? [])
    setLoading(false)
  }

  useEffect(() => {
    cargar()
  }, [])

  function abrirNuevo() {
    setEditId(null)
    setForm(vacio)
    setOpen(true)
  }

  function abrirEditar(e: Empleado) {
    setEditId(e.id)
    setForm({
      nombre: e.nombre,
      puesto: e.puesto,
      telefono: e.telefono ?? '',
      email: e.email ?? '',
      especialidad: e.especialidad ?? '',
      color: e.color ?? '#d946ef',
      comision_pct: Number(e.comision_pct),
      activo: e.activo,
    })
    setOpen(true)
  }

  async function guardar() {
    if (!form.nombre.trim()) return alert('El nombre es obligatorio')
    setSaving(true)
    const payload = {
      ...form,
      telefono: form.telefono || null,
      email: form.email || null,
      especialidad: form.especialidad || null,
    }
    const { error } = editId
      ? await supabase.from('empleados').update(payload).eq('id', editId)
      : await supabase.from('empleados').insert(payload)
    setSaving(false)
    if (error) return alert('Error al guardar: ' + error.message)
    setOpen(false)
    cargar()
  }

  async function eliminar(e: Empleado) {
    if (!confirm(`¿Eliminar a "${e.nombre}"?`)) return
    const { error } = await supabase.from('empleados').delete().eq('id', e.id)
    if (error) return alert('Error al eliminar: ' + error.message)
    cargar()
  }

  // ---------- ACCESO (usuario y contraseña) ----------
  function abrirAcceso(e: Empleado) {
    const p = perfilesByEmp[e.id] ?? null
    const rolDefault = roles.find((r) => r.key === 'estilista')?.key ?? roles[0]?.key ?? ''
    setAccesoEmp(e)
    setAccesoPerfil(p)
    setFormA({
      usuario: p?.username ?? sugerirUsuario(e.nombre),
      password: '',
      rol_key: p?.rol_key ?? rolDefault,
      activo: p?.activo ?? true,
    })
  }

  async function guardarAcceso() {
    if (!accesoEmp) return
    if (!accesoPerfil) {
      if (!formA.usuario.trim() || !formA.password) return alert('Usuario y contraseña son obligatorios')
      if (formA.password.length < 6) return alert('La contraseña debe tener al menos 6 caracteres')
    } else if (formA.password && formA.password.length < 6) {
      return alert('La nueva contraseña debe tener al menos 6 caracteres')
    }
    setSavingA(true)
    const payload: any = accesoPerfil
      ? { accion: 'actualizar', id: accesoPerfil.id, nombre: accesoEmp.nombre, rol_key: formA.rol_key, empleado_id: accesoEmp.id, activo: formA.activo }
      : { accion: 'crear', username: formA.usuario, password: formA.password, nombre: accesoEmp.nombre, rol_key: formA.rol_key, empleado_id: accesoEmp.id }
    if (accesoPerfil && formA.password) payload.password = formA.password
    const { data, error } = await supabase.functions.invoke('gestionar-usuarios', { body: payload })
    setSavingA(false)
    if (error || (data as any)?.error) return alert('Error: ' + (((data as any)?.error) || error?.message))
    setAccesoEmp(null)
    cargar()
  }

  async function quitarAcceso() {
    if (!accesoPerfil || !accesoEmp) return
    if (accesoPerfil.id === perfil?.id) return alert('No puedes quitar tu propio acceso')
    if (!confirm(`¿Quitar el acceso de "${accesoEmp.nombre}"? Ya no podrá iniciar sesión.`)) return
    setSavingA(true)
    const { data, error } = await supabase.functions.invoke('gestionar-usuarios', { body: { accion: 'eliminar', id: accesoPerfil.id } })
    setSavingA(false)
    if (error || (data as any)?.error) return alert('Error: ' + (((data as any)?.error) || error?.message))
    setAccesoEmp(null)
    cargar()
  }

  return (
    <div>
      <PageHeader
        title="Empleados"
        subtitle="Personal del salón"
        action={
          <button className="btn-primary" onClick={abrirNuevo}>
            <Plus size={16} /> Nuevo empleado
          </button>
        }
      />

      {items.length > 0 && (
        <div className="relative mb-4 max-w-md">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" />
          <input className="input pl-9" placeholder="Buscar por nombre, puesto o especialidad…" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
        </div>
      )}

      {loading ? (
        <Cargando />
      ) : items.length === 0 ? (
        <div className="card flex flex-col items-center gap-3 py-12 text-center">
          <UserCog className="text-brand-300" size={40} />
          <p className="text-slate-500">Aún no hay empleados registrados.</p>
        </div>
      ) : filtrados.length === 0 ? (
        <div className="card flex flex-col items-center gap-3 py-12 text-center">
          <Search className="text-brand-300" size={40} />
          <p className="text-slate-500">No hay empleados que coincidan con «{busqueda}».</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtrados.map((e) => (
            <div key={e.id} className={`card ${e.activo ? '' : 'opacity-60'}`}>
              <div className="flex items-start gap-3">
                <div
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-lg font-bold text-white"
                  style={{ backgroundColor: e.color ?? '#d946ef' }}
                >
                  {e.nombre.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-slate-800">{e.nombre}</p>
                  <p className="text-sm text-brand-600">{e.puesto}</p>
                  {e.especialidad && <p className="mt-0.5 truncate text-xs text-slate-600">{e.especialidad}</p>}
                </div>
              </div>
              <div className="mt-4 space-y-1 text-sm text-slate-500">
                {e.telefono && <p>📞 {e.telefono}</p>}
                {e.email && <p className="truncate">✉️ {e.email}</p>}
                <p>💰 Comisión: {Number(e.comision_pct)}%</p>
                {esAdmin && (
                  perfilesByEmp[e.id] ? (
                    <p className={perfilesByEmp[e.id].activo ? 'text-emerald-600' : 'text-amber-600'}>
                      🔑 {perfilesByEmp[e.id].username}{perfilesByEmp[e.id].activo ? '' : ' (sin acceso)'}
                    </p>
                  ) : (
                    <p className="text-slate-600">🔒 Sin usuario para iniciar sesión</p>
                  )
                )}
              </div>
              <div className="mt-4 flex justify-end gap-1 border-t border-slate-50 pt-3">
                {esAdmin && (
                  <button
                    title={perfilesByEmp[e.id] ? 'Gestionar acceso' : 'Dar usuario y contraseña'}
                    onClick={() => abrirAcceso(e)}
                    className="rounded-lg p-2 text-slate-600 hover:bg-brand-50 hover:text-brand-600"
                  >
                    <KeyRound size={16} />
                  </button>
                )}
                <button onClick={() => abrirEditar(e)} className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 hover:text-brand-600">
                  <Pencil size={16} />
                </button>
                <button onClick={() => eliminar(e)} className="rounded-lg p-2 text-slate-600 hover:bg-rose-50 hover:text-rose-600">
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={open}
        title={editId ? 'Editar empleado' : 'Nuevo empleado'}
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
            <label className="label">Nombre</label>
            <input className="input" value={form.nombre} onChange={(ev) => setForm({ ...form, nombre: ev.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Puesto</label>
              <select className="input" value={form.puesto} onChange={(ev) => setForm({ ...form, puesto: ev.target.value })}>
                {puestos.map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Comisión (%)</label>
              <input type="number" min={0} max={100} className="input" value={form.comision_pct || ''} onChange={(ev) => setForm({ ...form, comision_pct: Number(ev.target.value) })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Teléfono</label>
              <input className="input" value={form.telefono} onChange={(ev) => setForm({ ...form, telefono: ev.target.value })} />
            </div>
            <div>
              <label className="label">Color (agenda)</label>
              <input type="color" className="h-[42px] w-full rounded-lg border border-slate-300" value={form.color} onChange={(ev) => setForm({ ...form, color: ev.target.value })} />
            </div>
          </div>
          <div>
            <label className="label">Email</label>
            <input type="email" className="input" value={form.email} onChange={(ev) => setForm({ ...form, email: ev.target.value })} />
          </div>
          <div>
            <label className="label">Especialidad</label>
            <input className="input" value={form.especialidad} onChange={(ev) => setForm({ ...form, especialidad: ev.target.value })} placeholder="Cortes y color" />
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" checked={form.activo} onChange={(ev) => setForm({ ...form, activo: ev.target.checked })} />
            Empleado activo
          </label>
        </div>
      </Modal>

      {/* Acceso al sistema: usuario y contraseña del empleado */}
      <Modal
        open={!!accesoEmp}
        title={accesoPerfil ? `Acceso de ${accesoEmp?.nombre ?? ''}` : `Dar acceso a ${accesoEmp?.nombre ?? ''}`}
        onClose={() => setAccesoEmp(null)}
        footer={
          <>
            {accesoPerfil && accesoPerfil.id !== perfil?.id && (
              <button className="btn-ghost mr-auto text-rose-600 hover:bg-rose-50" onClick={quitarAcceso} disabled={savingA}>
                Quitar acceso
              </button>
            )}
            <button className="btn-ghost" onClick={() => setAccesoEmp(null)}>Cancelar</button>
            <button className="btn-primary" onClick={guardarAcceso} disabled={savingA}>
              {savingA ? 'Guardando…' : accesoPerfil ? 'Guardar' : 'Crear acceso'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="label">Usuario (para iniciar sesión)</label>
            <input
              className="input lowercase"
              value={formA.usuario}
              disabled={!!accesoPerfil}
              autoCapitalize="none"
              autoCorrect="off"
              onChange={(ev) => setFormA({ ...formA, usuario: ev.target.value.trim().toLowerCase() })}
              placeholder="ej: maria"
            />
            {accesoPerfil && <p className="mt-1 text-xs text-slate-600">El nombre de usuario no se puede cambiar.</p>}
          </div>
          <div>
            <label className="label">{accesoPerfil ? 'Nueva contraseña (opcional)' : 'Contraseña'}</label>
            <input
              type="text"
              className="input"
              value={formA.password}
              onChange={(ev) => setFormA({ ...formA, password: ev.target.value })}
              placeholder={accesoPerfil ? 'Dejar en blanco para no cambiarla' : 'Mínimo 6 caracteres'}
            />
          </div>
          <div>
            <label className="label">Rol (qué puede ver y hacer)</label>
            <select className="input" value={formA.rol_key} onChange={(ev) => setFormA({ ...formA, rol_key: ev.target.value })}>
              {roles.map((r) => <option key={r.key} value={r.key}>{r.nombre}</option>)}
            </select>
          </div>
          {accesoPerfil && (
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input type="checkbox" checked={formA.activo} onChange={(ev) => setFormA({ ...formA, activo: ev.target.checked })} />
              Puede iniciar sesión (activo)
            </label>
          )}
          <p className="rounded-lg bg-brand-50/60 px-3 py-2 text-xs text-brand-700">
            El empleado entrará con este <b>usuario</b> y <b>contraseña</b>. Anótalos y entrégaselos.
          </p>
        </div>
      </Modal>
    </div>
  )
}
