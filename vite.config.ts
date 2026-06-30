import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  // Rutas relativas para que funcione en GitHub Pages bajo cualquier subcarpeta
  base: './',
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
  },
})
