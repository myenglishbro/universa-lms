import { useCallback, useState } from 'react'
import Badge from '../ui/Badge'
import Button from '../ui/Button'
import Card from '../ui/Card'
import Field from '../ui/Field'
import Icon from '../ui/Icon'
import { AudioGuardado } from './EjercicioJugador'
import useCarga from '../../hooks/useCarga'
import { esManual, fmtPuntaje, palabras, tipoDe } from '../../lib/ejercicios'
import { formatFecha } from '../../lib/salones'

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
        <Field label="Nota (0–100)" type="number" min="0" max="100" value={nota} onChange={(e) => setNota(e.target.value)} />
        <Field as="textarea" rows={3} label={`Feedback para el estudiante`} value={feedback} onChange={(e) => setFeedback(e.target.value)} placeholder={tipo === 'writing' ? 'Qué hizo bien, qué corregir (gramática, vocabulario, organización)…' : 'Pronunciación, fluidez, vocabulario…'} />
      </div>
      {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
      <div className="flex justify-end">
        <Button onClick={guardar} disabled={guardando}>
          {guardando ? 'Guardando…' : entrega.estado === 'revisada' ? 'Actualizar revisión' : 'Guardar revisión'}
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

  const a = datos?.asignacion
  const t = a ? tipoDe(a.tipo) : null
  const manual = a ? esManual(a.tipo) : false

  return (
    <>
      <button onClick={onVolver} className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-brand-700">
        <Icon name="back" className="h-4 w-4" /> Ejercicios del salón
      </button>
      {cargando && <p className="py-10 text-center text-sm text-slate-500">Cargando…</p>}
      {error && <p className="text-sm text-red-600">No se pudieron cargar las entregas: {error}</p>}
      {a && (
        <>
          <div className="mb-5">
            <h2 className="text-2xl font-bold text-brand-800">{a.titulo}</h2>
            <p className="text-sm text-slate-500">
              {t.label}
              {a.fecha_limite && ` · hasta ${formatFecha(a.fecha_limite)}`}
              {manual ? ' · revisión manual' : ' · se califica solo'}
            </p>
          </div>
          {manual && a.contenido.consigna && <p className="mb-4 rounded-xl border border-brand-100 bg-white p-4 text-sm text-slate-800">{a.contenido.consigna}</p>}
          <Card>
            <ul className="divide-y divide-slate-100">
              {datos.filas.map((f) => {
                const e = f.entrega
                const abre = abierto === f.alumno_id
                return (
                  <li key={f.alumno_id} className="px-4 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium text-slate-900">{f.nombre}</p>
                        <p className="text-xs text-slate-500">{e ? `Entregó el ${formatFecha(String(e.entregado_at).slice(0, 10))}` : 'Aún no entrega'}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        {!e && <Badge color="slate">Pendiente</Badge>}
                        {e?.estado === 'pendiente' && <Badge color="peach">Por revisar</Badge>}
                        {e?.estado === 'revisada' && <Badge color="brand">Revisado · {fmtPuntaje(e.puntaje)}</Badge>}
                        {e?.estado === 'autocalificada' && (
                          <Badge color="brand">
                            {fmtPuntaje(e.puntaje)} · {e.correctas}/{e.total}
                          </Badge>
                        )}
                        {e && manual && (
                          <Button variant={e.estado === 'pendiente' ? 'primary' : 'ghost'} className="px-4 py-1 text-xs" onClick={() => setAbierto(abre ? null : f.alumno_id)}>
                            {e.estado === 'pendiente' ? 'Revisar' : abre ? 'Cerrar' : 'Ver'}
                          </Button>
                        )}
                      </div>
                    </div>
                    {e && manual && abre && (
                      <div className="mt-3">
                        {a.tipo === 'writing' ? (
                          <div className="rounded-xl border border-slate-200 bg-white p-4">
                            <p className="mb-2 text-xs text-slate-500">{palabras(e.respuestas?.texto)} palabras</p>
                            <p className="whitespace-pre-wrap text-[15px] leading-7 text-slate-800">{e.respuestas?.texto}</p>
                          </div>
                        ) : e.audio_path ? (
                          <AudioGuardado ruta={e.audio_path} />
                        ) : (
                          <p className="text-sm text-slate-500">Sin audio.</p>
                        )}
                        <Corregir entrega={e} tipo={a.tipo} servicio={servicio} onHecho={recargar} />
                      </div>
                    )}
                  </li>
                )
              })}
              {datos.filas.length === 0 && <li className="px-4 py-6 text-center text-sm text-slate-400">Este salón no tiene estudiantes matriculados.</li>}
            </ul>
          </Card>
        </>
      )}
    </>
  )
}
