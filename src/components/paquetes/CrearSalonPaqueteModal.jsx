import { useState } from 'react'
import Button from '../ui/Button'
import Field from '../ui/Field'
import Modal from '../ui/Modal'
import ConfiguracionAcademica from '../salones/ConfiguracionAcademica'
import HorariosEditor from '../salones/HorariosEditor'

// Crea el salón individual de un paquete registrado antes de que los paquetes tuvieran salón.
export default function CrearSalonPaqueteModal({ paquete: p, niveles, catalogo, onSave, onClose }) {
  const [v, setV] = useState({
    nivelId: p.nivel_id ?? '', nombre: '', fechaInicio: '', totalSesiones: '', planId: '', frecuenciaId: '',
    cicloDesde: '', cicloHasta: '', modalidad: '', nivel: '', horario: '', tipo: '', horarios: [],
  })
  const [usaPlan, setUsaPlan] = useState(false)
  const [usaFrecuencia, setUsaFrecuencia] = useState(false)
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)
  const cambiar = (e) => setV({ ...v, [e.target.name]: e.target.value })
  const parchear = (parche) => setV((x) => ({ ...x, ...parche }))
  const nivel = niveles.find((n) => n.id === v.nivelId)
  const cambiarNivel = (e) => {
    const nivelId = e.target.value
    const codigo = niveles.find((n) => n.id === nivelId)?.codigo
    const plan = catalogo.planes.find((x) => x.id === v.planId)
    const quitar = (plan && plan.nivelCodigo !== codigo) || (!plan && v.modalidad)
    setV((x) => ({ ...x, nivelId, ...(quitar ? { planId: '', modalidad: '', nivel: '', horario: '', tipo: '', cicloDesde: '', cicloHasta: '' } : {}) }))
    if (quitar) setUsaPlan(false)
  }

  const enviar = async (e) => {
    e.preventDefault()
    if (!v.nivelId) return setError('Select the academic level')
    if (!v.fechaInicio) return setError('Enter the start date')
    if (v.horarios.length === 0) return setError('Add at least one class day and time')
    if (v.horarios.some((h) => !h.horaInicio || !h.horaFin || h.horaFin <= h.horaInicio)) return setError('The end time must be after the start time')
    if (usaPlan && !v.planId) return setError('Complete the academic plan or turn it off')
    if (usaFrecuencia && !v.frecuenciaId) return setError('Choose a frequency or turn it off')
    setGuardando(true)
    setError('')
    try {
      await onSave(v)
    } catch (err) {
      setError(err.message)
      setGuardando(false)
    }
  }

  return (
    <Modal wide title="Create the classroom for this package" onClose={onClose}>
      <form onSubmit={enviar} className="space-y-4">
        <p className="text-sm text-slate-600">
          {p.alumno} will be enrolled in a private classroom with calendar, attendance, assessments, exercises and resources. Class hours are deducted from this package.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Classroom name (optional)" name="nombre" value={v.nombre} onChange={cambiar} hint="Empty: “Private · student name”." />
          <Field label="Academic level" name="nivelId" value={v.nivelId} onChange={cambiarNivel} options={[{ value: '', label: 'Select a level' }, ...niveles.map((n) => ({ value: n.id, label: n.nombre }))]} required />
          <Field label="Start date" name="fechaInicio" type="date" value={v.fechaInicio} onChange={cambiar} required />
          {!v.planId && <Field label="Total sessions (optional)" name="totalSesiones" type="number" min="1" step="1" value={v.totalSesiones} onChange={cambiar} hint="Empty: calculated from the package hours." />}
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
        <HorariosEditor horarios={v.horarios} onChange={(horarios) => parchear({ horarios })} />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={guardando}>{guardando ? 'Creating…' : 'Create classroom'}</Button>
        </div>
      </form>
    </Modal>
  )
}
