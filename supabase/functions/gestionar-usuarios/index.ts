// Edge Function: gestionar-usuarios
// Crea, actualiza y elimina usuarios (login por nombre de usuario) — solo administradores.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const DOMINIO = '@deluxe.local'
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
}
function limpiarUsuario(u: string) {
  return String(u || '').trim().toLowerCase()
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  const url = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
  const admin = createClient(url, serviceKey)

  const authHeader = req.headers.get('Authorization') ?? ''
  const caller = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } })
  const { data: userData, error: userErr } = await caller.auth.getUser()
  if (userErr || !userData?.user) return json({ error: 'No autenticado' }, 401)

  const { data: perfil } = await admin
    .from('perfiles').select('rol_key, activo, roles(es_admin)').eq('id', userData.user.id).single()
  const esAdmin = perfil?.activo && (perfil as any)?.roles?.es_admin
  if (!esAdmin) return json({ error: 'Solo un administrador puede gestionar usuarios' }, 403)

  let body: any
  try { body = await req.json() } catch { return json({ error: 'JSON inválido' }, 400) }
  const accion = body?.accion

  try {
    if (accion === 'crear') {
      const username = limpiarUsuario(body.username)
      const { password, nombre, rol_key, empleado_id } = body
      if (!username || !password) return json({ error: 'Usuario y contraseña son obligatorios' }, 400)
      const email = username + DOMINIO
      const { data: created, error } = await admin.auth.admin.createUser({
        email, password, email_confirm: true, user_metadata: { nombre, username },
      })
      if (error) return json({ error: error.message.includes('already') ? 'Ese usuario ya existe' : error.message }, 400)
      const { error: pErr } = await admin.from('perfiles').upsert({
        id: created.user.id, nombre: nombre ?? null, username, email,
        rol_key: rol_key ?? null, empleado_id: empleado_id ?? null, activo: true,
      })
      if (pErr) return json({ error: pErr.message }, 400)
      return json({ ok: true, id: created.user.id })
    }

    if (accion === 'actualizar') {
      const { id, nombre, rol_key, activo, password, empleado_id } = body
      if (!id) return json({ error: 'Falta id' }, 400)
      if (password) {
        const { error } = await admin.auth.admin.updateUserById(id, { password })
        if (error) return json({ error: error.message }, 400)
      }
      const { error: pErr } = await admin.from('perfiles')
        .update({ nombre, rol_key, activo, empleado_id: empleado_id ?? null }).eq('id', id)
      if (pErr) return json({ error: pErr.message }, 400)
      return json({ ok: true })
    }

    if (accion === 'eliminar') {
      const { id } = body
      if (!id) return json({ error: 'Falta id' }, 400)
      if (id === userData.user.id) return json({ error: 'No puedes eliminar tu propio usuario' }, 400)
      const { error } = await admin.auth.admin.deleteUser(id)
      if (error) return json({ error: error.message }, 400)
      return json({ ok: true })
    }

    return json({ error: 'Acción no válida' }, 400)
  } catch (e) {
    return json({ error: String(e) }, 500)
  }
})
