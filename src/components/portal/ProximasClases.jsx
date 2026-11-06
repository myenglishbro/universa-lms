import Card from '../ui/Card'
import { diaMes, nombreDia } from '../../lib/agenda'

// Lista de próximas clases (grupales y particulares). `clases` viene de portal_proximas_clases.
export default function ProximasClases({ clases, titulo = 'Próximas clases', vacio = 'No hay clases programadas por ahora.', limite = 6 }) {
  return (
    <Card className="p-5">
      <h2 className="mb-3 text-base font-semibold text-slate-900">{titulo}</h2>
      {clases.length === 0 ? (
        <p className="text-sm text-slate-400">{vacio}</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {clases.slice(0, limite).map((c) => (
            <li key={`${c.origen}:${c.id}`} className="flex items-center gap-3 py-2.5">
              <div className="w-14 shrink-0 rounded-lg bg-brand-50 py-1 text-center">
                <p className="text-[10px] font-medium uppercase text-brand-700">{nombreDia(c.fecha).slice(0, 3)}</p>
                <p className="text-sm font-semibold text-brand-800">{diaMes(c.fecha)}</p>
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-slate-900">{c.titulo}</p>
                <p className="text-xs text-slate-500">
                  {c.hora_inicio.slice(0, 5)}–{c.hora_fin.slice(0, 5)} · {c.origen === 'grupal' ? 'Clase grupal' : 'Clase particular'}
                  {c.docente ? ` · ${c.docente}` : ''}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
