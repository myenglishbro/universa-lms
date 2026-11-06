import { useState } from 'react'
import Button from '../ui/Button'
import Field from '../ui/Field'
import Modal from '../ui/Modal'
import { minutosTexto } from '../../lib/paquetes'

// Cancelación normal (no consume horas) o tardía (descuenta horas, con motivo obligatorio; solo la ejecuta un administrador).
export default function CancelarClaseModal({ clase, onConfirm, onClose }) {
  const [tardia, setTardia] = useState(false)
  const [motivo, setMotivo] = useState('')
  const [minutos, setMinutos] = useState(String(clase.minutos))
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)

  const enviar = async (e) => {
    e.preventDefault()
    if (tardia && !motivo.trim()) return setError('La cancelación tardía exige un motivo')
    const m = Number(minutos)
    if (tardia && !(m >= 1 && m <= clase.minutos)) return setError(`El descuento debe estar entre 1 y ${clase.minutos} minutos`)
    setGuardando(true)
    setError('')
    try {
      await onConfirm({ tardia, motivo: motivo.trim(), minutos: m })
    } catch (err) {
      setError(err.message)
      setGuardando(false)
    }
  }

  const opcion = (valor, titulo, texto) => (
    <label className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 ${tardia === valor ? 'border-brand-500 bg-brand-50' : 'border-slate-200'}`}>
      <input type="radio" name="tipo" checked={tardia === valor} onChange={() => setTardia(valor)} className="mt-1 accent-brand-600" />
      <span>
        <span className="block text-sm font-medium text-slate-900">{titulo}</span>
        <span className="block text-xs text-slate-500">{texto}</span>
      </span>
    </label>
  )

  return (
    <Modal title="Cancelar clase" onClose={onClose}>
      <form onSubmit={enviar} className="space-y-4">
        <div className="space-y-2">
          {opcion(false, 'Cancelación normal', 'No se descuentan horas del paquete.')}
          {opcion(true, 'Cancelación tardía', 'Se descuentan horas del paquete. Requiere motivo.')}
        </div>
        {tardia && (
          <>
            <Field
              label="Minutos a descontar"
              type="number"
              min="1"
              max={clase.minutos}
              value={minutos}
              onChange={(e) => setMinutos(e.target.value)}
              hint={`La clase dura ${minutosTexto(clase.minutos)}.`}
            />
            <Field label="Motivo" as="textarea" rows="2" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
          </>
        )}
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Volver
          </Button>
          <Button type="submit" disabled={guardando}>
            {guardando ? 'Guardando…' : tardia ? 'Cancelar y descontar' : 'Cancelar clase'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
