// Impresión directa por QZ Tray (sin cuadros de diálogo).
// - Si QZ Tray está instalado y configurado en la PC -> imprime directo.
// - Si no, el llamador usa el respaldo del navegador (window.print).
// La firma de seguridad se hace en una función de Supabase (la llave privada
// NUNCA está en la app). El certificado público de abajo debe coincidir con el
// override.crt instalado en la PC (lo hace el instalador).
import qz from 'qz-tray'

const CERTIFICADO = `-----BEGIN CERTIFICATE-----
MIIDdzCCAl+gAwIBAgIUIf1mqNgmWVkOc5YBQ6kfUh8gz7EwDQYJKoZIhvcNAQEL
BQAwSzEdMBsGA1UEAwwURGVsdVhlIEJlYXV0eSBDZW50ZXIxHTAbBgNVBAoMFERl
bHVYZSBCZWF1dHkgQ2VudGVyMQswCQYDVQQGEwJETzAeFw0yNjA2MzAxNzQ4Mjla
Fw0zNjA2MjcxNzQ4MjlaMEsxHTAbBgNVBAMMFERlbHVYZSBCZWF1dHkgQ2VudGVy
MR0wGwYDVQQKDBREZWx1WGUgQmVhdXR5IENlbnRlcjELMAkGA1UEBhMCRE8wggEi
MA0GCSqGSIb3DQEBAQUAA4IBDwAwggEKAoIBAQDnbh82U+snsezPcDCiuSqB+kkb
3Rp9J13sotCIuhRuaStFE1CSMoOupmRky0sKi7H7YBjzyuXEqHWJn3VQ6OIiXdvm
RJGaE62rvBGUgZBNTBBZ1JkWlMkDYSuul4Ex/8dMSqT/fBqKkeVSkSNFceSgeRMk
J56Wb46AbaFg6yFQo1t465eHTIFp2v78Yr92GGXw3+693dAh+/10qxW/MfxMHmIs
6gui0OonYQ6HFZmtKxRmS8Yq7GaASn/48B1VO14aoSJ5arc25b5z1NBbraQzzGph
JOd79xDyH3VIXBWVwabkbKXWgA6LaBfegU7xWfHg6pSrmujD1dxVMWm6/McVAgMB
AAGjUzBRMB0GA1UdDgQWBBSkYqQf5xLX80o2WipQLsjNugugjzAfBgNVHSMEGDAW
gBSkYqQf5xLX80o2WipQLsjNugugjzAPBgNVHRMBAf8EBTADAQH/MA0GCSqGSIb3
DQEBCwUAA4IBAQArzUAKxEclTJMQ+D+6icP3eJKyhf3Lg5ga9F9pxn1quc08VsUq
ezJlMknuGPV5QMVFQhFJviKksPONFhPOPGuUhvB0ua22Wl9nDO4Gb1rjT6yI7n23
63AhePbyF72gmJdIT3qaEfgp4JCSJ1hJHK0gTAJnAJsP51QBW1sVok2DWAckiFqO
q1ZwQ9GLYorM2JUunuXO3N/iZpQsJYNrR6KUehbtvgDYILwWDJ8N3g6k0TfyeXb0
1Ky19575l+jgDwvWw1uYWQM4DLXNfsbqQj+ViILP2omDGUpvbLhxGnLa5dvHnAbo
ZlQYVgQ8BNs840nw5SVbOG7eo1bId9i/2FJ0
-----END CERTIFICATE-----`

const FIRMA_URL = 'https://mrtqkhachhvsczltwakt.supabase.co/functions/v1/qz-firmar'

let seguridadLista = false
function configurarSeguridad() {
  if (seguridadLista) return
  seguridadLista = true
  qz.security.setCertificatePromise((resolve: (c: string) => void) => resolve(CERTIFICADO))
  qz.security.setSignatureAlgorithm('SHA512')
  const ANON = import.meta.env.VITE_SUPABASE_ANON_KEY
  qz.security.setSignaturePromise((toSign: string) => (resolve: (s: string) => void, reject: (e: unknown) => void) => {
    fetch(`${FIRMA_URL}?request=${encodeURIComponent(toSign)}`, {
      headers: { apikey: ANON, Authorization: `Bearer ${ANON}` },
    })
      .then((r) => (r.ok ? r.text() : Promise.reject(new Error('Firma HTTP ' + r.status))))
      .then((firma) => resolve(firma.trim()))
      .catch(reject)
  })
}

// Intenta conectar con QZ Tray. Devuelve true si está disponible.
export async function conectarQZ(): Promise<boolean> {
  configurarSeguridad()
  try {
    if (qz.websocket.isActive()) return true
    await qz.websocket.connect()
    return true
  } catch {
    return false
  }
}

export function qzActivo(): boolean {
  try {
    return qz.websocket.isActive()
  } catch {
    return false
  }
}

// Imprime un HTML en la impresora predeterminada vía QZ Tray (ancho del papel en mm).
export async function imprimirHTML(html: string, anchoMm: number): Promise<void> {
  const ok = await conectarQZ()
  if (!ok) throw new Error('QZ Tray no está disponible (¿instalado y abierto?)')
  const printer = await qz.printers.getDefault()
  if (!printer) throw new Error('No hay una impresora predeterminada en Windows')
  const config = qz.configs.create(printer, {
    units: 'mm',
    size: { width: anchoMm, height: null },
    margins: { top: 0, right: 0, bottom: 0, left: 0 },
  })
  await qz.print(config, [{ type: 'pixel', format: 'html', flavor: 'plain', data: html }])
}
