import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Megaphone } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { hoyISO } from '../lib/format'
import { Aviso, NIVELES_AVISO, avisoVigente, ordenarAvisos } from '../lib/avisos'
import { hace } from '../lib/notificaciones'

// Panel de avisos institucionales visible en el Panel/Dashboard para TODOS.
export default function AvisosPanel() {
  const [avisos, setAvisos] = useState<Aviso[]>([])
  const hoy = hoyISO()

  async function cargar() {
    const { data } = await supabase.from('avisos').select('*').eq('activo', true).order('created_at', { ascending: false }).limit(20)
    setAvisos((data as Aviso[]) ?? [])
  }
  useEffect(() => {
    cargar()
    const canal = supabase.channel('avisos-panel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'avisos' }, () => cargar())
      .subscribe()
    return () => { supabase.removeChannel(canal) }
  }, [])

  const vigentes = avisos.filter((a) => avisoVigente(a, hoy)).sort(ordenarAvisos).slice(0, 3)
  if (vigentes.length === 0) return null

  return (
    <div className="mb-6 rounded-2xl border border-amber-200 bg-white p-4 shadow-[0_18px_42px_-22px_rgba(201,162,39,0.30)]">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-display text-lg font-bold text-slate-800"><Megaphone size={18} className="text-amber-600" /> Avisos</h2>
        <Link to="/avisos" className="text-sm font-semibold text-brand-600 hover:underline">Ver todos →</Link>
      </div>
      <div className="space-y-2">
        {vigentes.map((a) => {
          const n = NIVELES_AVISO[a.nivel]
          return (
            <div key={a.id} className={`rounded-xl border px-4 py-3 ${n.card}`}>
              <div className="flex items-center gap-2">
                <span>{n.emoji}</span>
                <p className="flex-1 font-semibold text-slate-800">{a.fijado && '📌 '}{a.titulo}</p>
                <span className="text-[11px] text-slate-400">{hace(a.created_at)}</span>
              </div>
              {a.cuerpo && <p className="mt-1 whitespace-pre-wrap text-sm text-slate-600">{a.cuerpo}</p>}
            </div>
          )
        })}
      </div>
    </div>
  )
}
