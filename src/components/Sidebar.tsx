import { NavLink } from 'react-router-dom'
import {
  CalendarDays,
  Users,
  Stethoscope,
  Smile,
  HeartPulse,
  FileText,
  UserCog,
  LayoutDashboard,
  LogOut,
  Receipt,
  ShoppingCart,
  Wallet,
  Calculator,
  Settings,
  Package,
  Armchair,
  HandCoins,
  FileBarChart,
  X,
} from 'lucide-react'
import { useAuth } from '../lib/auth'

type Link = { to: string; label: string; icon: typeof Users; modulo: string; end?: boolean }

const grupos: { titulo: string; links: Link[] }[] = [
  {
    titulo: 'Clínica',
    links: [
      { to: '/', label: 'Panel', icon: LayoutDashboard, modulo: 'panel', end: true },
      { to: '/citas', label: 'Citas / Agenda', icon: CalendarDays, modulo: 'citas' },
      { to: '/clientes', label: 'Pacientes', icon: Users, modulo: 'clientes' },
      { to: '/odontograma', label: 'Odontograma', icon: Smile, modulo: 'odontograma' },
      { to: '/historia', label: 'Historia clínica', icon: HeartPulse, modulo: 'historia' },
      { to: '/presupuestos', label: 'Presupuestos', icon: FileText, modulo: 'presupuestos' },
      { to: '/servicios', label: 'Tratamientos y precios', icon: Stethoscope, modulo: 'servicios' },
    ],
  },
  {
    titulo: 'Facturación y operación',
    links: [
      { to: '/facturacion', label: 'Facturación', icon: Receipt, modulo: 'facturacion' },
      { to: '/caja', label: 'Caja', icon: Wallet, modulo: 'caja' },
      { to: '/cuentas', label: 'Cuentas por cobrar', icon: HandCoins, modulo: 'cuentas' },
      { to: '/compras', label: 'Compras', icon: ShoppingCart, modulo: 'compras' },
      { to: '/por-pagar', label: 'Cuentas por pagar', icon: HandCoins, modulo: 'cuentas_pagar' },
      { to: '/gastos', label: 'Gastos', icon: Wallet, modulo: 'gastos' },
      { to: '/nomina', label: 'Pagos a empleados', icon: Users, modulo: 'nomina' },
      { to: '/contabilidad', label: 'Contabilidad', icon: Calculator, modulo: 'contabilidad' },
      { to: '/reportes', label: 'Reportes', icon: FileBarChart, modulo: 'reportes' },
      { to: '/articulos', label: 'Artículos / Insumos', icon: Package, modulo: 'articulos' },
      { to: '/mobiliario', label: 'Mobiliario y equipos', icon: Armchair, modulo: 'mobiliario' },
    ],
  },
  {
    titulo: 'Configuración',
    links: [
      { to: '/configuracion', label: 'Configuración', icon: Settings, modulo: 'configuracion' },
      { to: '/empleados', label: 'Empleados', icon: UserCog, modulo: 'empleados' },
    ],
  },
]

interface Props {
  open: boolean
  onClose: () => void
}

export default function Sidebar({ open, onClose }: Props) {
  const { perfil, signOut, puede } = useAuth()
  const visibles = grupos
    .map((g) => ({ ...g, links: g.links.filter((l) => puede(l.modulo)) }))
    .filter((g) => g.links.length > 0)

  return (
    <>
      {open && <div className="fixed inset-0 z-30 bg-slate-900/50 lg:hidden" onClick={onClose} />}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 transform flex-col border-r border-amber-100 bg-white text-slate-700 shadow-[8px_0_30px_-12px_rgba(201,162,39,0.15)] transition-transform duration-200 lg:static lg:z-auto lg:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="relative border-b border-amber-100 px-5 py-5">
          <img
            src={`${import.meta.env.BASE_URL}amatista-logo.png`}
            alt="Amatista Dental"
            className="logo-glow mx-auto aspect-square w-24 rounded-2xl bg-white object-contain p-2.5 ring-1 ring-amber-200"
          />
          <button onClick={onClose} className="absolute right-3 top-3 rounded-lg p-1 text-slate-500 hover:bg-amber-50 lg:hidden">
            <X size={22} />
          </button>
        </div>

        <nav className="flex-1 space-y-4 overflow-y-auto px-3 py-2">
          {visibles.map((g) => (
            <div key={g.titulo}>
              <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-amber-600">{g.titulo}</p>
              <div className="space-y-1">
                {g.links.map(({ to, label, icon: Icon, end }) => (
                  <NavLink
                    key={to}
                    to={to}
                    end={end}
                    onClick={onClose}
                    className={({ isActive }) =>
                      `group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-all duration-150 ${
                        isActive
                          ? 'bg-gradient-to-r from-amber-100 to-amber-50 text-amber-900 ring-1 ring-amber-300/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.85),0_6px_14px_-6px_rgba(201,162,39,0.45)]'
                          : 'text-slate-600 hover:bg-amber-50/70 hover:text-amber-800 hover:translate-x-0.5'
                      }`
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <Icon size={18} className={isActive ? 'text-amber-600' : 'text-amber-500/80 group-hover:text-amber-600'} />
                        {label}
                      </>
                    )}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>

        <div className="space-y-2 border-t border-amber-100 px-3 py-4">
          {perfil?.rol_nombre && (
            <p className="px-3 text-xs font-semibold text-amber-700">{perfil.rol_nombre}</p>
          )}
          {(perfil?.username || perfil?.nombre) && (
            <p className="truncate px-3 text-xs text-slate-500">{perfil?.nombre || perfil?.username}{perfil?.username ? ` · ${perfil.username}` : ''}</p>
          )}
          <button
            onClick={signOut}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-amber-50 hover:text-slate-900"
          >
            <LogOut size={18} />
            Cerrar sesión
          </button>
        </div>
      </aside>
    </>
  )
}
