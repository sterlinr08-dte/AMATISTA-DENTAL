# 💅 DELUXE BEAUTY CENTER

Sistema de gestión para el salón de belleza **DELUXE BEAUTY CENTER**.
Aplicación web construida con **React + Vite + TypeScript + Tailwind CSS** y
**Supabase** como base de datos.

> Este repositorio reemplaza al antiguo proyecto "Seguro de Salud". El respaldo
> de los datos anteriores se conserva en la carpeta [`backup/`](./backup).

## ✨ Funcionalidades

- **Inicio de sesión** — autenticación con Supabase Auth (email + contraseña). Todo el panel requiere sesión.
- **Panel / Dashboard** — resumen del día: citas, ingresos, clientes, servicios y empleados.
- **Citas / Agenda** — agenda diaria, creación y edición de citas, cambio de estado
  (Pendiente, Confirmada, Completada, Cancelada) y cálculo automático de la hora de fin.
- **Clientes** — registro y búsqueda de clientes con datos de contacto y notas.
- **Servicios y precios** — catálogo de servicios por categoría, duración y precio.
- **Empleados / Staff** — personal del salón, puesto, comisión y color en la agenda.
- **Facturación** — facturas con renglones (servicios o manuales), ITBIS opcional (18%), descuento, estados (Pendiente/Pagada/Anulada) e impresión.
- **Compras** — registro de compras a proveedores con ITBIS.
- **Gastos** — registro de gastos por categoría.
- **Pagos a empleados (nómina)** — salario, comisión, adelantos y bonos.
- **Contabilidad** — resumen mensual de ingresos, egresos y utilidad neta.

## 🧱 Stack

| Capa | Tecnología |
|---|---|
| Frontend | React 18, TypeScript, Vite |
| Estilos | Tailwind CSS |
| Iconos | lucide-react |
| Backend / DB | Supabase (PostgreSQL) |

## 🚀 Puesta en marcha

```bash
# 1. Instalar dependencias
npm install

# 2. Configurar variables de entorno
cp .env.example .env
# edita .env con la URL y la clave (anon/publishable) de tu proyecto Supabase

# 3. Levantar en desarrollo
npm run dev

# 4. Compilar para producción
npm run build
```

## 🗄️ Base de datos

El esquema se aplica con una migración de Supabase. Las tablas son:

- `empleados` — personal del salón.
- `servicios` — catálogo de servicios y precios.
- `clientes` — clientes del salón.
- `citas` — agenda, con referencias a cliente, empleado y servicio.

El SQL completo del esquema está en [`supabase/migrations/`](./supabase/migrations).

> **Seguridad:** las tablas tienen RLS activado y las políticas exigen un usuario
> **autenticado** (`to authenticated`). La aplicación usa **Supabase Auth** con
> email y contraseña; sin sesión no se puede leer ni escribir.

### Acceso inicial

Se creó una cuenta de administrador. **Cambia la contraseña** tras el primer ingreso
(Supabase → Authentication → Users).

- **Correo:** `sterlinr08@gmail.com`
- **Contraseña temporal:** `Deluxe2026!`

Para crear más usuarios: Supabase → Authentication → **Add user**.

## 📁 Estructura

```
src/
  components/   Componentes reutilizables (Sidebar, Modal, PageHeader)
  lib/          Cliente de Supabase y utilidades de formato
  pages/        Páginas: Dashboard, Citas, Clientes, Servicios, Empleados
  types.ts      Tipos del dominio
supabase/
  migrations/   Migraciones SQL
backup/         Respaldo del sistema anterior (Seguro de Salud)
```
