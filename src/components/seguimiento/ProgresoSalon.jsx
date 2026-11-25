import { NOTA_PROGRESO, porcentajeAvance } from '../../lib/asistencia'
import { minutosTexto } from '../../lib/paquetes'
import { Anillo } from '../ui/Anillo'

function Cifra({ valor, etiqueta, alerta = false }) {
  return (
    <div className={`min-w-[5.5rem] rounded-xl px-3 py-2 text-center ${alerta ? 'bg-peach-50 text-peach-700' : 'bg-slate-50 text-slate-900'}`}>
      <dd className="text-lg font-bold leading-none">{valor}</dd>
      <dt className="mt-1 text-[11px] text-slate-500">{etiqueta}</dt>
    </div>
  )
}

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
  const horas = progreso.horas
  if (horas) {
    const pctH = porcentajeAvance(horas.consumidas, horas.contratadas)
    return (
      <div>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-sm font-medium text-slate-900">
            {minutosTexto(horas.consumidas)} of {minutosTexto(horas.contratadas)} used
            {pctH !== null && <span className="ml-2 text-brand-700">{pctH}%</span>}
          </p>
          <p className="text-xs text-slate-500">
            {minutosTexto(Math.max(horas.disponibles, 0))} remaining
            {horas.programadas > 0 && ` · ${minutosTexto(horas.programadas)} scheduled`}
            {porRegistrar > 0 && ` · ${porRegistrar} to record`}
          </p>
        </div>
        <div className="mt-2"><Barra valor={horas.consumidas} total={horas.contratadas} etiqueta="Package hours used" /></div>
        <p className="mt-3 text-xs text-slate-400">Hours are deducted from the package each time a class is held.</p>
      </div>
    )
  }
  return (
    <div>
      <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
        <div className="flex items-center gap-4">
          <Anillo valor={pct} size={76} grosor={8} etiqueta="Classroom progress" />
          <div>
            <p className="text-2xl font-bold leading-none text-slate-900">
              {realizadas}
              {total ? <span className="text-base font-medium text-slate-400"> / {total}</span> : null}
            </p>
            <p className="mt-1 text-xs text-slate-500">{total ? 'sessions held' : 'sessions held (no total defined)'}</p>
          </div>
        </div>
        <dl className="flex flex-wrap gap-2">
          <Cifra valor={programadas} etiqueta="Scheduled" />
          <Cifra valor={porRegistrar} etiqueta="To record" alerta={porRegistrar > 0} />
          {total ? <Cifra valor={Math.max(total - realizadas, 0)} etiqueta="Remaining" /> : null}
        </dl>
      </div>
      {ciclos.length > 0 && (
        <ul className="mt-4 grid gap-x-6 gap-y-2 border-t border-slate-100 pt-4 sm:grid-cols-2">
          {ciclos.map((c) => (
            <li key={c.ciclo}>
              <p className="mb-1 flex justify-between text-xs text-slate-600">
                <span className="font-medium">Cycle {c.ciclo}</span>
                <span>
                  {c.realizadas} of {c.sesiones} sessions
                </span>
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
