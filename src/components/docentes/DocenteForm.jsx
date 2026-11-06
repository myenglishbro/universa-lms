import { useState } from 'react'
import Button from '../ui/Button'
import Field from '../ui/Field'
import Modal from '../ui/Modal'

// Alta y edición de docentes: nombre, correo opcional y estado activo.
export default function DocenteForm({ docente, onSave, onClose }) {
  const [values, setValues] = useState({ nombre: docente?.nombre ?? '', correo: docente?.correo ?? '', activo: docente?.activo ?? true })
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)

  const guardar = async (e) => {
    e.preventDefault()
    setGuardando(true)
    setError('')
    try {
      await onSave(values)
    } catch (err) {
      setError(err.message)
      setGuardando(false)
    }
  }

  return (
    <Modal title={docente ? 'Editar docente' : 'Nuevo docente'} onClose={onClose}>
      <form onSubmit={guardar} className="space-y-4">
        <Field label="Nombre" value={values.nombre} onChange={(e) => setValues({ ...values, nombre: e.target.value })} required />
        <Field label="Correo (opcional)" type="email" value={values.correo} onChange={(e) => setValues({ ...values, correo: e.target.value })} />
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={values.activo}
            onChange={(e) => setValues({ ...values, activo: e.target.checked })}
            className="h-4 w-4 accent-brand-600"
          />
          Docente activo
        </label>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={guardando}>
            {guardando ? 'Guardando…' : docente ? 'Guardar cambios' : 'Registrar docente'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
