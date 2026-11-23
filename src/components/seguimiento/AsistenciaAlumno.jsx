import { useCallback } from 'react'
import Badge from '../ui/Badge'
import Card from '../ui/Card'
import useCarga from '../../hooks/useCarga'
import { LIMITE_INASISTENCIA, riesgoAsistencia } from '../../lib/asistencia'
import * as asistenciaReal from '../../services/asistencia'

// Ficha del estudiante (administración y comercial): asistencia acumulada en cada salón donde está o estuvo matriculado.
export default function AsistenciaAlumno({ alumnoId, servicio = asistenciaReal }) {
  const cargar = useCallback(() => servicio.resumenDelAlumno(alumnoId), [servicio, alumnoId])
  const { datos, cargando, error } = useCarga(cargar, [])
  return (
    <Card className="mt-6 p-6">
      <h2 className="mb-3 text-base font-semibold text-slate-900">Attendance</h2>
      {error ? (
        <p className="text-sm text-red-600">Could not load attendance: {error}</p>
      ) : cargando ? (
        <p className="text-sm text-slate-400">Loading…</p>
      ) : datos.length === 0 ? (
        <p className="text-sm text-slate-400">No group classrooms: there is no attendance to show.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {datos.map((s) => {
            const r = riesgoAsistencia({ presente: s.presentes, ausente: s.ausentes, tardanza: s.tardanzas }, s.total_sesiones)
            return (
            <li key={s.salon_id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
              <span className="font-medium text-slate-900">
                {s.nombre} {s.matricula === 'retirada' && <Badge color="slate">Retirado</Badge>}
              </span>
              <span className="text-xs text-slate-600">
                {s.presentes} presentes · {s.ausentes} ausentes · {s.tardanzas} tardanzas · {s.justificados} justificados
              </span>
              {r.base > 0 && (
                <span className={`w-full text-xs ${r.enRiesgo ? 'font-bold text-rose-700' : r.cercano ? 'font-medium text-amber-800' : 'text-slate-500'}`}>
                  {r.enRiesgo ? `⚠ Repeats the course: ${r.pct}% absences (limit ${LIMITE_INASISTENCIA}%)` : `Absences ${r.pct}% of ${r.porTotal ? 'the course' : 'classes recorded'} (2 late = 1 absence, limit ${LIMITE_INASISTENCIA}%)${r.limiteClases ? ` · can still miss ${r.faltasRestantes} or be late ${r.tardanzasRestantes}` : ''}`}
                </span>
              )}
            </li>
            )
          })}
        </ul>
      )}
    </Card>
  )
}
