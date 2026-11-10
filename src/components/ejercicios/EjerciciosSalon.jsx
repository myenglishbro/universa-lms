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
    if (!window.confirm(`«${a.titulo}» dejará de contar para el Formative. Las notas de la unidad se recalculan sin esta actividad.`)) return
    try {
      await servicio.desvincularFormative(a.id)
      await recargar()
    } catch (e) {
      setFalla(e.message)
    }
  }
  const validarDestino = () => {
    if (!evaluacionId) return 'Elige el módulo del Formative'
    if (!unidad) return 'Elige la unidad del Formative'
    if (!habilidad) return 'Elige la habilidad que alimenta esta actividad'
    if (esManual(ej.tipo) && !rubricaId) return `Elige la rúbrica de ${tipoDe(ej.tipo).label}`
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
    if (!window.confirm(`¿Quitar «${a.titulo}» de este salón? Las entregas dejarán de verse.`)) return
    try {
      await servicio.quitarAsignacion(a.id)
      await recargar()
    } catch (e) {
      setFalla(e.message)
    }
  }

  const camposFormative = (
    <>
        {modo === 'formative' && !opciones && !falla && <p className="text-sm text-slate-500">Cargando módulos…</p>}
        {modo === 'formative' && opciones && opciones.destinos.length === 0 && (
          <p className="rounded-xl bg-peach-50 px-3 py-2 text-sm text-peach-700">Este salón aún no tiene módulos con Formative.</p>
        )}
        {modo === 'formative' && opciones && opciones.destinos.length > 0 && (
          <div className="space-y-3">
            <Field
              label="Módulo"
              value={evaluacionId}
              onChange={(e) => {
                setEvaluacionId(e.target.value)
                setUnidad('')
              }}
              options={[{ value: '', label: 'Elige el módulo…' }, ...opciones.destinos.map((d) => ({ value: d.evaluacion_id, label: d.modulo }))]}
            />
            {destino && <Field label="Unidad" value={unidad} onChange={(e) => setUnidad(e.target.value)} options={[{ value: '', label: 'Elige la unidad…' }, ...destino.unidades]} />}
            <Field
              label="Habilidad que alimenta"
              value={habilidad}
              onChange={(e) => setHabilidad(e.target.value)}
              options={[{ value: '', label: 'Elige la habilidad…' }, ...HABILIDADES.map((h) => ({ value: h.id, label: h.label }))]}
              hint="Si hay varias actividades en la misma unidad y habilidad, cuenta el promedio simple de las calificadas."
            />
            {esManual(ej.tipo) &&
              (rubricasElegibles.length === 0 ? (
                <p className="rounded-xl bg-peach-50 px-3 py-2 text-sm text-peach-700">No hay una rúbrica activa de {tipoDe(ej.tipo).label}. Créala en Rúbricas antes de asignarlo como actividad oficial.</p>
              ) : (
                <Field
                  label={`Rúbrica de ${tipoDe(ej.tipo).label}`}
                  value={rubricaId}
                  onChange={(e) => setRubricaId(e.target.value)}
                  options={[{ value: '', label: 'Elige la rúbrica…' }, ...rubricasElegibles.map((r) => ({ value: r.id, label: r.nombre }))]}
                  hint="Con esta rúbrica calificarás las entregas. Cada criterio va de 0 a su máximo."
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
            Calificaciones Formative
          </Button>
          <Button onClick={() => setEligiendo(true)}>
            <Icon name="plus" className="h-4 w-4" /> Asignar ejercicio
          </Button>
        </div>
      </div>
      {falla && !eligiendo && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{falla}</p>}

      {cargando ? (
        <p className="py-10 text-center text-sm text-slate-500">Cargando…</p>
      ) : error ? (
        <p className="text-sm text-red-600">No se pudieron cargar los ejercicios: {error}</p>
      ) : lista.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-brand-200 bg-white px-6 py-12 text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-peach-100 text-peach-700">
            <Icon name="pen" className="h-7 w-7" />
          </span>
          <p className="mt-4 text-base font-semibold text-slate-900">Todavía no hay ejercicios en este salón</p>
          <p className="mt-1 text-sm text-slate-500">Elige uno del banco y tus estudiantes lo verán en su pestaña «Ejercicios».</p>
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
                    {a.fecha_limite && ` · hasta ${formatFecha(a.fecha_limite)}`}
                    {a.promedio != null && ` · promedio ${fmtPuntaje(a.promedio)}`}
                  </p>
                  <p className={`text-xs font-medium ${a.formative ? 'text-brand-700' : 'text-slate-400'}`}>{etiquetaFormative(a.formative)}</p>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-brand-500" style={{ width: `${a.total ? Math.round((100 * a.entregas) / a.total) : 0}%` }} />
                  </div>
                </button>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  {a.pendientes > 0 && <Badge color="peach">{a.pendientes} por revisar</Badge>}
                  {a.formative ? (
                    <button type="button" onClick={() => volverAPractica(a)} className="text-xs text-slate-400 hover:text-rose-600">
                      Quitar del Formative
                    </button>
                  ) : (
                    <button type="button" onClick={() => contarParaFormative(a)} className="text-xs font-medium text-brand-700 hover:underline">
                      Contar para el Formative
                    </button>
                  )}
                  <button type="button" onClick={() => quitar(a)} className="rounded-md p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600" aria-label={`Quitar ${a.titulo}`}>
                    <Icon name="trash" className="h-4 w-4" />
                  </button>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {eligiendo && !elegido && (
        <Modal title="Elige un ejercicio" onClose={cerrar} wide="xl">
          <BancoEjercicios esAdmin={esAdmin} userId={userId} servicio={servicio} onElegir={elegirEjercicio} />
        </Modal>
      )}
      {elegido && (
        <Modal title="Asignar a este salón" onClose={cerrar}>
          <div className="space-y-4">
            <p className="rounded-xl bg-brand-50 px-4 py-3 text-sm text-brand-800">
              <strong>{elegido.titulo}</strong>
              <span className="block text-xs text-brand-700">{tipoDe(elegido.tipo).label}</span>
            </p>
            <Field label="Fecha límite (opcional)" type="date" value={limite} onChange={(e) => setLimite(e.target.value)} hint="Los estudiantes pueden enviarlo después, pero verán la fecha." />
            <fieldset className="space-y-2">
              <legend className="mb-1 text-sm font-medium text-slate-700">¿Cómo se usa este ejercicio?</legend>
              <label className="flex cursor-pointer items-start gap-2 rounded-xl border border-slate-200 p-3 text-sm has-[:checked]:border-brand-500 has-[:checked]:bg-brand-50">
                <input type="radio" name="modo" checked={modo === 'practica'} onChange={() => elegirModo('practica')} className="mt-0.5" />
                <span>
                  <strong className="block text-slate-900">Práctica</strong>
                  <span className="text-xs text-slate-500">No afecta ninguna nota oficial.</span>
                </span>
              </label>
              <label className="flex cursor-pointer items-start gap-2 rounded-xl border border-slate-200 p-3 text-sm has-[:checked]:border-brand-500 has-[:checked]:bg-brand-50">
                <input type="radio" name="modo" checked={modo === 'formative'} onChange={() => elegirModo('formative')} className="mt-0.5" />
                <span>
                  <strong className="block text-slate-900">Actividad oficial del Formative</strong>
                  <span className="text-xs text-slate-500">Alimenta una habilidad de una unidad. La nota se calcula y se publica sola cuando el estudiante entrega y completa sus 5 elementos.</span>
                </span>
              </label>
            </fieldset>
            {camposFormative}
            {falla && <p role="alert" className="text-sm text-rose-700">{falla}</p>}
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setElegido(null)}>
                Atrás
              </Button>
              <Button onClick={asignar} disabled={guardando}>
                {guardando ? 'Asignando…' : 'Asignar'}
              </Button>
            </div>
          </div>
        </Modal>
      )}
      {vinculando && (
        <Modal title="Contar para el Formative" onClose={cerrar}>
          <div className="space-y-4">
            <p className="rounded-xl bg-brand-50 px-4 py-3 text-sm text-brand-800">
              <strong>{vinculando.titulo}</strong>
              <span className="block text-xs text-brand-700">{tipoDe(vinculando.tipo).label}</span>
            </p>
            <p className="text-sm text-slate-500">Las entregas que tus estudiantes ya hicieron cuentan desde ahora y la nota de la unidad se actualiza sola.</p>
            {camposFormative}
            {falla && <p role="alert" className="text-sm text-rose-700">{falla}</p>}
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={cerrar}>
                Cancelar
              </Button>
              <Button onClick={vincular} disabled={guardando}>
                {guardando ? 'Guardando…' : 'Contar para el Formative'}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </>
  )
}
