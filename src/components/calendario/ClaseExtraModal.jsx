import { useEffect, useState } from 'react'
import Button from '../ui/Button'
import Field from '../ui/Field'
import Modal from '../ui/Modal'
import { ETIQUETAS_EXTRA } from '../../lib/calendario'
import { hoyLima } from '../../lib/salones'

// Clase extra de un salón: va en el calendario a continuación del horario del salón (el sistema propone el siguiente hueco libre, editable)
// y lleva una etiqueta con el motivo. No cuenta para el total de clases del curso.
export default function ClaseExtraModal({ proponer, onSave, onClose }) {
  const [v, setV] = useState({ fecha: '', horaInicio: '', horaFin: '', etiqueta: ETIQUETAS_EXTRA[0], nota: '' })
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)
  const predefinida = ETIQUETAS_EXTRA.includes(v.etiqueta)

  useEffect(() => {
    let activo = true
    proponer()
      .then((p) => {
        if (activo && p) setV((x) => ({ ...x, fecha: p.fecha, horaInicio: p.hora_inicio.slice(0, 5), horaFin: p.hora_fin.slice(0, 5) }))
      })
      .catch(() => {})
      .finally(() => activo && setCargando(false))
    return () => {
      activo = false
    }
  }, [proponer])

  const cambiar = (campo) => (e) => setV({ ...v, [campo]: e.target.value })
  const guardar = async (e) => {
    e.preventDefault()
    setGuardando(true)
    setError('')
    try {
      await onSave(v)
      onClose()
    } catch (err) {
      setError(err.message)
      setGuardando(false)
    }
  }

  return (
    <Modal title="Add extra class" onClose={onClose}>
      <form onSubmit={guardar} className="space-y-4">
        <p className="rounded-xl bg-brand-50 px-3 py-2 text-xs text-brand-800">
          {cargando ? 'Looking for the next free slot of the classroom schedule… ' : 'The next free slot of the weekly schedule is suggested; you can change it. '}
          An extra class appears in the calendar, takes attendance and shows its label, but it does <b>not</b> count toward the course total, does not use package hours and does not count toward the 25% absences.
        </p>
        <fieldset>
          <legend className="mb-1 text-sm font-medium text-slate-700">Why is it added?</legend>
          <div className="flex flex-wrap gap-1.5">
            {ETIQUETAS_EXTRA.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => setV({ ...v, etiqueta: e })}
                className={`rounded-full px-3 py-1 text-sm font-medium ${v.etiqueta === e ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
              >
                {e}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setV({ ...v, etiqueta: predefinida ? '' : v.etiqueta })}
              className={`rounded-full px-3 py-1 text-sm font-medium ${!predefinida ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            >
              Other…
            </button>
          </div>
          {!predefinida && <Field className="mt-2" label="Label" value={v.etiqueta} onChange={cambiar('etiqueta')} maxLength={40} placeholder="E.g. Exam prep" required />}
        </fieldset>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <Field label="Date" type="date" min={hoyLima()} value={v.fecha} onChange={cambiar('fecha')} required />
          <Field label="Start" type="time" value={v.horaInicio} onChange={cambiar('horaInicio')} required />
          <Field label="End" type="time" value={v.horaFin} onChange={cambiar('horaFin')} required />
        </div>
        <Field label="Note (optional)" as="textarea" rows="2" value={v.nota} onChange={cambiar('nota')} />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={guardando || !v.etiqueta.trim()}>
            {guardando ? 'Saving…' : 'Add extra class'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
