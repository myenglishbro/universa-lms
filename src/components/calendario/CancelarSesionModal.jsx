import { useEffect, useState } from 'react'
import Button from '../ui/Button'
import Field from '../ui/Field'
import Modal from '../ui/Modal'
import { formatFechaCorta } from '../../lib/calendario'
import { hoyLima } from '../../lib/salones'

// Cancela una sesión. El sistema propone una recuperación en la siguiente fecha disponible,
// pero no se crea nada hasta que el administrador confirma (o elige otra fecha, o la deja pendiente).
export default function CancelarSesionModal({ sesion, proponer, onConfirm, onClose }) {
  const [propuesta, setPropuesta] = useState(undefined) // undefined = cargando, null = sin propuesta
  const [opcion, setOpcion] = useState('pendiente')
  const [otra, setOtra] = useState({ fecha: '', horaInicio: sesion.horaInicio, horaFin: sesion.horaFin })
  const [nota, setNota] = useState('')
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    let activo = true
    proponer(sesion.id)
      .then((p) => {
        if (!activo) return
        setPropuesta(p)
        if (p) setOpcion('propuesta')
      })
      .catch((e) => {
        if (!activo) return
        setPropuesta(null)
        setError(e.message)
      })
    return () => {
      activo = false
    }
  }, [proponer, sesion.id])

  const recuperacion =
    opcion === 'propuesta'
      ? propuesta
      : opcion === 'otra'
        ? { fecha: otra.fecha, hora_inicio: otra.horaInicio, hora_fin: otra.horaFin }
        : null

  const confirmar = async (e) => {
    e.preventDefault()
    setGuardando(true)
    setError('')
    try {
      await onConfirm(nota, recuperacion)
      onClose()
    } catch (err) {
      setError(err.message)
      setGuardando(false)
    }
  }

  const radio = (valor, children, deshabilitado = false) => (
    <label className={`flex items-start gap-2 text-sm ${deshabilitado ? 'text-slate-400' : 'text-slate-700'}`}>
      <input
        type="radio"
        name="opcion"
        checked={opcion === valor}
        onChange={() => setOpcion(valor)}
        disabled={deshabilitado}
        className="mt-0.5 accent-brand-600"
      />
      <span>{children}</span>
    </label>
  )

  return (
    <Modal title={`Cancel session on ${formatFechaCorta(sesion.fecha)}`} onClose={onClose}>
      <form onSubmit={confirmar} className="space-y-4">
        <p className="text-sm text-slate-600">
          A cancelled session does not count as held and the required total of sessions does not change.
        </p>
        <Field label="Reason (optional)" as="textarea" rows="2" value={nota} onChange={(e) => setNota(e.target.value)} />

        <fieldset className="space-y-2">
          <legend className="mb-1 text-sm font-medium text-slate-700">Make-up class</legend>
          {propuesta === undefined ? (
            <p className="text-sm text-slate-500">Looking for the next available date…</p>
          ) : (
            radio(
              'propuesta',
              propuesta ? (
                <>
                  Schedule the suggestion: <b>{formatFechaCorta(propuesta.fecha)}</b>, {propuesta.hora_inicio}–{propuesta.hora_fin}
                </>
              ) : (
                'There are no available time slots to suggest a date'
              ),
              !propuesta,
            )
          )}
          {radio('otra', 'Choose another date')}
          {opcion === 'otra' && (
            <div className="grid grid-cols-3 gap-2 pl-6">
              <Field label="Date" type="date" min={hoyLima()} value={otra.fecha} onChange={(e) => setOtra({ ...otra, fecha: e.target.value })} required />
              <Field label="Start" type="time" value={otra.horaInicio} onChange={(e) => setOtra({ ...otra, horaInicio: e.target.value })} required />
              <Field label="End" type="time" value={otra.horaFin} onChange={(e) => setOtra({ ...otra, horaFin: e.target.value })} required />
            </div>
          )}
          {radio('pendiente', 'Leave the make-up pending (it will stay as an unscheduled session)')}
        </fieldset>

        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Back
          </Button>
          <Button type="submit" disabled={guardando || propuesta === undefined}>
            {guardando ? 'Saving…' : recuperacion ? 'Cancel and schedule make-up' : 'Cancel session'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
