import { useEffect, useState } from 'react'
import { Upload, Trash2, Image as ImageIcon, FileText, ExternalLink } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { Cliente, ImagenPaciente } from '../types'
import { fechaCorta, hoyISO, codigoCliente } from '../lib/format'
import PageHeader from '../components/PageHeader'
import Cargando from '../components/Cargando'

const BUCKET = 'pacientes'

type TipoImagen = ImagenPaciente['tipo']

const subidaVacia = {
  tipo: 'foto' as TipoImagen,
  descripcion: '',
  fecha: hoyISO(),
}

// Limpia el nombre del archivo: quita espacios y caracteres poco fiables en rutas.
function limpiarNombre(nombre: string): string {
  return nombre.trim().replace(/\s+/g, '-').replace(/[^\w.\-]/g, '')
}

function esImagen(tipo: TipoImagen): boolean {
  return tipo === 'foto' || tipo === 'radiografia'
}

const etiquetaTipo: Record<TipoImagen, string> = {
  foto: 'Foto',
  radiografia: 'Radiografía',
  documento: 'Documento',
}

export default function ImagenesPaciente() {
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [pacienteId, setPacienteId] = useState<string>('')

  const [imagenes, setImagenes] = useState<ImagenPaciente[]>([])
  const [urls, setUrls] = useState<Record<string, string>>({})
  const [cargandoGaleria, setCargandoGaleria] = useState(false)

  const [archivo, setArchivo] = useState<File | null>(null)
  const [form, setForm] = useState(subidaVacia)
  const [subiendo, setSubiendo] = useState(false)
  const [error, setError] = useState<string>('')

  // Carga inicial: pacientes.
  useEffect(() => {
    async function inicial() {
      const { data, error: err } = await supabase.from('clientes').select('*').order('nombre')
      if (err) alert('Error al cargar pacientes: ' + err.message)
      setClientes(data ?? [])
    }
    inicial()
  }, [])

  async function cargarGaleria(pid: string) {
    setCargandoGaleria(true)
    setError('')
    const { data, error: err } = await supabase
      .from('imagenes_paciente')
      .select('*')
      .eq('cliente_id', pid)
      .order('fecha', { ascending: false })
    if (err) {
      setError('Error al cargar la galería: ' + err.message)
      setImagenes([])
      setUrls({})
      setCargandoGaleria(false)
      return
    }
    const rows = (data ?? []) as ImagenPaciente[]
    setImagenes(rows)

    // Genera URLs firmadas (bucket privado) para cada archivo.
    const mapa: Record<string, string> = {}
    await Promise.all(
      rows.map(async (img) => {
        const { data: firma } = await supabase.storage
          .from(BUCKET)
          .createSignedUrl(img.path, 3600)
        if (firma?.signedUrl) mapa[img.id] = firma.signedUrl
      }),
    )
    setUrls(mapa)
    setCargandoGaleria(false)
  }

  // Al cambiar de paciente, recargar galería y limpiar el formulario.
  useEffect(() => {
    setArchivo(null)
    setForm({ ...subidaVacia, fecha: hoyISO() })
    setError('')
    if (!pacienteId) {
      setImagenes([])
      setUrls({})
      return
    }
    cargarGaleria(pacienteId)
  }, [pacienteId])

  async function subir() {
    if (!pacienteId || !archivo) return
    setSubiendo(true)
    setError('')

    const path = `${pacienteId}/${crypto.randomUUID()}-${limpiarNombre(archivo.name)}`

    const { error: errUp } = await supabase.storage.from(BUCKET).upload(path, archivo)
    if (errUp) {
      setError('Error al subir el archivo: ' + errUp.message)
      setSubiendo(false)
      return
    }

    const { error: errIns } = await supabase.from('imagenes_paciente').insert({
      cliente_id: pacienteId,
      path,
      tipo: form.tipo,
      descripcion: form.descripcion || null,
      fecha: form.fecha,
    })
    if (errIns) {
      // Si falla la fila, elimina el archivo huérfano del storage.
      await supabase.storage.from(BUCKET).remove([path])
      setError('Error al guardar la imagen: ' + errIns.message)
      setSubiendo(false)
      return
    }

    setArchivo(null)
    setForm({ ...subidaVacia, fecha: hoyISO() })
    setSubiendo(false)
    await cargarGaleria(pacienteId)
  }

  async function eliminar(img: ImagenPaciente) {
    if (!confirm('¿Eliminar este archivo?')) return
    const { error: errRm } = await supabase.storage.from(BUCKET).remove([img.path])
    if (errRm) return alert('Error al eliminar el archivo: ' + errRm.message)
    const { error: errDel } = await supabase.from('imagenes_paciente').delete().eq('id', img.id)
    if (errDel) return alert('Error al eliminar el registro: ' + errDel.message)
    await cargarGaleria(pacienteId)
  }

  return (
    <div>
      <PageHeader title="Imágenes / Radiografías" subtitle="Galería de imágenes y documentos del paciente" />

      <div className="card mb-6 max-w-md">
        <label className="label">Paciente</label>
        <select className="input" value={pacienteId} onChange={(e) => setPacienteId(e.target.value)}>
          <option value="">Selecciona un paciente…</option>
          {clientes.map((c) => (
            <option key={c.id} value={c.id}>
              {codigoCliente(c.codigo)} — {c.nombre}
            </option>
          ))}
        </select>
      </div>

      {!pacienteId ? (
        <div className="card flex flex-col items-center gap-3 py-12 text-center">
          <ImageIcon className="text-brand-300" size={40} />
          <p className="text-slate-500">Selecciona un paciente para ver y subir sus imágenes y radiografías.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Formulario de subida */}
          <div className="card">
            <h2 className="mb-4 font-display text-lg font-bold uppercase text-slate-800">Subir archivo</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="label">Archivo</label>
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  className="input"
                  onChange={(e) => setArchivo(e.target.files?.[0] ?? null)}
                />
              </div>
              <div>
                <label className="label">Tipo</label>
                <select
                  className="input"
                  value={form.tipo}
                  onChange={(e) => setForm({ ...form, tipo: e.target.value as TipoImagen })}
                >
                  <option value="foto">Foto</option>
                  <option value="radiografia">Radiografía</option>
                  <option value="documento">Documento</option>
                </select>
              </div>
              <div>
                <label className="label">Descripción</label>
                <input
                  className="input"
                  value={form.descripcion}
                  onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
                />
              </div>
              <div>
                <label className="label">Fecha</label>
                <input
                  type="date"
                  className="input"
                  value={form.fecha}
                  onChange={(e) => setForm({ ...form, fecha: e.target.value })}
                />
              </div>
            </div>

            {error && <p className="mt-4 text-sm font-medium text-rose-600">{error}</p>}

            <div className="mt-4 flex justify-end">
              <button className="btn-primary" onClick={subir} disabled={subiendo || !archivo}>
                <Upload size={16} /> {subiendo ? 'Subiendo…' : 'Subir'}
              </button>
            </div>
          </div>

          {/* Galería */}
          <div>
            <h2 className="mb-4 font-display text-lg font-bold uppercase text-slate-800">Galería</h2>
            {cargandoGaleria ? (
              <Cargando />
            ) : imagenes.length === 0 ? (
              <div className="card flex flex-col items-center gap-3 py-12 text-center">
                <ImageIcon className="text-brand-300" size={40} />
                <p className="text-slate-500">Aún no hay imágenes ni documentos para este paciente.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {imagenes.map((img) => {
                  const url = urls[img.id]
                  return (
                    <div key={img.id} className="card flex flex-col gap-3">
                      <div className="flex aspect-video items-center justify-center overflow-hidden rounded-xl bg-slate-50 ring-1 ring-amber-100">
                        {esImagen(img.tipo) && url ? (
                          <a href={url} target="_blank" rel="noopener noreferrer" title="Abrir en nueva pestaña">
                            <img src={url} alt={img.descripcion ?? 'Imagen'} className="h-full w-full object-cover" />
                          </a>
                        ) : (
                          <div className="flex flex-col items-center gap-2 text-slate-400">
                            <FileText size={40} className="text-brand-300" />
                            {url ? (
                              <a
                                href={url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:underline"
                              >
                                <ExternalLink size={14} /> Ver
                              </a>
                            ) : (
                              <span className="text-xs">No disponible</span>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <span className="badge">{etiquetaTipo[img.tipo]}</span>
                          <p className="mt-2 truncate text-sm font-medium text-slate-800">
                            {img.descripcion || 'Sin descripción'}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">{fechaCorta(img.fecha)}</p>
                        </div>
                        <button
                          onClick={() => eliminar(img)}
                          className="rounded-lg p-2 text-slate-600 hover:bg-rose-50 hover:text-rose-600"
                          title="Eliminar"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
