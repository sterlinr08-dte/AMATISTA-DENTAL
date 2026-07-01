import { useState, useEffect, ReactElement } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { Menu } from 'lucide-react'
import Sidebar from './components/Sidebar'
import Dashboard from './pages/Dashboard'
import Citas from './pages/Citas'
import Clientes from './pages/Clientes'
import FichaPaciente from './pages/FichaPaciente'
import Odontograma from './pages/Odontograma'
import HistoriaClinica from './pages/HistoriaClinica'
import Presupuestos from './pages/Presupuestos'
import Periodontograma from './pages/Periodontograma'
import ImagenesPaciente from './pages/ImagenesPaciente'
import Recetas from './pages/Recetas'
import Consentimientos from './pages/Consentimientos'
import Alertas from './pages/Alertas'
import Seguimiento from './pages/Seguimiento'
import Servicios from './pages/Servicios'
import Articulos from './pages/Articulos'
import Mobiliario from './pages/Mobiliario'
import Empleados from './pages/Empleados'
import Facturacion from './pages/Facturacion'
import Caja from './pages/Caja'
import CuentasPorCobrar from './pages/CuentasPorCobrar'
import Compras from './pages/Compras'
import CuentasPorPagar from './pages/CuentasPorPagar'
import Gastos from './pages/Gastos'
import Nomina from './pages/Nomina'
import Contabilidad from './pages/Contabilidad'
import Reportes from './pages/Reportes'
import Configuracion from './pages/Configuracion'
import Cargando from './components/Cargando'
import { useAuth } from './lib/auth'
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
  const { session, loading } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)

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
        <header className="relative z-10 flex items-center gap-3 border-b-2 border-[#9c7d18] bg-[linear-gradient(100deg,rgba(255,255,255,0.2),transparent_45%),linear-gradient(180deg,#e6c356,#c9a227_58%,#b8901f)] px-4 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.5),0_8px_18px_-6px_rgba(176,141,28,0.65)]">
          <button onClick={() => setMenuOpen(true)} className="rounded-lg p-1.5 text-white hover:bg-white/20 lg:hidden" aria-label="Abrir menú">
            <Menu size={24} />
          </button>
          <img
            src={`${import.meta.env.BASE_URL}amatista-logo.png`}
            alt="Amatista Dental"
            className="h-9 w-9 rounded-lg bg-white object-contain p-0.5 shadow-[0_4px_10px_-3px_rgba(0,0,0,0.4),inset_0_1px_0_#fff] ring-1 ring-white/60"
          />
          <span className="text-lg font-semibold tracking-wide text-white [text-shadow:0_1px_2px_rgba(120,90,10,0.45)]">Amatista Dental</span>
        </header>

        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
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
              <Route path="/alertas" element={<Protegido modulo="alertas"><Alertas /></Protegido>} />
              <Route path="/seguimiento" element={<Protegido modulo="seguimiento"><Seguimiento /></Protegido>} />
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
              <Route path="/configuracion" element={<Protegido modulo="configuracion"><Configuracion /></Protegido>} />
            </Routes>
          </div>
        </main>
      </div>
    </div>
  )
}
