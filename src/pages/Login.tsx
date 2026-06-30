import { FormEvent, useState } from 'react'
import { LogIn, MapPin, Phone, Instagram } from 'lucide-react'
import { useAuth } from '../lib/auth'
import { usuarioAEmail } from '../lib/constants'
import { useNegocio } from '../lib/negocio'

export default function Login() {
  const { signIn } = useAuth()
  const { negocio } = useNegocio()
  const [usuario, setUsuario] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const { error } = await signIn(usuarioAEmail(usuario), password)
    setLoading(false)
    if (error) setError('Usuario o contraseña incorrectos. Verifica e intenta de nuevo.')
  }

  return (
    <div className="relative flex min-h-full items-center justify-center overflow-hidden bg-[#fdfaf0] p-4">
      {/* Resplandores dorados sutiles sobre fondo claro */}
      <div className="pointer-events-none absolute -top-40 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-brand-300/30 blur-[130px]" />
      <div className="pointer-events-none absolute -bottom-32 right-0 h-80 w-80 rounded-full bg-amber-200/40 blur-[130px]" />
      <div className="pointer-events-none absolute -left-24 top-1/3 h-72 w-72 rounded-full bg-amber-100/40 blur-[120px]" />

      <div className="relative z-10 w-full max-w-md">
        <div className="rounded-3xl border border-amber-100 bg-white p-8 shadow-[0_30px_60px_-15px_rgba(201,162,39,0.35)]">
          <div className="mb-8 flex flex-col items-center text-center">
            <img
              src={`${import.meta.env.BASE_URL}${negocio.logo}`}
              alt={negocio.nombre}
              className="logo-glow mb-4 w-52 max-w-full rounded-2xl bg-white object-contain p-2 ring-1 ring-amber-100"
            />
            <h1 className="font-display text-2xl font-bold tracking-tight text-slate-800">{negocio.nombre}</h1>
            <p className="mt-1 text-sm text-slate-500">Inicia sesión para administrar la clínica</p>
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-600">Usuario</label>
              <input
                type="text"
                className="input w-full rounded-xl px-4 py-3 lowercase placeholder-slate-400 outline-none transition focus:border-brand-400 focus:bg-white focus:ring-2 focus:ring-brand-200"
                value={usuario}
                onChange={(e) => setUsuario(e.target.value)}
                placeholder="usuario"
                autoCapitalize="none"
                autoCorrect="off"
                autoComplete="username"
                required
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-600">Contraseña</label>
              <input
                type="password"
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-800 placeholder-slate-400 outline-none transition focus:border-brand-400 focus:bg-white focus:ring-2 focus:ring-brand-200"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                required
              />
            </div>

            {error && (
              <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-600">{error}</p>
            )}

            <button
              type="submit"
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-brand-500 to-fuchsia-600 px-4 py-3 font-semibold text-white shadow-lg shadow-brand-900/50 transition hover:from-brand-400 hover:to-fuchsia-500 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
              disabled={loading}
            >
              <LogIn size={16} />
              {loading ? 'Entrando…' : 'Entrar'}
            </button>
          </form>

          <div className="mt-7 space-y-1.5 border-t border-amber-100 pt-5 text-center text-xs text-slate-400">
            <p className="flex items-center justify-center gap-1.5"><MapPin size={12} /> {negocio.direccion} · {negocio.referencia}</p>
            <p className="flex items-center justify-center gap-1.5"><Phone size={12} /> {negocio.whatsapp}</p>
            <p className="flex items-center justify-center gap-1.5"><Instagram size={12} /> {negocio.instagram}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
