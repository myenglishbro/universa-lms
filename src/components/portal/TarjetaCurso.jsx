import Badge from '../ui/Badge'
import Icon from '../ui/Icon'
import { horariosTexto, portadaDe } from '../../lib/recursos'

// Tarjeta de curso estilo plataforma de aprendizaje: portada de color, nombre, nivel y datos clave.
export default function TarjetaCurso({ curso, pie, onAbrir }) {
  const inicial = (curso.nombre ?? '?').trim().charAt(0).toUpperCase()
  return (
    <button
      type="button"
      onClick={onAbrir}
      className="group flex w-full flex-col overflow-hidden rounded-xl border border-slate-200 bg-white text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
    >
      <div className={`flex h-28 items-end justify-between bg-gradient-to-br p-4 ${portadaDe(curso.nombre)}`}>
        <span className="text-4xl font-bold text-white/90">{inicial}</span>
        {curso.estado === 'finalizado' && <Badge color="slate">Finalizado</Badge>}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <h3 className="line-clamp-2 text-base font-semibold text-slate-900 group-hover:text-brand-700">{curso.nombre}</h3>
        <p className="text-sm text-slate-500">{[curso.nivel || 'Sin nivel asignado', curso.docente].filter(Boolean).join(' · ')}</p>
        <p className="flex items-center gap-1.5 text-xs text-slate-500">
          <Icon name="clock" className="h-3.5 w-3.5" /> {horariosTexto(curso.horarios)}
        </p>
        <p className="mt-auto pt-2 text-xs font-medium text-brand-700">{pie}</p>
      </div>
    </button>
  )
}
