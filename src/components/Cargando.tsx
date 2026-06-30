// Indicador de carga: logo quieto y derecho con un aro dorado girando alrededor.
interface Props {
  texto?: string
  className?: string
}

export default function Cargando({ texto = 'Cargando…', className = '' }: Props) {
  return (
    <div className={`flex flex-col items-center justify-center gap-4 py-12 ${className}`}>
      <div className="relative h-20 w-20">
        {/* Aro dorado que gira (el logo no rota) */}
        <span
          className="absolute inset-0 animate-spin rounded-full border-[3px] border-amber-200/50 border-t-amber-500"
          style={{ animationDuration: '0.9s' }}
        />
        {/* Logo estático, derecho */}
        <img
          src={`${import.meta.env.BASE_URL}amatista-logo.png`}
          alt="Cargando"
          className="absolute inset-[7px] rounded-full bg-white object-contain p-1 shadow-[0_4px_14px_-4px_rgba(201,162,39,0.45)]"
        />
      </div>
      {texto && <p className="text-sm font-medium text-slate-500">{texto}</p>}
    </div>
  )
}
