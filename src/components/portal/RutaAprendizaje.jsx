import { useCallback, useEffect, useMemo, useRef } from 'react'
import Icon from '../ui/Icon'
import useCarga from '../../hooks/useCarga'
import { NIVELES_RUTA, estadoNiveles, etiquetaCiclos, posicionEnRuta } from '../../lib/rutaAprendizaje'
import * as asistenciaReal from '../../services/asistencia'

// Lienzo 1000 × 560. Cada parada (nivel) es un punto del camino; el camino sube de izquierda a derecha haciendo curvas.
const W = 1000
const H = 660
const PUNTOS = [
  [90, 500],
  [230, 390],
  [370, 470],
  [510, 330],
  [650, 410],
  [790, 270],
  [905, 175],
]
const ARRIBA = [false, true, false, true, false, true, true] // la tarjeta de cada parada va arriba o abajo del punto

const segmento = (i) => {
  const [x0, y0] = PUNTOS[i]
  const [x1, y1] = PUNTOS[i + 1]
  const dx = (x1 - x0) / 2
  return [[x0, y0], [x0 + dx, y0], [x1 - dx, y1], [x1, y1]]
}
const bezier = ([p0, p1, p2, p3], u) => {
  const v = 1 - u
  return [0, 1].map((k) => v ** 3 * p0[k] + 3 * v * v * u * p1[k] + 3 * v * u * u * p2[k] + u ** 3 * p3[k])
}
const largoHasta = (i, u) => {
  const s = segmento(i)
  let largo = 0
  let prev = bezier(s, 0)
  for (let k = 1; k <= 40; k++) {
    const p = bezier(s, (k / 40) * u)
    largo += Math.hypot(p[0] - prev[0], p[1] - prev[1])
    prev = p
  }
  return largo
}
const D = PUNTOS.slice(1).reduce((d, _, i) => {
  const [, c1, c2, p] = segmento(i)
  return `${d} C ${c1[0]} ${c1[1]}, ${c2[0]} ${c2[1]}, ${p[0]} ${p[1]}`
}, `M ${PUNTOS[0][0]} ${PUNTOS[0][1]}`)
const LARGO_TOTAL = PUNTOS.slice(1).reduce((s, _, i) => s + largoHasta(i, 1), 0)

// Posición del estudiante sobre el camino y el largo ya recorrido.
function sobreElCamino(idx, avance) {
  if (idx >= PUNTOS.length - 1) return { punto: PUNTOS[PUNTOS.length - 1], recorrido: LARGO_TOTAL }
  const antes = Array.from({ length: idx }, (_, i) => largoHasta(i, 1)).reduce((a, b) => a + b, 0)
  const u = Math.min(0.88, Math.max(0.12, avance)) // nunca encima de una parada
  return { punto: bezier(segmento(idx), u), recorrido: antes + largoHasta(idx, u) }
}

const pct = (x, total) => `${(x / total) * 100}%`

function Parada({ nivel, i }) {
  const [x, y] = PUNTOS[i]
  const arriba = ARRIBA[i]
  const hecho = nivel.estado === 'hecho'
  const actual = nivel.estado === 'actual'
  return (
    <div className="absolute" style={{ left: pct(x, W), top: pct(y, H) }} aria-current={actual ? 'step' : undefined}>
      {/* punto sobre el camino */}
      <span
        className={`absolute z-10 flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-4 border-white text-sm font-black shadow-lg ${
          hecho ? 'bg-brand-600 text-white' : actual ? 'bg-peach-500 text-brand-900' : 'bg-white text-slate-400 ring-2 ring-brand-100'
        }`}
      >
        {actual && <span className="absolute inset-0 rounded-full bg-peach-500/50 motion-safe:animate-ping" />}
        <span className="relative">{hecho ? <Icon name="check" className="h-5 w-5" /> : i + 1}</span>
      </span>

      {/* tarjeta del nivel */}
      <div className={`absolute left-0 w-36 -translate-x-1/2 text-center ${arriba ? 'bottom-8' : 'top-8'}`}>
        <div
          className={`rounded-2xl px-2 py-2 shadow-md ${
            hecho ? 'bg-brand-600 text-white' : actual ? 'bg-white ring-2 ring-peach-500' : 'bg-white/80 ring-1 ring-brand-100'
          }`}
        >
          <p className={`text-[11px] font-bold ${hecho ? 'text-brand-100' : 'text-brand-600'}`}>{etiquetaCiclos(nivel)}</p>
          <p className={`text-sm font-bold leading-tight ${hecho ? 'text-white' : 'text-slate-900'}`}>{nivel.nombre}</p>
          <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ${hecho ? 'bg-white text-brand-700' : actual ? 'bg-brand-700 text-white' : 'bg-brand-50 text-brand-700'}`}>{nivel.mcer}</span>
          {actual && <p className="mt-1 text-xs font-bold text-peach-700">{Math.round(nivel.avance * 100)}% done</p>}
        </div>
      </div>
    </div>
  )
}

// Dibujo del camino con relieve. Se separa para poder usarlo con datos de prueba.
export function CaminoRuta({ niveles }) {
  const idx = niveles.findIndex((n) => n.estado === 'actual')
  const actual = niveles[idx]
  const { punto, recorrido } = sobreElCamino(idx, actual.avance)
  const caja = useRef(null)
  const lienzo = useRef(null)
  // En pantallas angostas el camino se desplaza: se centra donde está el estudiante.
  useEffect(() => {
    const c = caja.current
    const l = lienzo.current
    if (c && l && c.scrollWidth > c.clientWidth) c.scrollLeft = (punto[0] / W) * l.offsetWidth - c.clientWidth / 2
  }, [punto])
  const tramo = (ancho) => ({ d: D, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: ancho })

  return (
    <div ref={caja} className="overflow-x-auto">
      <div ref={lienzo} className="relative mx-auto min-w-[760px] max-w-[1000px]" style={{ aspectRatio: `${W} / ${H}` }}>
        <svg viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 h-full w-full" aria-hidden="true">
          <defs>
            <filter id="ruta-sombra" x="-10%" y="-10%" width="120%" height="130%">
              <feGaussianBlur stdDeviation="7" />
            </filter>
          </defs>
          {/* camino con relieve: sombra, canto, superficie, tramo recorrido y línea central */}
          <g transform="translate(0 16)" opacity="0.28" filter="url(#ruta-sombra)">
            <path {...tramo(54)} stroke="var(--color-brand-900)" />
          </g>
          <path {...tramo(56)} stroke="var(--color-brand-900)" transform="translate(0 9)" />
          <path {...tramo(56)} stroke="var(--color-brand-200)" />
          <path {...tramo(44)} stroke="var(--color-brand-100)" />
          <path {...tramo(44)} stroke="var(--color-brand-500)" strokeDasharray={`${recorrido} ${LARGO_TOTAL * 2}`} />
          <path {...tramo(3)} stroke="white" strokeOpacity="0.85" strokeDasharray="2 14" />
          <circle cx={punto[0]} cy={punto[1]} r="13" fill="var(--color-peach-500)" stroke="white" strokeWidth="5" />
        </svg>

        {niveles.map((n, i) => (
          <Parada key={n.id} nivel={n} i={i} />
        ))}

        {/* tú */}
        <div className="absolute z-20" style={{ left: pct(punto[0], W), top: pct(punto[1], H) }}>
          {idx >= PUNTOS.length - 1 ? (
            <div className="absolute left-0 top-5 flex -translate-x-1/2 flex-col items-center motion-safe:animate-bounce">
              <span className="-mb-1.5 h-3 w-3 rotate-45 bg-brand-700" />
              <span className="whitespace-nowrap rounded-full bg-brand-700 px-3 py-1 text-xs font-bold text-white shadow-lg">You are here</span>
            </div>
          ) : (
            <div className="absolute bottom-5 left-0 flex -translate-x-1/2 flex-col items-center motion-safe:animate-bounce">
              <span className="whitespace-nowrap rounded-full bg-brand-700 px-3 py-1 text-xs font-bold text-white shadow-lg">You are here</span>
              <span className="-mt-1.5 h-3 w-3 rotate-45 bg-brand-700" />
            </div>
          )}
        </div>

        {/* meta */}
        <span className="absolute -translate-x-1/2 -translate-y-1/2 text-4xl drop-shadow" style={{ left: pct(965, W), top: pct(130, H) }} aria-hidden="true">
          🏆
        </span>
      </div>
    </div>
  )
}

// «Mi ruta»: los 7 niveles de Universa como un camino con curvas; muestra los tramos ya recorridos, dónde está y cuánto le falta.
export default function RutaAprendizaje({ cursos, asistencia = asistenciaReal }) {
  const activos = useMemo(() => cursos.filter((c) => c.estado !== 'finalizado'), [cursos])
  const cargar = useCallback(
    () => Promise.all(activos.map((c) => asistencia.progresoDelSalon(c.salon_id).then((p) => p?.ciclos ?? []).catch(() => []))),
    [activos, asistencia],
  )
  const { datos: listas, cargando } = useCarga(cargar, [])
  const pos = useMemo(() => posicionEnRuta(listas), [listas])
  const niveles = useMemo(() => estadoNiveles(pos), [pos])

  if (activos.length === 0 || cargando || !pos) return null
  const idx = niveles.findIndex((n) => n.estado === 'actual')
  const actual = niveles[idx]
  const faltan = NIVELES_RUTA.length - 1 - idx
  const siguiente = niveles[idx + 1]

  return (
    <section className="mb-10 overflow-hidden rounded-3xl border border-brand-100 bg-gradient-to-b from-brand-50 via-white to-peach-50 p-5 shadow-sm sm:p-6" aria-label="My learning path">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">My learning path</p>
          <h2 className="text-xl font-bold text-slate-900">
            You are in {etiquetaCiclos(actual).toLowerCase()} · {actual.nombre}
          </h2>
          <p className="mt-0.5 text-sm text-slate-600">
            {faltan === 0 ? 'You reached the last level. The finish line is right there!' : `${Math.round(actual.avance * 100)}% of this level done. Next stop: ${siguiente.nombre} (${siguiente.mcer}).`}
          </p>
        </div>
        <p className="rounded-full bg-peach-100 px-3 py-1 text-sm font-semibold text-peach-700">{faltan === 0 ? 'Final level' : `${faltan} ${faltan === 1 ? 'stop' : 'stops'} to go`}</p>
      </div>
      <CaminoRuta niveles={niveles} />
    </section>
  )
}
