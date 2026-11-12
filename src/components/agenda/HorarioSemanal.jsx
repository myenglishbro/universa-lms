import { useEffect, useMemo, useState } from 'react'
import Icon from '../ui/Icon'
import { claveItem, diaMes, nombreDia } from '../../lib/agenda'
import { hoyLima } from '../../lib/salones'

const PX_HORA = 56 // alto de cada hora en pantalla
const aMin = (t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5))

const ESTILO = {
  grupal: 'border-l-brand-600 bg-brand-100 text-brand-900 hover:bg-brand-200',
  particular: 'border-l-teal-600 bg-teal-50 text-teal-700 hover:bg-teal-100 ring-1 ring-inset ring-teal-200',
}

// Reparte en «carriles» las clases que se cruzan en el mismo día para que se vean una junto a otra y no encimadas.
function ubicar(items) {
  const orden = [...items].sort((a, b) => aMin(a.horaInicio) - aMin(b.horaInicio) || aMin(b.horaFin) - aMin(a.horaFin))
  const res = []
  let grupo = []
  let finGrupo = -1
  const cerrar = () => {
    const n = Math.max(1, ...grupo.map((g) => g.carril + 1))
    grupo.forEach((g) => res.push({ ...g, carriles: n }))
    grupo = []
  }
  for (const it of orden) {
    const ini = aMin(it.horaInicio)
    if (grupo.length && ini >= finGrupo) cerrar()
    const ocupados = new Set(grupo.filter((g) => aMin(g.item.horaFin) > ini).map((g) => g.carril))
    let carril = 0
    while (ocupados.has(carril)) carril++
    finGrupo = grupo.length ? Math.max(finGrupo, aMin(it.horaFin)) : aMin(it.horaFin)
    grupo.push({ item: it, carril })
  }
  cerrar()
  return res
}

// Minutos transcurridos del día en Lima; se actualiza cada minuto para mover la línea de «ahora».
const minutoActual = () => {
  const [h, m] = new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Lima', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date()).split(':')
  return Number(h) * 60 + Number(m)
}
function useMinutoActual() {
  const [min, setMin] = useState(minutoActual)
  useEffect(() => {
    const t = setInterval(() => setMin(minutoActual()), 60000)
    return () => clearInterval(t)
  }, [])
  return min
}

// Horario semanal estilo calendario: horas en filas, días en columnas, cada clase como un bloque de color.
export default function HorarioSemanal({ dias, porDia, conflictos, feriados, hoy, puedeEditar, onElegir, onProgramar }) {
  const todos = dias.flatMap((d) => porDia[d])
  const desde = Math.min(7 * 60, ...todos.map((i) => Math.floor(aMin(i.horaInicio) / 60) * 60))
  const hasta = Math.max(20 * 60, ...todos.map((i) => Math.ceil(aMin(i.horaFin) / 60) * 60))
  const horas = Array.from({ length: (hasta - desde) / 60 }, (_, k) => desde / 60 + k)
  const alto = horas.length * PX_HORA

  const colocados = useMemo(() => Object.fromEntries(dias.map((d) => [d, ubicar(porDia[d])])), [dias, porDia])
  const ahora = useMinutoActual()
  const hoyLima_ = hoyLima()

  return (
    <div className="overflow-x-auto rounded-2xl border border-brand-100 bg-white shadow-sm">
      <div className="min-w-[56rem]">
        {/* Cabecera de días */}
        <div className="sticky top-0 z-10 grid grid-cols-[3.5rem_repeat(7,minmax(0,1fr))] border-b border-brand-100 bg-white">
          <div />
          {dias.map((d) => {
            const esHoy = d === hoy
            return (
              <div key={d} className={`group relative border-l border-slate-100 px-2 py-2 text-center ${esHoy ? 'bg-brand-50' : ''}`}>
                <p className={`text-xs font-medium uppercase ${esHoy ? 'text-brand-700' : 'text-slate-500'}`}>{nombreDia(d).slice(0, 3)}</p>
                <p className={`mx-auto mt-0.5 flex h-8 w-8 items-center justify-center rounded-full text-base font-semibold ${esHoy ? 'bg-brand-600 text-white' : 'text-slate-900'}`}>
                  {Number(d.slice(8))}
                </p>
                {feriados.has(d) && (
                  <p className="mt-1 truncate rounded bg-peach-100 px-1 text-[10px] font-medium text-peach-700" title={feriados.get(d)}>
                    {feriados.get(d)}
                  </p>
                )}
                {puedeEditar && (
                  <button
                    type="button"
                    onClick={() => onProgramar(d)}
                    aria-label={`Schedule a private class on ${diaMes(d)}`}
                    className="absolute right-1 top-1 rounded-full p-1 text-slate-300 opacity-0 transition hover:bg-brand-50 hover:text-brand-700 focus:opacity-100 group-hover:opacity-100"
                  >
                    <Icon name="plus" className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            )
          })}
        </div>

        {/* Cuadrícula */}
        <div className="grid grid-cols-[3.5rem_repeat(7,minmax(0,1fr))]">
          <div className="relative" style={{ height: alto }}>
            {horas.map((h, k) => (
              <span key={h} className="absolute right-2 -translate-y-1/2 text-[11px] text-slate-400" style={{ top: k * PX_HORA, display: k === 0 ? 'none' : undefined }}>
                {String(h).padStart(2, '0')}:00
              </span>
            ))}
          </div>

          {dias.map((d) => (
            <div key={d} className={`relative border-l border-slate-100 ${d === hoy ? 'bg-brand-50/40' : feriados.has(d) ? 'bg-peach-50/50' : ''}`} style={{ height: alto }}>
              {horas.map((h, k) => (
                <div key={h} className="absolute inset-x-0 border-t border-slate-100" style={{ top: k * PX_HORA }} />
              ))}

              {d === hoyLima_ && ahora >= desde && ahora <= hasta && (
                <div className="pointer-events-none absolute inset-x-0 z-10 flex items-center" style={{ top: ((ahora - desde) / 60) * PX_HORA }}>
                  <span className="-ml-1 h-2 w-2 rounded-full bg-rose-500" />
                  <span className="h-px flex-1 bg-rose-500" />
                </div>
              )}

              {colocados[d].map(({ item: i, carril, carriles }) => {
                const top = ((aMin(i.horaInicio) - desde) / 60) * PX_HORA
                const h = Math.max(((aMin(i.horaFin) - aMin(i.horaInicio)) / 60) * PX_HORA, 26)
                const cancelada = i.estado === 'cancelada'
                const realizada = i.estado === 'realizada'
                const porRegistrar = i.estado === 'programada' && i.fecha < hoyLima_
                const cruce = conflictos.has(claveItem(i))
                return (
                  <button
                    key={claveItem(i)}
                    type="button"
                    onClick={() => onElegir(i)}
                    title={`${i.horaInicio}–${i.horaFin} · ${i.titulo}${i.docente ? ` · ${i.docente}` : ''}`}
                    className={`absolute overflow-hidden rounded-lg border-l-4 px-1.5 py-1 text-left text-[11px] leading-tight shadow-sm transition ${ESTILO[i.origen]} ${cancelada ? 'opacity-50' : ''} ${
                      porRegistrar ? 'outline outline-2 outline-peach-500' : ''
                    } ${cruce ? 'ring-2 ring-rose-400' : ''}`}
                    style={{ top: top + 1, height: h - 2, left: `calc(${(carril / carriles) * 100}% + 2px)`, width: `calc(${100 / carriles}% - 4px)` }}
                  >
                    <span className="flex items-center gap-1 font-semibold">
                      {i.horaInicio}
                      {realizada && <Icon name="check" className="h-3 w-3" />}
                      {porRegistrar && <Icon name="alert" className="h-3 w-3 text-peach-700" />}
                      {cruce && <Icon name="alert" className="h-3 w-3 text-rose-600" />}
                    </span>
                    <span className={`block truncate font-medium ${cancelada ? 'line-through' : ''}`}>{i.titulo}</span>
                    {h > 52 && <span className="block truncate opacity-75">{i.docente || 'No teacher'}</span>}
                  </button>
                )
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
