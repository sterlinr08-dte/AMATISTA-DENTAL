// Indicador de carga: el logo girando con resplandor rosado
interface Props {
  texto?: string
  className?: string
}

export default function Cargando({ texto = 'Cargando…', className = '' }: Props) {
  return (
    <div className={`flex flex-col items-center justify-center gap-4 py-12 ${className}`}>
      <div className="relative">
        <span className="absolute inset-0 animate-ping rounded-full bg-pink-400/30" />
        <img
          src={`${import.meta.env.BASE_URL}amatista-logo.svg`}
          alt="Cargando"
          className="relative h-16 w-16 animate-spin rounded-full object-cover ring-2 ring-pink-400/40 shadow-[0_0_24px_2px_rgba(201,162,39,0.45)]"
          style={{ animationDuration: '1.1s' }}
        />
      </div>
      {texto && <p className="text-sm font-medium text-slate-500">{texto}</p>}
    </div>
  )
}
