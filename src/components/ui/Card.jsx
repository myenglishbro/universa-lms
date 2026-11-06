// Tarjeta del sistema: blanca, con borde lila y una sombra muy ligera para dar profundidad sobre el lienzo.
export default function Card({ className = '', children }) {
  return <div className={`rounded-2xl border border-brand-100 bg-white shadow-sm ${className}`}>{children}</div>
}
