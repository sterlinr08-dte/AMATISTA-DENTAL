// Indicador de carga: logo con pulso, aro dorado que se expande (radar) y
// tres puntos dorados en onda.
interface Props {
  texto?: string
  className?: string
}

export default function Cargando({ texto = 'Cargando…', className = '' }: Props) {
  return (
    <div className={`flex flex-col items-center justify-center gap-4 py-12 ${className}`}>
      <div className="relative flex h-20 w-20 items-center justify-center">
        {/* Aros dorados que se expanden (efecto radar) */}
        <span className="absolute h-16 w-16 rounded-full bg-amber-300/25 animate-ping" style={{ animationDuration: '1.5s' }} />
        <span className="absolute h-20 w-20 rounded-full bg-amber-200/20 animate-ping" style={{ animationDuration: '1.5s', animationDelay: '0.4s' }} />
        {/* Logo con pulso suave */}
        <img
          src={`${import.meta.env.BASE_URL}amatista-logo.png`}
          alt="Cargando"
          className="animate-carga-pulse relative h-14 w-14 rounded-full bg-white object-contain p-1 shadow-[0_6px_18px_-4px_rgba(201,162,39,0.5)] ring-1 ring-amber-100"
        />
      </div>

      {/* Puntos en onda */}
      <div className="flex items-center gap-1.5">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="animate-carga-dot h-2.5 w-2.5 rounded-full bg-gradient-to-b from-amber-300 to-amber-600"
            style={{ animationDelay: `${i * 0.16}s` }}
          />
        ))}
      </div>

      {texto && <p className="text-sm font-medium text-slate-500">{texto}</p>}
    </div>
  )
}
