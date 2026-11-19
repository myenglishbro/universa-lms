import { useMemo, useState } from 'react'
import { NIVELES_RUBRICA, fmtNota } from '../../lib/evaluaciones'
import { nivelDePct, promedioAnterior, seguimientoDetalle, seguimientoFormative } from '../../lib/seguimiento'

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

// Radar genérico: ejes = etiquetas; capas = [{ valores (0–100 o null), clase (color con currentColor), destacada, punteada }].
function Radar({ etiquetas, capas, sel, onSel }) {
  const n = etiquetas.length
  const punto = (i, f) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / n
    return [CX + Math.cos(a) * R * f, CY + Math.sin(a) * R * f]
  }
  const anillo = (f) => etiquetas.map((_, i) => punto(i, f).join(',')).join(' ')
  const poligono = (vals) => vals.map((v, i) => punto(i, (v ?? 0) / 100).join(',')).join(' ')
  return (
    <svg viewBox="0 0 340 300" className="mx-auto block h-auto w-full max-w-md" role="img" aria-label="Radar by skill">
      {[0.2, 0.4, 0.6, 0.8, 1].map((f) => (
        <polygon key={f} points={anillo(f)} fill="none" className="stroke-slate-200" strokeWidth="1" />
      ))}
      {etiquetas.map((e, i) => {
        const [x, y] = punto(i, 1)
        return <line key={e} x1={CX} y1={CY} x2={x} y2={y} className="stroke-slate-200" />
      })}
      {capas.map((c, k) => (
        <g key={k} className={c.clase}>
          <polygon points={poligono(c.valores)} fill="currentColor" fillOpacity={c.destacada ? 0.2 : 0.07} stroke="currentColor" strokeWidth={c.destacada ? 2.5 : 1.6} strokeDasharray={c.punteada ? '5 4' : undefined} strokeLinejoin="round" />
          {c.destacada &&
            c.valores.map((v, i) => {
              const [x, y] = punto(i, (v ?? 0) / 100)
              return <circle key={i} cx={x} cy={y} r={i === sel ? 6.5 : 4.2} fill={v == null ? 'white' : 'currentColor'} stroke="currentColor" strokeWidth="2" />
            })}
        </g>
      ))}
      {etiquetas.map((e, i) => {
        const [x, y] = punto(i, 1.18)
        const ancla = x < CX - 6 ? 'end' : x > CX + 6 ? 'start' : 'middle'
        return (
          <g key={e} role="button" tabIndex={0} aria-label={e} className="cursor-pointer outline-none" onClick={() => onSel?.(i)} onKeyDown={(ev) => (ev.key === 'Enter' || ev.key === ' ') && (ev.preventDefault(), onSel?.(i))}>
            <circle cx={x} cy={y} r="24" fill="transparent" />
            <text x={x} y={y} textAnchor={ancla} dominantBaseline="middle" fontSize="10.5" fontWeight="600" className={i === sel ? 'fill-brand-700' : 'fill-slate-700'}>
              {e}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

const etiquetaNivel = (pct) => NIVELES_RUBRICA.find((x) => x.nivel === nivelDePct(pct))?.etiqueta ?? ''
const corto = (nombre) => nombre.split(' & ')[0]

// Detalle de un tipo de evaluación (Writing o Oral Project): radar del módulo elegido contra el anterior y una fila por criterio con su nivel.
function BloqueDetalle({ titulo, actual, anterior, nombreAnterior }) {
  const [sel, setSel] = useState(0)
  const [comparar, setComparar] = useState(true)
  const prev = Object.fromEntries(anterior.map((c) => [c.clave, c.pct]))
  const hayPrev = anterior.length > 0
  const capas = [
    ...(hayPrev && comparar ? [{ valores: actual.map((c) => prev[c.clave] ?? null), clase: 'text-slate-400', punteada: true }] : []),
    { valores: actual.map((c) => c.pct), clase: 'text-brand-600', destacada: true },
  ]
  return (
    <div className="min-w-0 space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-sm font-semibold text-slate-900">{titulo}</h4>
        {hayPrev && (
          <button type="button" aria-pressed={comparar} onClick={() => setComparar((c) => !c)} className={`inline-flex items-center gap-1.5 rounded-full border border-slate-300 px-2.5 py-0.5 text-xs font-medium ${comparar ? 'text-slate-700' : 'text-slate-400'}`}>
            <span className="h-0 w-3 border-t-2 border-dashed border-slate-400" />
            {nombreAnterior}
          </button>
        )}
      </div>
      {actual.length >= 3 ? <Radar etiquetas={actual.map((c) => corto(c.nombre))} capas={capas} sel={sel} onSel={setSel} /> : <p className="text-xs text-slate-500">The radar appears when at least three criteria have a published grade.</p>}
      <ul className="space-y-1" role="list">
        {actual.map((c, k) => {
          const d = prev[c.clave] != null ? Math.round(c.pct - prev[c.clave]) : null
          return (
            <li key={c.nombre}>
              <button type="button" onClick={() => setSel(k)} aria-pressed={k === sel} className={`grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-slate-50 ${k === sel ? 'bg-slate-50' : ''}`}>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-slate-900">{c.nombre}</span>
                  <span className="text-xs text-slate-500">
                    Level {nivelDePct(c.pct)} · {etiquetaNivel(c.pct)}
                    {d != null && <span className={d >= 0 ? ' text-emerald-700' : ' text-amber-800'}>{` · ${d >= 0 ? '▲ +' : '▼ '}${d} pts vs ${nombreAnterior}`}</span>}
                  </span>
                </span>
                <span className="text-sm font-bold tabular-nums text-slate-900">{Math.round(c.pct)}%</span>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function Detalle({ modulos }) {
  const seg = useMemo(() => seguimientoDetalle(modulos), [modulos])
  const [idx, setIdx] = useState(null)
  if (seg.length === 0) return <p className="text-sm text-slate-500">Your Writing and Oral Project criteria will appear here once your teacher publishes those grades.</p>
  const i = idx != null && idx < seg.length ? idx : seg.length - 1
  const m = seg[i]
  const p = seg[i - 1]
  return (
    <div className="space-y-3">
      {seg.length > 1 && (
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Module">
          {seg.map((x, k) => (
            <button key={x.id} type="button" onClick={() => setIdx(k)} aria-pressed={k === i} className={`rounded-full border px-3 py-1 text-xs font-medium ${k === i ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-300 bg-white text-slate-700 hover:border-brand-500'}`}>
              {x.nombre}
            </button>
          ))}
        </div>
      )}
      <div className="grid gap-6 lg:grid-cols-2">
        {m.writing.length > 0 && <BloqueDetalle titulo="Writing Assessment" actual={m.writing} anterior={p?.writing ?? []} nombreAnterior={p?.nombre ?? ''} />}
        {m.project.length > 0 && <BloqueDetalle titulo="Oral Project" actual={m.project} anterior={p?.project ?? []} nombreAnterior={p?.nombre ?? ''} />}
      </div>
      <p className="text-xs text-slate-500">Each percentage is the points you earned in that criterion out of its maximum. Criteria that are not published yet are not shown; they never count as zero.</p>
    </div>
  )
}

function HabilidadesFormative({ modulos }) {
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
  const ultima = mod.unidades.reduce((u, _, k) => (visibles[k] ? k : u), -1)
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
            <Radar
              etiquetas={hs.map((h) => h.nombre.split('/')[0].trim())}
              capas={[
                ...(hayAnterior && comparar ? [{ valores: hs.map((h) => anterior[h.clave] ?? null), clase: 'text-slate-400', punteada: true }] : []),
                ...mod.unidades.map((u, k) => ({ valores: hs.map((h) => h.valores[k]), clase: COLOR_UNIDAD[k] ?? COLOR_UNIDAD[3], destacada: k === ultima })).filter((c, k) => visibles[k]),
              ]}
              sel={Math.min(sel, hs.length - 1)}
              onSel={setSel}
            />
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

// Sección «My skills» del estudiante: pestaña «Skills» (Formative por unidad) y pestaña de detalle de Writing y Oral Project. Solo aparecen las que tienen notas publicadas.
export default function MisHabilidades({ modulos }) {
  const tieneF = useMemo(() => seguimientoFormative(modulos).length > 0, [modulos])
  const tieneD = useMemo(() => seguimientoDetalle(modulos).length > 0, [modulos])
  const [tab, setTab] = useState('skills')
  if (!tieneF && !tieneD) return null
  const activa = tieneF && tieneD ? tab : tieneF ? 'skills' : 'detalle'
  return (
    <div className="space-y-2">
      {tieneF && tieneD && (
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="My skills view">
          {[['skills', 'Skills by unit'], ['detalle', 'Writing & Speaking detail']].map(([k, t]) => (
            <button key={k} type="button" aria-pressed={activa === k} onClick={() => setTab(k)} className={`rounded-full border px-3.5 py-1 text-sm font-medium ${activa === k ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-300 bg-white text-slate-700 hover:border-brand-500'}`}>
              {t}
            </button>
          ))}
        </div>
      )}
      {activa === 'skills' ? (
        <HabilidadesFormative modulos={modulos} />
      ) : (
        <section aria-labelledby="mis-habilidades-detalle">
          <h3 id="mis-habilidades-detalle" className="text-sm font-semibold text-slate-900">
            My skills
          </h3>
          <p className="text-xs text-slate-500">Your Writing Assessment and Oral Project, criterion by criterion.</p>
          <div className="mt-3 rounded-2xl border border-brand-100 bg-white p-4">
            <Detalle modulos={modulos} />
          </div>
        </section>
      )}
    </div>
  )
}
