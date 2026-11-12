import { useEffect, useState } from 'react'
import Button from '../ui/Button'
import Field from '../ui/Field'
import Modal from '../ui/Modal'
import { estadoSesionLabel, estadosSesion, formatFechaCorta } from '../../lib/calendario'
import { hoyLima } from '../../lib/salones'

const titulos = {
  reprogramar: 'Reschedule session',
  recuperar: 'Schedule make-up',
  corregir: 'Correct session',
}

// modo 'reprogramar': mueve una sesión programada. 'recuperar': repone una sesión cancelada.
// 'corregir': cambio EXPLÍCITO de una sesión realizada o cancelada (exige motivo).
export default function SesionModal({ modo, sesion, proponer, onSave, onClose }) {
  const [v, setV] = useState({
    fecha: modo === 'reprogramar' ? sesion.fecha : '',
    horaInicio: sesion.horaInicio,
    horaFin: sesion.horaFin,
    texto: '',
    estado: estadosSesion.find((e) => e.value !== sesion.estado && e.value !== 'programada')?.value ?? 'programada',
  })
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)

  // Para recuperar, se precarga la fecha propuesta por el sistema (editable).
  useEffect(() => {
    if (modo !== 'recuperar') return
    let activo = true
    proponer(sesion.id)
      .then((p) => {
        if (activo && p) setV((x) => ({ ...x, fecha: p.fecha, horaInicio: p.hora_inicio, horaFin: p.hora_fin }))
      })
      .catch(() => {})
    return () => {
      activo = false
    }
  }, [modo, proponer, sesion.id])

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

  const opcionesEstado = estadosSesion.filter((x) => x.value !== sesion.estado)

  return (
    <Modal title={`${titulos[modo]} · ${formatFechaCorta(sesion.fecha)}`} onClose={onClose}>
      <form onSubmit={guardar} className="space-y-4">
        {modo === 'corregir' ? (
          <>
            <p className="text-sm text-slate-600">
              This session is already recorded as <b>{estadoSesionLabel(sesion.estado).toLowerCase()}</b>. Changes are logged with their reason.
            </p>
            <Field label="New status" value={v.estado} onChange={cambiar('estado')} options={opcionesEstado} />
            <Field label="Reason for the correction" as="textarea" rows="2" value={v.texto} onChange={cambiar('texto')} required />
          </>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-2">
              <Field label="Date" type="date" min={modo === 'recuperar' ? hoyLima() : undefined} value={v.fecha} onChange={cambiar('fecha')} required />
              <Field label="Start" type="time" value={v.horaInicio} onChange={cambiar('horaInicio')} required />
              <Field label="End" type="time" value={v.horaFin} onChange={cambiar('horaFin')} required />
            </div>
            {modo === 'reprogramar' && (
              <Field label="Reason (optional)" as="textarea" rows="2" value={v.texto} onChange={cambiar('texto')} />
            )}
          </>
        )}
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={guardando}>
            {guardando ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
