import { useCallback, useEffect, useState } from 'react'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import Field from '../components/ui/Field'
import PageHeader from '../components/ui/PageHeader'
import { formatFechaCorta } from '../lib/calendario'
import { formatFecha } from '../lib/salones'
import { eliminarFeriado, guardarFeriado, listarFeriados } from '../services/calendario'

// Feriados y días no laborables. Al agregar o quitar uno, la base recalcula las sesiones futuras regulares
// de los calendarios; las sesiones de fecha fijada, realizadas y canceladas no se mueven.
export default function Feriados({ puedeEditar, onCambio }) {
  const [feriados, setFeriados] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [form, setForm] = useState({ fecha: '', nombre: '' })
  const [guardando, setGuardando] = useState(false)
  const [confirmar, setConfirmar] = useState(null) // fecha pendiente de confirmar al quitar

  const cargar = useCallback(
    () =>
      listarFeriados({ forzar: true })
        .then((f) => {
          setFeriados(f)
          setError('')
        })
        .catch((e) => setError(e.message))
        .finally(() => setCargando(false)),
    [],
  )

  useEffect(() => {
    cargar()
  }, [cargar])

  const ejecutar = async (operacion) => {
    setGuardando(true)
    setError('')
    try {
      await operacion()
      await Promise.all([cargar(), onCambio()])
      return true
    } catch (e) {
      setError(e.message)
      return false
    } finally {
      setGuardando(false)
    }
  }

  const agregar = async (e) => {
    e.preventDefault()
    if (await ejecutar(() => guardarFeriado(form.fecha, form.nombre))) setForm({ fecha: '', nombre: '' })
  }

  const quitar = async (fecha) => {
    setConfirmar(null)
    await ejecutar(() => eliminarFeriado(fecha))
  }

  const porAnio = Object.entries(
    feriados.reduce((grupos, f) => {
      const anio = f.fecha.slice(0, 4)
      return { ...grupos, [anio]: [...(grupos[anio] ?? []), f] }
    }, {}),
  )

  return (
    <>
      <PageHeader title="Holidays" description="Non-working days the academic calendar skips when scheduling sessions" />

      {puedeEditar && (
        <Card className="mb-6 p-4">
          <form onSubmit={agregar} className="flex flex-wrap items-end gap-3">
            <Field label="Date" type="date" value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} required />
            <Field label="Name" className="min-w-56 flex-1" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} required />
            <Button type="submit" disabled={guardando}>
              {guardando ? 'Saving…' : 'Add holiday'}
            </Button>
          </form>
          <p className="mt-3 text-xs text-slate-500">
            Adding or removing a holiday recalculates the future regular sessions of existing calendars.
          </p>
        </Card>
      )}
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      {cargando ? (
        <p className="text-sm text-slate-500">Loading holidays…</p>
      ) : (
        porAnio.map(([anio, lista]) => (
          <Card key={anio} className="mb-4">
            <h2 className="border-b border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-900">
              {anio} <span className="font-normal text-slate-500">· {lista.length} días</span>
            </h2>
            <ul className="divide-y divide-slate-100">
              {lista.map((f) => (
                <li key={f.fecha} className="flex items-center gap-4 px-4 py-2 text-sm">
                  <span className="w-24 font-medium text-slate-900">{formatFechaCorta(f.fecha)}</span>
                  <span className="flex-1 text-slate-600">{f.nombre}</span>
                  <span className="hidden text-xs text-slate-400 sm:inline">{formatFecha(f.fecha)}</span>
                  {puedeEditar &&
                    (confirmar === f.fecha ? (
                      <span className="flex gap-1">
                        <Button variant="ghost" className="px-2 py-1" onClick={() => quitar(f.fecha)} disabled={guardando}>
                          Confirm
                        </Button>
                        <Button variant="ghost" className="px-2 py-1 !text-slate-500" onClick={() => setConfirmar(null)}>
                          No
                        </Button>
                      </span>
                    ) : (
                      <Button variant="ghost" className="px-2 py-1" onClick={() => setConfirmar(f.fecha)}>
                        Remove
                      </Button>
                    ))}
                </li>
              ))}
            </ul>
          </Card>
        ))
      )}
      {!cargando && feriados.length === 0 && <p className="text-sm text-slate-500">No holidays registered.</p>}
    </>
  )
}
