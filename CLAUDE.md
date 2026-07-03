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

---

# Estado actual · AMATISTA DENTAL (para continuar en otro chat)

> Aunque arriba el doc describe "Deluxe Beauty Center", **este repositorio es
> AMATISTA DENTAL** (clínica odontológica, clon adaptado, estilo Dentalink).
> Repo GitHub: **`sterlinr08-dte/AMATISTA-DENTAL`** (PÚBLICO).
> Proyecto Supabase: **`sdxyqaawxomnfhyaxuyo`**.
> Producción: **https://amatista.nexusprord.com** (GitHub Pages + dominio propio).
> Entrada por portal NEXUS (`nexusprord.com`); sin login propio en la app.

## Módulo de Chat interno corporativo (YA CONSTRUIDO y en producción)

Mensajería en tiempo real del equipo (Supabase Realtime + RLS). Fases hechas:
**1** (chat directo, presencia, "escribiendo…", recibos de lectura, no leídos),
**2** (grupos + grupos por departamento), **3** ("Conversación del caso" en la
ficha del paciente), **8** (centro de notificaciones: campana + toasts + sonido),
**9** (avisos institucionales), **10** (tareas del equipo). Extras: adjuntos,
respuestas rápidas, menciones `@`, responder/editar (estilo WhatsApp), gestión de
miembros del grupo (ver/agregar/quitar), acceso rápido (burbuja flotante + ícono
en la barra) que abre una ventana estilo Messenger con tamaño configurable.

- Frontend: `src/pages/Chat.tsx`, `src/components/chat/*`
  (`ChatWorkspace`, `HiloMensajes`, `ChatDrawer`, `BotonChat`),
  `src/pages/ConversacionCaso.tsx`, `src/pages/Tareas.tsx`, `src/pages/Avisos.tsx`,
  `src/components/CampanaNotificaciones.tsx`, `src/components/TareaModal.tsx`,
  `src/components/AjustesChat.tsx`.
- Libs: `src/lib/chat.ts`, `chatActivo.ts`, `notificaciones.ts`, `tareas.ts`,
  `avisos.ts`, `ajustesChat.ts` (preferencias del chat en localStorage),
  `useChatNoLeidos.ts`.
- Backend (Supabase): tablas `chat_conversaciones/participantes/mensajes`,
  `notificaciones`, `tareas`, `avisos`; vista `chat_mis_conversaciones`; RPCs
  `chat_abrir_directo`, `chat_crear_grupo`, `chat_departamento`,
  `chat_conversacion_paciente`, `chat_marcar_leido`, `chat_no_leidos_total`,
  `chat_usuarios`, `chat_agregar_miembro`, `chat_quitar_miembro`,
  `crear_notificacion`, `notif_no_leidas`, `marcar_notifs_leidas`; triggers de
  menciones/tareas/avisos; RLS por PARTICIPACIÓN (un no-participante ve 0);
  bucket privado `chat` para adjuntos. Realtime habilitado en esas tablas.
- Pendiente opcional: Fase 4 (hilo por tratamiento; el tipo `tratamiento` y
  `presupuesto_id` ya existen). Departamentos: hoy incluyen a TODO el personal
  activo (no hay campo `departamento` por usuario).

## Despliegue: problema conocido de GitHub Pages

El **build siempre pasa**; lo que falla de forma intermitente es el paso final
`actions/deploy-pages@v4` con el error **"Deployment failed, try again later"**.
Es un **problema de infraestructura de GitHub Pages**, NO del código, y NO afecta
al sitio ya publicado. Solución: **relanzar** el deploy hasta que quede verde
(`rerun_failed_jobs` sobre el run fallido, o `run_workflow` de `deploy.yml` en
`main`). Verificar con `actions_get get_workflow_run`.

## PENDIENTE: migrar el hosting a Cloudflare Pages (decidido por la dueña)

Motivo: GitHub Pages viene fallando/lento al publicar; Cloudflare Pages es más
rápido y estable, y **gratis** para este uso. La dueña **hará el paso del token
más adelante**; mientras tanto se sigue publicando en GitHub Pages.

Plan acordado (deploy automático como ahora, pero a Cloudflare):
- Un GitHub Action publica con **`wrangler pages deploy dist`** (carga directa:
  se compila en el runner y se sube el resultado → **no consume** el cupo de 500
  builds/mes del plan gratis; ideal porque la dueña tiene varias empresas/dominios).
- Requiere **GitHub Secrets** (los crea/pega ELLA, nunca en el repo/chat):
  `CLOUDFLARE_API_TOKEN` (permiso mínimo **Account → Cloudflare Pages → Edit**) y
  `CLOUDFLARE_ACCOUNT_ID`.
- Nombre del proyecto Cloudflare Pages: **por definir** (sugerido `amatista-dental`).
- Al activar, mantener el dominio `amatista.nexusprord.com` y `vite.config.ts`
  con `base` correcto (Pages sirve en raíz de dominio → `base: '/'`; HashRouter
  seguiría funcionando igual).

## SEGURIDAD (crítico — leer)

- El repo es **PÚBLICO**: **NUNCA** poner tokens/secretos en el código, en
  `deploy.yml`, ni en el chat. Los secretos van **solo** en GitHub Actions Secrets.
- ⚠️ La dueña **pegó por error un token de Cloudflare en el chat**. Ese token debe
  considerarse **comprometido**: hay que **anularlo/regenerarlo** en Cloudflare
  (API Tokens → Roll/Delete) y usar uno NUEVO. No reutilizar el expuesto.
- La `VITE_SUPABASE_ANON_KEY` sí es pública por diseño (la protege RLS).
