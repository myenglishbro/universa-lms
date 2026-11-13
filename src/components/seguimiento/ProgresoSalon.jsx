import { NOTA_PROGRESO, porcentajeAvance } from '../../lib/asistencia'

function Barra({ valor, total, etiqueta }) {
  const pct = total ? Math.min(100, Math.round((valor / total) * 100)) : 0
  return (
    <div role="progressbar" aria-label={etiqueta} aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} className="h-2 overflow-hidden rounded-full bg-slate-100">
      <div className="h-full rounded-full bg-brand-500" style={{ width: `${pct}%` }} />
    </div>
  )
}

// Avance por sesiones: total del salón y, si hay plan, por ciclo. Deja claro que no es aprobación.
export default function ProgresoSalon({ progreso }) {
  const { total, realizadas, programadas, por_registrar: porRegistrar, ciclos = [] } = progreso
  const pct = porcentajeAvance(realizadas, total)
  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-medium text-slate-900">
          {total ? `${realizadas} of ${total} sessions held` : `${realizadas} sessions held`}
          {pct !== null && <span className="ml-2 text-brand-700">{pct}%</span>}
        </p>
        <p className="text-xs text-slate-500">
          {programadas} {programadas === 1 ? 'programada' : 'programadas'}
          {porRegistrar > 0 && ` · ${porRegistrar} to record`}
        </p>
      </div>
      {total ? <div className="mt-2"><Barra valor={realizadas} total={total} etiqueta="Classroom progress" /></div> : <p className="mt-1 text-xs text-slate-400">This classroom has no total number of sessions defined yet.</p>}
      {ciclos.length > 0 && (
        <ul className="mt-3 space-y-2">
          {ciclos.map((c) => (
            <li key={c.ciclo}>
              <p className="flex justify-between text-xs text-slate-600">
                <span>Cycle {c.ciclo}</span>
                <span>{c.realizadas} de {c.sesiones} sesiones</span>
              </p>
              <Barra valor={c.realizadas} total={c.sesiones} etiqueta={`Progress of cycle ${c.ciclo}`} />
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-xs text-slate-400">{NOTA_PROGRESO}</p>
    </div>
  )
}
