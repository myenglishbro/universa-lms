import { useCallback, useState } from 'react'
import Badge from '../ui/Badge'
import Button from '../ui/Button'
import Card from '../ui/Card'
import Field from '../ui/Field'
import Icon from '../ui/Icon'
import Modal from '../ui/Modal'
import BancoEjercicios from './BancoEjercicios'
import RevisionEjercicio from './RevisionEjercicio'
import FormativePropuesta from './FormativePropuesta'
import useCarga from '../../hooks/useCarga'
import { TONOS, esManual, fmtPuntaje, tipoDe } from '../../lib/ejercicios'
import { HABILIDADES, etiquetaFormative, habilidadSugerida, rubricaPorDefecto, rubricasDelTipo } from '../../lib/formativeBanco'
import { formatFecha } from '../../lib/salones'
import * as servicioReal from '../../services/ejercicios'

// Pestaña «Ejercicios» de un salón (docente o administración): lo asignado, quién entregó y qué falta revisar.
export default function EjerciciosSalon({ salonId, esAdmin = false, userId, servicio = servicioReal }) {
  const cargar = useCallback(() => servicio.ejerciciosDelSalon(salonId), [servicio, salonId])
  const { datos: lista, cargando, error, recargar } = useCarga(cargar, [])
  const [eligiendo, setEligiendo] = useState(false)
  const [elegido, setElegido] = useState(null)
  const [limite, setLimite] = useState('')
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

  const cerrar = () => {
    setEligiendo(false)
    setElegido(null)
    setLimite('')
    setFalla('')
    setModo('formative')
    setVinculando(null)
    setOpciones(null)
    setEvaluacionId('')
    setUnidad('')
    setHabilidad('')
    setRubricaId('')
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
      if (o.destinos.length === 1) setEvaluacionId(o.destinos[0].evaluacion_id)
      if (ejercicio && esManual(ejercicio.tipo)) setRubricaId(rubricaPorDefecto(o.rubricas, ejercicio.tipo))
    } catch (e) {
      setFalla(e.message)
    }
  }
  // Por defecto un ejercicio nuevo cuenta para el Formative; «Práctica» es la excepción.
  const elegirEjercicio = (e) => {
    setElegido(e)
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
  const asignar = async () => {
    setFalla('')
    if (modo === 'formative') {
      const v = validarDestino()
      if (v) return setFalla(v)
    }
    setGuardando(true)
    try {
      if (modo === 'formative') {
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

  const camposFormative = (
    <>
        {modo === 'formative' && !opciones && !falla && <p className="text-sm text-slate-500">Loading modules…</p>}
        {modo === 'formative' && opciones && opciones.destinos.length === 0 && (
          <p className="rounded-xl bg-peach-50 px-3 py-2 text-sm text-peach-700">This classroom has no modules with a Formative yet.</p>
        )}
        {modo === 'formative' && opciones && opciones.destinos.length > 0 && (
          <div className="space-y-3">
            <Field
              label="Module"
              value={evaluacionId}
              onChange={(e) => {
                setEvaluacionId(e.target.value)
                setUnidad('')
              }}
              options={[{ value: '', label: 'Elige el módulo…' }, ...opciones.destinos.map((d) => ({ value: d.evaluacion_id, label: d.modulo }))]}
            />
            {destino && <Field label="Unit" value={unidad} onChange={(e) => setUnidad(e.target.value)} options={[{ value: '', label: 'Choose the unit…' }, ...destino.unidades]} />}
            <Field
              label="Skill it feeds"
              value={habilidad}
              onChange={(e) => setHabilidad(e.target.value)}
              options={[{ value: '', label: 'Elige la habilidad…' }, ...HABILIDADES.map((h) => ({ value: h.id, label: h.label }))]}
              hint="If there are several activities in the same unit and skill, the simple average of the graded ones counts."
            />
            {esManual(ej.tipo) &&
              (rubricasElegibles.length === 0 ? (
                <p className="rounded-xl bg-peach-50 px-3 py-2 text-sm text-peach-700">There is no active {tipoDe(ej.tipo).label} rubric. Create it in Rubrics before assigning it as an official activity.</p>
              ) : (
                <Field
                  label={`${tipoDe(ej.tipo).label} rubric`}
                  value={rubricaId}
                  onChange={(e) => setRubricaId(e.target.value)}
                  options={[{ value: '', label: 'Elige la rúbrica…' }, ...rubricasElegibles.map((r) => ({ value: r.id, label: r.nombre }))]}
                  hint="You will grade submissions with this rubric. Each criterion goes from 0 to its maximum."
                />
              ))}
          </div>
        )}
    </>
  )

  if (abierta) return <RevisionEjercicio asignacionId={abierta} servicio={servicio} onVolver={() => { setAbierta(null); recargar() }} />
  if (verFormative) return <FormativePropuesta salonId={salonId} servicio={servicio} onVolver={() => { setVerFormative(false); recargar() }} />

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-slate-500">Asigna ejercicios del banco (o los tuyos) como práctica o como actividad oficial del Formative, y revisa lo que entregan tus estudiantes.</p>
        <div className="flex flex-wrap gap-2">
          <Button variant="ghost" onClick={() => setVerFormative(true)}>
            Formative grades
          </Button>
          <Button onClick={() => setEligiendo(true)}>
            <Icon name="plus" className="h-4 w-4" /> Assign exercise
          </Button>
        </div>
      </div>
      {falla && !eligiendo && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{falla}</p>}

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
                    {t.label} · {a.entregas} de {a.total} entregaron
                    {a.fecha_limite && ` · until ${formatFecha(a.fecha_limite)}`}
                    {a.promedio != null && ` · average ${fmtPuntaje(a.promedio)}`}
                  </p>
                  <p className={`text-xs font-medium ${a.formative ? 'text-brand-700' : 'text-slate-400'}`}>{etiquetaFormative(a.formative)}</p>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-brand-500" style={{ width: `${a.total ? Math.round((100 * a.entregas) / a.total) : 0}%` }} />
                  </div>
                </button>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  {a.pendientes > 0 && <Badge color="peach">{a.pendientes} to review</Badge>}
                  {a.formative ? (
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
        <Modal title="Choose an exercise" onClose={cerrar} wide="xl">
          <BancoEjercicios esAdmin={esAdmin} userId={userId} servicio={servicio} onElegir={elegirEjercicio} />
        </Modal>
      )}
      {elegido && (
        <Modal title="Assign to this classroom" onClose={cerrar}>
          <div className="space-y-4">
            <p className="rounded-xl bg-brand-50 px-4 py-3 text-sm text-brand-800">
              <strong>{elegido.titulo}</strong>
              <span className="block text-xs text-brand-700">{tipoDe(elegido.tipo).label}</span>
            </p>
            <Field label="Due date (optional)" type="date" value={limite} onChange={(e) => setLimite(e.target.value)} hint="Students can submit it later, but they will see the date." />
            <fieldset className="space-y-2">
              <legend className="mb-1 text-sm font-medium text-slate-700">How is this exercise used?</legend>
              <label className="flex cursor-pointer items-start gap-2 rounded-xl border border-slate-200 p-3 text-sm has-[:checked]:border-brand-500 has-[:checked]:bg-brand-50">
                <input type="radio" name="modo" checked={modo === 'practica'} onChange={() => elegirModo('practica')} className="mt-0.5" />
                <span>
                  <strong className="block text-slate-900">Practice</strong>
                  <span className="text-xs text-slate-500">It does not affect any official grade.</span>
                </span>
              </label>
              <label className="flex cursor-pointer items-start gap-2 rounded-xl border border-slate-200 p-3 text-sm has-[:checked]:border-brand-500 has-[:checked]:bg-brand-50">
                <input type="radio" name="modo" checked={modo === 'formative'} onChange={() => elegirModo('formative')} className="mt-0.5" />
                <span>
                  <strong className="block text-slate-900">Official Formative activity</strong>
                  <span className="text-xs text-slate-500">It feeds a skill of a unit. The grade is calculated and published automatically when the student submits and completes their 5 elements.</span>
                </span>
              </label>
            </fieldset>
            {camposFormative}
            {falla && <p role="alert" className="text-sm text-rose-700">{falla}</p>}
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setElegido(null)}>
                Back
              </Button>
              <Button onClick={asignar} disabled={guardando}>
                {guardando ? 'Asignando…' : 'Asignar'}
              </Button>
            </div>
          </div>
        </Modal>
      )}
      {vinculando && (
        <Modal title="Count toward Formative" onClose={cerrar}>
          <div className="space-y-4">
            <p className="rounded-xl bg-brand-50 px-4 py-3 text-sm text-brand-800">
              <strong>{vinculando.titulo}</strong>
              <span className="block text-xs text-brand-700">{tipoDe(vinculando.tipo).label}</span>
            </p>
            <p className="text-sm text-slate-500">Submissions your students have already made count from now on and the unit grade updates automatically.</p>
            {camposFormative}
            {falla && <p role="alert" className="text-sm text-rose-700">{falla}</p>}
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={cerrar}>
                Cancel
              </Button>
              <Button onClick={vincular} disabled={guardando}>
                {guardando ? 'Saving…' : 'Count toward Formative'}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </>
  )
}
