import { useCallback, useState } from 'react'
import Badge from '../ui/Badge'
import Button from '../ui/Button'
import Card from '../ui/Card'
import { inputClass } from '../ui/Field'
import Icon from '../ui/Icon'
import Modal from '../ui/Modal'
import BancoEjercicios from './BancoEjercicios'
import RevisionEjercicio from './RevisionEjercicio'
import RevisionWritingAssessment from './RevisionWritingAssessment'
import FormativePropuesta from './FormativePropuesta'
import useCarga from '../../hooks/useCarga'
import { TONOS, clasificacionTexto, esExamen, esManual, fmtPuntaje, tipoDe } from '../../lib/ejercicios'
import { HABILIDADES, etiquetaFormative, habilidadSugerida, rubricaPorDefecto, rubricasDelTipo } from '../../lib/formativeBanco'
import { formatFecha } from '../../lib/salones'
import * as servicioReal from '../../services/ejercicios'

// ---- Piezas pequeñas del flujo de asignación ----
function Bloque({ titulo, nota, children }) {
  return (
    <div>
      <p className="mb-2 text-sm font-semibold text-slate-900">{titulo}</p>
      {children}
      {nota ? <p className="mt-1.5 text-xs text-slate-500">{nota}</p> : null}
    </div>
  )
}

// Selección con botones (en vez de listas desplegables): todo a la vista, un toque.
function Chips({ items, valor, onChange }) {
  return (
    <div role="radiogroup" className="flex flex-wrap gap-2">
      {items.map((i) => {
        const on = valor === i.value
        return (
          <button
            key={i.value}
            type="button"
            role="radio"
            aria-checked={on}
            disabled={i.disabled}
            onClick={() => onChange(i.value)}
            className={`rounded-full border px-3.5 py-1.5 text-sm transition disabled:cursor-not-allowed disabled:opacity-40 ${on ? 'border-brand-600 bg-brand-600 font-medium text-white shadow-sm' : 'border-slate-200 bg-white text-slate-700 hover:border-brand-300 hover:bg-brand-50/60'}`}
          >
            {i.label}
          </button>
        )
      })}
    </div>
  )
}

function Decision({ activa, onClick, icono, titulo, desc }) {
  return (
    <button type="button" role="radio" aria-checked={activa} onClick={onClick} className={`flex items-start gap-3 rounded-2xl border p-4 text-left transition ${activa ? 'border-brand-500 bg-brand-50 ring-2 ring-brand-500/20' : 'border-slate-200 bg-white hover:border-brand-300'}`}>
      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${activa ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
        <Icon name={icono} className="h-5 w-5" />
      </span>
      <span>
        <span className="block text-sm font-semibold text-slate-900">{titulo}</span>
        <span className="block text-xs text-slate-500">{desc}</span>
      </span>
    </button>
  )
}

function ResumenEjercicio({ e, onCambiar }) {
  const t = tipoDe(e.tipo)
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-brand-100 bg-brand-50/50 p-3">
      <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${TONOS[t.tono]}`}>
        <Icon name={t.icono} className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-semibold text-slate-900">{e.titulo}</p>
        <p className="truncate text-xs text-slate-500">{[t.label, clasificacionTexto(e), e.nivel].filter(Boolean).join(' · ')}</p>
      </div>
      {onCambiar && (
        <button type="button" onClick={onCambiar} className="shrink-0 text-sm font-medium text-brand-700 hover:underline">
          Change
        </button>
      )}
    </div>
  )
}

// Unidad del ejercicio (número) → la unidad del Formative cuyo nombre la contiene como número entero («Unit 5» sí, «Unit 15» no).
function unidadSugerida(unidades, n) {
  if (!n) return ''
  const re = new RegExp(`(^|\\D)${n}(\\D|$)`)
  const m = unidades.map((u) => (typeof u === 'string' ? { value: u, label: u } : u)).filter((u) => re.test(String(u.label)))
  return m.length === 1 ? m[0].value : ''
}

// Pestaña «Ejercicios» de un salón (docente o administración): lo asignado, quién entregó y qué falta revisar.
export default function EjerciciosSalon({ salonId, esAdmin = false, userId, servicio = servicioReal }) {
  const cargar = useCallback(() => servicio.ejerciciosDelSalon(salonId), [servicio, salonId])
  const { datos: lista, cargando, error, recargar } = useCarga(cargar, [])
  const [eligiendo, setEligiendo] = useState(false)
  const [elegido, setElegido] = useState(null)
  const [limite, setLimite] = useState('')
  const [conFecha, setConFecha] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [falla, setFalla] = useState('')
  const [abierta, setAbierta] = useState(null)
  const [verFormative, setVerFormative] = useState(false)
  // Ejercicio ya asignado que se convierte en actividad oficial del Formative.
  const [vinculando, setVinculando] = useState(null)
  // Destino de la asignación: práctica (no afecta notas) u oficial del Formative (módulo, unidad, habilidad y, en writing/speaking, rúbrica).
  const [modo, setModo] = useState('formative')
  const [opciones, setOpciones] = useState(null)
  const [evaluacionId, setEvaluacionId] = useState('')
  const [unidad, setUnidad] = useState('')
  const [habilidad, setHabilidad] = useState('')
  const [rubricaId, setRubricaId] = useState('')
  // Writing Assessment (examen): módulo con Writing por tareas y tiempo límite.
  const [opcionesExamen, setOpcionesExamen] = useState(null)
  const [minutos, setMinutos] = useState('')

  const cerrar = () => {
    setEligiendo(false)
    setElegido(null)
    setLimite('')
    setConFecha(false)
    setFalla('')
    setModo('formative')
    setVinculando(null)
    setOpciones(null)
    setEvaluacionId('')
    setUnidad('')
    setHabilidad('')
    setRubricaId('')
    setOpcionesExamen(null)
    setMinutos('')
  }
  const ej = elegido ?? vinculando
  const elegirModo = async (nuevo, ejercicio = ej) => {
    setModo(nuevo)
    setFalla('')
    if (nuevo !== 'formative') return
    if (!habilidad && ejercicio) setHabilidad(habilidadSugerida(ejercicio.tipo))
    if (opciones) return
    try {
      const o = await servicio.opcionesFormative(salonId)
      setOpciones(o)
      // Lo que se puede deducir se rellena solo: un único módulo, la unidad del ejercicio y la única rúbrica disponible.
      if (o.destinos.length === 1) {
        setEvaluacionId(o.destinos[0].evaluacion_id)
        setUnidad(unidadSugerida(o.destinos[0].unidades, ejercicio?.unidad))
      }
      if (ejercicio && esManual(ejercicio.tipo)) {
        const elegibles = rubricasDelTipo(o.rubricas, ejercicio.tipo)
        setRubricaId(rubricaPorDefecto(o.rubricas, ejercicio.tipo) || (elegibles.length === 1 ? elegibles[0].id : ''))
      }
    } catch (e) {
      setFalla(e.message)
    }
  }
  // Por defecto un ejercicio nuevo cuenta para el Formative; «Práctica» es la excepción.
  const elegirEjercicio = async (e) => {
    setElegido(e)
    if (esExamen(e.datos)) {
      setModo('examen')
      setMinutos(String(e.datos.minutos ?? 60))
      setFalla('')
      try {
        const o = await servicio.writingOpciones(salonId)
        setOpcionesExamen(o)
        const libres = o.filter((x) => !x.asignado)
        if (libres.length === 1) setEvaluacionId(libres[0].evaluacion_id)
      } catch (err) {
        setFalla(err.message)
      }
      return
    }
    elegirModo('formative', e)
  }
  const contarParaFormative = (a) => {
    setVinculando(a)
    elegirModo('formative', a)
  }
  const volverAPractica = async (a) => {
    if (!window.confirm(`“${a.titulo}” will stop counting toward the Formative. The unit grades are recalculated without this activity.`)) return
    try {
      await servicio.desvincularFormative(a.id)
      await recargar()
    } catch (e) {
      setFalla(e.message)
    }
  }
  const validarDestino = () => {
    if (!evaluacionId) return 'Choose the Formative module'
    if (!unidad) return 'Choose the Formative unit'
    if (!habilidad) return 'Choose the skill this activity feeds'
    if (esManual(ej.tipo) && !rubricaId) return `Choose the ${tipoDe(ej.tipo).label} rubric`
    return ''
  }
  const vincular = async () => {
    const v = validarDestino()
    if (v) return setFalla(v)
    setGuardando(true)
    try {
      await servicio.vincularFormative({ asignacionId: vinculando.id, evaluacionId, unidad, habilidad, rubricaId: esManual(vinculando.tipo) ? rubricaId : null })
      cerrar()
      await recargar()
    } catch (e) {
      setFalla(e.message)
    } finally {
      setGuardando(false)
    }
  }
  const destino = opciones?.destinos.find((d) => d.evaluacion_id === evaluacionId)
  const rubricasElegibles = ej && opciones ? rubricasDelTipo(opciones.rubricas, ej.tipo) : []
  const elegirModulo = (id) => {
    setEvaluacionId(id)
    const d = opciones?.destinos.find((x) => x.evaluacion_id === id)
    setUnidad(d ? unidadSugerida(d.unidades, ej?.unidad) : '')
  }
  const sugerida = destino && ej?.unidad && unidad && unidad === unidadSugerida(destino.unidades, ej.unidad) ? unidad : ''
  const resumenDestino =
    modo === 'examen'
      ? 'Writing Assessment exam'
      : modo === 'practica'
        ? 'Practice: it will not change any grade.'
        : [destino?.modulo ?? (opciones?.destinos.length === 1 ? opciones.destinos[0].modulo : ''), unidad, HABILIDADES.find((h) => h.id === habilidad)?.label].filter(Boolean).join(' · ') || 'Choose where it counts'

  const asignar = async () => {
    setFalla('')
    if (modo === 'examen') {
      if (!evaluacionId) return setFalla('Choose the module whose Writing this exam feeds')
      if (!(Number(minutos) >= 5 && Number(minutos) <= 240)) return setFalla('The time limit must be between 5 and 240 minutes')
    }
    if (modo === 'formative') {
      const v = validarDestino()
      if (v) return setFalla(v)
    }
    setGuardando(true)
    try {
      if (modo === 'examen') {
        await servicio.asignarWritingAssessment({ ejercicioId: elegido.id, salonId, evaluacionId, minutos, limite })
      } else if (modo === 'formative') {
        await servicio.asignarEjercicioFormative({ ejercicioId: elegido.id, salonId, limite, evaluacionId, unidad, habilidad, rubricaId: esManual(elegido.tipo) ? rubricaId : null })
      } else {
        await servicio.asignarEjercicio(elegido.id, salonId, limite)
      }
      cerrar()
      await recargar()
    } catch (e) {
      setFalla(e.message)
    } finally {
      setGuardando(false)
    }
  }
  const quitar = async (a) => {
    if (!window.confirm(`Remove “${a.titulo}” from this classroom? Submissions will no longer be visible.`)) return
    try {
      await servicio.quitarAsignacion(a.id)
      await recargar()
    } catch (e) {
      setFalla(e.message)
    }
  }

  // Dónde cuenta: solo se pregunta lo que no se puede deducir (un solo módulo o una sola rúbrica se muestran ya resueltos).
  const camposFormative = modo === 'formative' && ej && (
    <>
      {!opciones && !falla && <p className="text-sm text-slate-500">Loading modules…</p>}
      {opciones && opciones.destinos.length === 0 && <p className="rounded-xl bg-peach-50 px-3 py-2 text-sm text-peach-700">This classroom has no modules with a Formative yet.</p>}
      {opciones && opciones.destinos.length > 0 && (
        <div className="space-y-4 rounded-2xl bg-slate-50/70 p-4">
          {opciones.destinos.length === 1 ? (
            <p className="text-sm text-slate-600">
              Module: <strong className="text-slate-900">{opciones.destinos[0].modulo}</strong>
            </p>
          ) : (
            <Bloque titulo="Module">
              <Chips valor={evaluacionId} onChange={elegirModulo} items={opciones.destinos.map((d) => ({ value: d.evaluacion_id, label: d.modulo }))} />
            </Bloque>
          )}
          {destino && (
            <Bloque titulo="Unit" nota={sugerida ? `Suggested from the exercise: ${sugerida}` : ''}>
              <Chips valor={unidad} onChange={setUnidad} items={destino.unidades.map((u) => ({ value: u.value ?? u, label: u.label ?? u }))} />
            </Bloque>
          )}
          <Bloque titulo="Skill it feeds" nota="Several activities in the same unit and skill: the simple average of the graded ones counts.">
            <Chips valor={habilidad} onChange={setHabilidad} items={HABILIDADES.map((h) => ({ value: h.id, label: h.label }))} />
          </Bloque>
          {esManual(ej.tipo) &&
            (rubricasElegibles.length === 0 ? (
              <p className="rounded-xl bg-peach-50 px-3 py-2 text-sm text-peach-700">There is no active {tipoDe(ej.tipo).label} rubric. Create it in Rubrics before assigning it as an official activity.</p>
            ) : rubricasElegibles.length === 1 ? (
              <p className="text-sm text-slate-600">
                Rubric: <strong className="text-slate-900">{rubricasElegibles[0].nombre}</strong>
              </p>
            ) : (
              <Bloque titulo={`${tipoDe(ej.tipo).label} rubric`} nota="You will grade submissions with this rubric.">
                <Chips valor={rubricaId} onChange={setRubricaId} items={rubricasElegibles.map((r) => ({ value: r.id, label: r.nombre }))} />
              </Bloque>
            ))}
        </div>
      )}
    </>
  )

  if (abierta && lista?.find((x) => x.id === abierta)?.examen_minutos) return <RevisionWritingAssessment asignacionId={abierta} servicio={servicio} onVolver={() => { setAbierta(null); recargar() }} />
  if (abierta) return <RevisionEjercicio asignacionId={abierta} servicio={servicio} onVolver={() => { setAbierta(null); recargar() }} />
  if (verFormative) return <FormativePropuesta salonId={salonId} servicio={servicio} onVolver={() => { setVerFormative(false); recargar() }} />

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-slate-500">Assign exercises from the bank as practice or as an official Formative activity, and review what your students submit.</p>
        <div className="flex flex-wrap gap-2">
          <Button variant="ghost" onClick={() => setVerFormative(true)}>
            Formative grades
          </Button>
          <Button onClick={() => setEligiendo(true)}>
            <Icon name="plus" className="h-4 w-4" /> Assign exercise
          </Button>
        </div>
      </div>
      {falla && !eligiendo && !elegido && !vinculando && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{falla}</p>}

      {cargando ? (
        <p className="py-10 text-center text-sm text-slate-500">Loading…</p>
      ) : error ? (
        <p className="text-sm text-red-600">Could not load the exercises: {error}</p>
      ) : lista.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-brand-200 bg-white px-6 py-12 text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-peach-100 text-peach-700">
            <Icon name="pen" className="h-7 w-7" />
          </span>
          <p className="mt-4 text-base font-semibold text-slate-900">There are no exercises in this classroom yet</p>
          <p className="mt-1 text-sm text-slate-500">Choose one from the bank and your students will see it in their “Exercises” tab.</p>
          <Button className="mt-5" onClick={() => setEligiendo(true)}>
            <Icon name="plus" className="h-4 w-4" /> Assign the first exercise
          </Button>
        </div>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {lista.map((a) => {
            const t = tipoDe(a.tipo)
            return (
              <Card key={a.id} className="flex items-center gap-4 p-4">
                <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${TONOS[t.tono]}`}>
                  <Icon name={t.icono} className="h-6 w-6" />
                </span>
                <button type="button" onClick={() => setAbierta(a.id)} className="min-w-0 flex-1 text-left">
                  <p className="truncate text-base font-semibold text-slate-900 hover:text-brand-700">{a.titulo}</p>
                  <p className="text-xs text-slate-500">
                    {t.label} · {a.entregas} of {a.total} submitted
                    {a.fecha_limite && ` · until ${formatFecha(a.fecha_limite)}`}
                    {a.promedio != null && ` · average ${fmtPuntaje(a.promedio)}`}
                  </p>
                  <p className={`text-xs font-medium ${a.formative || a.examen_minutos ? 'text-brand-700' : 'text-slate-400'}`}>{a.examen_minutos ? `Writing Assessment exam · ${a.examen_minutos} min` : etiquetaFormative(a.formative)}</p>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-brand-500" style={{ width: `${a.total ? Math.round((100 * a.entregas) / a.total) : 0}%` }} />
                  </div>
                </button>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  {a.pendientes > 0 && <Badge color="peach">{a.pendientes} to review</Badge>}
                  {a.examen_minutos ? null : a.formative ? (
                    <button type="button" onClick={() => volverAPractica(a)} className="text-xs text-slate-400 hover:text-rose-600">
                      Remove from Formative
                    </button>
                  ) : (
                    <button type="button" onClick={() => contarParaFormative(a)} className="text-xs font-medium text-brand-700 hover:underline">
                      Count toward Formative
                    </button>
                  )}
                  <button type="button" onClick={() => quitar(a)} className="rounded-md p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600" aria-label={`Remove ${a.titulo}`}>
                    <Icon name="trash" className="h-4 w-4" />
                  </button>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {eligiendo && !elegido && (
        <Modal title="Choose an exercise" subtitulo="Tap one to assign it to this classroom" onClose={cerrar} wide="xl">
          <BancoEjercicios esAdmin={esAdmin} userId={userId} servicio={servicio} onElegir={elegirEjercicio} />
        </Modal>
      )}

      {elegido && (
        <Modal title="Assign to this classroom" onClose={cerrar} wide>
          <div className="space-y-5">
            <ResumenEjercicio
              e={elegido}
              onCambiar={() => {
                setElegido(null)
                setOpcionesExamen(null)
                setEvaluacionId('')
                setFalla('')
              }}
            />

            {modo === 'examen' ? (
              <div className="space-y-4">
                <p className="flex items-start gap-2 rounded-xl bg-peach-50 px-3 py-2.5 text-sm text-peach-800">
                  <Icon name="clock" className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>Writing Assessment exam: one attempt, with a time limit. Leaving the page is recorded. You grade each task with the rubric and publish the grade from the Grade matrix.</span>
                </p>
                {!opcionesExamen && !falla && <p className="text-sm text-slate-500">Loading modules…</p>}
                {opcionesExamen && opcionesExamen.length === 0 && <p className="rounded-xl bg-peach-50 px-3 py-2 text-sm text-peach-700">This classroom has no module with a Writing by tasks (Task 1 and Task 2).</p>}
                {opcionesExamen && opcionesExamen.length > 0 && (
                  <Bloque titulo="Which module’s Writing does it feed?">
                    <Chips valor={evaluacionId} onChange={setEvaluacionId} items={opcionesExamen.map((x) => ({ value: x.evaluacion_id, label: x.asignado ? `${x.modulo} · already has an exam` : x.modulo, disabled: x.asignado }))} />
                  </Bloque>
                )}
                <Bloque titulo="Time limit">
                  <div className="flex items-center gap-2">
                    <input type="number" min="5" max="240" value={minutos} onChange={(e) => setMinutos(e.target.value)} aria-label="Time limit in minutes" className={`${inputClass} w-28!`} />
                    <span className="text-sm text-slate-500">minutes · the clock starts when each student begins</span>
                  </div>
                </Bloque>
              </div>
            ) : (
              <>
                <Bloque titulo="How will it count?">
                  <div role="radiogroup" className="grid gap-2 sm:grid-cols-2">
                    <Decision activa={modo === 'formative'} onClick={() => elegirModo('formative')} icono="check" titulo="Counts for the Formative" desc="Feeds a skill of a unit. Graded and published automatically." />
                    <Decision activa={modo === 'practica'} onClick={() => elegirModo('practica')} icono="pen" titulo="Practice only" desc="Students do it, but no official grade changes." />
                  </div>
                </Bloque>
                {camposFormative}
              </>
            )}

            {conFecha ? (
              <Bloque titulo="Due date" nota="Students can still submit later, but they will see the date.">
                <div className="flex items-center gap-3">
                  <input type="date" value={limite} onChange={(e) => setLimite(e.target.value)} aria-label="Due date" className={`${inputClass} w-auto!`} />
                  <button
                    type="button"
                    onClick={() => {
                      setConFecha(false)
                      setLimite('')
                    }}
                    className="text-xs text-slate-500 hover:text-rose-600"
                  >
                    Remove
                  </button>
                </div>
              </Bloque>
            ) : (
              <button type="button" onClick={() => setConFecha(true)} className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-700 hover:underline">
                <Icon name="plus" className="h-4 w-4" /> Add a due date
              </button>
            )}

            {falla && (
              <p role="alert" className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {falla}
              </p>
            )}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
              <p className="min-w-0 flex-1 text-xs text-slate-500">{resumenDestino}</p>
              <div className="flex gap-2">
                <Button variant="ghost" onClick={cerrar}>
                  Cancel
                </Button>
                <Button onClick={asignar} disabled={guardando}>
                  {guardando ? 'Assigning…' : 'Assign exercise'}
                </Button>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {vinculando && (
        <Modal title="Count toward Formative" onClose={cerrar} wide>
          <div className="space-y-5">
            <ResumenEjercicio e={vinculando} />
            <p className="text-sm text-slate-500">Submissions your students have already made count from now on and the unit grade updates automatically.</p>
            {camposFormative}
            {falla && (
              <p role="alert" className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {falla}
              </p>
            )}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
              <p className="min-w-0 flex-1 text-xs text-slate-500">{resumenDestino}</p>
              <div className="flex gap-2">
                <Button variant="ghost" onClick={cerrar}>
                  Cancel
                </Button>
                <Button onClick={vincular} disabled={guardando}>
                  {guardando ? 'Saving…' : 'Count toward Formative'}
                </Button>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </>
  )
}
