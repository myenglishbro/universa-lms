// Una variante por nivel académico para distinguirlos de un vistazo, SOLO con la paleta de la marca (morado en intensidades, durazno y gris pizarra).
// Siguen el orden de la lista de niveles: del morado claro al más profundo, luego durazno, pizarra y la mezcla morado-durazno.
// Las clases van completas (Tailwind no detecta nombres armados).
const PALETA = [
  { barra: 'from-brand-200 to-brand-500', chip: 'bg-brand-50 text-brand-700 ring-brand-200', caja: 'bg-brand-100 text-brand-700', cajaOn: 'bg-brand-500 text-white', titulo: 'text-brand-700', fondo: 'bg-brand-50/70', borde: 'border-brand-200' },
  { barra: 'from-brand-500 to-brand-700', chip: 'bg-brand-600 text-white ring-brand-600', caja: 'bg-brand-200 text-brand-800', cajaOn: 'bg-brand-600 text-white', titulo: 'text-brand-800', fondo: 'bg-brand-50/70', borde: 'border-brand-200' },
  { barra: 'from-brand-800 to-brand-900', chip: 'bg-brand-900 text-white ring-brand-900', caja: 'bg-brand-200 text-brand-900', cajaOn: 'bg-brand-900 text-white', titulo: 'text-brand-900', fondo: 'bg-brand-50/70', borde: 'border-brand-200' },
  { barra: 'from-peach-200 to-peach-500', chip: 'bg-peach-100 text-peach-700 ring-peach-200', caja: 'bg-peach-100 text-peach-700', cajaOn: 'bg-peach-700 text-white', titulo: 'text-peach-700', fondo: 'bg-peach-50', borde: 'border-peach-200' },
  { barra: 'from-slate-600 to-slate-800', chip: 'bg-slate-700 text-white ring-slate-700', caja: 'bg-slate-200 text-slate-800', cajaOn: 'bg-slate-700 text-white', titulo: 'text-slate-800', fondo: 'bg-slate-50', borde: 'border-slate-300' },
  { barra: 'from-brand-600 to-peach-500', chip: 'bg-white text-brand-700 ring-brand-500', caja: 'bg-peach-100 text-brand-700', cajaOn: 'bg-gradient-to-br from-brand-600 to-peach-500 text-white', titulo: 'text-brand-700', fondo: 'bg-peach-50', borde: 'border-peach-200' },
]
export const SIN_COLOR = { barra: 'from-slate-200 to-slate-300', chip: 'bg-slate-50 text-slate-500 ring-slate-200', caja: 'bg-slate-100 text-slate-500', cajaOn: 'bg-slate-400 text-white', titulo: 'text-slate-600', fondo: 'bg-slate-50', borde: 'border-slate-200' }

// Devuelve una función nivel (id o nombre) → colores. Un nivel desconocido o vacío usa el gris.
export function coloresDeNiveles(niveles = []) {
  const m = new Map()
  niveles.forEach((n, i) => {
    const c = PALETA[i % PALETA.length]
    m.set(n.id, c)
    m.set(n.nombre, c)
  })
  return (clave) => m.get(clave) ?? SIN_COLOR
}
