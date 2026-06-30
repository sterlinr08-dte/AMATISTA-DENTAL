import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import App from './App'
import { AuthProvider } from './lib/auth'
import { NegocioProvider } from './lib/negocio'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <HashRouter>
      <AuthProvider>
        <NegocioProvider>
          <App />
        </NegocioProvider>
      </AuthProvider>
    </HashRouter>
  </React.StrictMode>,
)
