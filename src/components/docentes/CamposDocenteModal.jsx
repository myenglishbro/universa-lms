import { useState } from 'react'
import Button from '../ui/Button'
import Modal from '../ui/Modal'
import { eliminarCampo, guardarCampo } from '../../services/docentesPerfil'

// Administra los campos con los que se describe a los docentes (p. ej. «Age group»): nombre y opciones. Se pueden crear, renombrar, ocultar y eliminar.
function Fila({ campo, onCambio }) {
  const [v, setV] = useState({ nombre: campo.nombre, opciones: campo.opciones.join(', '), activo: campo.activo })
  const [estado, setEstado] = useState('')
  const sucio = v.nombre !== campo.nombre || v.opciones !== campo.opciones.join(', ') || v.activo !== campo.activo
  const accion = async (fn, ok) => {
    setEstado('Saving…')
    try {
      await fn()
      await onCambio()
      setEstado(ok)
    } catch (e) {
      setEstado(e.message)
    }
  }
  const guardar = () => accion(() => guardarCampo({ id: campo.id, nombre: v.nombre, opciones: v.opciones.split(','), orden: campo.orden, activo: v.activo }), 'Saved')
  return (
    <li className="space-y-2 rounded-xl border border-slate-200 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <input value={v.nombre} onChange={(e) => setV({ ...v, nombre: e.target.value })} maxLength={60} aria-label="Field name" className="min-w-40 flex-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold" />
        <label className="flex items-center gap-1.5 text-xs text-slate-600">
          <input type="checkbox" checked={v.activo} onChange={(e) => setV({ ...v, activo: e.target.checked })} className="accent-brand-600" /> In use
        </label>
      </div>
      <input value={v.opciones} onChange={(e) => setV({ ...v, opciones: e.target.value })} aria-label={`Options of ${campo.nombre}`} placeholder="Options separated by commas" className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm" />
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" className="px-3 py-1 text-xs" disabled={!sucio || !v.nombre.trim()} onClick={guardar}>
          Save
        </Button>
        <button
          type="button"
          onClick={() => window.confirm(`Delete “${campo.nombre}”? It will be removed from every teacher profile.`) && accion(() => eliminarCampo(campo.id), '')}
          className="text-xs font-medium text-rose-700 hover:underline"
        >
          Delete
        </button>
        <span className="text-xs text-slate-500" role="status">{estado}</span>
      </div>
    </li>
  )
}

export default function CamposDocenteModal({ campos, onCambio, onClose }) {
  const [nuevo, setNuevo] = useState('')
  const [error, setError] = useState('')
  const crear = async (e) => {
    e.preventDefault()
    setError('')
    try {
      await guardarCampo({ nombre: nuevo, opciones: [], orden: campos.length + 1 })
      setNuevo('')
      await onCambio()
    } catch (err) {
      setError(err.message)
    }
  }
  return (
    <Modal title="Teacher profile fields" onClose={onClose} wide>
      <p className="mb-3 text-sm text-slate-600">Fields describe teachers internally (only administration sees them) and let you filter when assigning a classroom or a private group.</p>
      <ul className="space-y-3">
        {campos.map((c) => (
          <Fila key={`${c.id}:${c.nombre}:${c.opciones.join()}:${c.activo}`} campo={c} onCambio={onCambio} />
        ))}
      </ul>
      <form onSubmit={crear} className="mt-4 flex flex-wrap gap-2">
        <input value={nuevo} onChange={(e) => setNuevo(e.target.value)} maxLength={60} placeholder="New field (e.g. Languages spoken)" aria-label="New field name" className="min-w-48 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm" />
        <Button type="submit" disabled={!nuevo.trim()}>
          Add field
        </Button>
      </form>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </Modal>
  )
}
