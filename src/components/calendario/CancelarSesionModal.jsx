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
    <Modal title={`Cancelar sesión del ${formatFechaCorta(sesion.fecha)}`} onClose={onClose}>
      <form onSubmit={confirmar} className="space-y-4">
        <p className="text-sm text-slate-600">
          La sesión cancelada no cuenta como realizada y el total de sesiones requerido no cambia.
        </p>
        <Field label="Motivo (opcional)" as="textarea" rows="2" value={nota} onChange={(e) => setNota(e.target.value)} />

        <fieldset className="space-y-2">
          <legend className="mb-1 text-sm font-medium text-slate-700">Recuperación</legend>
          {propuesta === undefined ? (
            <p className="text-sm text-slate-500">Buscando la siguiente fecha disponible…</p>
          ) : (
            radio(
              'propuesta',
              propuesta ? (
                <>
                  Programar la propuesta: <b>{formatFechaCorta(propuesta.fecha)}</b>, {propuesta.hora_inicio}–{propuesta.hora_fin}
                </>
              ) : (
                'No hay horarios disponibles para proponer una fecha'
              ),
              !propuesta,
            )
          )}
          {radio('otra', 'Elegir otra fecha')}
          {opcion === 'otra' && (
            <div className="grid grid-cols-3 gap-2 pl-6">
              <Field label="Fecha" type="date" min={hoyLima()} value={otra.fecha} onChange={(e) => setOtra({ ...otra, fecha: e.target.value })} required />
              <Field label="Inicio" type="time" value={otra.horaInicio} onChange={(e) => setOtra({ ...otra, horaInicio: e.target.value })} required />
              <Field label="Fin" type="time" value={otra.horaFin} onChange={(e) => setOtra({ ...otra, horaFin: e.target.value })} required />
            </div>
          )}
          {radio('pendiente', 'Dejar la recuperación pendiente (quedará como sesión sin programar)')}
        </fieldset>

        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Volver
          </Button>
          <Button type="submit" disabled={guardando || propuesta === undefined}>
            {guardando ? 'Guardando…' : recuperacion ? 'Cancelar y programar recuperación' : 'Cancelar sesión'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
