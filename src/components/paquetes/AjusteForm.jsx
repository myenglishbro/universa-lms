import { useState } from 'react'
import Button from '../ui/Button'
import Field from '../ui/Field'
import Modal from '../ui/Modal'

// Ampliación (suma horas) o ajuste autorizado (suma o resta). Siempre con motivo; queda en el historial.
export default function AjusteForm({ onSave, onClose }) {
  const [v, setV] = useState({ tipo: 'ampliacion', horas: '', motivo: '' })
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [clave] = useState(() => crypto.randomUUID()) // el mismo envío repetido no duplica el movimiento
  const cambiar = (e) => setV({ ...v, [e.target.name]: e.target.value })

  const enviar = async (e) => {
    e.preventDefault()
    const h = Number(v.horas)
    if (!h) return setError('Enter the hours')
    if (v.tipo === 'ampliacion' && h < 0) return setError('An extension must add hours')
    if (!v.motivo.trim()) return setError('Enter the reason')
    setGuardando(true)
    setError('')
    try {
      await onSave({ tipo: v.tipo, horas: h, motivo: v.motivo.trim(), clave })
    } catch (err) {
      setError(err.message)
      setGuardando(false)
    }
  }

  return (
    <Modal title="Extend or adjust hours" onClose={onClose}>
      <form onSubmit={enviar} className="space-y-4">
        <Field
          label="Type"
          name="tipo"
          value={v.tipo}
          onChange={cambiar}
          options={[
            { value: 'ampliacion', label: 'Extension (add hours)' },
            { value: 'ajuste', label: 'Authorized adjustment (add or subtract)' },
          ]}
        />
        <Field
          label="Hours"
          name="horas"
          type="number"
          step="0.25"
          value={v.horas}
          onChange={cambiar}
          hint={v.tipo === 'ajuste' ? 'Use a negative number to subtract.' : 'E.g.: 1, 2.5'}
          required
        />
        <Field label="Reason" name="motivo" as="textarea" rows="2" value={v.motivo} onChange={cambiar} required />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={guardando}>
            {guardando ? 'Saving…' : 'Record'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
