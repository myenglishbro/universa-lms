import { useState } from 'react'
import Button from '../ui/Button'
import Field from '../ui/Field'
import Modal from '../ui/Modal'

export default function SeccionForm({ seccion, onSave, onClose }) {
  const [titulo, setTitulo] = useState(seccion?.titulo ?? '')
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)

  const enviar = async (e) => {
    e.preventDefault()
    if (!titulo.trim()) return setError('Enter the section title')
    setGuardando(true)
    setError('')
    try {
      await onSave(titulo.trim())
    } catch (err) {
      setError(err.message)
      setGuardando(false)
    }
  }

  return (
    <Modal title={seccion ? 'Edit section' : 'New section'} onClose={onClose}>
      <form onSubmit={enviar} className="space-y-4">
        <Field label="Title" value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="E.g.: Module 1 · Introductions" autoFocus />
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
