import { useState } from 'react'
import Button from '../ui/Button'
import Field from '../ui/Field'
import Modal from '../ui/Modal'
import AlumnoForm from './AlumnoForm'

const rapidas = [10, 20, 30]

// Nuevo paquete, renovación o compra adicional (con `origen`: mismo alumno, docente y nivel). Precio libre; primer pago opcional.
export default function PaqueteForm({ origen, alumnos, docentes, niveles, onSave, onCrearAlumno, onClose }) {
  const [v, setV] = useState({
    alumnoId: origen?.alumno_id ?? '',
    horas: '',
    precio: '',
    moneda: origen?.moneda ?? 'PEN',
    docenteId: origen?.docente_id ?? '',
    nivelId: origen?.nivel_id ?? '',
    vigenciaHasta: '',
    pagoMonto: '',
    notas: '',
  })
  const [nuevoAlumno, setNuevoAlumno] = useState(false)
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)
  const cambiar = (e) => setV({ ...v, [e.target.name]: e.target.value })

  const enviar = async (e) => {
    e.preventDefault()
    if (!v.alumnoId) return setError('Select a student')
    if (!(Number(v.horas) > 0)) return setError('Enter the package hours')
    if (v.precio === '' || Number(v.precio) < 0) return setError('Enter the price (can be 0)')
    if (Number(v.pagoMonto || 0) > Number(v.precio)) return setError('The first payment cannot exceed the price')
    setGuardando(true)
    setError('')
    try {
      await onSave({
        ...v,
        horas: Number(v.horas),
        precio: Number(v.precio),
        pagoMonto: v.pagoMonto === '' ? 0 : Number(v.pagoMonto),
        origenId: origen?.id ?? '',
        pagoMetodo: '',
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

  return (
    <>
      <Modal wide title={origen ? 'Renew or buy more hours' : 'New hour package'} onClose={onClose}>
        <form onSubmit={enviar} className="space-y-4">
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
                placeholder="Other amount"
                aria-label="Package hours"
                className="w-32 rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                required
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Total price" name="precio" type="number" min="0" step="0.01" value={v.precio} onChange={cambiar} hint="Free-form: there is no hourly rate." required />
            <Field label="First payment (optional)" name="pagoMonto" type="number" min="0" step="0.01" value={v.pagoMonto} onChange={cambiar} hint="The rest is recorded later, in installments." />
            <Field
              label="Currency"
              name="moneda"
              value={v.moneda}
              onChange={cambiar}
              options={[
                { value: 'PEN', label: 'Soles (S/)' },
                { value: 'USD', label: 'US dollars (US$)' },
              ]}
            />
            <Field label="Expires on (optional)" name="vigenciaHasta" type="date" value={v.vigenciaHasta} onChange={cambiar} />
            <Field
              label="Level (optional)"
              name="nivelId"
              value={v.nivelId}
              onChange={cambiar}
              options={[{ value: '', label: 'No level' }, ...niveles.map((n) => ({ value: n.id, label: n.nombre }))]}
              hint="For information only: does not affect the balance."
            />
            <Field label="Notes (optional)" name="notas" value={v.notas} onChange={cambiar} />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={guardando}>
              {guardando ? 'Saving…' : origen ? 'Record renewal' : 'Record package'}
            </Button>
          </div>
        </form>
      </Modal>
      {nuevoAlumno && <AlumnoForm onSave={registrarAlumno} onClose={() => setNuevoAlumno(false)} />}
    </>
  )
}
