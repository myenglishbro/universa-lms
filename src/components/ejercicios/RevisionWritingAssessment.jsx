import { useCallback, useState } from 'react'
import CriteriosRubrica from '../evaluaciones/CriteriosRubrica'
import Badge from '../ui/Badge'
import Button from '../ui/Button'
import Card from '../ui/Card'
import Field from '../ui/Field'
import useCarga from '../../hooks/useCarga'
import { palabras } from '../../lib/ejercicios'
import { criteriosDeUnidad, fmtNota, totalCriterios } from '../../lib/evaluaciones'
import { valoresDesdeDetalle } from '../../lib/formativeBanco'
import { formatFecha } from '../../lib/salones'
import * as servicioReal from '../../services/ejercicios'

const iniciales = (n) => String(n ?? '?').split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase()
const minSeg = (s) => `${Math.floor(s / 60)} min ${s % 60}s`

// Califica UNA tarea (Task 1 o Task 2) con los criterios de la rúbrica. Guarda un borrador en la Grade matrix: no publica nada.
function CorregirTarea({ tarea, entrega, nota, criterios, texto, servicio, onHecho }) {
  const propios = criteriosDeUnidad(criterios, tarea)
  const [valores, setValores] = useState(() => valoresDesdeDetalle(propios, { criterios: nota?.detalle }))
  const [feedback, setFeedback] = useState(nota?.comentario ?? '')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const total = totalCriterios(propios, valores)
  const publicada = nota?.estado === 'publicada'

  const guardar = async () => {
    setError('')
    if (!total.completo) return setError('Grade all the criteria of this task')
    setGuardando(true)
    try {
      await servicio.calificarWritingTask(entrega.id, tarea, propios.map((c) => ({ criterio_id: c.id, puntaje: Number(valores[c.id]) })), feedback)
      await onHecho()
    } catch (e) {
      setError(e.message)
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-slate-900">{tarea}</p>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span>{palabras(texto)} words</span>
          {nota && <Badge color={publicada ? 'brand' : 'peach'}>{publicada ? 'Published' : 'Draft saved'}</Badge>}
        </div>
      </div>
      <p className="max-h-72 overflow-y-auto whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-[15px] leading-7 text-slate-800">{texto?.trim() ? texto : <span className="text-slate-400">The student left this task blank.</span>}</p>
      <div className="mt-3 space-y-3 rounded-xl bg-brand-50/60 p-4">
        <CriteriosRubrica criterios={propios} valores={valores} onCambiar={(id, v) => setValores((x) => ({ ...x, [id]: v }))} deshabilitado={publicada} />
        <Field as="textarea" rows={3} label={`Feedback for ${tarea}`} value={feedback} onChange={(e) => setFeedback(e.target.value)} disabled={publicada} />
        {publicada ? (
          <p className="text-xs text-slate-500">This grade is already published. To change it, use “Correct grade” in the Grade matrix (a reason is required).</p>
        ) : (
          <div className="flex items-center justify-end gap-3">
            {error && (
              <span role="alert" className="text-sm text-rose-700">
                {error}
              </span>
            )}
            <Button type="button" onClick={guardar} disabled={guardando}>
              {guardando ? 'Saving…' : nota ? `Update ${tarea}` : `Save ${tarea}`}
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}

// Revisión de un Writing Assessment: por estudiante, sus dos textos, cuánto tardó, cuántas veces salió de la página y la calificación por tarea.
export default function RevisionWritingAssessment({ asignacionId, servicio = servicioReal, onVolver }) {
  const cargar = useCallback(() => servicio.writingAssessmentRevision(asignacionId), [servicio, asignacionId])
  const { datos, cargando, error, recargar } = useCarga(cargar, [])
  const [abierto, setAbierto] = useState(null)

  if (cargando && !datos) return <p className="py-10 text-center text-sm text-slate-500">Loading…</p>
  if (error) return <p className="text-sm text-red-600">Could not load the exam: {error}</p>
  if (!datos) return null

  const { asignacion: a, filas, rubrica } = datos
  const criterios = rubrica?.criterios ?? []
  const tareas = datos.unidades.filter((u) => u === 'Task 1' || u === 'Task 2')
  const hechas = (f) => tareas.filter((t) => f.notas?.[t]).length
  const porRevisar = filas.filter((f) => f.entrega && hechas(f) < tareas.length).length

  return (
    <>
      <button type="button" onClick={onVolver} className="mb-3 text-sm font-medium text-brand-700 hover:underline">
        ← Back to exercises
      </button>
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-slate-900">{a.titulo}</h2>
        <p className="text-sm text-slate-500">
          Writing Assessment · {datos.modulo} · {datos.minutos} min · {porRevisar} to review
        </p>
        <p className="mt-2 rounded-xl bg-peach-50 px-3 py-2 text-xs text-peach-800">
          Grade each task with the rubric. Grades are saved as drafts in the module’s Writing in the Grade matrix: nothing is published until you publish it there.
        </p>
      </div>
      {!rubrica && <p className="mb-3 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">The module’s Writing has no rubric, so it cannot be graded here.</p>}
      <Card>
        <ul className="divide-y divide-slate-100">
          {filas.map((f) => {
            const e = f.entrega
            const abre = abierto === f.alumno_id
            const r = e?.respuestas ?? {}
            const n = hechas(f)
            return (
              <li key={f.alumno_id} className="px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <span aria-hidden="true" className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-800">
                      {iniciales(f.nombre)}
                    </span>
                    <div>
                      <p className="text-sm font-medium text-slate-900">{f.nombre}</p>
                      <p className="text-xs text-slate-500">
                        {e
                          ? `Submitted on ${formatFecha(String(e.entregado_at).slice(0, 10))}${r.segundos != null ? ` · took ${minSeg(r.segundos)}` : ''}`
                          : f.examen
                            ? 'Started, not submitted yet'
                            : 'Has not started'}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {(f.examen?.salidas ?? 0) > 0 && <Badge color="peach">Left the page {f.examen.salidas}×</Badge>}
                    {r.fuera_de_tiempo && <Badge color="peach">Over the time limit</Badge>}
                    {e && <Badge color={n === tareas.length ? 'brand' : 'slate'}>{n} of {tareas.length} tasks graded</Badge>}
                    {e && tareas.map((t) => f.notas?.[t] && <span key={t} className="text-xs text-slate-500">{t}: {fmtNota(f.notas[t].puntaje)}%</span>)}
                    {e && rubrica && (
                      <Button variant={n < tareas.length ? 'primary' : 'ghost'} className="px-4 py-1 text-xs" onClick={() => setAbierto(abre ? null : f.alumno_id)}>
                        {abre ? 'Close' : n < tareas.length ? 'Review' : 'View'}
                      </Button>
                    )}
                  </div>
                </div>
                {e && abre && (
                  <div className="mt-3 space-y-4">
                    {tareas.map((t, i) => (
                      <CorregirTarea
                        key={`${t}-${f.notas?.[t]?.puntaje ?? 'x'}-${f.notas?.[t]?.estado ?? ''}`}
                        tarea={t}
                        entrega={e}
                        nota={f.notas?.[t]}
                        criterios={criterios}
                        texto={r.tareas?.[i]?.texto ?? ''}
                        servicio={servicio}
                        onHecho={recargar}
                      />
                    ))}
                  </div>
                )}
              </li>
            )
          })}
          {filas.length === 0 && <li className="px-4 py-6 text-center text-sm text-slate-400">This classroom has no students enrolled.</li>}
        </ul>
      </Card>
    </>
  )
}
