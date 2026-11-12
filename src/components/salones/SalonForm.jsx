import { useEffect, useState } from 'react'
import Button from '../ui/Button'
import Field from '../ui/Field'
import Modal from '../ui/Modal'
import DocenteForm from '../docentes/DocenteForm'
import ConfiguracionAcademica from './ConfiguracionAcademica'
import HorariosEditor from './HorariosEditor'
import ResumenSalon from './ResumenSalon'
import { validarHorariosSalon } from '../../services/catalogo'
import { disponibilidadDocentes } from '../../services/registros'
import { choquesHorarioSalon } from '../../services/salones'
import { aConjunto, cubreHorarios } from '../../lib/disponibilidad'
import { estados, salonVacio } from '../../lib/salones'
import { resumenSalon } from '../../lib/resumenSalon'

function Bloque({ numero, titulo, subtitulo, children }) {
  return (
    <section className="border-t border-slate-100 pt-6 first:border-0 first:pt-0">
      <header className="mb-4 flex items-start gap-3">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-700">{numero}</span>
        <div>
          <h3 className="text-base font-semibold leading-6 text-slate-900">{titulo}</h3>
          {subtitulo && <p className="text-xs text-slate-500">{subtitulo}</p>}
        </div>
      </header>
      {children}
    </section>
  )
}

const grid = 'grid gap-4 sm:grid-cols-2'

// Crea o edita un salón. `salon` null = crear. El código lo genera Supabase al crear y es de solo lectura al editar.
// Bloques: 1 Datos básicos · 2 Configuración académica · 3 Programación de clases · 4 Información adicional · 5 Resumen.
export default function SalonForm({ salon, niveles, docentes, catalogo, onSave, onCrearDocente, onClose }) {
  const [values, setValues] = useState({ ...salonVacio, ...salon })
  const [usaPlan, setUsaPlan] = useState(Boolean(salon?.planId))
  const [usaFrecuencia, setUsaFrecuencia] = useState(Boolean(salon?.frecuenciaId))
  const [avisosPlan, setAvisosPlan] = useState([])
  const [errors, setErrors] = useState({})
  const [errorGeneral, setErrorGeneral] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [nuevoDocente, setNuevoDocente] = useState(false)
  // Con sesiones registradas, la fecha de fin la calcula el calendario y la de inicio ya no se puede mover.
  const tieneCalendario = (salon?.progreso?.sesiones ?? 0) > 0

  const cambiar = (e) => setValues({ ...values, [e.target.name]: e.target.value })
  const nivel = niveles.find((n) => n.id === values.nivelId)
  // Al cambiar el nivel se descarta un plan que pertenezca a otro nivel (los planes dependen del nivel elegido).
  const cambiarNivel = (e) => {
    const nivelId = e.target.value
    const codigoNuevo = niveles.find((n) => n.id === nivelId)?.codigo
    const planActual = catalogo.planes.find((p) => p.id === values.planId)
    const quitarPlan = (planActual && planActual.nivelCodigo !== codigoNuevo) || (!planActual && values.modalidad)
    setValues((v) => ({ ...v, nivelId, ...(quitarPlan ? { planId: '', modalidad: '', nivel: '', horario: '', tipo: '', cicloDesde: '', cicloHasta: '' } : {}) }))
  }
  const parchear = (parche) => setValues((v) => ({ ...v, ...parche }))

  // Avisos de horario según el plan y la frecuencia: los calcula la base de datos (solo lectura), no el frontend.
  const horariosCompletos = values.horarios.length > 0 && values.horarios.every((h) => h.horaInicio && h.horaFin && h.horaFin > h.horaInicio)
  const consultaAvisos = Boolean(values.planId || values.frecuenciaId) && horariosCompletos
  useEffect(() => {
    if (!consultaAvisos) return undefined
    let vigente = true
    const t = setTimeout(() => {
      validarHorariosSalon(values.planId, values.frecuenciaId, values.horarios)
        .then((a) => vigente && setAvisosPlan(a))
        .catch(() => vigente && setAvisosPlan([]))
    }, 300)
    return () => {
      vigente = false
      clearTimeout(t)
    }
  }, [consultaAvisos, values.planId, values.frecuenciaId, values.horarios])
  const avisos = consultaAvisos ? avisosPlan : []
  const resumen = resumenSalon({ values, catalogo, nivelNombre: nivel?.nombre ?? '', avisos, usaPlan, usaFrecuencia, tieneCalendario })

  // Disponibilidad que marcó cada docente: sirve para sugerir quién puede dar el horario elegido (si no se puede leer, el selector funciona igual).
  const [dispDocentes, setDispDocentes] = useState(null) // Map docenteId -> Set de franjas
  useEffect(() => {
    let vigente = true
    disponibilidadDocentes()
      .then((filas) => {
        if (!vigente) return
        const porDocente = new Map()
        for (const f of filas) porDocente.set(f.docente_id, [...(porDocente.get(f.docente_id) ?? []), f])
        setDispDocentes(new Map([...porDocente].map(([id, fs]) => [id, aConjunto(fs)])))
      })
      .catch(() => vigente && setDispDocentes(null))
    return () => {
      vigente = false
    }
  }, [])

  // Docentes ya ocupados en ese horario y rango de fechas (otros salones o clases particulares), calculado en la base de datos.
  const [choques, setChoques] = useState(new Map()) // Map docenteId -> ["Salón X (Lun 18:00–20:00)", ...]
  const horariosValidos = values.horarios.filter((h) => h.horaInicio && h.horaFin && h.horaFin > h.horaInicio)
  const consultaChoques = horariosValidos.length > 0 && Boolean(values.fechaInicio)
  useEffect(() => {
    if (!consultaChoques) return undefined
    let vigente = true
    const t = setTimeout(() => {
      choquesHorarioSalon(horariosValidos, values.fechaInicio, tieneCalendario ? values.fechaFin : '', salon?.id, resumen.sesiones)
        .then((m) => vigente && setChoques(m))
        .catch(() => vigente && setChoques(new Map()))
    }, 300)
    return () => {
      vigente = false
      clearTimeout(t)
    }
    // horariosValidos se recalcula en cada render; basta depender de los valores que lo definen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [consultaChoques, values.horarios, values.fechaInicio, values.fechaFin, salon?.id, resumen.sesiones, tieneCalendario])
  const choquesDocente = (id) => (consultaChoques && values.estado !== 'finalizado' ? choques.get(id) ?? [] : [])

  // Docentes activos; si el salón ya tiene uno inactivo asignado, se conserva en la lista.
  // Con horarios completos y disponibilidades cargadas, primero van los docentes libres en TODO ese horario.
  const horariosParaDocente = values.horarios.filter((h) => h.horaInicio && h.horaFin && h.horaFin > h.horaInicio)
  const sugerir = dispDocentes !== null && horariosParaDocente.length > 0 && horariosParaDocente.length === values.horarios.length
  const estadoDocente = (d) => {
    if (choquesDocente(d.id).length) return 'choque'
    if (!sugerir) return null
    const franjas = dispDocentes.get(d.id)
    if (!franjas) return 'sin_datos'
    return cubreHorarios(franjas, horariosParaDocente) ? 'libre' : 'ocupado'
  }
  const etiquetaDocente = { choque: '⛔ busy in another classroom', libre: '✓ available at this time', ocupado: 'not available at this time', sin_datos: 'no availability on record' }
  const orden = { libre: 0, sin_datos: 1, ocupado: 2, choque: 3 }
  const lista = docentes.filter((d) => d.activo || d.id === values.docenteId).map((d) => ({ d, e: estadoDocente(d) }))
  if (sugerir || lista.some((x) => x.e === 'choque')) lista.sort((a, b) => (orden[a.e] ?? 1) - (orden[b.e] ?? 1) || a.d.nombre.localeCompare(b.d.nombre))
  const nLibres = lista.filter((x) => x.e === 'libre').length
  const opcionesDocente = [{ value: '', label: 'Unassigned' }, ...lista.map(({ d, e }) => ({ value: d.id, label: e === 'choque' ? `${d.nombre} · ⛔ busy: ${choquesDocente(d.id)[0]}${choquesDocente(d.id).length > 1 ? ` and ${choquesDocente(d.id).length - 1} more` : ''}` : e ? `${d.nombre} · ${etiquetaDocente[e]}` : d.nombre }))]
  const ayudaDocente = sugerir
    ? nLibres > 0
      ? `${nLibres} ${nLibres === 1 ? 'teacher is available' : 'teachers are available'} at this time.`
      : 'No teacher has marked availability for this time.'
    : 'Choose the classroom schedule first to see which teachers are available.'
  const opcionesNivel = [{ value: '', label: 'Select a level' }, ...niveles.map((n) => ({ value: n.id, label: n.nombre }))]

  const validar = () => {
    const e = {}
    if (values.horarios.some((h) => h.horaFin <= h.horaInicio)) e.horarios = 'The end time must be after the start time'
    if (values.docenteId && choquesDocente(values.docenteId).length)
      e.docente = `The teacher is already busy at that time: ${choquesDocente(values.docenteId).join(', ')}`
    if (!values.nivelId) e.nivel = 'Select the academic level'
    if (usaPlan && !values.planId) e.plan = 'Complete the academic plan or turn it off.'
    if (usaFrecuencia && !values.frecuenciaId) e.frecuencia = 'Choose a frequency or turn it off.'
    if (avisos.some((a) => a.severidad === 'error')) e.horarios = 'Fix the schedule so it matches the frequency or plan'
    if (tieneCalendario && values.totalSesiones === '') e.totalSesiones = 'Cannot be removed: the classroom already has sessions'
    else if (values.totalSesiones !== '' && salon?.progreso && Number(values.totalSesiones) < salon.progreso.realizadas)
      e.totalSesiones = `Cannot be less than the sessions already held (${salon.progreso.realizadas})`
    return e
  }

  const guardar = async (ev) => {
    ev.preventDefault()
    const e = validar()
    setErrors(e)
    if (Object.keys(e).length) return

    setGuardando(true)
    setErrorGeneral('')
    try {
      await onSave({
        ...values,
        capacidad: Number(values.capacidad),
        totalSesiones: values.totalSesiones === '' ? '' : Number(values.totalSesiones),
      })
    } catch (err) {
      setErrorGeneral(err.message)
      setGuardando(false)
    }
  }

  const registrarDocente = async (datos) => {
    const creado = await onCrearDocente(datos)
    setValues((v) => ({ ...v, docenteId: creado.id }))
    setNuevoDocente(false)
  }

  return (
    <>
      <Modal wide="xl" title={salon ? 'Edit classroom' : 'New classroom'} onClose={onClose}>
        <form onSubmit={guardar}>
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_17rem]">
            <div className="space-y-6">
              <Bloque numero="1" titulo="Basic details" subtitulo="How the classroom is identified and who teaches it.">
                <div className={grid}>
                  {salon && <Field label="Code" name="codigo" value={values.codigo} disabled readOnly hint="Assigned automatically." />}
                  <Field label="Name" name="nombre" value={values.nombre} onChange={cambiar} required />
                  <Field
                    label="Academic level"
                    name="nivelId"
                    value={values.nivelId}
                    onChange={cambiarNivel}
                    options={opcionesNivel}
                    error={errors.nivel}
                    hint={salon && !salon.nivelId ? 'This classroom has no level yet: choose one to save.' : 'Classifies the classroom and filters the Dashboard.'}
                    required
                  />
                  <div>
                    <Field label="Teacher" name="docenteId" value={values.docenteId} onChange={cambiar} options={opcionesDocente} error={errors.docente} hint={dispDocentes !== null ? ayudaDocente : undefined} />
                    <Button type="button" variant="ghost" className="mt-1 px-2 py-1" onClick={() => setNuevoDocente(true)}>
                      + New teacher
                    </Button>
                  </div>
                  <Field label="Classroom status" name="estado" value={values.estado} onChange={cambiar} options={estados} />
                </div>
              </Bloque>

              <Bloque numero="2" titulo="Academic setup" subtitulo="Optional. You can use a plan, a frequency, both or neither.">
                <ConfiguracionAcademica
                  catalogo={catalogo}
                  nivelCodigo={nivel?.codigo ?? ''}
                  values={values}
                  onChange={parchear}
                  tieneCalendario={tieneCalendario}
                  usaPlan={usaPlan}
                  setUsaPlan={setUsaPlan}
                  usaFrecuencia={usaFrecuencia}
                  setUsaFrecuencia={setUsaFrecuencia}
                  errorPlan={errors.plan}
                  errorFrecuencia={errors.frecuencia}
                />
              </Bloque>

              <Bloque numero="3" titulo="Class schedule" subtitulo="When classes take place.">
                <div className="space-y-4">
                  {resumen.clasesTexto && (
                    <p className="rounded-lg bg-brand-50 px-3 py-2 text-sm text-slate-700">
                      This classroom needs <strong className="font-semibold text-slate-900">{resumen.clasesTexto}</strong> per week.
                    </p>
                  )}
                  <HorariosEditor horarios={values.horarios} onChange={(horarios) => parchear({ horarios })} error={errors.horarios} />
                  {avisos.map((a, i) => (
                    <p key={i} className={`text-sm ${a.severidad === 'error' ? 'text-red-600' : 'text-peach-700'}`}>
                      {a.severidad === 'error' ? 'Schedule: ' : 'Notice: '}
                      {a.mensaje}
                    </p>
                  ))}
                  {tieneCalendario && (
                    <p className="text-xs text-slate-500">
                      Changing the schedule only regenerates future regular sessions. Held, cancelled, past and date-pinned sessions
                      are kept.
                    </p>
                  )}
                  <div className={grid}>
                    <Field
                      label="Start date"
                      name="fechaInicio"
                      type="date"
                      value={values.fechaInicio}
                      onChange={cambiar}
                      disabled={tieneCalendario}
                      hint={tieneCalendario ? 'Cannot be changed once sessions exist' : undefined}
                      required
                    />
                    <Field
                      label="Estimated end date"
                      name="fechaFin"
                      type="date"
                      value={values.fechaFin}
                      disabled
                      readOnly
                      hint="Calculated automatically from the start date, schedule and total sessions; adjusted for rescheduling and cancellations."
                    />
                    {/* Con plan y sin calendario el total lo fija el plan; en los demás casos es editable. */}
                    {(!values.planId || tieneCalendario) && (
                      <Field
                        label="Total sessions"
                        name="totalSesiones"
                        type="number"
                        min="1"
                        step="1"
                        value={values.totalSesiones}
                        onChange={cambiar}
                        error={errors.totalSesiones}
                        hint="Number of classes (not hours). Enables the calendar."
                      />
                    )}
                  </div>
                </div>
              </Bloque>

              <Bloque numero="4" titulo="Additional information">
                <div className={grid}>
                  <Field label="Maximum capacity" name="capacidad" type="number" min="1" step="1" value={values.capacidad} onChange={cambiar} required />
                  <Field label="Notes" name="observaciones" as="textarea" rows="2" value={values.observaciones} onChange={cambiar} className="sm:col-span-2" />
                </div>
              </Bloque>
            </div>

            <div>
              <div className="lg:sticky lg:top-4">
                <h3 className="mb-3 flex items-center gap-3 text-base font-semibold leading-6 text-slate-900">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-700">5</span>
                  Summary
                </h3>
                <ResumenSalon datos={resumen} />
              </div>
            </div>
          </div>

          {errorGeneral && <p className="mt-4 text-sm text-red-600">{errorGeneral}</p>}

          <div className="mt-6 flex justify-end gap-2 border-t border-slate-100 pt-4">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={guardando}>
              {guardando ? 'Saving…' : salon ? 'Save changes' : 'Create classroom'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Fuera del <form> del salón para no anidar formularios */}
      {nuevoDocente && <DocenteForm onSave={registrarDocente} onClose={() => setNuevoDocente(false)} />}
    </>
  )
}
