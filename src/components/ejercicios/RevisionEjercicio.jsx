import { useCallback, useState } from 'react'
import CriteriosRubrica from '../evaluaciones/CriteriosRubrica'
import Badge from '../ui/Badge'
import Button from '../ui/Button'
import Card from '../ui/Card'
import Field from '../ui/Field'
import Icon from '../ui/Icon'
import { AudioGuardado } from './EjercicioJugador'
import useCarga from '../../hooks/useCarga'
import { esManual, fmtPuntaje, palabras, tipoDe } from '../../lib/ejercicios'
import { etiquetaFormative, nota2, notaRubricaPct, valoresDesdeDetalle } from '../../lib/formativeBanco'
import { formatFecha } from '../../lib/salones'
import { clasificarNota } from '../../lib/evaluaciones'

const COLOR_RESULTADO = {
  desaprobo: 'bg-rose-100 text-rose-800',
  reforzamiento: 'bg-amber-100 text-amber-800',
  aprobo: 'bg-emerald-100 text-emerald-800',
  excelencia: 'bg-brand-100 text-brand-800',
}
const FILTROS = [
  ['todos', 'All'],
  ['revisar', 'To review'],
  ['pendientes', 'Not submitted'],
  ['listos', 'Graded'],
]
const estadoDe = (f) => (!f.entrega ? 'pendientes' : f.entrega.estado === 'pendiente' ? 'revisar' : 'listos')
const iniciales = (n) => String(n ?? '?').split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase()

// Actividad oficial del Formative: se califica con la rúbrica elegida al asignarla (cada criterio de 0 a su máximo, sin mínimos).
// enVivo = { asignacionId, alumnoId }: actividad tomada en clase, sin entrega del estudiante (entrega = null hasta que se guarda).
function CorregirRubrica({ entrega, rubrica, tipo, servicio, onHecho, enVivo = null }) {
  const [valores, setValores] = useState(() => valoresDesdeDetalle(rubrica.criterios, entrega?.detalle))
  const [feedback, setFeedback] = useState(entrega?.feedback ?? '')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const nota = notaRubricaPct(rubrica.criterios, valores)
  const oficial = clasificarNota(nota)

  const guardar = async () => {
    setError('')
    if (nota == null) return setError('Grade all criteria with a value between 0 and its maximum')
    setGuardando(true)
    try {
      const detalle = rubrica.criterios.map((c) => ({ criterio_id: c.id, puntaje: Number(valores[c.id]) }))
      if (!entrega && enVivo) await servicio.calificarEnVivo(enVivo.asignacionId, enVivo.alumnoId, detalle, feedback)
      else await servicio.calificarEntregaRubrica(entrega.id, detalle, feedback)
      await onHecho()
    } catch (e) {
      setError(e.message)
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="mt-4 space-y-3 rounded-xl bg-brand-50/60 p-4">
      <p className="text-sm font-medium text-slate-800">Rubric: {rubrica.nombre}</p>
      <CriteriosRubrica criterios={rubrica.criterios} valores={valores} onCambiar={(id, v) => setValores((x) => ({ ...x, [id]: v }))} />
      <Field as="textarea" rows={3} label="Feedback for the student" value={feedback} onChange={(e) => setFeedback(e.target.value)} placeholder={tipo === 'writing' ? 'What they did well, what to fix…' : 'Pronunciation, fluency, vocabulary…'} />
      {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
      <div className="sticky bottom-2 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-brand-100 bg-white px-4 py-3 shadow-sm">
        <div>
          <p className="text-xs text-slate-500">Activity result</p>
          <p className="text-xl font-bold text-brand-800">
            {nota == null ? '—' : nota2(nota)} <span className="text-sm font-normal text-slate-400">/ 100</span>
            {oficial && (
              <span className={`ml-2 rounded-full px-2 py-0.5 align-middle text-xs font-medium ${COLOR_RESULTADO[oficial.resultado]}`}>{oficial.etiqueta}</span>
            )}
          </p>
          {nota == null && <p className="text-xs text-amber-700">Grade every criterion to see the result.</p>}
        </div>
        <Button onClick={guardar} disabled={guardando || nota == null}>
          {guardando ? 'Saving…' : entrega?.estado === 'revisada' ? 'Update review' : enVivo && !entrega ? 'Save live grade' : 'Save review'}
        </Button>
      </div>
    </div>
  )
}

function Corregir({ entrega, tipo, servicio, onHecho }) {
  const [nota, setNota] = useState(entrega.puntaje ?? '')
  const [feedback, setFeedback] = useState(entrega.feedback ?? '')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  const guardar = async () => {
    setError('')
    const n = Number(nota)
    if (nota === '' || Number.isNaN(n) || n < 0 || n > 100) return setError('Pon una nota entre 0 y 100')
    setGuardando(true)
    try {
      await servicio.calificarEntrega(entrega.id, n, feedback)
      await onHecho()
    } catch (e) {
      setError(e.message)
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="mt-4 space-y-3 rounded-xl bg-brand-50/60 p-4">
      <div className="grid gap-3 sm:grid-cols-[8rem_1fr]">
        <Field label="Grade (0–100)" type="number" min="0" max="100" value={nota} onChange={(e) => setNota(e.target.value)} />
        <Field as="textarea" rows={3} label="Feedback for the student" value={feedback} onChange={(e) => setFeedback(e.target.value)} placeholder={tipo === 'writing' ? 'What they did well, what to fix (grammar, vocabulary, organization)…' : 'Pronunciation, fluency, vocabulary…'} />
      </div>
      {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
      <div className="flex justify-end">
        <Button onClick={guardar} disabled={guardando}>
          {guardando ? 'Saving…' : entrega.estado === 'revisada' ? 'Update review' : 'Save review'}
        </Button>
      </div>
    </div>
  )
}

// Entregas de una asignación: lista de estudiantes con su estado. Writing y speaking se revisan aquí con nota y feedback.
export default function RevisionEjercicio({ asignacionId, servicio, onVolver }) {
  const cargar = useCallback(() => servicio.entregasDeEjercicio(asignacionId), [servicio, asignacionId])
  const { datos, cargando, error, recargar } = useCarga(cargar, null)
  const [abierto, setAbierto] = useState(null)
  const [filtro, setFiltro] = useState('todos')
  const cuenta = (k) => (datos?.filas ?? []).filter((f) => k === 'todos' || estadoDe(f) === k).length

  const a = datos?.asignacion
  const t = a ? tipoDe(a.tipo) : null
  const manual = a ? esManual(a.tipo) : false

  return (
    <>
      <button onClick={onVolver} className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-brand-700">
        <Icon name="back" className="h-4 w-4" /> Classroom exercises
      </button>
      {cargando && <p className="py-10 text-center text-sm text-slate-500">Loading…</p>}
      {error && <p className="text-sm text-red-600">Could not load the submissions: {error}</p>}
      {a && (
        <>
          <div className="mb-5">
            <h2 className="text-2xl font-bold text-brand-800">{a.titulo}</h2>
            <p className="text-sm text-slate-500">
              {t.label}
              {a.fecha_limite && ` · until ${formatFecha(a.fecha_limite)}`}
              {manual ? ' · manual review' : ' · graded automatically'}
            </p>
            <p className={`text-sm font-medium ${a.formative ? 'text-brand-700' : 'text-slate-400'}`}>{etiquetaFormative(a.formative)}</p>
            {a.formative && <p className="text-xs text-slate-500">This activity feeds that skill of the unit. It counts when you confirm and publish the unit grade in “Formative grades”.</p>}
          </div>
          {manual && a.contenido.consigna && <p className="mb-4 rounded-xl border border-brand-100 bg-white p-4 text-sm text-slate-800">{a.contenido.consigna}</p>}
          <div className="mb-3 flex flex-wrap gap-1.5" role="tablist" aria-label="Filter students">
            {FILTROS.map(([id, t]) => (
              <button
                key={id}
                role="tab"
                aria-selected={filtro === id}
                onClick={() => setFiltro(id)}
                className={`rounded-full px-3 py-1 text-xs font-medium ${filtro === id ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
              >
                {t} · {cuenta(id)}
              </button>
            ))}
          </div>
          <Card>
            <ul className="divide-y divide-slate-100">
              {datos.filas.filter((f) => filtro === 'todos' || estadoDe(f) === filtro).map((f) => {
                const e = f.entrega
                const abre = abierto === f.alumno_id
                return (
                  <li key={f.alumno_id} className="px-4 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <span aria-hidden="true" className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-800">{iniciales(f.nombre)}</span>
                        <div>
                        <p className="text-sm font-medium text-slate-900">{f.nombre}</p>
                        <p className="text-xs text-slate-500">{e ? (e.respuestas?.en_vivo ? `Graded live on ${formatFecha(String(e.entregado_at).slice(0, 10))}` : `Submitted on ${formatFecha(String(e.entregado_at).slice(0, 10))}`) : 'Not submitted yet'}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {!e && <Badge color="slate">Pending</Badge>}
                        {e?.estado === 'pendiente' && <Badge color="peach">To review</Badge>}
                        {e?.estado === 'revisada' && <Badge color="brand">Revisado · {fmtPuntaje(e.puntaje)}</Badge>}
                        {e?.estado === 'autocalificada' && (
                          <Badge color="brand">
                            {fmtPuntaje(e.puntaje)} · {e.correctas}/{e.total}
                          </Badge>
                        )}
                        {!e && manual && a.formative?.rubrica && (
                          <Button variant="ghost" className="px-4 py-1 text-xs" onClick={() => setAbierto(abre ? null : f.alumno_id)}>
                            {abre ? 'Close' : 'Grade live'}
                          </Button>
                        )}
                        {e && manual && (
                          <Button variant={e.estado === 'pendiente' ? 'primary' : 'ghost'} className="px-4 py-1 text-xs" onClick={() => setAbierto(abre ? null : f.alumno_id)}>
                            {e.estado === 'pendiente' ? 'Review' : abre ? 'Close' : 'View'}
                          </Button>
                        )}
                      </div>
                    </div>
                    {!e && manual && a.formative?.rubrica && abre && (
                      <div className="mt-3">
                        <p className="text-xs text-slate-500">Taken in class, nothing submitted on the platform: grade it with the same rubric.</p>
                        <CorregirRubrica entrega={null} enVivo={{ asignacionId, alumnoId: f.alumno_id }} rubrica={a.formative.rubrica} tipo={a.tipo} servicio={servicio} onHecho={recargar} />
                      </div>
                    )}
                    {e && manual && abre && (
                      <div className="mt-3">
                        {e.respuestas?.en_vivo ? (
                          <p className="text-xs text-slate-500">Taken in class: there is no text or audio on the platform.</p>
                        ) : a.tipo === 'writing' ? (
                          <div className="rounded-xl border border-slate-200 bg-white p-4">
                            <p className="mb-2 text-xs text-slate-500">{palabras(e.respuestas?.texto)} palabras</p>
                            <p className="whitespace-pre-wrap text-[15px] leading-7 text-slate-800">{e.respuestas?.texto}</p>
                          </div>
                        ) : e.audio_path ? (
                          <AudioGuardado ruta={e.audio_path} />
                        ) : (
                          <p className="text-sm text-slate-500">No audio.</p>
                        )}
                        {a.formative?.rubrica ? (
                          <CorregirRubrica entrega={e} rubrica={a.formative.rubrica} tipo={a.tipo} servicio={servicio} onHecho={recargar} />
                        ) : (
                          <Corregir entrega={e} tipo={a.tipo} servicio={servicio} onHecho={recargar} />
                        )}
                      </div>
                    )}
                  </li>
                )
              })}
              {datos.filas.length === 0 && <li className="px-4 py-6 text-center text-sm text-slate-400">This classroom has no students enrolled.</li>}
            </ul>
          </Card>
        </>
      )}
    </>
  )
}
