import { useCallback, useEffect, useState } from 'react'
import Badge from '../ui/Badge'
import Button from '../ui/Button'
import Card from '../ui/Card'
import AlumnosExtra from './AlumnosExtra'

// Estudiantes del salón del paquete: el titular (quien compró las horas) y los adicionales. Administración puede sumar o retirar adicionales.
export default function AlumnosPaquete({ paquete: p, servicio, alumnos, puedeEditar, onVerAlumno, onCambio }) {
  const [lista, setLista] = useState(null)
  const [nuevos, setNuevos] = useState([])
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState('')

  const cargar = useCallback(() => servicio.alumnosDelPaquete(p.salon_id).then(setLista).catch((e) => setError(e.message)), [servicio, p.salon_id])
  useEffect(() => {
    cargar()
  }, [cargar])

  const ejecutar = async (fn) => {
    if (ocupado) return
    setOcupado(true)
    setError('')
    try {
      await fn()
      setNuevos([])
      await Promise.all([cargar(), onCambio?.()])
    } catch (e) {
      setError(e.message)
    } finally {
      setOcupado(false)
    }
  }

  const retirar = (m) => {
    if (!window.confirm(`Remove ${m.nombre} from this package's classroom? Their history is kept.`)) return
    ejecutar(() => servicio.retirarAlumnoPaquete(m.matriculaId, 'Removed from the package'))
  }

  const matriculados = (lista ?? []).map((m) => m.alumnoId)
  return (
    <Card className="mb-6 p-4">
      <h2 className="mb-3 text-sm font-semibold text-slate-900">
        Students in this package {lista && <span className="font-normal text-slate-500">({lista.length})</span>}
      </h2>
      {error && <p className="mb-2 text-sm text-red-600">{error}</p>}
      {lista === null && !error && <p className="text-sm text-slate-500">Loading…</p>}
      {lista && (
        <ul className="divide-y divide-slate-100">
          {lista.map((m) => (
            <li key={m.matriculaId} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
              <span className="flex items-center gap-2">
                {onVerAlumno ? (
                  <button type="button" className="font-medium text-slate-900 hover:text-brand-700" onClick={() => onVerAlumno(m.alumnoId)}>
                    {m.nombre}
                  </button>
                ) : (
                  <span className="font-medium text-slate-900">{m.nombre}</span>
                )}
                {m.alumnoId === p.alumno_id && <Badge color="brand">Package holder</Badge>}
              </span>
              {puedeEditar && m.alumnoId !== p.alumno_id && (
                <Button variant="ghost" className="px-2 py-1 text-xs" disabled={ocupado} onClick={() => retirar(m)}>
                  Remove
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      {puedeEditar && lista && (
        <div className="mt-3 space-y-2 border-t border-slate-100 pt-3">
          <AlumnosExtra alumnos={alumnos} seleccionados={nuevos} excluidos={matriculados} onChange={setNuevos} />
          {nuevos.length > 0 && (
            <div className="flex justify-end">
              <Button disabled={ocupado} onClick={() => ejecutar(() => servicio.agregarAlumnosPaquete(p.id, nuevos))}>
                {ocupado ? 'Adding…' : `Add ${nuevos.length} student${nuevos.length === 1 ? '' : 's'}`}
              </Button>
            </div>
          )}
        </div>
      )}
    </Card>
  )
}
