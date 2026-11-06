import { useState } from 'react'
import Button from '../ui/Button'
import Field from '../ui/Field'
import Modal from '../ui/Modal'

export default function AlumnoForm({ onSave, onClose }) {
  const [v, setV] = useState({ nombre: '', telefono: '', correo: '' })
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)
  const cambiar = (e) => setV({ ...v, [e.target.name]: e.target.value })

  const enviar = async (e) => {
    e.preventDefault()
    setGuardando(true)
    setError('')
    try {
      await onSave(v)
    } catch (err) {
      setError(err.message)
      setGuardando(false)
    }
  }

  return (
    <Modal title="Nuevo alumno" onClose={onClose}>
      <form onSubmit={enviar} className="space-y-4">
        <Field label="Nombre" name="nombre" value={v.nombre} onChange={cambiar} required />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Teléfono (opcional)" name="telefono" value={v.telefono} onChange={cambiar} />
          <Field label="Correo (opcional)" name="correo" type="email" value={v.correo} onChange={cambiar} />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={guardando}>
            {guardando ? 'Guardando…' : 'Registrar alumno'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
