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
          {p.realizadas} de {p.total} sesiones realizadas
        </p>
        <p className="text-sm text-slate-600">
          Fin estimado: <b className="text-slate-900">{formatFecha(fechaFinSalon(salon))}</b>
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
        <span>{p.programadas} programadas</span>
        <span>{p.restantes} restantes</span>
        {p.canceladas > 0 && <span>{p.canceladas} canceladas</span>}
        {p.porRegistrar > 0 && <Badge color="peach">{p.porRegistrar} por registrar</Badge>}
        {p.sinProgramar > 0 && <Badge color="peach">{p.sinProgramar} sin programar</Badge>}
        {sobrantes > 0 && <Badge color="peach">{sobrantes} programadas de más</Badge>}
        {p.sinProgramar > 0 && onCompletar && (
          <Button variant="secondary" className="px-3 py-1" onClick={onCompletar} disabled={ocupado}>
            Programar sesiones faltantes
          </Button>
        )}
      </div>
    </Card>
  )
}
