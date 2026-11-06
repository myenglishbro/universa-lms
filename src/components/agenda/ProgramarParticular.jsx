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
    <Modal title="Programar clase particular" onClose={onClose}>
      <div className="space-y-4">
        {disponibles.length === 0 ? (
          <p className="text-sm text-slate-600">No hay paquetes activos. Registra uno en «Paquetes de horas».</p>
        ) : (
          <Field
            label="Paquete del alumno"
            value={paqueteId}
            onChange={(e) => setPaqueteId(e.target.value)}
            options={[
              { value: '', label: 'Selecciona un alumno' },
              ...disponibles.map((p) => ({ value: p.id, label: `${p.alumno} · ${minutosTexto(p.disponibles)} disponibles${p.docente ? ` · ${p.docente}` : ''}` })),
            ]}
          />
        )}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button disabled={!paqueteId} onClick={() => setElegido(disponibles.find((p) => p.id === paqueteId))}>
            Continuar
          </Button>
        </div>
      </div>
    </Modal>
  )
}
