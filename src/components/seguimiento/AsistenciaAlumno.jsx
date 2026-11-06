import { useCallback } from 'react'
import Badge from '../ui/Badge'
import Card from '../ui/Card'
import useCarga from '../../hooks/useCarga'
import * as asistenciaReal from '../../services/asistencia'

// Ficha del estudiante (administración y comercial): asistencia acumulada en cada salón donde está o estuvo matriculado.
export default function AsistenciaAlumno({ alumnoId, servicio = asistenciaReal }) {
  const cargar = useCallback(() => servicio.resumenDelAlumno(alumnoId), [servicio, alumnoId])
  const { datos, cargando, error } = useCarga(cargar, [])
  return (
    <Card className="mt-6 p-6">
      <h2 className="mb-3 text-base font-semibold text-slate-900">Asistencia</h2>
      {error ? (
        <p className="text-sm text-red-600">No se pudo cargar la asistencia: {error}</p>
      ) : cargando ? (
        <p className="text-sm text-slate-400">Cargando…</p>
      ) : datos.length === 0 ? (
        <p className="text-sm text-slate-400">Sin salones grupales: no hay asistencia que mostrar.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {datos.map((s) => (
            <li key={s.salon_id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
              <span className="font-medium text-slate-900">
                {s.nombre} {s.matricula === 'retirada' && <Badge color="slate">Retirado</Badge>}
              </span>
              <span className="text-xs text-slate-600">
                {s.presentes} presentes · {s.ausentes} ausentes · {s.tardanzas} tardanzas · {s.justificados} justificados
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
