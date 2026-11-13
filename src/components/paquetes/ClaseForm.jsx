import { useState } from 'react'
import Button from '../ui/Button'
import Field from '../ui/Field'
import Modal from '../ui/Modal'
import { duracionMinutos, minutosTexto } from '../../lib/paquetes'

const hora = (t) => (t ? t.slice(0, 5) : '')

// Programa una clase (o reprograma una existente). La duración puede ser cualquiera: se descuenta lo que dure realmente.
export default function ClaseForm({ paquete, clase, docentes = [], fechaInicial = '', onSave, onClose }) {
  const [v, setV] = useState({
    docenteId: clase?.docente_id ?? paquete.docente_id ?? '',
    fecha: clase?.fecha ?? fechaInicial,
    horaInicio: hora(clase?.hora_inicio),
    horaFin: hora(clase?.hora_fin),
    nota: clase?.nota ?? '',
  })
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)
  const cambiar = (e) => setV({ ...v, [e.target.name]: e.target.value })
  const min = duracionMinutos(v.horaInicio, v.horaFin)
  const libresTras = paquete.libres - (clase ? 0 : Math.max(min, 0))

  const enviar = async (e) => {
    e.preventDefault()
    if (min <= 0) return setError('The end time must be after the start time')
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
    <Modal title={clase ? 'Reschedule class' : 'Schedule class'} onClose={onClose}>
      <form onSubmit={enviar} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Date" name="fecha" type="date" value={v.fecha} onChange={cambiar} required />
          <Field label="From" name="horaInicio" type="time" value={v.horaInicio} onChange={cambiar} required />
          <Field label="To" name="horaFin" type="time" value={v.horaFin} onChange={cambiar} required />
        </div>
        {docentes.length > 0 && (
          <Field
            label="Teacher"
            name="docenteId"
            value={v.docenteId}
            onChange={cambiar}
            options={[{ value: '', label: 'No teacher' }, ...docentes.filter((d) => d.activo || d.id === v.docenteId).map((d) => ({ value: d.id, label: d.nombre }))]}
          />
        )}
        {!clase && <Field label="Note (optional)" name="nota" value={v.nota} onChange={cambiar} />}
        {min > 0 && (
          <p className="text-sm text-slate-600">
            Duration: <strong>{minutosTexto(min)}</strong>. It is only deducted when you confirm it was taught.
          </p>
        )}
        {!clase && min > 0 && libresTras < 0 && (
          <p className="rounded-lg bg-peach-100 px-3 py-2 text-sm text-peach-700">
            With this class there will be {minutosTexto(-libresTras)} scheduled above what is available. It can be scheduled, but to confirm it the package
            will need to be extended.
          </p>
        )}
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={guardando}>
            {guardando ? 'Saving…' : clase ? 'Save changes' : 'Schedule'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
