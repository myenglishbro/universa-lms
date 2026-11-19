// Un color por nivel académico para distinguirlos de un vistazo. Se evitan rosa, durazno y ámbar: son los colores de las alertas.
// Las clases van completas (Tailwind no detecta nombres armados), y el color sigue el orden de la lista de niveles.
const PALETA = [
  { barra: 'from-sky-400 to-sky-600', chip: 'bg-sky-50 text-sky-700 ring-sky-200', caja: 'bg-sky-100 text-sky-700', cajaOn: 'bg-sky-600 text-white', titulo: 'text-sky-800', fondo: 'bg-sky-50/70', borde: 'border-sky-200' },
  { barra: 'from-emerald-400 to-emerald-600', chip: 'bg-emerald-50 text-emerald-700 ring-emerald-200', caja: 'bg-emerald-100 text-emerald-700', cajaOn: 'bg-emerald-600 text-white', titulo: 'text-emerald-800', fondo: 'bg-emerald-50/70', borde: 'border-emerald-200' },
  { barra: 'from-violet-400 to-violet-600', chip: 'bg-violet-50 text-violet-700 ring-violet-200', caja: 'bg-violet-100 text-violet-700', cajaOn: 'bg-violet-600 text-white', titulo: 'text-violet-800', fondo: 'bg-violet-50/70', borde: 'border-violet-200' },
  { barra: 'from-teal-400 to-teal-600', chip: 'bg-teal-50 text-teal-700 ring-teal-200', caja: 'bg-teal-100 text-teal-700', cajaOn: 'bg-teal-600 text-white', titulo: 'text-teal-800', fondo: 'bg-teal-50/70', borde: 'border-teal-200' },
  { barra: 'from-indigo-400 to-indigo-600', chip: 'bg-indigo-50 text-indigo-700 ring-indigo-200', caja: 'bg-indigo-100 text-indigo-700', cajaOn: 'bg-indigo-600 text-white', titulo: 'text-indigo-800', fondo: 'bg-indigo-50/70', borde: 'border-indigo-200' },
  { barra: 'from-fuchsia-400 to-fuchsia-600', chip: 'bg-fuchsia-50 text-fuchsia-700 ring-fuchsia-200', caja: 'bg-fuchsia-100 text-fuchsia-700', cajaOn: 'bg-fuchsia-600 text-white', titulo: 'text-fuchsia-800', fondo: 'bg-fuchsia-50/70', borde: 'border-fuchsia-200' },
  { barra: 'from-lime-400 to-lime-600', chip: 'bg-lime-50 text-lime-800 ring-lime-300', caja: 'bg-lime-100 text-lime-800', cajaOn: 'bg-lime-600 text-white', titulo: 'text-lime-900', fondo: 'bg-lime-50/70', borde: 'border-lime-300' },
  { barra: 'from-cyan-400 to-cyan-600', chip: 'bg-cyan-50 text-cyan-700 ring-cyan-200', caja: 'bg-cyan-100 text-cyan-700', cajaOn: 'bg-cyan-600 text-white', titulo: 'text-cyan-800', fondo: 'bg-cyan-50/70', borde: 'border-cyan-200' },
]
export const SIN_COLOR = { barra: 'from-slate-300 to-slate-400', chip: 'bg-slate-50 text-slate-500 ring-slate-200', caja: 'bg-slate-100 text-slate-500', cajaOn: 'bg-slate-500 text-white', titulo: 'text-slate-700', fondo: 'bg-slate-50', borde: 'border-slate-200' }

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
