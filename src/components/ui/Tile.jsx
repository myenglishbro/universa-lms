import Icon from './Icon'

const TONOS = {
  brand: 'bg-brand-100 text-brand-600',
  peach: 'bg-peach-100 text-peach-700',
  rose: 'bg-rose-100 text-rose-600',
  slate: 'bg-teal-50 text-teal-700',
}

// Indicador compacto: icono de color + número grande + frase corta. Con `onClick` se vuelve un botón.
export default function Tile({ icono, tono = 'brand', valor, etiqueta, nota, onClick, activo = false }) {
  const Raiz = onClick ? 'button' : 'div'
  return (
    <Raiz
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      aria-pressed={onClick ? activo : undefined}
      className={`flex w-full items-center gap-3 rounded-2xl border bg-white p-3 text-left shadow-sm ${
        activo ? 'border-brand-500 ring-2 ring-brand-500/30' : 'border-brand-100'
      } ${onClick ? 'transition hover:-translate-y-0.5 hover:shadow-md' : ''}`}
    >
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${TONOS[tono]}`}>
        <Icon name={icono} className="h-5 w-5" />
      </span>
      <span className="min-w-0">
        <span className="block text-2xl font-bold leading-none text-slate-900">{valor}</span>
        <span className="mt-1 block text-xs leading-tight text-slate-500">{etiqueta}</span>
        {nota && <span className="block text-[11px] leading-tight text-slate-400">{nota}</span>}
      </span>
    </Raiz>
  )
}
