import { createClient } from '@supabase/supabase-js'
import type { Database } from '../types'

const url = import.meta.env.VITE_SUPABASE_URL as string
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if ((!url || !anonKey) && import.meta.env.DEV) {
  // Aviso claro solo en desarrollo si falta la configuración.
  console.error(
    'Faltan VITE_SUPABASE_URL y/o VITE_SUPABASE_ANON_KEY. Copia .env.example a .env.',
  )
}

export const supabase = createClient<Database>(url, anonKey)
