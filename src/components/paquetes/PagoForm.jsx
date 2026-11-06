import { useState } from 'react'
import Button from '../ui/Button'
import Field from '../ui/Field'
import Modal from '../ui/Modal'
import { dinero, hoyISO, metodosPago } from '../../lib/paquetes'

// Registro de un pago (completo o en cuota). Propone el saldo pendiente; la base rechaza pagos mayores al pendiente.
export default function PagoForm({ paquete, onSave, onClose }) {
  const [v, setV] = useState({ monto: Number(paquete.pendiente).toFixed(2), fecha: hoyISO(), metodo: metodosPago[0], nota: '' })
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)
  const cambiar = (e) => setV({ ...v, [e.target.name]: e.target.value })

  const enviar = async (e) => {
    e.preventDefault()
    if (!(Number(v.monto) > 0)) return setError('El monto debe ser mayor que cero')
    setGuardando(true)
    setError('')
    try {
      await onSave({ ...v, monto: Number(v.monto) })
    } catch (err) {
      setError(err.message)
      setGuardando(false)
    }
  }

  return (
    <Modal title="Registrar pago" onClose={onClose}>
      <form onSubmit={enviar} className="space-y-4">
        <p className="text-sm text-slate-600">
          Precio {dinero(paquete.precio, paquete.moneda)} · pagado {dinero(paquete.pagado, paquete.moneda)} · pendiente{' '}
          <strong>{dinero(paquete.pendiente, paquete.moneda)}</strong>
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Monto" name="monto" type="number" min="0.01" step="0.01" value={v.monto} onChange={cambiar} required />
          <Field label="Fecha" name="fecha" type="date" value={v.fecha} onChange={cambiar} required />
          <Field label="Método" name="metodo" value={v.metodo} onChange={cambiar} options={metodosPago} />
          <Field label="Nota (opcional)" name="nota" value={v.nota} onChange={cambiar} />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={guardando}>
            {guardando ? 'Guardando…' : 'Registrar pago'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
