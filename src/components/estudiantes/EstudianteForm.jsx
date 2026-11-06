import { useState } from 'react'
import Button from '../ui/Button'
import Field from '../ui/Field'
import Modal from '../ui/Modal'

// Alta y edición de estudiantes. Supabase rechaza nombre, correo o teléfono repetidos y el mensaje se muestra aquí.
export default function EstudianteForm({ estudiante, onSave, onClose }) {
  const [v, setV] = useState({
    nombre: estudiante?.nombre ?? '',
    telefono: estudiante?.telefono ?? '',
    correo: estudiante?.correo ?? '',
    notas: estudiante?.notas ?? '',
    activo: estudiante?.activo ?? true,
  })
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
    <Modal title={estudiante ? 'Editar estudiante' : 'Nuevo estudiante'} onClose={onClose}>
      <form onSubmit={enviar} className="space-y-4">
        <Field label="Nombre completo" name="nombre" value={v.nombre} onChange={cambiar} required />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Teléfono (opcional)" name="telefono" value={v.telefono} onChange={cambiar} />
          <Field label="Correo (opcional)" name="correo" type="email" value={v.correo} onChange={cambiar} />
        </div>
        <Field label="Notas (opcional)" name="notas" as="textarea" rows="2" value={v.notas} onChange={cambiar} />
        {estudiante && (
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={v.activo} onChange={(e) => setV({ ...v, activo: e.target.checked })} className="h-4 w-4 accent-brand-600" />
            Estudiante activo
          </label>
        )}
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={guardando}>
            {guardando ? 'Guardando…' : estudiante ? 'Guardar cambios' : 'Registrar estudiante'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
