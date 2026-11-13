import { useState } from 'react'
import Button from '../ui/Button'
import Field from '../ui/Field'
import Modal from '../ui/Modal'
import { PRIORIDADES, TIPOS } from '../../lib/tickets'
import { crearTicket } from '../../services/tickets'

// `personal`: usuarios administrativos activos para elegir responsable (opcional).
export default function TicketNuevo({ personal, miId, onCerrar, onCreado }) {
  const [f, setF] = useState({ titulo: '', descripcion: '', tipo: 'tarea', prioridad: 'media', responsable_id: '', fecha_limite: '' })
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)
  const cambiar = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }))

  const guardar = async (e) => {
    e.preventDefault()
    if (guardando) return
    setGuardando(true)
    setError('')
    try {
      const t = await crearTicket(f)
      onCreado(t)
    } catch (err) {
      setError(err.message)
      setGuardando(false)
    }
  }

  return (
    <Modal title="New ticket" wide onClose={onCerrar}>
      <form onSubmit={guardar} className="space-y-3">
        <Field label="Title" value={f.titulo} onChange={cambiar('titulo')} maxLength={200} required autoFocus placeholder="E.g.: Schedule placement exam" />
        <Field as="textarea" rows={4} label="Description" value={f.descripcion} onChange={cambiar('descripcion')} maxLength={5000} />
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Type" options={TIPOS} value={f.tipo} onChange={cambiar('tipo')} />
          <Field label="Prioridad" options={PRIORIDADES} value={f.prioridad} onChange={cambiar('prioridad')} />
          <Field
            label="Responsable"
            options={[{ value: '', label: 'Unassigned' }, ...personal.map((p) => ({ value: p.user_id, label: p.user_id === miId ? `${p.correo} (me)` : p.correo }))]}
            value={f.responsable_id}
            onChange={cambiar('responsable_id')}
          />
          <Field type="date" label="Due date (optional)" value={f.fecha_limite} onChange={cambiar('fecha_limite')} />
        </div>
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="ghost" onClick={onCerrar}>
            Cancel
          </Button>
          <Button type="submit" disabled={guardando || !f.titulo.trim()}>
            {guardando ? 'Creating…' : 'Create ticket'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
