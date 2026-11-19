import { createContext, useContext, useState } from 'react'
import { inputClass } from '../ui/Field'
import {
  NIVELES_RUBRICA,
  acotarPuntaje,
  adaptarNivel,
  agruparCriterios,
  bandaDe,
  bandaDeNivel,
  esPorNiveles,
  expectativasMcer,
  fmtNota,
  nivelDePuntaje,
  nombreEnGrupo,
  puntajeDeNivel,
  subtotalGrupo,
} from '../../lib/evaluaciones'

// Formulario de los criterios de una rúbrica (diseño de la guía de Project Assessment): título con el total de puntos, una fila por criterio con su campo
// «0–máx» y «/máx», y los criterios que comparten prefijo («Grupo · Parte») dentro de un bloque con subtotal («0 / 25»).
// Cada campo se mantiene entre 0 y su máximo; vacío = pendiente. La descripción y los niveles de desempeño van en un desplegable bajo cada criterio.
//   criterios: [{ id, nombre, descripcion, max_puntaje, bandas }]   valores: { [id]: texto }   onCambiar(id, texto)
//   titulo: encabezado opcional (con badge de puntos)   etiquetaSufijo: texto para los aria-label (p. ej. « for Ana»)
//   sinDetalle: oculta descripción y niveles (Formative)
// Nivel MCER del salón (p. ej. «A2.2 – B1.1»): adapta los descriptores. Sin proveedor = texto general.
export const NivelMcerContext = createContext(null)

// Criterio por niveles 0–5: el docente elige un nivel, ve su descriptor y las expectativas del nivel MCER del salón, y los puntos salen solos
// (nivel ÷ 5 × peso). El valor que se guarda en «valores» son los puntos (texto); vacío = pendiente (nunca cero).
// Al pasar el cursor (o enfocar con el teclado) por un nivel se previsualiza su descriptor sin elegirlo; ←/→ cambian de nivel.
export function CampoNivel({ c, etiqueta, enGrupo = false, valor, onCambiar, deshabilitado = false, etiquetaSufijo = '', mcer = null }) {
  const [abierto, setAbierto] = useState(false)
  const [previo, setPrevio] = useState(null)
  const nivel = nivelDePuntaje(c, valor)
  const mostrado = previo ?? nivel
  const banda = bandaDeNivel(c, mostrado)
  const expectativas = expectativasMcer(c, mcer)
  const puntos = nivel == null ? null : Number(puntajeDeNivel(c, nivel))
  // Misma etiqueta en pantalla para todas las rúbricas por niveles (la de la base puede estar en otro idioma).
  const etiquetaNivel = (n) => NIVELES_RUBRICA.find((x) => x.nivel === Number(n))?.etiqueta ?? ''
  // Hay expectativas escritas, pero no para el nivel pedido (p. ej. C2): se avisa en vez de esconder la ayuda.
  const sinExpectativas = !!mcer && !!c.niveles_mcer && expectativas.length === 0
  const elegir = (n) => onCambiar(c.id, nivel === n ? '' : puntajeDeNivel(c, n))
  const teclas = (ev, n) => {
    const paso = ev.key === 'ArrowRight' || ev.key === 'ArrowDown' ? 1 : ev.key === 'ArrowLeft' || ev.key === 'ArrowUp' ? -1 : 0
    if (!paso) return
    ev.preventDefault()
    const sig = Math.min(5, Math.max(0, n + paso))
    onCambiar(c.id, puntajeDeNivel(c, sig))
    ev.currentTarget.parentElement.children[sig]?.focus()
  }
  return (
    <div className={`rounded-xl border px-3 py-2.5 ${nivel == null ? 'border-slate-200 bg-white' : 'border-brand-200 bg-brand-50/40'} ${enGrupo ? 'ml-3' : ''}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-900">{etiqueta}</p>
          {c.descripcion && <p className="text-xs text-slate-500">{adaptarNivel(c.descripcion, mcer)}</p>}
        </div>
        <div className="shrink-0 text-right" aria-label={`Points for ${etiqueta}`}>
          <p className={`text-base font-bold tabular-nums ${nivel == null ? 'text-slate-300' : 'text-brand-800'}`}>
            {puntos == null ? '—' : fmtNota(puntos)}
            <span className="text-xs font-medium text-slate-400"> / {fmtNota(c.max_puntaje)}</span>
          </p>
          {nivel == null && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-800">Pending</span>}
        </div>
      </div>

      <div role="radiogroup" aria-label={`${c.nombre}${etiquetaSufijo}`} className="mt-2 grid grid-cols-6 gap-1.5" onMouseLeave={() => setPrevio(null)}>
        {NIVELES_RUBRICA.map((n) => {
          const activo = nivel === n.nivel
          return (
            <button
              key={n.nivel}
              type="button"
              role="radio"
              aria-checked={activo}
              aria-label={`${n.nivel} · ${n.etiqueta}`}
              tabIndex={activo || (nivel == null && n.nivel === 0) ? 0 : -1}
              disabled={deshabilitado}
              onClick={() => elegir(n.nivel)}
              onKeyDown={(ev) => teclas(ev, n.nivel)}
              onMouseEnter={() => setPrevio(n.nivel)}
              onFocus={() => setPrevio(n.nivel)}
              onBlur={() => setPrevio(null)}
              title={n.etiqueta}
              className={`flex h-10 items-center justify-center rounded-lg border text-base font-bold tabular-nums transition-colors disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${activo ? 'border-brand-600 bg-brand-600 text-white shadow-sm' : 'border-slate-300 bg-white text-slate-700 hover:border-brand-400 hover:bg-brand-50'}`}
            >
              {n.nivel}
            </button>
          )
        })}
      </div>

      <p className={`mt-2 rounded-lg px-2.5 py-1.5 text-xs leading-snug ${banda ? (previo != null && previo !== nivel ? 'bg-slate-50 text-slate-600' : 'bg-white text-slate-800') : 'text-slate-400'}`} aria-live="polite">
        {banda ? (
          <>
            <span className="font-semibold text-brand-800">
              {mostrado} · {etiquetaNivel(mostrado)}
              {previo != null && previo !== nivel ? ' (preview — click to choose)' : ''}:
            </span>{' '}
            {adaptarNivel(banda.descripcion, mcer)}
          </>
        ) : (
          'Point at a level to read its descriptor, then click to choose it. Empty = pending, never zero.'
        )}
      </p>

      {sinExpectativas && <p className="mt-1.5 text-xs text-slate-500">No expectations are written for {mcer}; use the closest CEFR level.</p>}
      {expectativas.length > 0 && (
        <button type="button" onClick={() => setAbierto((a) => !a)} aria-expanded={abierto} className="mt-1.5 text-xs font-medium text-brand-700 underline">
          {abierto ? 'Hide' : 'See'} expectations{mcer ? ` for ${mcer}` : ' by CEFR level'} and all levels
        </button>
      )}
      {abierto && (
        <div className="mt-1.5 space-y-2 rounded-lg bg-white px-3 py-2">
          <div>
            <p className="text-xs font-semibold text-slate-700">What to expect{mcer ? ` at ${mcer}` : ''}</p>
            <ul className="space-y-0.5">
              {expectativas.map((e) => (
                <li key={e.nivel} className="text-xs text-slate-600">
                  <span className="font-semibold">{e.nivel}</span>: {e.texto}
                </li>
              ))}
            </ul>
          </div>
          <ul className="space-y-1 border-t border-slate-100 pt-2">
            {(c.bandas ?? []).map((b) => (
              <li key={b.nivel} className={`text-xs ${nivel === Number(b.nivel) ? 'font-semibold text-brand-800' : 'text-slate-600'}`}>
                <span className="font-semibold">
                  {b.nivel} · {etiquetaNivel(b.nivel)}
                </span>
                {b.descripcion ? `: ${adaptarNivel(b.descripcion, mcer)}` : ''}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

// Nombre corto de un criterio para el eje del radar: sin prefijo de grupo o de tarea y solo la primera parte antes de « & ».
const etiquetaEje = (nombre) => (nombre.split(' · ').pop() ?? nombre).split(' & ')[0]

// Perfil del alumno: un eje por criterio (de 0 a 5); el polígono se dibuja mientras se califica. Los pendientes quedan en el centro con punto hueco.
function RadarRubrica({ criterios, valores }) {
  const n = criterios.length
  const R = 86
  const cx = 150
  const cy = 118
  const punto = (i, f) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / n
    return [cx + Math.cos(a) * R * f, cy + Math.sin(a) * R * f]
  }
  const anillo = (f) => criterios.map((_, i) => punto(i, f).join(',')).join(' ')
  const nivelDe = (c) => nivelDePuntaje(c, valores?.[c.id])
  const poligono = criterios.map((c, i) => punto(i, (nivelDe(c) ?? 0) / 5).join(',')).join(' ')
  return (
    <svg viewBox="0 0 300 236" className="mx-auto block h-auto w-full max-w-xs text-brand-600" role="img" aria-label="Student profile by criterion">
      {[0.2, 0.4, 0.6, 0.8, 1].map((f) => (
        <polygon key={f} points={anillo(f)} fill="none" className="stroke-slate-200" strokeWidth="1" />
      ))}
      {criterios.map((c, i) => {
        const [x, y] = punto(i, 1)
        return <line key={c.id} x1={cx} y1={cy} x2={x} y2={y} className="stroke-slate-200" />
      })}
      <polygon points={poligono} fill="currentColor" fillOpacity="0.2" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      {criterios.map((c, i) => {
        const nv = nivelDe(c)
        const [x, y] = punto(i, (nv ?? 0) / 5)
        return <circle key={c.id} cx={x} cy={y} r={nv == null ? 3 : 4.5} fill={nv == null ? 'white' : 'currentColor'} stroke="currentColor" strokeWidth="2" />
      })}
      {criterios.map((c, i) => {
        const [x, y] = punto(i, 1.2)
        const ancla = x < cx - 5 ? 'end' : x > cx + 5 ? 'start' : 'middle'
        return (
          <text key={c.id} x={x} y={y} textAnchor={ancla} dominantBaseline="middle" fontSize="10.5" fontWeight="600" className="fill-slate-700">
            {etiquetaEje(c.nombre)}
          </text>
        )
      })}
    </svg>
  )
}

// Avance de la rúbrica: criterios calificados, puntos acumulados y cuántos faltan. Los que faltan no cuentan como cero.
function AvanceRubrica({ criterios, valores }) {
  const hechos = criterios.filter((c) => valores?.[c.id] !== '' && valores?.[c.id] != null).length
  const max = criterios.reduce((s, c) => s + Number(c.max_puntaje), 0)
  const suma = criterios.reduce((s, c) => s + (valores?.[c.id] !== '' && valores?.[c.id] != null && !Number.isNaN(Number(valores[c.id])) ? Number(valores[c.id]) : 0), 0)
  const completo = hechos === criterios.length && criterios.length > 0
  return (
    <div className="sticky top-0 z-10 mb-2 rounded-xl border border-brand-100 bg-white/95 px-3 py-2 shadow-sm backdrop-blur" role="status" aria-live="polite">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="font-medium text-slate-700">
          {completo ? '✓ All criteria graded' : `${hechos} of ${criterios.length} criteria graded`}
        </span>
        <span className="font-bold tabular-nums text-brand-800">
          {fmtNota(Math.round(suma * 100) / 100)} <span className="text-xs font-medium text-slate-400">/ {fmtNota(max)} pts</span>
        </span>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100" aria-hidden="true">
        <div className={`h-full rounded-full transition-all ${completo ? 'bg-brand-600' : 'bg-brand-300'}`} style={{ width: `${criterios.length ? (hechos / criterios.length) * 100 : 0}%` }} />
      </div>
      {!completo && hechos > 0 && <p className="mt-1 text-[11px] text-amber-800">The grade is saved only when every criterion has a level. Pending criteria never count as zero.</p>}
    </div>
  )
}

export default function CriteriosRubrica({ criterios, valores, onCambiar, deshabilitado = false, etiquetaSufijo = '', sinDetalle = false, titulo = '' }) {
  const mcer = useContext(NivelMcerContext)
  const [abiertos, setAbiertos] = useState({})
  const total = criterios.reduce((s, c) => s + Number(c.max_puntaje), 0)

  const campo = (c, etiqueta, enGrupo) => {
    if (esPorNiveles(c)) {
      return <CampoNivel key={c.id} c={c} etiqueta={etiqueta} enGrupo={enGrupo} valor={valores?.[c.id]} onCambiar={onCambiar} deshabilitado={deshabilitado} etiquetaSufijo={etiquetaSufijo} mcer={mcer} />
    }
    const banda = bandaDe(c, valores?.[c.id])
    const hayNiveles = (c.bandas ?? []).some((b) => b.desde != null)
    return (
      <div key={c.id} className="py-1.5">
        <div className="flex items-center justify-between gap-3">
          <span className={`text-sm ${enGrupo ? 'pl-1 text-slate-700' : 'text-slate-800'}`}>
            {enGrupo && <span aria-hidden="true">↳ </span>}
            {etiqueta}
            {!sinDetalle && (c.descripcion || hayNiveles) && (
              <button
                type="button"
                onClick={() => setAbiertos((x) => ({ ...x, [c.id]: !x[c.id] }))}
                aria-expanded={!!abiertos[c.id]}
                aria-label={`Show performance levels for ${etiqueta}`}
                title="Low / Fair / Excellent descriptors"
                className="ml-1.5 inline-flex h-4 w-4 items-center justify-center rounded-full border border-brand-300 align-middle text-[10px] font-bold leading-none text-brand-700 hover:bg-brand-50"
              >
                i
              </button>
            )}
            {banda && !sinDetalle && <span className="ml-2 text-[11px] font-medium text-brand-700">{banda.etiqueta}</span>}
          </span>
          <span className="flex shrink-0 items-center gap-2">
            <input
              type="number"
              inputMode="decimal"
              min={0}
              max={c.max_puntaje}
              step="0.5"
              disabled={deshabilitado}
              aria-label={`${c.nombre}${etiquetaSufijo}`}
              value={valores?.[c.id] ?? ''}
              onChange={(e) => onCambiar(c.id, acotarPuntaje(e.target.value, c.max_puntaje))}
              className={`${inputClass} w-24 rounded-full text-right`}
              placeholder={`0–${fmtNota(c.max_puntaje)}`}
            />
            <span className="w-9 text-xs text-slate-500">/{fmtNota(c.max_puntaje)}</span>
          </span>
        </div>
        {!sinDetalle && abiertos[c.id] && (
          <div className="mt-1 rounded-xl bg-brand-50/50 px-3 py-2">
            {c.descripcion && <p className="text-xs text-slate-600">{adaptarNivel(c.descripcion, mcer)}</p>}
            {hayNiveles && (
              <ul className="mt-1 space-y-1">
                {c.bandas.map((b) => (
                  <li key={b.etiqueta} className={`text-xs ${banda?.etiqueta === b.etiqueta ? 'font-semibold text-brand-800' : 'text-slate-600'}`}>
                    <span className="font-semibold">{b.etiqueta} ({fmtNota(b.desde)}–{fmtNota(b.hasta)})</span>
                    {b.descripcion ? `: ${adaptarNivel(b.descripcion, mcer)}` : ''}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    )
  }

  const conNiveles = criterios.some(esPorNiveles)
  return (
    <div className={titulo ? 'rounded-2xl border border-brand-100 bg-white px-4 py-3' : ''}>
      {conNiveles && <AvanceRubrica criterios={criterios} valores={valores} />}
      {titulo && (
        <div className="mb-1 flex items-center justify-between gap-3">
          <h3 className="text-base font-semibold text-slate-900">{titulo}</h3>
          <span className="rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-semibold text-brand-800">{fmtNota(total)} pts</span>
        </div>
      )}
      <div className={conNiveles && criterios.length >= 3 ? 'gap-4 lg:grid lg:grid-cols-[minmax(0,280px)_minmax(0,1fr)] lg:items-start' : ''}>
      {conNiveles && criterios.length >= 3 && (
        <div className="mb-3 rounded-xl border border-slate-200 bg-white p-2 lg:sticky lg:top-24 lg:mb-0">
          <RadarRubrica criterios={criterios} valores={valores} />
        </div>
      )}
      <ul className={conNiveles ? 'space-y-2' : 'divide-y divide-slate-100'}>
        {agruparCriterios(criterios).map((g) => {
          if (!g.grupo) return <li key={g.items[0].id}>{campo(g.items[0], g.items[0].nombre, false)}</li>
          const sub = subtotalGrupo(g.items, valores)
          return (
            <li key={g.grupo} className="py-1">
              <div className="flex items-center justify-between gap-3 pt-1.5">
                <span className="text-sm font-semibold text-slate-900">{g.grupo}</span>
                <span className="text-xs font-medium text-slate-600" aria-label={`Subtotal of ${g.grupo}`}>
                  {fmtNota(sub.suma)} / {fmtNota(g.max)}
                </span>
              </div>
              {g.items.map((c) => campo(c, nombreEnGrupo(c, g.grupo), true))}
            </li>
          )
        })}
      </ul>
      </div>
    </div>
  )
}
