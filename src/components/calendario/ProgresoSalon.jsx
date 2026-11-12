import Badge from '../ui/Badge'
import Button from '../ui/Button'
import Card from '../ui/Card'
import { fechaFinSalon, formatFecha } from '../../lib/salones'

// Barra de avance + resumen. `onCompletar` solo se pasa a administradores.
export default function ProgresoSalon({ salon, onCompletar, ocupado }) {
  const p = salon.progreso
  const porcentaje = Math.min(100, Math.round((p.realizadas / p.total) * 100))
  const sobrantes = p.programadas - p.restantes

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-medium text-slate-900">
          {p.realizadas} of {p.total} sessions held
        </p>
        <p className="text-sm text-slate-600">
          Estimated end: <b className="text-slate-900">{formatFecha(fechaFinSalon(salon))}</b>
          {p.sinProgramar > 0 && (
            <span className="ml-2">
              <Badge color="peach">Provisional</Badge>
            </span>
          )}
        </p>
      </div>

      <div className="mt-3 h-2 w-full rounded-full bg-slate-100">
        <div className="h-2 rounded-full bg-brand-500" style={{ width: `${porcentaje}%` }} />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-slate-600">
        <span>{p.programadas} scheduled</span>
        <span>{p.restantes} remaining</span>
        {p.canceladas > 0 && <span>{p.canceladas} cancelled</span>}
        {p.porRegistrar > 0 && <Badge color="peach">{p.porRegistrar} to record</Badge>}
        {p.sinProgramar > 0 && <Badge color="peach">{p.sinProgramar} unscheduled</Badge>}
        {sobrantes > 0 && <Badge color="peach">{sobrantes} extra scheduled</Badge>}
        {p.sinProgramar > 0 && onCompletar && (
          <Button variant="secondary" className="px-3 py-1" onClick={onCompletar} disabled={ocupado}>
            Schedule missing sessions
          </Button>
        )}
      </div>
    </Card>
  )
}
