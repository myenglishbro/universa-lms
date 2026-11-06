import Button from '../ui/Button'
import { Anillo } from '../ui/Anillo'
import Icon from '../ui/Icon'
import EstadoBadge from './EstadoBadge'
import { portadaDe } from '../../lib/recursos'
import { porcentajeAvance } from '../../lib/asistencia'
import { diasParaFin, formatFecha, formatHorario } from '../../lib/salones'

const CHIP = {
  rose: 'bg-rose-50 text-rose-700 ring-rose-200',
  peach: 'bg-peach-50 text-peach-700 ring-peach-200',
  brand: 'bg-brand-50 text-brand-700 ring-brand-200',
  slate: 'bg-slate-50 text-slate-500 ring-slate-200',
}

// Qué tan cerca está el fin del salón, con el mismo semáforo del dashboard.
function plazo(s) {
  const dias = diasParaFin(s)
  if (s.estado === 'finalizado') return { tono: 'slate', icono: 'check', texto: 'Finalizado' }
  if (s.estado === 'pendiente') return { tono: 'slate', icono: 'clock', texto: 'Aún no inicia' }
  if (dias === null) return { tono: 'slate', icono: 'clock', texto: 'Sin fecha de fin' }
  if (dias < 0) return { tono: 'rose', icono: 'alert', texto: `Venció hace ${-dias} ${dias === -1 ? 'día' : 'días'}` }
  if (dias === 0) return { tono: 'peach', icono: 'flag', texto: 'Termina hoy' }
  if (dias <= 7) return { tono: 'peach', icono: 'flag', texto: `Termina en ${dias} ${dias === 1 ? 'día' : 'días'}` }
  if (dias <= 30) return { tono: 'brand', icono: 'calendar', texto: `Termina en ${dias} días` }
  return { tono: 'slate', icono: 'calendar', texto: `Termina el ${formatFecha(s.fechaFin)}` }
}

// Lista de salones en tarjetas: cada una resume quién, cuándo, cuánto avanzó y qué falta completar.
export default function SalonesCards({ salones, puedeEditar, onVer, onEditar }) {
  return (
    <ul className="grid gap-4 p-4 sm:grid-cols-2 xl:grid-cols-3">
      {salones.map((s) => {
        const pct = s.progreso ? porcentajeAvance(s.progreso.realizadas, s.progreso.total) : null
        const pl = plazo(s)
        const faltantes = [!s.docente && 'docente', !s.nivel && 'nivel'].filter(Boolean)
        return (
          <li key={s.id} className="flex flex-col overflow-hidden rounded-2xl border border-brand-100 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
            <div className={`relative h-2 bg-gradient-to-r ${portadaDe(s.nombre)}`} />
            <button type="button" onClick={() => onVer(s.id)} className="flex flex-1 flex-col gap-3 p-4 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-slate-500">{s.codigo}</p>
                  <h3 className="line-clamp-2 text-base font-semibold text-slate-900">{s.nombre}</h3>
                </div>
                <Anillo valor={pct} size={56} grosor={6} etiqueta={`Avance de ${s.nombre}`} />
              </div>

              <ul className="space-y-1 text-sm text-slate-600">
                <li className="flex items-center gap-2">
                  <Icon name="box" className="h-4 w-4 shrink-0 text-slate-400" /> {s.nivel || <span className="text-peach-700">Sin nivel</span>}
                </li>
                <li className="flex items-center gap-2">
                  <Icon name="teacher" className="h-4 w-4 shrink-0 text-slate-400" /> {s.docente || <span className="text-peach-700">Sin docente</span>}
                </li>
                <li className="flex items-center gap-2">
                  <Icon name="clock" className="h-4 w-4 shrink-0 text-slate-400" /> <span className="truncate">{formatHorario(s.horarios)}</span>
                </li>
              </ul>

              <div className="flex flex-wrap items-center gap-2">
                <EstadoBadge estado={s.estado} />
                <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${CHIP[pl.tono]}`}>
                  <Icon name={pl.icono} className="h-3 w-3" /> {pl.texto}
                </span>
                {s.progreso?.porRegistrar > 0 && (
                  <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${CHIP.peach}`} title="Clases que ya pasaron y falta registrar">
                    <Icon name="eye" className="h-3 w-3" /> {s.progreso.porRegistrar} sin registrar
                  </span>
                )}
              </div>

              {faltantes.length > 0 && s.estado !== 'finalizado' && (
                <p className="rounded-lg bg-peach-50 px-3 py-1.5 text-xs text-peach-700">Falta asignar: {faltantes.join(' y ')}</p>
              )}

              <div className="mt-auto flex items-center justify-between border-t border-brand-100 pt-3 text-xs text-slate-500">
                <span className="inline-flex items-center gap-1">
                  <Icon name="users" className="h-3.5 w-3.5" /> Capacidad {s.capacidad}
                </span>
                <span>{s.progreso?.total ? `${s.progreso.realizadas} de ${s.progreso.total} clases` : 'Sin calendario'}</span>
              </div>
            </button>
            <div className="flex items-center justify-between border-t border-brand-100 bg-brand-50/40 px-3 py-2">
              <Button variant="ghost" className="px-3 py-1" onClick={() => onVer(s.id)}>
                Ver salón
              </Button>
              {puedeEditar && (
                <Button variant="ghost" className="px-3 py-1" onClick={() => onEditar(s.id)}>
                  Editar
                </Button>
              )}
            </div>
          </li>
        )
      })}
    </ul>
  )
}
