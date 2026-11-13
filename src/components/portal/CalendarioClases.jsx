import { useMemo, useState } from 'react'
import Icon from '../ui/Icon'
import { diaMes, nombreDia } from '../../lib/agenda'
import { cuando, hoyISO } from '../../lib/calendario'

const pad = (n) => String(n).padStart(2, '0')
const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
const SEMANA = ['L', 'M', 'M', 'J', 'V', 'S', 'D']

export function FilaClase({ c, hoy = hoyISO() }) {
  const grupal = c.origen === 'grupal'
  return (
    <li className="flex items-center gap-3 rounded-xl border border-brand-100 bg-white p-3">
      <div className={`w-14 shrink-0 rounded-lg py-1.5 text-center ${c.fecha === hoy ? 'bg-brand-600 text-white' : 'bg-brand-50 text-brand-800'}`}>
        <p className="text-[10px] font-medium uppercase opacity-80">{nombreDia(c.fecha).slice(0, 3)}</p>
        <p className="text-sm font-semibold">{diaMes(c.fecha)}</p>
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-slate-900">{c.titulo}</p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-slate-500">
          <span className="inline-flex items-center gap-1">
            <Icon name="clock" className="h-3.5 w-3.5" /> {c.hora_inicio.slice(0, 5)}–{c.hora_fin.slice(0, 5)}
          </span>
          {c.docente && <span>· {c.docente}</span>}
        </p>
      </div>
      <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${grupal ? 'bg-brand-100 text-brand-700' : 'bg-peach-100 text-peach-700'}`}>
        {c.fecha === hoy ? 'Today' : grupal ? 'Group' : 'Private'}
      </span>
    </li>
  )
}

// Calendario mensual con las clases del estudiante marcadas; al elegir un día se listan sus clases.
export default function CalendarioClases({ clases, titulo = 'Class calendar', vacio = 'There are no classes scheduled for now.' }) {
  const hoy = hoyISO()
  const [mes, setMes] = useState({ y: Number(hoy.slice(0, 4)), m: Number(hoy.slice(5, 7)) - 1 })
  const [elegido, setElegido] = useState(null)

  const porDia = useMemo(() => {
    const m = new Map()
    for (const c of clases) m.set(c.fecha, [...(m.get(c.fecha) ?? []), c])
    return m
  }, [clases])

  const primero = new Date(mes.y, mes.m, 1)
  const huecos = (primero.getDay() + 6) % 7
  const diasMes = new Date(mes.y, mes.m + 1, 0).getDate()
  const celdas = [...Array(huecos).fill(null), ...Array.from({ length: diasMes }, (_, i) => `${mes.y}-${pad(mes.m + 1)}-${pad(i + 1)}`)]
  const cambiar = (d) =>
    setMes(({ y, m }) => {
      const t = y * 12 + m + d
      return { y: Math.floor(t / 12), m: t % 12 }
    })

  const proximas = clases
    .filter((c) => c.fecha >= hoy)
    .sort((a, b) => a.fecha.localeCompare(b.fecha) || a.hora_inicio.localeCompare(b.hora_inicio))
  const delDia = elegido ? (porDia.get(elegido) ?? []) : proximas.slice(0, 5)
  const tituloLista = elegido ? `${cuando(elegido, hoy)} · ${diaMes(elegido)}` : 'Upcoming classes'

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
      <section aria-label={titulo} className="h-fit rounded-2xl border border-brand-100 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">
            {MESES[mes.m]} <span className="font-normal text-slate-400">{mes.y}</span>
          </h2>
          <div className="flex gap-1">
            <button type="button" aria-label="Previous month" onClick={() => cambiar(-1)} className="rounded-full p-1.5 text-slate-500 hover:bg-brand-50 hover:text-brand-700">
              <Icon name="back" className="h-4 w-4" />
            </button>
            <button type="button" aria-label="Next month" onClick={() => cambiar(1)} className="rounded-full p-1.5 text-slate-500 hover:bg-brand-50 hover:text-brand-700">
              <Icon name="back" className="h-4 w-4 rotate-180" />
            </button>
          </div>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center">
          {SEMANA.map((d, i) => (
            <span key={i} className="py-1 text-[11px] font-medium text-slate-400">
              {d}
            </span>
          ))}
          {celdas.map((f, i) => {
            if (!f) return <span key={`v${i}`} />
            const n = porDia.get(f)?.length ?? 0
            const esHoy = f === hoy
            const on = f === elegido
            return (
              <button
                key={f}
                type="button"
                onClick={() => setElegido(on ? null : f)}
                aria-pressed={on}
                aria-label={`${MESES[mes.m]} ${Number(f.slice(8))}${n ? `, ${n} ${n === 1 ? 'class' : 'classes'}` : ''}`}
                className={`relative flex aspect-square flex-col items-center justify-center rounded-lg text-sm transition ${
                  on ? 'bg-brand-600 font-semibold text-white' : n ? 'bg-brand-50 font-semibold text-brand-800 hover:bg-brand-100' : 'text-slate-600 hover:bg-slate-50'
                } ${esHoy && !on ? 'ring-2 ring-peach-500' : ''}`}
              >
                {Number(f.slice(8))}
                {n > 0 && <span className={`absolute bottom-1 h-1.5 w-1.5 rounded-full ${on ? 'bg-peach-200' : 'bg-brand-500'}`} />}
              </button>
            )
          })}
        </div>
        <p className="mt-3 flex items-center gap-4 text-xs text-slate-500">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-brand-500" /> Has a class
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full ring-2 ring-peach-500" /> Today
          </span>
        </p>
      </section>

      <section>
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-brand-700">{tituloLista}</h3>
        {delDia.length === 0 ? (
          <p className="rounded-xl border border-dashed border-brand-200 bg-white px-4 py-8 text-center text-sm text-slate-500">
            {elegido ? 'You have no classes this day.' : vacio}
          </p>
        ) : (
          <ul className="space-y-2">
            {delDia.map((c) => (
              <FilaClase key={`${c.origen}:${c.id}`} c={c} hoy={hoy} />
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
