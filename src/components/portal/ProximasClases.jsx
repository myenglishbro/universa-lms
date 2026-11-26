import Icon from '../ui/Icon'
import { diaMes, nombreDia, sumarDias } from '../../lib/agenda'

const hoyISO = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// Lista de próximas clases (grupales y particulares). `clases` viene de portal_proximas_clases.
// La primera se destaca como «Next»; las de hoy y mañana llevan etiqueta.
export default function ProximasClases({ clases, titulo = 'Upcoming classes', vacio = 'There are no classes scheduled for now.', limite = 6 }) {
  const hoy = hoyISO()
  const manana = sumarDias(hoy, 1)
  const etiqueta = (f) => (f === hoy ? 'Today' : f === manana ? 'Tomorrow' : null)
  const lista = clases.slice(0, limite)

  return (
    <section className="overflow-hidden rounded-3xl border border-brand-100 bg-white shadow-sm">
      <div className="flex items-center justify-between gap-2 border-b border-brand-50 bg-gradient-to-r from-brand-50 to-white px-5 py-4">
        <h2 className="flex items-center gap-2 text-base font-bold text-slate-900">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand-600 text-white">
            <Icon name="calendar" className="h-4 w-4" />
          </span>
          {titulo}
        </h2>
        {clases.length > 0 && <span className="rounded-full bg-brand-100 px-2.5 py-0.5 text-xs font-semibold text-brand-700">{clases.length}</span>}
      </div>

      {lista.length === 0 ? (
        <div className="flex flex-col items-center gap-2 px-5 py-10 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-50 text-slate-300">
            <Icon name="calendar" className="h-6 w-6" />
          </span>
          <p className="text-sm text-slate-400">{vacio}</p>
        </div>
      ) : (
        <ul className="space-y-1 p-3">
          {lista.map((c, i) => {
            const marca = etiqueta(c.fecha)
            const primera = i === 0
            return (
              <li key={`${c.origen}:${c.id}`} className={`flex items-center gap-3.5 rounded-2xl p-2.5 transition ${primera ? 'bg-brand-50/70 ring-1 ring-brand-100' : 'hover:bg-slate-50'}`}>
                <div className={`w-14 shrink-0 rounded-xl py-1.5 text-center ${primera ? 'bg-brand-600 text-white shadow-md shadow-brand-600/25' : 'bg-brand-50 text-brand-800'}`}>
                  <p className={`text-[10px] font-semibold uppercase tracking-wide ${primera ? 'text-brand-100' : 'text-brand-600'}`}>{nombreDia(c.fecha).slice(0, 3)}</p>
                  <p className="text-sm font-bold leading-tight">{diaMes(c.fecha)}</p>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    {primera && <span className="shrink-0 rounded-full bg-peach-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">Next</span>}
                    {marca && !primera && <span className="shrink-0 rounded-full bg-peach-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-peach-700">{marca}</span>}
                    <p className="truncate text-sm font-semibold text-slate-900">{c.titulo}</p>
                  </div>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500">
                    <span className="inline-flex items-center gap-1 font-medium text-slate-700">
                      <Icon name="clock" className="h-3.5 w-3.5 text-brand-500" />
                      {c.hora_inicio.slice(0, 5)}–{c.hora_fin.slice(0, 5)}
                    </span>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${c.origen === 'grupal' ? 'bg-brand-100 text-brand-700' : 'bg-peach-100 text-peach-700'}`}>{c.origen === 'grupal' ? 'Group' : 'Private'}</span>
                    {marca && primera && <span className="font-semibold text-peach-700">{marca}</span>}
                    {c.docente && <span className="truncate">{c.docente}</span>}
                  </p>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
