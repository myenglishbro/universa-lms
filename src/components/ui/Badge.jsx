// Insignias de estado: morado = correcto/publicado/activo, durazno = borrador o pendiente, rosa = problema, gris = neutro.
const colors = {
  brand: 'bg-brand-100 text-brand-700',
  peach: 'bg-peach-100 text-peach-700',
  slate: 'bg-slate-100 text-slate-600',
  rose: 'bg-rose-50 text-rose-700',
}

export default function Badge({ color = 'slate', children }) {
  return (
    <span className={`inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${colors[color]}`}>
      {children}
    </span>
  )
}
