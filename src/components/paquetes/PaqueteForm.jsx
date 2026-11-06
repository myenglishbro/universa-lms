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
    if (!v.alumnoId) return setError('Selecciona un alumno')
    if (!(Number(v.horas) > 0)) return setError('Indica las horas del paquete')
    if (v.precio === '' || Number(v.precio) < 0) return setError('Indica el precio (puede ser 0)')
    if (Number(v.pagoMonto || 0) > Number(v.precio)) return setError('El primer pago no puede superar el precio')
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
      <Modal wide title={origen ? 'Renovar o comprar más horas' : 'Nuevo paquete de horas'} onClose={onClose}>
        <form onSubmit={enviar} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Field
                label="Alumno"
                name="alumnoId"
                value={v.alumnoId}
                onChange={cambiar}
                disabled={Boolean(origen)}
                options={[{ value: '', label: 'Selecciona un alumno' }, ...alumnos.map((a) => ({ value: a.id, label: a.nombre }))]}
                required
              />
              {!origen && (
                <Button type="button" variant="ghost" className="mt-1 px-2 py-1" onClick={() => setNuevoAlumno(true)}>
                  + Nuevo alumno
                </Button>
              )}
            </div>
            <Field
              label="Docente"
              name="docenteId"
              value={v.docenteId}
              onChange={cambiar}
              options={[
                { value: '', label: 'Sin asignar' },
                ...docentes.filter((d) => d.activo || d.id === v.docenteId).map((d) => ({ value: d.id, label: d.nombre })),
              ]}
            />
          </div>

          <div>
            <span className="mb-1 block text-sm font-medium text-slate-700">Horas del paquete</span>
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
                placeholder="Otra cantidad"
                aria-label="Horas del paquete"
                className="w-32 rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                required
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Precio total" name="precio" type="number" min="0" step="0.01" value={v.precio} onChange={cambiar} hint="Libre: no hay tarifa por hora." required />
            <Field label="Primer pago (opcional)" name="pagoMonto" type="number" min="0" step="0.01" value={v.pagoMonto} onChange={cambiar} hint="El resto se registra después, en cuotas." />
            <Field
              label="Moneda"
              name="moneda"
              value={v.moneda}
              onChange={cambiar}
              options={[
                { value: 'PEN', label: 'Soles (S/)' },
                { value: 'USD', label: 'Dólares (US$)' },
              ]}
            />
            <Field label="Vence el (opcional)" name="vigenciaHasta" type="date" value={v.vigenciaHasta} onChange={cambiar} />
            <Field
              label="Nivel (opcional)"
              name="nivelId"
              value={v.nivelId}
              onChange={cambiar}
              options={[{ value: '', label: 'Sin nivel' }, ...niveles.map((n) => ({ value: n.id, label: n.nombre }))]}
              hint="Solo informativo: no afecta al saldo."
            />
            <Field label="Notas (opcional)" name="notas" value={v.notas} onChange={cambiar} />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={guardando}>
              {guardando ? 'Guardando…' : origen ? 'Registrar renovación' : 'Registrar paquete'}
            </Button>
          </div>
        </form>
      </Modal>
      {nuevoAlumno && <AlumnoForm onSave={registrarAlumno} onClose={() => setNuevoAlumno(false)} />}
    </>
  )
}
