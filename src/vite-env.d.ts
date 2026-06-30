/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

// La librería qz-tray no trae tipos; la usamos como any.
declare module 'qz-tray' {
  const qz: any
  export default qz
}
