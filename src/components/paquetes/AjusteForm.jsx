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
    if (!h) return setError('Indica las horas')
    if (v.tipo === 'ampliacion' && h < 0) return setError('Una ampliación debe sumar horas')
    if (!v.motivo.trim()) return setError('Escribe el motivo')
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
    <Modal title="Ampliar o ajustar horas" onClose={onClose}>
      <form onSubmit={enviar} className="space-y-4">
        <Field
          label="Tipo"
          name="tipo"
          value={v.tipo}
          onChange={cambiar}
          options={[
            { value: 'ampliacion', label: 'Ampliación (sumar horas)' },
            { value: 'ajuste', label: 'Ajuste autorizado (sumar o restar)' },
          ]}
        />
        <Field
          label="Horas"
          name="horas"
          type="number"
          step="0.25"
          value={v.horas}
          onChange={cambiar}
          hint={v.tipo === 'ajuste' ? 'Usa un número negativo para restar.' : 'Ej.: 1, 2.5'}
          required
        />
        <Field label="Motivo" name="motivo" as="textarea" rows="2" value={v.motivo} onChange={cambiar} required />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={guardando}>
            {guardando ? 'Guardando…' : 'Registrar'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
