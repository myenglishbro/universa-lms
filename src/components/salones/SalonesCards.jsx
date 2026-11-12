import Avatar from '../ui/Avatar'
import useFotosDocentes from '../../hooks/useFotosDocentes'
import { Anillo } from '../ui/Anillo'
import Icon from '../ui/Icon'
import BotonCompendio from './BotonCompendio'
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
  if (s.estado === 'finalizado') return { tono: 'slate', icono: 'check', texto: 'Finished' }
  if (s.estado === 'pendiente') return { tono: 'slate', icono: 'clock', texto: 'Not started yet' }
  if (dias === null) return { tono: 'slate', icono: 'clock', texto: 'No end date' }
  if (dias < 0) return { tono: 'rose', icono: 'alert', texto: `Overdue by ${-dias} ${dias === -1 ? 'day' : 'days'}` }
  if (dias === 0) return { tono: 'peach', icono: 'flag', texto: 'Ends today' }
  if (dias <= 7) return { tono: 'peach', icono: 'flag', texto: `Ends in ${dias} ${dias === 1 ? 'day' : 'days'}` }
  if (dias <= 30) return { tono: 'brand', icono: 'calendar', texto: `Ends in ${dias} days` }
  return { tono: 'slate', icono: 'calendar', texto: `Ends on ${formatFecha(s.fechaFin)}` }
}

// Lista de salones en tarjetas compactas: foto del docente, nombre, avance y lo que falta, en el menor espacio posible.
export default function SalonesCards({ salones, puedeEditar, onVer, onEditar }) {
  const fotos = useFotosDocentes()
  return (
    <ul className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
      {salones.map((s) => {
        const pct = s.progreso ? porcentajeAvance(s.progreso.realizadas, s.progreso.total) : null
        const pl = plazo(s)
        const faltantes = [!s.docente && 'teacher', !s.nivel && 'level'].filter(Boolean)
        const sinAsistencia = s.progreso?.porRegistrar ?? 0
        const sinGrabacion = s.pendientes?.sinGrabacion ?? 0
        return (
          <li key={s.id} className="group flex flex-col overflow-hidden rounded-2xl border border-brand-100 bg-white shadow-sm transition hover:shadow-md">
            <div className={`h-1.5 bg-gradient-to-r ${portadaDe(s.nombre)}`} />
            <button type="button" onClick={() => onVer(s.id)} className="flex flex-1 flex-col gap-2.5 p-3.5 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500">
              <div className="flex items-center gap-3">
                <Avatar nombre={s.docente || '?'} fotoUrl={fotos.get(s.docenteId)} tamano="md" className={s.docente ? '' : 'opacity-40'} />
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500">
                    {s.codigo} <EstadoBadge estado={s.estado} />
                  </p>
                  <h3 className="truncate text-sm font-semibold text-slate-900" title={s.nombre}>
                    {s.nombre}
                  </h3>
                  <p className="truncate text-xs text-slate-500">{s.docente || <span className="text-peach-700">No teacher</span>}</p>
                </div>
                <Anillo valor={pct} size={44} grosor={5} etiqueta={`Progress of ${s.nombre}`} />
              </div>

              <p className="flex items-center gap-1.5 text-xs text-slate-600">
                <Icon name="box" className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                <span className="truncate">{s.nivel || <span className="text-peach-700">No level</span>}</span>
                <span className="text-slate-300">·</span>
                <Icon name="clock" className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                <span className="truncate">{formatHorario(s.horarios)}</span>
              </p>

              <div className="flex flex-wrap items-center gap-1.5">
                <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${CHIP[pl.tono]}`}>
                  <Icon name={pl.icono} className="h-3 w-3" /> {pl.texto}
                </span>
                {sinAsistencia > 0 && (
                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${CHIP.peach}`} title="Past classes with no attendance recorded">
                    <Icon name="check" className="h-3 w-3" /> {sinAsistencia} without attendance
                  </span>
                )}
                {sinGrabacion > 0 && (
                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${CHIP.peach}`} title="Past classes with no recording">
                    <Icon name="play" className="h-3 w-3" /> {sinGrabacion} without recording
                  </span>
                )}
                {faltantes.length > 0 && s.estado !== 'finalizado' && (
                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${CHIP.peach}`}>Missing {faltantes.join(' and ')}</span>
                )}
              </div>
            </button>
            <div className="flex items-center justify-between gap-2 border-t border-brand-100 bg-brand-50/40 px-3.5 py-1.5 text-xs text-slate-500">
              <span className="inline-flex items-center gap-1 truncate">
                <Icon name="users" className="h-3.5 w-3.5" /> {s.capacidad} · {s.progreso?.total ? `${s.progreso.realizadas}/${s.progreso.total} classes` : 'No calendar'}
              </span>
              <div className="flex shrink-0 items-center">
                {puedeEditar && <BotonCompendio salon={s} variant="ghost" className="px-2 py-1 text-xs" etiqueta="Excel" />}
                {puedeEditar && (
                  <button type="button" onClick={() => onEditar(s.id)} className="rounded-lg px-2 py-1 font-medium text-slate-600 hover:bg-white hover:text-brand-700">
                    Edit
                  </button>
                )}
                <button type="button" onClick={() => onVer(s.id)} className="rounded-lg px-2 py-1 font-semibold text-brand-700 hover:bg-white">
                  View
                </button>
              </div>
            </div>
          </li>
        )
      })}
    </ul>
  )
}
