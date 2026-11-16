import { useState } from 'react'
import Button from '../ui/Button'
import Field from '../ui/Field'
import Modal from '../ui/Modal'
import { minutosTexto } from '../../lib/paquetes'
import AlumnoForm from './AlumnoForm'
import ConfiguracionAcademica from '../salones/ConfiguracionAcademica'
import HorariosEditor from '../salones/HorariosEditor'

const rapidas = [10, 20, 30]

function Titulo({ n, titulo, subtitulo }) {
  return (
    <header className="flex items-start gap-3">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-700">{n}</span>
      <div>
        <h3 className="text-base font-semibold leading-6 text-slate-900">{titulo}</h3>
        {subtitulo && <p className="text-xs text-slate-500">{subtitulo}</p>}
      </div>
    </header>
  )
}

// Nuevo paquete (crea además su salón individual: nivel, plan/frecuencia, horario y fecha de inicio como en un salón grupal),
// renovación o compra adicional (con `origen`: mismo alumno, docente, nivel y salón).
export default function PaqueteForm({ origen, alumnos, docentes, niveles, catalogo, onSave, onCrearAlumno, onClose }) {
  const [v, setV] = useState({
    alumnoId: origen?.alumno_id ?? '',
    horas: '',
    docenteId: origen?.docente_id ?? '',
    nivelId: origen?.nivel_id ?? '',
    vigenciaHasta: '',
    notas: '',
    nombreSalon: '',
    fechaInicio: '',
    totalSesiones: '',
    planId: '',
    frecuenciaId: '',
    cicloDesde: '',
    cicloHasta: '',
    modalidad: '',
    horarios: [],
  })
  const [usaPlan, setUsaPlan] = useState(false)
  const [usaFrecuencia, setUsaFrecuencia] = useState(false)
  const [nuevoAlumno, setNuevoAlumno] = useState(false)
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)
  const cambiar = (e) => setV({ ...v, [e.target.name]: e.target.value })
  const parchear = (parche) => setV((x) => ({ ...x, ...parche }))
  const conSalon = !origen
  const nivel = niveles.find((n) => n.id === v.nivelId)
  // Un plan pertenece a un nivel: al cambiar de nivel se descarta el plan elegido.
  const cambiarNivel = (e) => {
    const nivelId = e.target.value
    const codigo = niveles.find((n) => n.id === nivelId)?.codigo
    const plan = catalogo?.planes.find((p) => p.id === v.planId)
    const quitar = (plan && plan.nivelCodigo !== codigo) || (!plan && v.modalidad)
    setV((x) => ({ ...x, nivelId, ...(quitar ? { planId: '', modalidad: '', nivel: '', horario: '', tipo: '', cicloDesde: '', cicloHasta: '' } : {}) }))
    if (quitar) setUsaPlan(false)
  }

  const enviar = async (e) => {
    e.preventDefault()
    if (!v.alumnoId) return setError('Select a student')
    if (!(Number(v.horas) > 0)) return setError('Enter the package hours')
    if (conSalon) {
      if (!v.nivelId) return setError('Select the academic level')
      if (!v.fechaInicio) return setError('Enter the start date')
      if (v.horarios.length === 0) return setError('Add at least one class day and time')
      if (v.horarios.some((h) => !h.horaInicio || !h.horaFin || h.horaFin <= h.horaInicio)) return setError('The end time must be after the start time')
      if (usaPlan && !v.planId) return setError('Complete the academic plan or turn it off')
      if (usaFrecuencia && !v.frecuenciaId) return setError('Choose a frequency or turn it off')
    }
    setGuardando(true)
    setError('')
    try {
      await onSave({
        ...v,
        horas: Number(v.horas),
        origenId: origen?.id ?? '',
        salon: conSalon
          ? {
              nombre: v.nombreSalon,
              fechaInicio: v.fechaInicio,
              totalSesiones: v.totalSesiones === '' ? '' : Number(v.totalSesiones),
              planId: v.planId,
              frecuenciaId: v.frecuenciaId,
              cicloDesde: v.cicloDesde,
              cicloHasta: v.cicloHasta,
              horarios: v.horarios,
            }
          : null,
      })
    } catch (err) {
      setError(err.message)
      setGuardando(false)
    }
  }

  const registrarAlumno = async (datos) => {
    const id = await onCrearAlumno(datos)
    setV((x) => ({ ...x, alumnoId: id }))
    setNuevoAlumno(false)
  }

  // Clases que salen de las horas del paquete según la duración de la primera franja del horario.
  const primera = v.horarios.find((h) => h.horaInicio && h.horaFin && h.horaFin > h.horaInicio)
  const minClase = primera ? (Number(primera.horaFin.slice(0, 2)) * 60 + Number(primera.horaFin.slice(3, 5))) - (Number(primera.horaInicio.slice(0, 2)) * 60 + Number(primera.horaInicio.slice(3, 5))) : 0
  const nClases = minClase > 0 && Number(v.horas) > 0 ? Math.ceil((Number(v.horas) * 60) / minClase) : 0

  return (
    <>
      <Modal wide title={origen ? 'Renew or buy more hours' : 'New hour package'} onClose={onClose}>
        <form onSubmit={enviar} className="space-y-6">
          <section className="space-y-4">
            {conSalon && <Titulo n="1" titulo="Student and hours" />}
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Field
                  label="Student"
                  name="alumnoId"
                  value={v.alumnoId}
                  onChange={cambiar}
                  disabled={Boolean(origen)}
                  options={[{ value: '', label: 'Select a student' }, ...alumnos.map((a) => ({ value: a.id, label: a.nombre }))]}
                  required
                />
                {!origen && (
                  <Button type="button" variant="ghost" className="mt-1 px-2 py-1" onClick={() => setNuevoAlumno(true)}>
                    + New student
                  </Button>
                )}
              </div>
              <Field
                label="Teacher"
                name="docenteId"
                value={v.docenteId}
                onChange={cambiar}
                options={[
                  { value: '', label: 'Unassigned' },
                  ...docentes.filter((d) => d.activo || d.id === v.docenteId).map((d) => ({ value: d.id, label: d.nombre })),
                ]}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <span className="mb-1 block text-sm font-medium text-slate-700">Package hours</span>
                <div className="flex flex-wrap items-center gap-2">
                  {rapidas.map((h) => (
                    <button
                      key={h}
                      type="button"
                      onClick={() => setV({ ...v, horas: String(h) })}
                      className={`rounded-lg border px-3 py-1.5 text-sm font-medium ${
                        Number(v.horas) === h ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-slate-300 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      {h} h
                    </button>
                  ))}
                  <input
                    name="horas"
                    type="number"
                    min="0.25"
                    step="0.25"
                    value={v.horas}
                    onChange={cambiar}
                    placeholder="Other"
                    aria-label="Package hours"
                    className="w-24 rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                    required
                  />
                </div>
              </div>
              <Field label="Expires on (optional)" name="vigenciaHasta" type="date" value={v.vigenciaHasta} onChange={cambiar} />
            </div>
          </section>

          {conSalon && catalogo && (
            <section className="space-y-4 border-t border-slate-100 pt-5">
              <Titulo n="2" titulo="Classroom and schedule" subtitulo="A private classroom is created for the student with calendar, attendance, assessments and resources." />
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Academic level" name="nivelId" value={v.nivelId} onChange={cambiarNivel} options={[{ value: '', label: 'Select a level' }, ...niveles.map((n) => ({ value: n.id, label: n.nombre }))]} required />
                <Field label="Start date" name="fechaInicio" type="date" value={v.fechaInicio} onChange={cambiar} required />
              </div>
              <HorariosEditor horarios={v.horarios} onChange={(horarios) => parchear({ horarios })} />
              {nClases > 0 && !usaPlan && !v.totalSesiones && (
                <p className="rounded-lg bg-brand-50 px-3 py-2 text-sm text-slate-700">
                  {v.horas} h = <strong className="font-semibold text-slate-900">{nClases} {nClases === 1 ? 'class' : 'classes'}</strong> of {minutosTexto(minClase)}.
                </p>
              )}

              <details className="rounded-lg border border-slate-200">
                <summary className="cursor-pointer px-3 py-2 text-sm font-medium text-slate-700">More options</summary>
                <div className="space-y-4 border-t border-slate-200 p-3">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Classroom name" name="nombreSalon" value={v.nombreSalon} onChange={cambiar} hint="Empty: “Private · student name”." />
                    {!usaPlan && <Field label="Total classes" name="totalSesiones" type="number" min="1" step="1" value={v.totalSesiones} onChange={cambiar} hint="Empty: calculated from the hours." />}
                  </div>
                  <ConfiguracionAcademica
                    catalogo={catalogo}
                    nivelCodigo={nivel?.codigo ?? ''}
                    values={v}
                    onChange={parchear}
                    tieneCalendario={false}
                    usaPlan={usaPlan}
                    setUsaPlan={setUsaPlan}
                    usaFrecuencia={usaFrecuencia}
                    setUsaFrecuencia={setUsaFrecuencia}
                  />
                  <Field label="Notes" name="notas" value={v.notas} onChange={cambiar} />
                </div>
              </details>
            </section>
          )}

          {!conSalon && <Field label="Notes (optional)" name="notas" value={v.notas} onChange={cambiar} />}

          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={guardando}>
              {guardando ? 'Saving…' : origen ? 'Record renewal' : 'Create package'}
            </Button>
          </div>
        </form>
      </Modal>
      {nuevoAlumno && <AlumnoForm onSave={registrarAlumno} onClose={() => setNuevoAlumno(false)} />}
    </>
  )
}
