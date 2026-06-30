import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'
import { Perfil, TODOS_MODULOS } from './permisos'

interface AuthContextValue {
  session: Session | null
  perfil: Perfil | null
  permisos: string[]
  puede: (modulo: string) => boolean
  puedeAccion: (accion: string) => boolean
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
  recargarPerfil: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue>({
  session: null,
  perfil: null,
  permisos: [],
  puede: () => false,
  puedeAccion: () => false,
  loading: true,
  signIn: async () => ({ error: 'no-provider' }),
  signOut: async () => {},
  recargarPerfil: async () => {},
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [perfil, setPerfil] = useState<Perfil | null>(null)
  const [loading, setLoading] = useState(true)

  const cargarPerfil = useCallback(async (userId: string) => {
    const { data } = await supabase
      .from('perfiles')
      .select('*, roles(nombre, permisos, es_admin)')
      .eq('id', userId)
      .maybeSingle()

    if (!data) {
      // Usuario sin perfil asignado: acceso mínimo
      setPerfil({ id: userId, nombre: null, username: null, email: null, rol_key: null, activo: true, permisos: ['panel'], es_admin: false })
      return
    }
    const rol = (data as any).roles
    const esAdmin = !!rol?.es_admin
    setPerfil({
      id: data.id,
      nombre: data.nombre,
      username: (data as any).username ?? null,
      email: data.email,
      rol_key: data.rol_key,
      activo: data.activo,
      rol_nombre: rol?.nombre ?? null,
      es_admin: esAdmin,
      permisos: esAdmin ? TODOS_MODULOS : (rol?.permisos ?? ['panel']),
    })
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session)
      if (data.session) await cargarPerfil(data.session.user.id)
      setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, s) => {
      setSession(s)
      if (s) await cargarPerfil(s.user.id)
      else setPerfil(null)
    })
    return () => sub.subscription.unsubscribe()
  }, [cargarPerfil])

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error: error ? error.message : null }
  }

  async function signOut() {
    await supabase.auth.signOut()
    setPerfil(null)
    // Volver a la puerta central (NEXUS) en vez de quedarse en el login de Amatista.
    window.location.href = 'https://nexusprord.com'
  }

  async function recargarPerfil() {
    if (session) await cargarPerfil(session.user.id)
  }

  const permisos = perfil?.permisos ?? []
  const puede = (modulo: string) => permisos.includes(modulo)
  // El admin puede todas las funciones; los demás según su rol.
  const puedeAccion = (accion: string) => !!perfil?.es_admin || permisos.includes(accion)

  return (
    <AuthContext.Provider value={{ session, perfil, permisos, puede, puedeAccion, loading, signIn, signOut, recargarPerfil }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
