// Utilidades para reportes: exportar a Excel (CSV) e imprimir/guardar PDF en A4

interface NegocioMin {
  nombre?: string | null
  rnc?: string | null
  direccion?: string | null
  telefono?: string | null
}

// Descarga un archivo CSV (se abre en Excel). Incluye BOM para acentos.
export function descargarCSV(nombreArchivo: string, encabezados: string[], filas: (string | number)[][]) {
  const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`
  const lineas = [encabezados.map(esc).join(','), ...filas.map((f) => f.map(esc).join(','))]
  const blob = new Blob(['﻿' + lineas.join('\r\n')], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${nombreArchivo}.csv`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

interface ColReporte {
  label: string
  align?: 'left' | 'right' | 'center'
}

// Abre una ventana con el reporte en formato A4 y lo manda a imprimir (Guardar como PDF).
export function imprimirTabla(opts: {
  negocio: NegocioMin
  titulo: string
  subtitulo?: string
  columnas: ColReporte[]
  filas: (string | number)[][]
  pie?: (string | number)[]
  orientacion?: 'portrait' | 'landscape'
}) {
  const { negocio, titulo, subtitulo, columnas, filas, pie, orientacion = 'portrait' } = opts
  // Escapa HTML para evitar inyección (XSS) con datos del usuario en el reporte
  const esc = (v: unknown) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
  const th = columnas.map((c) => `<th style="text-align:${c.align || 'left'}">${esc(c.label)}</th>`).join('')
  const cell = (v: string | number, i: number) => `<td style="text-align:${columnas[i]?.align || 'left'}">${esc(v)}</td>`
  const body = filas.map((f) => `<tr>${f.map(cell).join('')}</tr>`).join('')
  const pieRow = pie ? `<tr class="tot">${pie.map(cell).join('')}</tr>` : ''
  const fecha = new Date().toLocaleString('es-DO')
  const w = window.open('', '_blank', 'width=1000,height=700')
  if (!w) {
    alert('Permite las ventanas emergentes para imprimir o guardar el PDF.')
    return
  }
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(titulo)}</title>
  <style>
    @page { size: A4 ${orientacion}; margin: 12mm; }
    * { box-sizing: border-box; }
    body { font-family: -apple-system, "Segoe UI", Roboto, sans-serif; color:#111; margin:0; }
    .hd { text-align:center; margin-bottom:8px; border-bottom:2px solid #c026d3; padding-bottom:6px; }
    .hd h2 { margin:0; font-size:18px; color:#86198f; }
    .hd p { margin:1px 0; font-size:11px; color:#555; }
    h1 { font-size:15px; margin:12px 0 2px; }
    .sub { font-size:11px; color:#555; margin:0 0 8px; }
    table { width:100%; border-collapse:collapse; font-size:11px; }
    th,td { border:1px solid #d0d0d0; padding:5px 7px; }
    thead { display: table-header-group; }
    th { background:#f7eef7; }
    tr.tot td { font-weight:bold; background:#faf5fa; }
    .foot { margin-top:14px; font-size:10px; color:#888; text-align:center; }
  </style></head><body>
    <div class="hd">
      <h2>${esc(negocio.nombre)}</h2>
      ${negocio.rnc ? `<p>RNC: ${esc(negocio.rnc)}</p>` : ''}
      ${negocio.direccion ? `<p>${esc(negocio.direccion)}${negocio.telefono ? ' · Tel ' + esc(negocio.telefono) : ''}</p>` : ''}
    </div>
    <h1>${esc(titulo)}</h1>
    ${subtitulo ? `<p class="sub">${esc(subtitulo)}</p>` : ''}
    <table><thead><tr>${th}</tr></thead><tbody>${body}${pieRow}</tbody></table>
    <p class="foot">Generado el ${fecha}</p>
    <script>window.onload=function(){setTimeout(function(){window.print()},250)}</script>
  </body></html>`)
  w.document.close()
}
