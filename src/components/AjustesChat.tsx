import { MessagesSquare, Volume2, Circle } from 'lucide-react'
import { TamanoChat, TAMANOS, useAjustesChat, guardarAjustesChat } from '../lib/ajustesChat'

// Preferencias del chat (se guardan en este dispositivo/navegador).
export default function AjustesChat() {
  const a = useAjustesChat()
  const set = (patch: Partial<typeof a>) => guardarAjustesChat({ ...a, ...patch })

  return (
    <div className="max-w-2xl space-y-5">
      <p className="text-sm text-slate-600">
        Estas preferencias del chat se guardan en <strong>este dispositivo</strong> (no afectan a los demás usuarios).
      </p>

      {/* Tamaño de la ventana flotante */}
      <div className="card">
        <h3 className="mb-1 flex items-center gap-2 font-display font-bold text-slate-800"><MessagesSquare size={18} className="text-amber-600" /> Tamaño de la ventana flotante</h3>
        <p className="mb-3 text-sm text-slate-500">Cuando abres el chat con la burbuja o el ícono de arriba.</p>
        <div className="grid grid-cols-3 gap-2">
          {(Object.keys(TAMANOS) as TamanoChat[]).map((k) => {
            const sel = a.tamano === k
            const t = TAMANOS[k]
            return (
              <button key={k} onClick={() => set({ tamano: k })}
                className={`flex flex-col items-center gap-2 rounded-xl border-2 p-3 transition ${sel ? 'border-brand-400 bg-brand-50' : 'border-slate-200 hover:bg-slate-50'}`}>
                <div className="rounded-md bg-amber-200/60 ring-1 ring-amber-300" style={{ width: t.w / 8, height: t.h / 8 }} />
                <span className={`text-xs font-semibold ${sel ? 'text-brand-700' : 'text-slate-600'}`}>{t.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Interruptores */}
      <div className="card divide-y divide-slate-100">
        <FilaSwitch
          icono={<Circle size={16} className="text-amber-600" />}
          titulo="Mostrar la burbuja flotante"
          detalle="El botón redondo del chat en la esquina inferior derecha."
          valor={a.burbuja}
          onChange={(v) => set({ burbuja: v })}
        />
        <FilaSwitch
          icono={<Volume2 size={16} className="text-amber-600" />}
          titulo="Sonido de avisos"
          detalle="Un pequeño sonido cuando llega un mensaje o notificación."
          valor={a.sonido}
          onChange={(v) => set({ sonido: v })}
        />
      </div>
    </div>
  )
}

function FilaSwitch({ icono, titulo, detalle, valor, onChange }: { icono: React.ReactNode; titulo: string; detalle: string; valor: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-50">{icono}</span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-slate-800">{titulo}</p>
        <p className="text-xs text-slate-500">{detalle}</p>
      </div>
      <button type="button" onClick={() => onChange(!valor)} aria-pressed={valor}
        className={`relative h-6 w-11 shrink-0 rounded-full transition ${valor ? 'bg-emerald-500' : 'bg-slate-300'}`}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${valor ? 'left-[22px]' : 'left-0.5'}`} />
      </button>
    </div>
  )
}
