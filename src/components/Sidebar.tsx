import { NavLink } from 'react-router-dom'
import {
  CalendarDays,
  Users,
  Stethoscope,
  Smile,
  HeartPulse,
  FileText,
  Ruler,
  Image,
  Pill,
  Bell,
  ClipboardCheck,
  BellRing,
  FlaskConical,
  PenLine,
  IdCard,
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
  Gauge,
  MessagesSquare,
  ListChecks,
  X,
} from 'lucide-react'
import { useAuth } from '../lib/auth'
import { useChatNoLeidos } from '../lib/useChatNoLeidos'

type Link = { to: string; label: string; icon: typeof Users; modulo: string; end?: boolean; oculto?: boolean }

const grupos: { titulo: string; links: Link[] }[] = [
  {
    titulo: 'Clínica',
    links: [
      { to: '/', label: 'Panel', icon: LayoutDashboard, modulo: 'panel', end: true },
      { to: '/citas', label: 'Citas / Agenda', icon: CalendarDays, modulo: 'citas' },
      { to: '/clientes', label: 'Pacientes', icon: Users, modulo: 'clientes' },
      { to: '/ficha', label: 'Ficha del paciente', icon: IdCard, modulo: 'ficha' },
      { to: '/chat', label: 'Chat interno', icon: MessagesSquare, modulo: 'chat' },
      { to: '/tareas', label: 'Tareas', icon: ListChecks, modulo: 'tareas' },
      // Se trabajan desde la ficha del paciente; ocultos del menú para dejarlo más limpio.
      { to: '/odontograma', label: 'Odontograma', icon: Smile, modulo: 'odontograma', oculto: true },
      { to: '/periodontograma', label: 'Periodontograma', icon: Ruler, modulo: 'periodontograma', oculto: true },
      { to: '/historia', label: 'Historia clínica', icon: HeartPulse, modulo: 'historia', oculto: true },
      { to: '/imagenes', label: 'Imágenes / Radiografías', icon: Image, modulo: 'imagenes', oculto: true },
      { to: '/recetas', label: 'Recetas', icon: Pill, modulo: 'recetas', oculto: true },
      { to: '/documentos', label: 'Documentos', icon: FileText, modulo: 'documentos', oculto: true },
      { to: '/consentimientos', label: 'Consentimientos', icon: PenLine, modulo: 'consentimientos', oculto: true },
      { to: '/presupuestos', label: 'Presupuestos', icon: FileText, modulo: 'presupuestos', oculto: true },
      { to: '/seguimiento', label: 'Seguimiento de planes', icon: ClipboardCheck, modulo: 'seguimiento' },
      { to: '/controles', label: 'Controles / Recall', icon: BellRing, modulo: 'controles' },
      { to: '/laboratorio', label: 'Laboratorio', icon: FlaskConical, modulo: 'laboratorio' },
      { to: '/alertas', label: 'Alertas', icon: Bell, modulo: 'alertas' },
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
      { to: '/indicadores', label: 'Indicadores', icon: Gauge, modulo: 'indicadores' },
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
  const chatNoLeidos = useChatNoLeidos()
  const visibles = grupos
    .map((g) => ({ ...g, links: g.links.filter((l) => puede(l.modulo) && !l.oculto) }))
    .filter((g) => g.links.length > 0)

  return (
    <>
      {open && <div className="fixed inset-0 z-30 bg-slate-900/50 lg:hidden" onClick={onClose} />}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 transform flex-col border-r-2 border-[#9c7d18] bg-[linear-gradient(180deg,rgba(255,255,255,0.2),transparent_24%),linear-gradient(165deg,#e6c356,#cfa62b_45%,#b8901f)] text-amber-50 shadow-[inset_1px_1px_0_rgba(255,255,255,0.45),inset_-7px_0_18px_-10px_rgba(0,0,0,0.4),10px_0_34px_-12px_rgba(176,141,28,0.6)] transition-transform duration-200 lg:static lg:z-auto lg:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="relative border-b border-white/25 px-5 py-5">
          <img
            src={`${import.meta.env.BASE_URL}amatista-logo.png`}
            alt="Amatista Dental"
            className="mx-auto aspect-square w-24 rounded-2xl bg-white object-contain p-2.5 shadow-[0_8px_18px_-6px_rgba(0,0,0,0.4),inset_0_1px_0_#fff] ring-1 ring-white/70"
          />
          <button onClick={onClose} className="absolute right-3 top-3 rounded-lg p-1 text-white/90 hover:bg-white/20 lg:hidden">
            <X size={22} />
          </button>
        </div>

        <nav className="flex-1 space-y-4 overflow-y-auto px-3 py-2">
          {visibles.map((g) => (
            <div key={g.titulo}>
              <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-white/70">{g.titulo}</p>
              <div className="space-y-1">
                {g.links.map(({ to, label, icon: Icon, end, modulo }) => (
                  <NavLink
                    key={to}
                    to={to}
                    end={end}
                    onClick={onClose}
                    className={({ isActive }) =>
                      `group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-all duration-150 ${
                        isActive
                          ? 'bg-white text-amber-800 shadow-[0_5px_12px_-3px_rgba(0,0,0,0.45),inset_0_1px_0_#fff] -translate-y-px'
                          : 'text-amber-50 [text-shadow:0_1px_1px_rgba(120,90,10,0.4)] hover:-translate-y-px hover:bg-white/15 hover:text-white hover:shadow-[0_4px_10px_-4px_rgba(0,0,0,0.35)]'
                      }`
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <Icon size={18} className={isActive ? 'text-amber-600' : 'text-amber-50/90 group-hover:text-white'} />
                        <span className="flex-1">{label}</span>
                        {modulo === 'chat' && chatNoLeidos > 0 && (
                          <span className="shrink-0 rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-bold text-white shadow">
                            {chatNoLeidos > 99 ? '99+' : chatNoLeidos}
                          </span>
                        )}
                      </>
                    )}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>

        <div className="space-y-2 border-t border-white/25 px-3 py-4">
          {perfil?.rol_nombre && (
            <p className="px-3 text-xs font-semibold text-white">{perfil.rol_nombre}</p>
          )}
          {(perfil?.username || perfil?.nombre) && (
            <p className="truncate px-3 text-xs text-amber-50/80">{perfil?.nombre || perfil?.username}{perfil?.username ? ` · ${perfil.username}` : ''}</p>
          )}
          <button
            onClick={signOut}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-amber-50 transition hover:bg-white/15 hover:text-white"
          >
            <LogOut size={18} />
            Cerrar sesión
          </button>
        </div>
      </aside>
    </>
  )
}
