import { useState } from 'react'
import Button from '../ui/Button'
import Field from '../ui/Field'
import Modal from '../ui/Modal'

// Confirmación con motivo obligatorio (corregir una clase, anular un pago o un paquete).
export default function MotivoModal({ titulo, texto, confirmar, onConfirm, onClose }) {
  const [motivo, setMotivo] = useState('')
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)

  const enviar = async (e) => {
    e.preventDefault()
    if (!motivo.trim()) return setError('Escribe el motivo')
    setGuardando(true)
    setError('')
    try {
      await onConfirm(motivo.trim())
    } catch (err) {
      setError(err.message)
      setGuardando(false)
    }
  }

  return (
    <Modal title={titulo} onClose={onClose}>
      <form onSubmit={enviar} className="space-y-4">
        {texto && <p className="text-sm text-slate-600">{texto}</p>}
        <Field label="Motivo" as="textarea" rows="2" value={motivo} onChange={(e) => setMotivo(e.target.value)} required />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={guardando}>
            {guardando ? 'Guardando…' : confirmar}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
