import { useState } from 'react'
import Button from '../ui/Button'
import Field from '../ui/Field'
import Modal from '../ui/Modal'
import { formatFecha, hoyLima } from '../../lib/salones'

// Cambia desde qué día cuenta una matrícula. Con una fecha anterior, el estudiante aparece en la asistencia de las clases pasadas.
// `alcance`: 'una' (un estudiante) o 'todas' (todas las matrículas activas del salón que empezaron después de la fecha elegida).
export default function FechaMatriculaModal({ titulo, texto, fechaActual, inicioSalon, alcance = 'una', onConfirm, onClose }) {
  const hoy = hoyLima()
  const sugerida = inicioSalon && inicioSalon <= hoy && (!fechaActual || inicioSalon < fechaActual) ? inicioSalon : fechaActual || ''
  const [fecha, setFecha] = useState(sugerida)
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)

  const enviar = async (e) => {
    e.preventDefault()
    if (!fecha) return setError('Elige la fecha')
    if (fecha > hoy) return setError('La fecha no puede ser futura')
    setGuardando(true)
    setError('')
    try {
      await onConfirm(fecha)
    } catch (err) {
      setError(err.message)
      setGuardando(false)
    }
  }

  return (
    <Modal title={titulo} onClose={onClose}>
      <form onSubmit={enviar} className="space-y-4">
        {texto && <p className="text-sm text-slate-600">{texto}</p>}
        <Field
          label={alcance === 'todas' ? 'Matriculados desde' : 'Matriculado desde'}
          type="date"
          value={fecha}
          max={hoy}
          onChange={(e) => setFecha(e.target.value)}
          required
          hint={fechaActual ? `Hoy figura desde el ${formatFecha(fechaActual)}.` : undefined}
        />
        {inicioSalon && inicioSalon <= hoy && fecha !== inicioSalon && (
          <button type="button" className="text-sm text-brand-700 hover:underline" onClick={() => setFecha(inicioSalon)}>
            Usar el inicio del salón ({formatFecha(inicioSalon)})
          </button>
        )}
        <p className="rounded-lg bg-peach-50 px-3 py-2 text-xs text-peach-700">
          Las clases desde esa fecha pasarán a incluir al estudiante en la asistencia y en la participación. Las notas ya publicadas no se recalculan solas.
        </p>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={guardando}>
            {guardando ? 'Guardando…' : 'Guardar fecha'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
