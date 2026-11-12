import { useState } from 'react'
import Button from '../ui/Button'
import Field from '../ui/Field'
import Modal from '../ui/Modal'
import ClaseForm from '../paquetes/ClaseForm'
import { minutosTexto } from '../../lib/paquetes'

// Programar una clase particular desde la agenda: primero se elige el paquete y luego se usa el mismo formulario de paquetes.
export default function ProgramarParticular({ paquetes, fechaInicial, onSave, onClose }) {
  const [paqueteId, setPaqueteId] = useState('')
  const [elegido, setElegido] = useState(null)
  const disponibles = paquetes.filter((p) => p.estado === 'activo' || p.estado === 'agotado')

  if (elegido)
    return <ClaseForm paquete={elegido} fechaInicial={fechaInicial} onSave={(v) => onSave(elegido, v)} onClose={onClose} />

  return (
    <Modal title="Schedule a private class" onClose={onClose}>
      <div className="space-y-4">
        {disponibles.length === 0 ? (
          <p className="text-sm text-slate-600">There are no active packages. Register one under “Hour packages”.</p>
        ) : (
          <Field
            label="Student's package"
            value={paqueteId}
            onChange={(e) => setPaqueteId(e.target.value)}
            options={[
              { value: '', label: 'Select a student' },
              ...disponibles.map((p) => ({ value: p.id, label: `${p.alumno} · ${minutosTexto(p.disponibles)} available${p.docente ? ` · ${p.docente}` : ''}` })),
            ]}
          />
        )}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={!paqueteId} onClick={() => setElegido(disponibles.find((p) => p.id === paqueteId))}>
            Continue
          </Button>
        </div>
      </div>
    </Modal>
  )
}
