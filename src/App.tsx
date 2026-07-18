import { useState, useEffect, ReactElement, Suspense, lazy } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { Menu } from 'lucide-react'
import Sidebar from './components/Sidebar'
import Cargando from './components/Cargando'

// Cada página se descarga solo cuando se visita (code splitting), en vez de
// cargar las ~33 páginas del sistema de una sola vez al entrar. Esto reduce
// muchísimo el peso inicial (antes ~1 MB de JS en un solo archivo) y por
// tanto el tiempo de carga, sobre todo en conexiones móviles.
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Citas = lazy(() => import('./pages/Citas'))
const Clientes = lazy(() => import('./pages/Clientes'))
const FichaPaciente = lazy(() => import('./pages/FichaPaciente'))
const Odontograma = lazy(() => import('./pages/Odontograma'))
const HistoriaClinica = lazy(() => import('./pages/HistoriaClinica'))
const Presupuestos = lazy(() => import('./pages/Presupuestos'))
const Periodontograma = lazy(() => import('./pages/Periodontograma'))
const ImagenesPaciente = lazy(() => import('./pages/ImagenesPaciente'))
const Recetas = lazy(() => import('./pages/Recetas'))
const Consentimientos = lazy(() => import('./pages/Consentimientos'))
const Documentos = lazy(() => import('./pages/Documentos'))
const Alertas = lazy(() => import('./pages/Alertas'))
const Seguimiento = lazy(() => import('./pages/Seguimiento'))
const Controles = lazy(() => import('./pages/Controles'))
const Laboratorio = lazy(() => import('./pages/Laboratorio'))
const Servicios = lazy(() => import('./pages/Servicios'))
const Articulos = lazy(() => import('./pages/Articulos'))
const Mobiliario = lazy(() => import('./pages/Mobiliario'))
const Empleados = lazy(() => import('./pages/Empleados'))
const Facturacion = lazy(() => import('./pages/Facturacion'))
const Caja = lazy(() => import('./pages/Caja'))
const CuentasPorCobrar = lazy(() => import('./pages/CuentasPorCobrar'))
const Compras = lazy(() => import('./pages/Compras'))
const CuentasPorPagar = lazy(() => import('./pages/CuentasPorPagar'))
const Gastos = lazy(() => import('./pages/Gastos'))
const Nomina = lazy(() => import('./pages/Nomina'))
const Contabilidad = lazy(() => import('./pages/Contabilidad'))
const Reportes = lazy(() => import('./pages/Reportes'))
const Indicadores = lazy(() => import('./pages/Indicadores'))
const Chat = lazy(() => import('./pages/Chat'))
const Tareas = lazy(() => import('./pages/Tareas'))
const Avisos = lazy(() => import('./pages/Avisos'))
const Configuracion = lazy(() => import('./pages/Configuracion'))
import CampanaNotificaciones from './components/CampanaNotificaciones'
import ChatDrawer from './components/chat/ChatDrawer'
import { BurbujaChat, IconoChatHeader } from './components/chat/BotonChat'
import { useAuth } from './lib/auth'
import { useAjustesChat } from './lib/ajustesChat'
import { usePantallaCompletaAbierta } from './lib/pantallaCompleta'
import { MODULOS } from './lib/permisos'

function Protegido({ modulo, children }: { modulo: string; children: ReactElement }) {
  const { puede, permisos } = useAuth()
  if (puede(modulo)) return children
  const primero = MODULOS.find((m) => permisos.includes(m.key))
  if (primero && primero.key !== modulo) return <Navigate to={primero.path} replace />
  return (
    <div className="card text-center text-slate-500">
      No tienes acceso a este módulo. Contacta al administrador.
    </div>
  )
}

export default function App() {
  const { session, loading, puede } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)
  const [chatOpen, setChatOpen] = useState(false)
  const location = useLocation()
  const ajustesChat = useAjustesChat()
  const pantallaCompleta = usePantallaCompletaAbierta()

  // El acceso rápido (burbuja + ícono) aparece si el usuario tiene el chat,
  // se oculta en la propia página del chat, y también mientras una pantalla
  // (ej. Nueva venta) ocupa toda la vista y no quiere que la burbuja la tape.
  const accesoChat = puede('chat') && !location.pathname.startsWith('/chat') && !pantallaCompleta
  // Al navegar a otra pantalla, cerrar el panel deslizante.
  useEffect(() => { setChatOpen(false) }, [location.pathname])

  // Al enfocar un campo numérico, seleccionar su contenido para que el "0"
  // se reemplace al escribir (evita tener que borrarlo manualmente).
  useEffect(() => {
    const onFocus = (e: FocusEvent) => {
      const t = e.target as HTMLInputElement
      if (t instanceof HTMLInputElement && t.type === 'number') {
        requestAnimationFrame(() => t.select())
      }
    }
    document.addEventListener('focusin', onFocus)
    return () => document.removeEventListener('focusin', onFocus)
  }, [])

  if (loading) {
    return <div className="flex h-full items-center justify-center"><Cargando texto="Cargando…" /></div>
  }

  if (!session) {
    // Entrada unificada por el portal central: si no hay sesión, se envía a NEXUS
    // (nexusprord.com) para iniciar con "usuario@amatista". No hay login propio.
    window.location.replace('https://nexusprord.com')
    return (
      <div className="flex h-full items-center justify-center">
        <Cargando texto="Redirigiendo al portal…" />
      </div>
    )
  }

  return (
    <div className="flex h-full">
      <Sidebar open={menuOpen} onClose={() => setMenuOpen(false)} />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="relative z-10 flex items-center gap-3 border-b-2 border-[#9c7d18] bg-[linear-gradient(180deg,rgba(255,255,255,0.28),transparent_55%),linear-gradient(180deg,#e6c356,#c9a227_58%,#b8901f)] px-4 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.55),0_8px_18px_-6px_rgba(176,141,28,0.65)]">
          <button onClick={() => setMenuOpen(true)} className="rounded-lg p-1.5 text-white hover:bg-white/20 lg:hidden" aria-label="Abrir menú">
            <Menu size={24} />
          </button>
          <img
            src={`${import.meta.env.BASE_URL}amatista-logo.png`}
            alt="Amatista Dental"
            className="h-9 w-9 rounded-lg bg-white object-contain p-0.5 shadow-[0_4px_10px_-3px_rgba(0,0,0,0.4),inset_0_1px_0_#fff] ring-1 ring-white/60"
          />
          <span className="text-lg font-semibold tracking-wide text-white [text-shadow:0_1px_2px_rgba(120,90,10,0.45)]">Amatista Dental</span>
          <div className="ml-auto flex items-center gap-1">
            {accesoChat && <IconoChatHeader onClick={() => setChatOpen((v) => !v)} />}
            <CampanaNotificaciones />
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          <div className={`contenido-principal mx-auto max-w-[1600px] px-4 pt-6 sm:px-6 sm:pt-8 ${accesoChat && ajustesChat.burbuja ? 'pb-24 sm:pb-10' : 'pb-6 sm:pb-8'}`}>
            <Suspense fallback={<div className="flex justify-center py-16"><Cargando texto="Cargando…" /></div>}>
            <Routes>
              <Route path="/" element={<Protegido modulo="panel"><Dashboard /></Protegido>} />
              <Route path="/citas" element={<Protegido modulo="citas"><Citas /></Protegido>} />
              <Route path="/clientes" element={<Protegido modulo="clientes"><Clientes /></Protegido>} />
              <Route path="/ficha" element={<Protegido modulo="ficha"><FichaPaciente /></Protegido>} />
              <Route path="/ficha/:id" element={<Protegido modulo="ficha"><FichaPaciente /></Protegido>} />
              <Route path="/odontograma" element={<Protegido modulo="odontograma"><Odontograma /></Protegido>} />
              <Route path="/historia" element={<Protegido modulo="historia"><HistoriaClinica /></Protegido>} />
              <Route path="/presupuestos" element={<Protegido modulo="presupuestos"><Presupuestos /></Protegido>} />
              <Route path="/periodontograma" element={<Protegido modulo="periodontograma"><Periodontograma /></Protegido>} />
              <Route path="/imagenes" element={<Protegido modulo="imagenes"><ImagenesPaciente /></Protegido>} />
              <Route path="/recetas" element={<Protegido modulo="recetas"><Recetas /></Protegido>} />
              <Route path="/consentimientos" element={<Protegido modulo="consentimientos"><Consentimientos /></Protegido>} />
              <Route path="/documentos" element={<Protegido modulo="documentos"><Documentos /></Protegido>} />
              <Route path="/alertas" element={<Protegido modulo="alertas"><Alertas /></Protegido>} />
              <Route path="/seguimiento" element={<Protegido modulo="seguimiento"><Seguimiento /></Protegido>} />
              <Route path="/controles" element={<Protegido modulo="controles"><Controles /></Protegido>} />
              <Route path="/laboratorio" element={<Protegido modulo="laboratorio"><Laboratorio /></Protegido>} />
              <Route path="/servicios" element={<Protegido modulo="servicios"><Servicios /></Protegido>} />
              <Route path="/articulos" element={<Protegido modulo="articulos"><Articulos /></Protegido>} />
              <Route path="/mobiliario" element={<Protegido modulo="mobiliario"><Mobiliario /></Protegido>} />
              <Route path="/empleados" element={<Protegido modulo="empleados"><Empleados /></Protegido>} />
              <Route path="/facturacion" element={<Protegido modulo="facturacion"><Facturacion /></Protegido>} />
              <Route path="/caja" element={<Protegido modulo="caja"><Caja /></Protegido>} />
              <Route path="/cuentas" element={<Protegido modulo="cuentas"><CuentasPorCobrar /></Protegido>} />
              <Route path="/compras" element={<Protegido modulo="compras"><Compras /></Protegido>} />
              <Route path="/por-pagar" element={<Protegido modulo="cuentas_pagar"><CuentasPorPagar /></Protegido>} />
              <Route path="/gastos" element={<Protegido modulo="gastos"><Gastos /></Protegido>} />
              <Route path="/nomina" element={<Protegido modulo="nomina"><Nomina /></Protegido>} />
              <Route path="/contabilidad" element={<Protegido modulo="contabilidad"><Contabilidad /></Protegido>} />
              <Route path="/reportes" element={<Protegido modulo="reportes"><Reportes /></Protegido>} />
              <Route path="/indicadores" element={<Protegido modulo="indicadores"><Indicadores /></Protegido>} />
              <Route path="/chat" element={<Protegido modulo="chat"><Chat /></Protegido>} />
              <Route path="/tareas" element={<Protegido modulo="tareas"><Tareas /></Protegido>} />
              {/* Avisos: visibles para todo el personal (no se restringe por módulo) */}
              <Route path="/avisos" element={<Avisos />} />
              <Route path="/configuracion" element={<Protegido modulo="configuracion"><Configuracion /></Protegido>} />
            </Routes>
            </Suspense>
          </div>
        </main>
      </div>

      {/* Acceso rápido al chat desde cualquier pantalla */}
      {accesoChat && ajustesChat.burbuja && <BurbujaChat onClick={() => setChatOpen((v) => !v)} />}
      <ChatDrawer open={chatOpen} onClose={() => setChatOpen(false)} />
    </div>
  )
}
