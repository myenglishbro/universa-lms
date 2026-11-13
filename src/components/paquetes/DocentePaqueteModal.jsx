import { useState } from 'react'
import Button from '../ui/Button'
import Field from '../ui/Field'
import Modal from '../ui/Modal'

// Asigna el docente habitual de un paquete. No toca saldos, pagos ni movimientos.
export default function DocentePaqueteModal({ actualId, docentes, onSave, onClose }) {
  const [docenteId, setDocenteId] = useState(actualId ?? '')
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)

  const enviar = async (e) => {
    e.preventDefault()
    setGuardando(true)
    setError('')
    try {
      await onSave(docenteId)
    } catch (err) {
      setError(err.message)
      setGuardando(false)
    }
  }

  return (
    <Modal title="Package teacher" onClose={onClose}>
      <form onSubmit={enviar} className="space-y-4">
        <Field
          label="Teacher"
          value={docenteId}
          onChange={(e) => setDocenteId(e.target.value)}
          options={[{ value: '', label: 'No teacher' }, ...docentes.filter((d) => d.activo || d.id === actualId).map((d) => ({ value: d.id, label: d.nombre }))]}
          hint="Used for classes you schedule from now on. Classes already scheduled keep their teacher; to change them use “Reschedule”."
        />
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
