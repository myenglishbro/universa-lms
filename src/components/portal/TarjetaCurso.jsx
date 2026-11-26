import Badge from '../ui/Badge'
import Icon from '../ui/Icon'
import { DIAS, portadaDe } from '../../lib/recursos'

// Tarjeta de salón del docente: portada con relieve, nivel, datos clave y horario en chips.
export default function TarjetaCurso({ curso, pie, onAbrir }) {
  const inicial = (curso.nombre ?? '?').trim().charAt(0).toUpperCase()
  const horarios = curso.horarios ?? []
  return (
    <button
      type="button"
      onClick={onAbrir}
      className="group flex w-full flex-col overflow-hidden rounded-3xl border border-brand-100 bg-white text-left shadow-sm transition duration-200 hover:-translate-y-1 hover:border-brand-200 hover:shadow-xl hover:shadow-brand-900/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
    >
      <div className={`relative h-32 overflow-hidden bg-gradient-to-br p-4 ${portadaDe(curso.nombre)}`}>
        <span aria-hidden="true" className="pointer-events-none absolute -right-8 -top-10 h-40 w-40 rounded-full bg-white/10" />
        <span aria-hidden="true" className="pointer-events-none absolute -bottom-14 left-12 h-32 w-32 rounded-full bg-white/10" />
        <span aria-hidden="true" className="pointer-events-none absolute -bottom-3 right-4 text-8xl font-black leading-none text-white/20 transition duration-300 group-hover:scale-110">{inicial}</span>
        <div className="relative flex items-start justify-between gap-2">
          <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-semibold text-white backdrop-blur">{curso.nivel || 'No level assigned'}</span>
          {curso.estado === 'finalizado' && <Badge color="slate">Finalizado</Badge>}
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-3 p-5">
        <div>
          <h3 className="line-clamp-2 text-lg font-bold leading-snug text-slate-900 transition-colors group-hover:text-brand-700">{curso.nombre}</h3>
          {curso.docente && <p className="mt-0.5 text-sm text-slate-500">{curso.docente}</p>}
        </div>

        <div className="flex flex-wrap gap-1.5">
          {horarios.length === 0 ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-50 px-2.5 py-1 text-xs text-slate-500">
              <Icon name="clock" className="h-3.5 w-3.5" /> Schedule to be defined
            </span>
          ) : (
            horarios.map((h, i) => (
              <span key={i} className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-800">
                <Icon name="clock" className="h-3.5 w-3.5 text-brand-500" />
                {DIAS[h.dia]} {h.hora_inicio.slice(0, 5)}–{h.hora_fin.slice(0, 5)}
              </span>
            ))
          )}
        </div>

        <div className="mt-auto flex items-center justify-between border-t border-slate-100 pt-3">
          <span className="text-xs font-semibold text-slate-600">{pie}</span>
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-brand-600 opacity-0 transition group-hover:translate-x-0.5 group-hover:opacity-100 group-focus-visible:opacity-100">
            Open <span aria-hidden="true">→</span>
          </span>
        </div>
      </div>
    </button>
  )
}
