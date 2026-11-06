import { useCallback } from 'react'
import Badge from '../ui/Badge'
import Icon from '../ui/Icon'
import { Anillo } from '../ui/Anillo'
import useCarga from '../../hooks/useCarga'
import { porcentajeAvance } from '../../lib/asistencia'
import { horariosTexto, portadaDe } from '../../lib/recursos'
import { diaMes } from '../../lib/agenda'
import { cuando } from '../../lib/calendario'
import * as asistenciaReal from '../../services/asistencia'

// Tarjeta de curso del estudiante: portada con relieve, anillo de avance, próxima clase y acceso directo.
export default function TarjetaCursoEstudiante({ curso, proxima, onAbrir, asistencia = asistenciaReal }) {
  const cargar = useCallback(() => asistencia.progresoDelSalon(curso.salon_id), [asistencia, curso.salon_id])
  const { datos: progreso } = useCarga(cargar, null)
  const pct = progreso ? porcentajeAvance(progreso.realizadas, progreso.total) : null
  const inicial = (curso.nombre ?? '?').trim().charAt(0).toUpperCase()

  return (
    <button
      type="button"
      onClick={onAbrir}
      className="group flex w-full flex-col overflow-hidden rounded-2xl border border-brand-100 bg-white text-left shadow-sm transition hover:-translate-y-1 hover:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
    >
      <div className={`relative h-36 overflow-hidden bg-gradient-to-br p-4 ${portadaDe(curso.nombre)}`}>
        <span className="pointer-events-none absolute -right-8 -top-10 h-40 w-40 rounded-full bg-white/10" />
        <span className="pointer-events-none absolute -bottom-12 left-10 h-32 w-32 rounded-full bg-white/10" />
        <span className="pointer-events-none absolute right-4 bottom-1 text-7xl font-black text-white/20">{inicial}</span>
        <div className="relative flex items-start justify-between gap-2">
          <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-medium text-white backdrop-blur">{curso.nivel || 'Sin nivel'}</span>
          {curso.estado === 'finalizado' && <Badge color="slate">Finalizado</Badge>}
        </div>
      </div>

      <div className="relative flex flex-1 flex-col gap-3 p-5 pt-4">
        <div className="absolute -top-9 right-4 rounded-full bg-white p-1 shadow-md">
          <Anillo valor={pct} size={64} grosor={7} etiqueta={`Avance de ${curso.nombre}`} />
        </div>
        <div className="min-w-0 pr-16">
          <h3 className="line-clamp-2 text-lg font-semibold leading-snug text-slate-900 group-hover:text-brand-700">{curso.nombre}</h3>
          <p className="mt-0.5 flex items-center gap-1.5 text-sm text-slate-500">
            <Icon name="teacher" className="h-4 w-4 shrink-0" /> <span className="truncate">{curso.docente || 'Docente por asignar'}</span>
          </p>
        </div>

        <p className="flex items-center gap-1.5 text-xs text-slate-500">
          <Icon name="clock" className="h-3.5 w-3.5 shrink-0" /> {horariosTexto(curso.horarios)}
        </p>

        {proxima ? (
          <div className="flex items-center gap-2 rounded-lg bg-peach-50 px-3 py-2 text-xs text-peach-700">
            <Icon name="calendar" className="h-4 w-4 shrink-0" />
            <span className="min-w-0 truncate">
              Próxima clase: <strong>{cuando(proxima.fecha)}</strong> {diaMes(proxima.fecha)} · {proxima.hora_inicio.slice(0, 5)}
            </span>
          </div>
        ) : (
          <div className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-400">Sin clases programadas</div>
        )}

        <div className="mt-auto flex items-center justify-between border-t border-brand-100 pt-3 text-xs">
          <span className="text-slate-500">
            {progreso?.total ? `${progreso.realizadas} de ${progreso.total} clases` : curso.lecciones > 0 ? `${curso.lecciones} ${curso.lecciones === 1 ? 'lección' : 'lecciones'}` : 'Contenido próximamente'}
          </span>
          <span className="inline-flex items-center gap-1 font-semibold text-brand-700">
            Continuar <Icon name="back" className="h-3.5 w-3.5 rotate-180 transition group-hover:translate-x-0.5" />
          </span>
        </div>
      </div>
    </button>
  )
}
