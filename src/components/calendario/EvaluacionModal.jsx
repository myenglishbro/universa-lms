import { useState } from 'react'
import Button from '../ui/Button'
import Field from '../ui/Field'
import Modal from '../ui/Modal'
import { formatFechaCorta } from '../../lib/calendario'

// Marca (o edita / quita) el aviso de evaluación del día de una clase. `existente` = la evaluación ya marcada ese día, si la hay.
export default function EvaluacionModal({ sesion, existente, onSave, onRemove, onClose }) {
  const [v, setV] = useState({ titulo: existente?.titulo ?? '', nota: existente?.nota ?? '' })
  const [error, setError] = useState('')
  const [ocupado, setOcupado] = useState(false)

  const correr = async (operacion) => {
    setOcupado(true)
    setError('')
    try {
      await operacion()
      onClose()
    } catch (err) {
      setError(err.message)
      setOcupado(false)
    }
  }

  return (
    <Modal title={`Evaluation · ${formatFechaCorta(sesion.fecha)}`} onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          correr(() => onSave({ id: existente?.id ?? null, fecha: sesion.fecha, titulo: v.titulo, nota: v.nota }))
        }}
        className="space-y-4"
      >
        <p className="text-sm text-slate-600">This day will be marked in the calendar as an evaluation day.</p>
        <Field label="Evaluation" required maxLength={80} placeholder="E.g.: Formative Unit 4" value={v.titulo} onChange={(e) => setV({ ...v, titulo: e.target.value })} />
        <Field label="Note (optional)" as="textarea" rows="2" maxLength={300} value={v.nota} onChange={(e) => setV({ ...v, nota: e.target.value })} />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-between gap-2">
          {existente ? (
            <Button type="button" variant="ghost" disabled={ocupado} onClick={() => correr(() => onRemove(existente.id))}>
              Remove evaluation
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={ocupado}>
              {ocupado ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  )
}
