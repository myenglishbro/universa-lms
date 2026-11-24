import { useMemo, useState } from 'react'
import Icon from '../ui/Icon'
import { ESTILO_PRIORIDAD, etiquetaPrioridad, hoyLima, mesGrid, ticketsPorFecha, vencido } from '../../lib/tickets'

const DIAS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const MAX_POR_DIA = 3
const nombreMes = (anio, mes) => new Date(Date.UTC(anio, mes, 1)).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })
const fechaLarga = (f) => new Date(`${f}T00:00:00Z`).toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })

function Chip({ ticket, onAbrir }) {
  const p = ESTILO_PRIORIDAD[ticket.prioridad] ?? ESTILO_PRIORIDAD.media
  const hecho = ticket.estado === 'realizado'
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        onAbrir(ticket.id)
      }}
      title={`${ticket.codigo} · ${ticket.titulo} (${etiquetaPrioridad(ticket.prioridad)})`}
      className={`flex w-full items-center gap-1 overflow-hidden rounded-md border border-slate-200 bg-white px-1 py-0.5 text-left text-[11px] leading-tight hover:border-brand-300 ${hecho ? 'opacity-60' : ''}`}
    >
      <span aria-hidden className={`h-3 w-1 shrink-0 rounded-full ${p.franja}`} />
      <span className={`truncate ${hecho ? 'line-through' : vencido(ticket) ? 'font-semibold text-rose-700' : 'text-slate-800'}`}>{ticket.titulo}</span>
    </button>
  )
}

// Calendario mensual por fecha límite: cada ticket aparece en el día de su fecha límite. Clic en un día lista sus tickets; clic en uno lo abre.
export default function TicketCalendario({ tickets, onAbrir }) {
  const hoy = hoyLima()
  const [anio, setAnio] = useState(Number(hoy.slice(0, 4)))
  const [mes, setMes] = useState(Number(hoy.slice(5, 7)) - 1)
  const [dia, setDia] = useState(hoy)
  const grid = useMemo(() => mesGrid(anio, mes), [anio, mes])
  const porFecha = useMemo(() => ticketsPorFecha(tickets), [tickets])
  const sinFecha = tickets.filter((t) => !t.fecha_limite).length
  const delMes = grid.flat().filter((d) => d.delMes).reduce((s, d) => s + (porFecha.get(d.fecha)?.length ?? 0), 0)
  const delDia = porFecha.get(dia) ?? []

  const mover = (delta) => {
    const f = new Date(Date.UTC(anio, mes + delta, 1))
    setAnio(f.getUTCFullYear())
    setMes(f.getUTCMonth())
  }
  const irHoy = () => {
    setAnio(Number(hoy.slice(0, 4)))
    setMes(Number(hoy.slice(5, 7)) - 1)
    setDia(hoy)
  }

  return (
    <div className="rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-200">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => mover(-1)} aria-label="Previous month" className="rounded-lg p-2 text-slate-600 hover:bg-slate-100">
            <Icon name="back" className="h-4 w-4" />
          </button>
          <h2 className="min-w-40 text-center text-base font-semibold capitalize text-slate-900" aria-live="polite">
            {nombreMes(anio, mes)}
          </h2>
          <button type="button" onClick={() => mover(1)} aria-label="Next month" className="rounded-lg p-2 text-slate-600 hover:bg-slate-100">
            <Icon name="back" className="h-4 w-4 rotate-180" />
          </button>
          <button type="button" onClick={irHoy} className="ml-1 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-200">
            Today
          </button>
        </div>
        <p className="text-xs text-slate-500">
          {delMes} due this month{sinFecha > 0 ? ` · ${sinFecha} without a due date (not shown)` : ''}
        </p>
      </div>

      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-xl bg-slate-200 text-xs">
        {DIAS.map((d) => (
          <div key={d} className="bg-slate-50 px-1 py-1.5 text-center font-semibold text-slate-500">
            {d}
          </div>
        ))}
        {grid.flat().map((d) => {
          const lista = porFecha.get(d.fecha) ?? []
          const esHoy = d.fecha === hoy
          const elegido = d.fecha === dia
          const atrasados = lista.filter((t) => vencido(t)).length
          return (
            <div
              key={d.fecha}
              role="button"
              tabIndex={0}
              aria-label={`${fechaLarga(d.fecha)}: ${lista.length} tickets`}
              aria-pressed={elegido}
              onClick={() => setDia(d.fecha)}
              onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setDia(d.fecha)}
              className={`min-h-16 cursor-pointer p-1 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500 sm:min-h-24 ${d.delMes ? 'bg-white' : 'bg-slate-50 text-slate-400'} ${elegido ? 'ring-2 ring-inset ring-brand-400' : ''}`}
            >
              <span className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[11px] font-semibold ${esHoy ? 'bg-brand-600 text-white' : d.delMes ? 'text-slate-700' : 'text-slate-400'}`}>{Number(d.fecha.slice(8))}</span>
              {/* Celular: solo un contador (los títulos no caben); el detalle sale en la lista de abajo. */}
              {lista.length > 0 && (
                <span className={`ml-1 inline-flex rounded-full px-1.5 text-[10px] font-bold sm:hidden ${atrasados ? 'bg-rose-100 text-rose-700' : 'bg-brand-100 text-brand-700'}`}>{lista.length}</span>
              )}
              <div className="mt-1 hidden space-y-0.5 sm:block">
                {lista.slice(0, MAX_POR_DIA).map((t) => (
                  <Chip key={t.id} ticket={t} onAbrir={onAbrir} />
                ))}
                {lista.length > MAX_POR_DIA && <p className="px-1 text-[10px] font-semibold text-brand-700">+{lista.length - MAX_POR_DIA} more</p>}
              </div>
            </div>
          )
        })}
      </div>

      <section className="mt-4" aria-live="polite">
        <h3 className="text-sm font-semibold capitalize text-slate-900">
          {fechaLarga(dia)} <span className="font-normal text-slate-400">· {delDia.length} {delDia.length === 1 ? 'ticket' : 'tickets'}</span>
        </h3>
        {delDia.length === 0 ? (
          <p className="mt-1 text-xs text-slate-400">No tickets are due this day.</p>
        ) : (
          <ul className="mt-2 grid gap-2 sm:grid-cols-2">
            {delDia.map((t) => (
              <li key={t.id}>
                <button type="button" onClick={() => onAbrir(t.id)} className="flex w-full items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-left hover:border-brand-300">
                  <span aria-hidden className={`h-8 w-1.5 shrink-0 rounded-full ${(ESTILO_PRIORIDAD[t.prioridad] ?? ESTILO_PRIORIDAD.media).franja}`} />
                  <span className="min-w-0">
                    <span className={`block truncate text-sm font-semibold ${t.estado === 'realizado' ? 'text-slate-400 line-through' : 'text-slate-900'}`}>{t.titulo}</span>
                    <span className="block text-xs text-slate-500">
                      {t.codigo} · {etiquetaPrioridad(t.prioridad)}
                      {vencido(t) ? ' · overdue' : ''}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
