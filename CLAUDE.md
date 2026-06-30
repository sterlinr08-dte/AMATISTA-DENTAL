# CLAUDE.md

Guía para asistentes de IA (Claude Code) que trabajen en este repositorio.
Lee también el `README.md` para la descripción funcional completa.

## Qué es este proyecto

**DELUXE BEAUTY CENTER** — sistema web de gestión para un salón de belleza
(citas, clientes, servicios, empleados, facturación, caja, compras, gastos,
nómina, cuentas por cobrar/pagar y contabilidad).

> Nota de nombres: la carpeta local es `Seguro-de-salud` y el repo histórico se
> llamaba "Seguro de Salud", pero **el proyecto actual es DELUXE BEAUTY CENTER**.
> En GitHub el repositorio se llama **`DELUXE-BEAUTY-CENTER-`**
> (owner `sterlinr08-dte`). El sistema anterior quedó archivado en `backup/`.

## Stack

| Capa | Tecnología |
|---|---|
| Frontend | React 18 + TypeScript + Vite 5 |
| Estilos | Tailwind CSS |
| Iconos | lucide-react |
| Routing | react-router-dom v6 — **HashRouter** (ver gotchas) |
| Backend/DB | Supabase (PostgreSQL + Auth + RLS) |
| Fechas | date-fns |

## Comandos

```bash
npm install        # instalar dependencias
npm run dev        # desarrollo (Vite, puerto 5173)
npm run build      # build de producción (tsc -b && vite build) -> dist/
npm run preview    # previsualizar el build
npm run lint       # chequeo de tipos (tsc --noEmit)
```

No hay framework de tests configurado. La verificación previa al deploy es
`npm run build` (incluye el chequeo de TypeScript).

## Estructura

```
src/
  components/   Reutilizables: Sidebar, Modal, PageHeader, DataTable, Cargando
  lib/          supabase.ts (cliente), auth.tsx (sesión), permisos.ts (RBAC),
                negocio.tsx (ajustes), comisiones.ts, reportes.ts, format.ts, constants.ts
  pages/        Una página por módulo: Dashboard, Citas, Clientes, Servicios,
                Empleados, Facturacion, Caja, Compras, Gastos, Nomina,
                Contabilidad, CuentasPorCobrar, CuentasPorPagar, Articulos,
                Reportes, Configuracion, Login
  types.ts      Tipos del dominio
supabase/
  migrations/   Migraciones SQL numeradas (0001..0028). Añade nuevas en orden.
  functions/    Edge functions (gestionar-usuarios)
backup/         Sistema anterior (no tocar salvo petición explícita)
```

## Convenciones de código

- **Todo el código y la UI están en español** (nombres de variables, archivos,
  rutas, identificadores y textos). Mantén ese idioma al crear código nuevo.
- Componentes y páginas en React con TypeScript (`.tsx`).
- Estilos con clases de Tailwind; no hay CSS-in-JS.
- Sigue el estilo de los archivos vecinos (naming, densidad de comentarios, idiom).

## Supabase / seguridad

- Auth por **email + contraseña** (Supabase Auth). Sin sesión no se entra ni se
  lee/escribe nada: **todas las tablas tienen RLS** con políticas `to authenticated`.
- La clave que usa el front es la **publishable/anon**, pública por diseño (la
  protege RLS). Está en `.env` (local) y en el workflow de deploy (producción).
- Variables de entorno: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
  (ver `.env.example`).
- Para cambios de esquema: revisa primero las migraciones existentes y añade una
  nueva numerada en `supabase/migrations/`.

## Despliegue (IMPORTANTE — leído de experiencia real)

- La app se publica en **GitHub Pages** vía GitHub Actions:
  `.github/workflows/deploy.yml`.
- **Se despliega automáticamente con cada push a `main`** (o manualmente con
  *workflow_dispatch*). El build inyecta las variables `VITE_SUPABASE_*`.
- URL de producción:
  **https://sterlinr08-dte.github.io/DELUXE-BEAUTY-CENTER-/**
- Pages → Source = **GitHub Actions** (ya configurado).

### Gotchas de GitHub Pages (ya resueltos — no re-romper)

1. **El sitio vive en un subdirectorio** (`/DELUXE-BEAUTY-CENTER-/`), por eso:
   - `vite.config.ts` usa `base: './'` (rutas relativas).
   - `src/main.tsx` usa **`HashRouter`** (no `BrowserRouter`), para que el routing
     funcione sin necesidad de un `404.html`. **No cambiar a BrowserRouter** sin
     configurar `basename` + fallback SPA.
2. El entorno **`github-pages`** (Settings → Environments) debe permitir desplegar
   desde `main`. Si el job `deploy` falla **al instante (~1s, sin logs)**, casi
   seguro es la regla *"Deployment branches and tags"* bloqueando `main`
   → ponerla en **"No restriction"** o añadir regla `main`.

## Reglas de trabajo

- No crees Pull Requests salvo que el usuario lo pida explícitamente.
- Commits con mensajes claros y descriptivos.
- El usuario (dueña del salón) se comunica en español; responde en español.
