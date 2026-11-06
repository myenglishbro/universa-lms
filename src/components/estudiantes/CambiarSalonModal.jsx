import { useState } from 'react'
import Button from '../ui/Button'
import Field from '../ui/Field'
import Modal from '../ui/Modal'
import { destinosCambio, motivoSinDestinos } from '../../lib/matriculas'

// Cambia a un estudiante de salón: la matrícula actual queda en el historial como retirada.
export default function CambiarSalonModal({ matricula, salones, matriculas, onConfirm, onClose }) {
  const actual = salones.find((s) => s.id === matricula.salon_id)
  const destinos = destinosCambio(matricula, salones, matriculas)
  const [salonId, setSalonId] = useState('')
  const [motivo, setMotivo] = useState('')
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)

  const enviar = async (e) => {
    e.preventDefault()
    if (!salonId) return setError('Elige el salón de destino')
    setGuardando(true)
    setError('')
    try {
      await onConfirm(salonId, motivo.trim())
    } catch (err) {
      setError(err.message)
      setGuardando(false)
    }
  }

  return (
    <Modal title="Cambiar de salón" onClose={onClose}>
      <form onSubmit={enviar} className="space-y-4">
        <p className="text-sm text-slate-600">
          Sale de <strong>{actual?.nombre ?? 'el salón actual'}</strong>. Su matrícula anterior se conserva en el historial.
        </p>
        {destinos.elegibles.length === 0 ? (
          <p className="rounded-lg bg-peach-100 px-3 py-2 text-sm text-peach-700">{motivoSinDestinos(destinos)}</p>
        ) : (
          <>
            <Field
              label="Salón de destino"
              value={salonId}
              onChange={(e) => setSalonId(e.target.value)}
              options={[
                { value: '', label: 'Selecciona un salón' },
                ...destinos.elegibles.map(({ salon: s, cupos: c }) => ({
                  value: s.id,
                  label: `${s.nombre} · ${s.nivel || 'Sin nivel asignado'} · ${c.disponibles} ${c.disponibles === 1 ? 'cupo' : 'cupos'}`,
                })),
              ]}
              hint="Se muestran todos los salones con cupos que no estén finalizados, sin importar nivel ni docente."
            />
          </>
        )}
        <Field label="Motivo (opcional)" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={guardando || destinos.elegibles.length === 0}>
            {guardando ? 'Cambiando…' : 'Cambiar de salón'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
