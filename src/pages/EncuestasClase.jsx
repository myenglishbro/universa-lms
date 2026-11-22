import { Fragment, useCallback, useMemo, useState } from 'react'
import Badge from '../components/ui/Badge'
import Card from '../components/ui/Card'
import PageHeader from '../components/ui/PageHeader'
import useCarga from '../hooks/useCarga'
import { MIN_RESPUESTAS_CONFIABLES, PREGUNTAS, compararDocentes, matrizMensual, nombreMes, notaDe, tasaRespuesta } from '../lib/encuestas'
import { formatFecha } from '../lib/salones'
import * as servicioReal from '../services/encuestas'

const PERIODOS = [
  { dias: 30, label: '30 days' },
  { dias: 90, label: '90 days' },
  { dias: 365, label: '1 year' },
  { dias: 0, label: 'All time' },
]
const ETIQUETAS = {
  destacado: { color: 'brand', texto: 'Above the team' },
  normal: { color: 'slate', texto: 'In line with the team' },
  atencion: { color: 'rose', texto: 'Needs attention' },
  poco: { color: 'slate', texto: `Fewer than ${MIN_RESPUESTAS_CONFIABLES} responses` },
}
const CELDA = {
  destacado: 'bg-brand-100 text-brand-800',
  atencion: 'bg-rose-50 text-rose-700',
  normal: 'bg-white text-slate-800',
  poco: 'bg-slate-50 text-slate-400',
  sin: 'text-slate-300',
}

const f1 = (x) => (x == null ? '—' : Number(x).toFixed(1))
const signo = (x) => (x == null ? '' : `${x > 0 ? '+' : ''}${x.toFixed(2)}`)
const colorDelta = (x) => (x == null ? 'text-slate-400' : x > 0 ? 'text-brand-700' : x < 0 ? 'text-rose-700' : 'text-slate-500')

function Segmentos({ opciones, valor, onChange, etiqueta }) {
  return (
    <div role="group" aria-label={etiqueta} className="inline-flex max-w-full gap-0.5 overflow-x-auto rounded-xl bg-slate-100 p-0.5">
      {opciones.map(([v, t]) => (
        <button key={String(v)} type="button" aria-pressed={valor === v} onClick={() => onChange(v)} className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm ${valor === v ? 'bg-white font-semibold text-brand-700 shadow-sm' : 'text-slate-600'}`}>
          {t}
        </button>
      ))}
    </div>
  )
}

// Respuestas de cada estudiante a un docente, con su nombre. Con `mes`, solo las clases de ese mes.
function Respuestas({ docenteId, dias, mes, servicio }) {
  const cargar = useCallback(() => servicio.respuestasEncuestas(docenteId, mes ? 0 : dias, mes), [servicio, docenteId, dias, mes])
  const { datos, cargando, error } = useCarga(cargar, [])
  if (cargando) return <p className="text-sm text-slate-500">Loading responses…</p>
  if (error) return <p className="text-sm text-red-600">Could not load the responses: {error}</p>
  if (datos.length === 0) return <p className="text-sm text-slate-500">No responses {mes ? `in ${nombreMes(mes)}` : 'in this period'}.</p>
  return (
    <ul className="space-y-2">
      {datos.map((r, i) => (
        <li key={i} className="rounded-xl bg-white p-3 text-sm shadow-sm ring-1 ring-slate-100">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3">
            <p className="font-semibold text-slate-900">{r.alumno}</p>
            <p className="text-xs text-slate-400">
              {formatFecha(r.clase)} · {r.salon}
            </p>
          </div>
          <p className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-slate-600">
            {PREGUNTAS.map((p) => (
              <span key={p.id}>
                {p.corta} <strong className="text-slate-900">{r[p.id]}</strong>
              </span>
            ))}
            <span className="font-semibold text-brand-700">avg {notaDe(r)?.toFixed(1)}</span>
          </p>
          {r.comentario && <p className="mt-1.5 text-slate-800">“{r.comentario}”</p>}
        </li>
      ))}
    </ul>
  )
}

// Detalle de un docente: su evolución mes a mes (frente al equipo) y las respuestas de cada estudiante.
function DetalleDocente({ fila, dias, servicio }) {
  const [mes, setMes] = useState(null)
  return (
    <div className="space-y-3">
      {fila && (
        <div>
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">Month by month · tap a month to filter the responses</p>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {fila.celdas.map((c) => (
              <button
                key={c.mes}
                type="button"
                disabled={c.n === 0}
                aria-pressed={mes === c.mes}
                onClick={() => setMes(mes === c.mes ? null : c.mes)}
                className={`min-w-[5.5rem] shrink-0 rounded-xl px-3 py-2 text-left ring-1 ${mes === c.mes ? 'ring-2 ring-brand-600' : 'ring-slate-200'} ${CELDA[c.estado]} disabled:opacity-50`}
              >
                <span className="block text-[11px] font-medium text-slate-500">{nombreMes(c.mes)}</span>
                <span className="block text-lg font-bold leading-tight">{f1(c.nota)}</span>
                <span className="block text-[11px] text-slate-500">{c.n} resp.</span>
                {c.deltaMes != null && <span className={`block text-[11px] font-semibold ${colorDelta(c.deltaMes)}`}>{signo(c.deltaMes)} vs prev.</span>}
              </button>
            ))}
          </div>
        </div>
      )}
      <div>
        <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">Responses{mes ? ` · ${nombreMes(mes)}` : ''}</p>
        <Respuestas docenteId={fila?.docente_id ?? null} dias={dias} mes={mes} servicio={servicio} />
      </div>
    </div>
  )
}

// Experiencia de clase según los estudiantes: promedios por docente, evolución mes a mes y respuestas de cada estudiante. Solo administración.
export default function EncuestasClase({ servicio = servicioReal }) {
  const [vista, setVista] = useState('docentes') // docentes | meses
  const [dias, setDias] = useState(90)
  const [abierto, setAbierto] = useState(null)
  const cargar = useCallback(() => Promise.all([servicio.resumenEncuestas(dias), servicio.mensualEncuestas(6)]), [servicio, dias])
  const { datos, cargando, error, recargar } = useCarga(cargar, null)
  const resumen = datos?.[0]
  const matriz = useMemo(() => matrizMensual(datos?.[1]), [datos])
  const docentes = useMemo(() => compararDocentes(resumen?.docentes ?? [], resumen?.equipo), [resumen])
  const equipo = resumen?.equipo
  const filaDe = (id) => matriz.filas.find((f) => (f.docente_id ?? 'sin') === (id ?? 'sin'))

  return (
    <>
      <PageHeader title="Class feedback" description="How students rate each class, by teacher and month. Only administration sees the answers." />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Segmentos etiqueta="View" valor={vista} onChange={setVista} opciones={[['docentes', 'By teacher'], ['meses', 'Month by month']]} />
        {vista === 'docentes' && <Segmentos etiqueta="Period" valor={dias} onChange={setDias} opciones={PERIODOS.map((p) => [p.dias, p.label])} />}
      </div>

      {error ? (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          Could not load the feedback: {error}{' '}
          <button type="button" onClick={recargar} className="font-medium underline">
            Retry
          </button>
        </div>
      ) : cargando || !datos ? (
        <p className="py-10 text-center text-sm text-slate-500">Loading feedback…</p>
      ) : matriz.meses.length === 0 && docentes.length === 0 ? (
        <Card className="px-6 py-12 text-center">
          <p className="font-semibold text-slate-900">No responses yet</p>
          <p className="mt-1 text-sm text-slate-500">Students see the survey in their portal from the moment a class starts.</p>
        </Card>
      ) : vista === 'docentes' ? (
        <>
          <div className="mb-4 grid grid-cols-3 gap-3">
            {[
              ['Responses', equipo?.n ?? 0],
              ['Team score', f1(notaDe(equipo))],
              ['Teachers rated', docentes.length],
            ].map(([t, v]) => (
              <Card key={t} className="p-4">
                <p className="text-2xl font-bold text-slate-900">{v}</p>
                <p className="text-xs text-slate-500">{t}</p>
              </Card>
            ))}
          </div>

          <Card className="overflow-hidden">
            <table className="tabla-tarjetas w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Teacher</th>
                  <th className="px-3 py-2.5 text-right font-medium">Responses</th>
                  {PREGUNTAS.map((p) => (
                    <th key={p.id} className="px-3 py-2.5 text-right font-medium">{p.corta}</th>
                  ))}
                  <th className="px-3 py-2.5 text-right font-medium">Score</th>
                  <th className="px-3 py-2.5 text-right font-medium">vs team</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {docentes.map((d) => {
                  const e = ETIQUETAS[d.etiqueta]
                  const key = d.docente_id ?? 'sin'
                  const tasa = tasaRespuesta(d)
                  return (
                    <Fragment key={key}>
                      <tr className="hover:bg-slate-50">
                        <td className="px-4 py-3">
                          <button type="button" aria-expanded={abierto === key} onClick={() => setAbierto(abierto === key ? null : key)} className="text-left font-medium text-brand-700 hover:underline">
                            {d.docente}
                          </button>
                          <div className="mt-0.5">
                            <Badge color={e.color}>{e.texto}</Badge>
                          </div>
                        </td>
                        <td data-label="Responses" className="px-3 py-3 text-right text-slate-700">
                          <span>
                            {d.n}
                            {tasa != null && <span className="text-xs text-slate-400"> of {d.asistentes} · {Math.round(tasa * 100)}%</span>}
                          </span>
                        </td>
                        {PREGUNTAS.map((p) => (
                          <td key={p.id} data-label={p.corta} className="px-3 py-3 text-right text-slate-700">{f1(d[p.id])}</td>
                        ))}
                        <td data-label="Score" className="px-3 py-3 text-right text-base font-bold text-slate-900">{f1(d.nota)}</td>
                        <td data-label="vs team" className={`px-3 py-3 text-right font-semibold ${colorDelta(d.delta)}`}>{d.delta == null ? '—' : signo(d.delta)}</td>
                      </tr>
                      {abierto === key && (
                        <tr className="bg-brand-50/40">
                          <td colSpan={8} className="px-4 py-3">
                            <DetalleDocente fila={filaDe(d.docente_id)} dias={dias} servicio={servicio} />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </Card>
          <p className="mt-3 text-xs text-slate-400">
            Scores are the average of the four questions (1 to 5). “of N · %” is the share of students who attended and answered. A teacher is only compared after {MIN_RESPUESTAS_CONFIABLES} responses; “Needs attention” means a score under 3.5 or 0.3 points below the team.
          </p>
        </>
      ) : (
        <>
          <Card className="overflow-x-auto">
            <table className="w-full min-w-[34rem] text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="sticky left-0 bg-slate-50 px-4 py-2.5 text-left font-medium">Teacher</th>
                  {matriz.meses.map((m) => (
                    <th key={m} className="px-3 py-2.5 text-center font-medium">{nombreMes(m)}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {matriz.filas.map((f) => {
                  const key = f.docente_id ?? 'sin'
                  return (
                    <Fragment key={key}>
                      <tr>
                        <td className="sticky left-0 bg-white px-4 py-2">
                          <button type="button" aria-expanded={abierto === key} onClick={() => setAbierto(abierto === key ? null : key)} className="text-left font-medium text-brand-700 hover:underline">
                            {f.docente}
                          </button>
                        </td>
                        {f.celdas.map((c) => (
                          <td key={c.mes} className="p-1 text-center">
                            <div className={`rounded-lg px-2 py-1.5 ${CELDA[c.estado]}`} title={c.n ? `${c.n} responses` : 'No responses'}>
                              <span className="block text-base font-bold leading-tight">{f1(c.nota)}</span>
                              <span className="block text-[11px] text-slate-500">{c.n ? `${c.n} resp.` : ''}</span>
                              {c.deltaMes != null && <span className={`block text-[11px] font-semibold ${colorDelta(c.deltaMes)}`}>{c.deltaMes > 0 ? '▲' : c.deltaMes < 0 ? '▼' : '='} {Math.abs(c.deltaMes).toFixed(2)}</span>}
                            </div>
                          </td>
                        ))}
                      </tr>
                      {abierto === key && (
                        <tr className="bg-brand-50/40">
                          <td colSpan={matriz.meses.length + 1} className="px-4 py-3">
                            <DetalleDocente fila={f} dias={0} servicio={servicio} />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })}
                <tr className="bg-slate-50 font-semibold">
                  <td className="sticky left-0 bg-slate-50 px-4 py-2 text-slate-700">Team</td>
                  {matriz.equipo.map((e) => (
                    <td key={e.mes} className="px-3 py-2 text-center">
                      <span className="block text-base text-slate-900">{f1(e.nota)}</span>
                      <span className="block text-[11px] font-normal text-slate-500">{e.n} resp.</span>
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </Card>
          <p className="mt-3 text-xs text-slate-400">
            Last 6 months by class date. Purple = 0.3 or more above the team that month; red = under 3.5 or 0.3 below it; grey = fewer than 3 responses. ▲▼ compares with the teacher’s previous month. Tap a name to see each student’s answers.
          </p>
        </>
      )}
    </>
  )
}
