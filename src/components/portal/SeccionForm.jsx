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
    if (!titulo.trim()) return setError('Escribe el título de la sección')
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
    <Modal title={seccion ? 'Editar sección' : 'Nueva sección'} onClose={onClose}>
      <form onSubmit={enviar} className="space-y-4">
        <Field label="Título" value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ej.: Módulo 1 · Presentaciones" autoFocus />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={guardando}>
            {guardando ? 'Guardando…' : 'Guardar'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
