import { useCallback } from 'react'
import Badge from '../ui/Badge'
import Button from '../ui/Button'
import Card from '../ui/Card'
import useCarga from '../../hooks/useCarga'
import * as servicioReal from '../../services/evaluaciones'

// Administración: qué evaluaciones faltan por registrar o publicar, agrupadas por docente y salón.
// Solo cuenta módulos en marcha de salones en curso (con alguna nota o clase ya realizada).
export default function PendientesAdmin({ servicio = servicioReal, onVerSalon }) {
  const cargar = useCallback(() => servicio.pendientes(), [servicio])
  const { datos, cargando, error, recargar } = useCarga(cargar, null)
  if (error) return <p className="text-sm text-red-600">No se pudieron cargar los pendientes: {error}</p>
  if (cargando || !datos) return <p className="py-6 text-center text-sm text-slate-500">Loading…</p>

  const porDocente = new Map()
  for (const p of datos) {
    if (!porDocente.has(p.docente)) porDocente.set(p.docente, new Map())
    const salones = porDocente.get(p.docente)
    if (!salones.has(p.salon_id)) salones.set(p.salon_id, { nombre: p.salon, filas: [] })
    salones.get(p.salon_id).filas.push(p)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="max-w-2xl text-sm text-slate-500">Assessments with grades to enter or publish in classrooms in progress. “To publish” items are drafts (or completed participations) that the student cannot see yet.</p>
        <Button variant="secondary" onClick={recargar}>
          Refresh
        </Button>
      </div>
      {datos.length === 0 ? (
        <Card className="p-6 text-center">
          <p className="text-sm text-slate-500">There are no pending assessments in modules in progress.</p>
        </Card>
      ) : (
        [...porDocente.entries()].map(([docente, salones]) => (
          <Card key={docente} className="p-5">
            <h2 className="text-base font-semibold text-slate-900">{docente}</h2>
            {[...salones.entries()].map(([id, s]) => (
              <div key={id} className="mt-3">
                <p className="text-sm font-medium text-slate-800">
                  {s.nombre}{' '}
                  {onVerSalon && (
                    <button type="button" className="text-xs text-brand-700 underline" onClick={() => onVerSalon(id)}>
                      Open classroom
                    </button>
                  )}
                </p>
                <ul className="mt-1 divide-y divide-slate-100 rounded-lg border border-slate-200">
                  {s.filas.map((p) => (
                    <li key={`${p.modulo}${p.evaluacion}`} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
                      <span className="text-slate-800">
                        {p.modulo} · {p.evaluacion}
                      </span>
                      <span className="flex flex-wrap gap-1.5 text-xs">
                        <span className="text-slate-500">{p.publicadas} publicadas</span>
                        {p.faltantes > 0 && <Badge color="rose">{p.faltantes} por registrar</Badge>}
                        {p.borradores > 0 && <Badge color="peach">{p.borradores} por publicar</Badge>}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </Card>
        ))
      )}
    </div>
  )
}
