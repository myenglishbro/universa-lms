import { useMemo, useState } from 'react'
import { fmtNota } from '../../lib/evaluaciones'
import { promedioAnterior, seguimientoFormative } from '../../lib/seguimiento'

// «My skills»: seguimiento del Formative por habilidad y unidad. Radar con una capa por unidad (y el promedio del módulo anterior),
// tendencia de cada habilidad y lectura de la que se elija. Solo notas publicadas; lo pendiente queda vacío, nunca cuenta como cero.
const ESTADOS = {
  mejora: { texto: 'Improving', clase: 'bg-emerald-50 text-emerald-700' },
  estable: { texto: 'Steady', clase: 'bg-brand-50 text-brand-700' },
  baja: { texto: 'Dropping', clase: 'bg-amber-50 text-amber-800' },
  atencion: { texto: 'Needs attention', clase: 'bg-amber-50 text-amber-800' },
  primera: { texto: 'First grade', clase: 'bg-slate-100 text-slate-600' },
  sin_nota: { texto: 'Not graded yet', clase: 'bg-slate-100 text-slate-500' },
}
const COLOR_UNIDAD = ['text-brand-200', 'text-brand-500', 'text-brand-800', 'text-brand-900']
const R = 104
const CX = 170
const CY = 150

const redondeo = (n) => Math.round(n)

function Estado({ estado }) {
  const e = ESTADOS[estado] ?? ESTADOS.sin_nota
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${e.clase}`}>{e.texto}</span>
}

function Mini({ valores }) {
  const W = 72
  const H = 28
  const n = valores.length
  const pts = valores.map((v, i) => (v == null ? null : [6 + (i * (W - 12)) / Math.max(1, n - 1), H - 4 - (v / 100) * (H - 8)])).filter(Boolean)
  if (pts.length === 0) return <svg viewBox={`0 0 ${W} ${H}`} className="h-7 w-[72px]" aria-hidden="true" />
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-7 w-[72px] text-brand-600" aria-hidden="true">
      <polyline points={pts.map((p) => p.join(',')).join(' ')} fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      {pts.map((p, i) => (
        <circle key={i} cx={p[0]} cy={p[1]} r={i === pts.length - 1 ? 3.5 : 2.2} fill="currentColor" />
      ))}
    </svg>
  )
}

function Radar({ habilidades, unidades, visibles, anterior, mostrarAnterior, sel, onSel }) {
  const n = habilidades.length
  const punto = (i, f) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / n
    return [CX + Math.cos(a) * R * f, CY + Math.sin(a) * R * f]
  }
  const anillo = (f) => habilidades.map((_, i) => punto(i, f).join(',')).join(' ')
  const poligono = (vals) => vals.map((v, i) => punto(i, (v ?? 0) / 100).join(',')).join(' ')
  const ultima = unidades.reduce((u, _, i) => (visibles[i] && habilidades.some((h) => h.valores[i] != null) ? i : u), -1)
  return (
    <svg viewBox="0 0 340 300" className="mx-auto block h-auto w-full max-w-md" role="img" aria-label="Skills radar by unit">
      {[0.2, 0.4, 0.6, 0.8, 1].map((f) => (
        <polygon key={f} points={anillo(f)} fill="none" className="stroke-slate-200" strokeWidth="1" />
      ))}
      {habilidades.map((h, i) => {
        const [x, y] = punto(i, 1)
        return <line key={h.nombre} x1={CX} y1={CY} x2={x} y2={y} className="stroke-slate-200" />
      })}
      {mostrarAnterior && (
        <g className="text-slate-400">
          <polygon points={poligono(habilidades.map((h) => anterior[h.clave] ?? null))} fill="currentColor" fillOpacity="0.1" stroke="currentColor" strokeWidth="1.6" strokeDasharray="5 4" strokeLinejoin="round" />
        </g>
      )}
      {unidades.map((u, ui) =>
        visibles[ui] && habilidades.some((h) => h.valores[ui] != null) ? (
          <g key={u} className={COLOR_UNIDAD[ui] ?? COLOR_UNIDAD[3]}>
            <polygon points={poligono(habilidades.map((h) => h.valores[ui]))} fill="currentColor" fillOpacity={ui === ultima ? 0.2 : 0.07} stroke="currentColor" strokeWidth={ui === ultima ? 2.5 : 1.6} strokeLinejoin="round" />
            {ui === ultima &&
              habilidades.map((h, i) => {
                const [x, y] = punto(i, (h.valores[ui] ?? 0) / 100)
                return <circle key={h.nombre} cx={x} cy={y} r={i === sel ? 6.5 : 4.2} fill={h.valores[ui] == null ? 'white' : 'currentColor'} stroke="currentColor" strokeWidth="2" />
              })}
          </g>
        ) : null,
      )}
      {habilidades.map((h, i) => {
        const [x, y] = punto(i, 1.18)
        const ancla = x < CX - 6 ? 'end' : x > CX + 6 ? 'start' : 'middle'
        return (
          <g key={h.nombre} role="button" tabIndex={0} aria-label={h.nombre} className="cursor-pointer outline-none" onClick={() => onSel(i)} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onSel(i))}>
            <circle cx={x} cy={y} r="24" fill="transparent" />
            <text x={x} y={y} textAnchor={ancla} dominantBaseline="middle" fontSize="10.5" fontWeight="600" className={i === sel ? 'fill-brand-700' : 'fill-slate-700'}>
              {h.nombre.split('/')[0].trim()}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

export default function MisHabilidades({ modulos }) {
  const seg = useMemo(() => seguimientoFormative(modulos), [modulos])
  const [idx, setIdx] = useState(null)
  const [sel, setSel] = useState(0)
  const [ocultas, setOcultas] = useState({})
  const [comparar, setComparar] = useState(true)
  if (seg.length === 0) return null
  const i = idx != null && idx < seg.length ? idx : seg.length - 1
  const mod = seg[i]
  const hs = mod.habilidades
  const anterior = promedioAnterior(seg, i)
  const hayAnterior = Object.keys(anterior).length > 0
  const visibles = mod.unidades.map((u, k) => !ocultas[`${i}:${k}`] && hs.some((h) => h.valores[k] != null))
  const actual = hs[Math.min(sel, hs.length - 1)]
  const conRadar = hs.length >= 3
  const vsAnterior = actual.ultimo != null && anterior[actual.clave] != null ? redondeo(actual.ultimo - anterior[actual.clave]) : null
  const ordenadas = hs.filter((h) => h.ultimo != null).sort((a, b) => b.ultimo - a.ultimo)
  const fuertes = ordenadas.slice(0, 2)
  const trabajar = ordenadas.length > 2 ? ordenadas.slice(-2).reverse() : []

  return (
    <section aria-labelledby="mis-habilidades">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 id="mis-habilidades" className="text-sm font-semibold text-slate-900">
            My skills
          </h3>
          <p className="text-xs text-slate-500">Your Formative activities by skill, unit by unit.</p>
        </div>
        {seg.length > 1 && (
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Module">
            {seg.map((m, k) => (
              <button key={m.id} type="button" onClick={() => { setIdx(k); setSel(0) }} aria-pressed={k === i} className={`rounded-full border px-3 py-1 text-xs font-medium ${k === i ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-300 bg-white text-slate-700 hover:border-brand-500'}`}>
                {m.nombre}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="mt-3 grid gap-5 rounded-2xl border border-brand-100 bg-white p-4 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap justify-center gap-1.5" role="group" aria-label="Layers">
            {mod.unidades.map((u, k) =>
              hs.some((h) => h.valores[k] != null) ? (
                <button key={u} type="button" aria-pressed={!ocultas[`${i}:${k}`]} onClick={() => setOcultas((o) => ({ ...o, [`${i}:${k}`]: !o[`${i}:${k}`] }))} className={`inline-flex items-center gap-1.5 rounded-full border border-slate-300 px-2.5 py-0.5 text-xs font-medium ${ocultas[`${i}:${k}`] ? 'bg-white text-slate-400' : 'bg-white text-slate-700'}`}>
                  <span className={`h-2.5 w-2.5 rounded-full ${ocultas[`${i}:${k}`] ? 'border-2 border-slate-300' : ['bg-brand-200', 'bg-brand-500', 'bg-brand-800', 'bg-brand-900'][k] ?? 'bg-brand-900'}`} />
                  {u}
                </button>
              ) : null,
            )}
            {hayAnterior && (
              <button type="button" aria-pressed={comparar} onClick={() => setComparar((c) => !c)} className={`inline-flex items-center gap-1.5 rounded-full border border-slate-300 px-2.5 py-0.5 text-xs font-medium ${comparar ? 'text-slate-700' : 'text-slate-400'}`}>
                <span className="h-0 w-3 border-t-2 border-dashed border-slate-400" />
                {seg[i - 1].nombre} average
              </button>
            )}
          </div>
          {conRadar ? (
            <Radar habilidades={hs} unidades={mod.unidades} visibles={visibles} anterior={anterior} mostrarAnterior={hayAnterior && comparar} sel={Math.min(sel, hs.length - 1)} onSel={setSel} />
          ) : (
            <p className="text-xs text-slate-500">The radar appears when at least three skills have a published grade.</p>
          )}
        </div>

        <div className="min-w-0 space-y-3">
          <div className="rounded-xl bg-brand-50 px-4 py-3" aria-live="polite">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <p className="text-base font-semibold text-slate-900">
                {actual.nombre} {actual.ultimo != null && <span className="tabular-nums">· {redondeo(actual.ultimo)}%</span>}
              </p>
              <Estado estado={actual.estado} />
              {actual.delta != null && (
                <span className={`text-xs font-semibold ${actual.delta >= 0 ? 'text-emerald-700' : 'text-amber-800'}`}>
                  {actual.delta >= 0 ? '▲ +' : '▼ '}
                  {actual.delta} pts since {mod.unidades.find((u, k) => actual.valores[k] != null)}
                </span>
              )}
            </div>
            <p className="mt-1 text-sm text-slate-700">
              {mod.unidades.map((u, k) => (actual.valores[k] == null ? `${u}: pending` : `${u}: ${redondeo(actual.valores[k])}%`)).join('  →  ')}
            </p>
            {vsAnterior != null && (
              <p className="mt-0.5 text-xs text-slate-500">
                Compared with your {seg[i - 1].nombre} average ({fmtNota(anterior[actual.clave])}%): {vsAnterior >= 0 ? '+' : ''}
                {vsAnterior} pts.
              </p>
            )}
          </div>

          <ul className="space-y-1" role="list">
            {hs.map((h, k) => (
              <li key={h.nombre}>
                <button type="button" onClick={() => setSel(k)} aria-pressed={k === sel} className={`grid w-full grid-cols-[minmax(0,1fr)_72px_44px] items-center gap-3 rounded-lg px-2 py-1.5 text-left hover:bg-slate-50 ${k === sel ? 'bg-slate-50' : ''}`}>
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="truncate text-sm font-medium text-slate-900">{h.nombre}</span>
                    <Estado estado={h.estado} />
                  </span>
                  <Mini valores={h.valores} />
                  <span className="text-right text-sm font-bold tabular-nums text-slate-900">{h.ultimo == null ? '—' : `${redondeo(h.ultimo)}%`}</span>
                </button>
              </li>
            ))}
          </ul>

          {(fuertes.length > 0 || trabajar.length > 0) && (
            <div className="grid gap-2 sm:grid-cols-2">
              {fuertes.length > 0 && (
                <div className="rounded-xl bg-emerald-50 px-3 py-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700">Strongest</p>
                  {fuertes.map((h) => (
                    <p key={h.nombre} className="flex justify-between text-sm text-slate-800">
                      <span>{h.nombre}</span>
                      <span className="tabular-nums text-slate-500">{redondeo(h.ultimo)}%</span>
                    </p>
                  ))}
                </div>
              )}
              {trabajar.length > 0 && (
                <div className="rounded-xl bg-amber-50 px-3 py-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-800">To work on</p>
                  {trabajar.map((h) => (
                    <p key={h.nombre} className="flex justify-between text-sm text-slate-800">
                      <span>{h.nombre}</span>
                      <span className="tabular-nums text-slate-500">{redondeo(h.ultimo)}%</span>
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}
          <p className="text-xs text-slate-500">Each percentage is your published grade for that skill. A unit that is not published yet stays empty; it never counts as zero.</p>
        </div>
      </div>
    </section>
  )
}
