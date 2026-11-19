import { useState } from 'react'
import Avatar from '../ui/Avatar'
import useFotosDocentes from '../../hooks/useFotosDocentes'
import { Anillo } from '../ui/Anillo'
import Icon from '../ui/Icon'
import BotonCompendio from './BotonCompendio'
import EstadoBadge from './EstadoBadge'
import { porcentajeAvance } from '../../lib/asistencia'
import { minutosTexto } from '../../lib/paquetes'
import { SIN_COLOR } from '../../lib/coloresNivel'
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

// La alerta más grave del salón (una sola: el resto se ve en el detalle). Sin alertas devuelve null.
function alertaPrincipal(s, pl) {
  if (s.estado !== 'finalizado') {
    if (!s.docente) return { tono: 'rose', icono: 'alert', texto: 'No teacher assigned' }
    if (!s.nivel) return { tono: 'rose', icono: 'alert', texto: 'No level set' }
  }
  if (pl.tono === 'rose') return { ...pl }
  const sinAsistencia = s.progreso?.porRegistrar ?? 0
  if (sinAsistencia > 0) return { tono: 'peach', icono: 'check', texto: `${sinAsistencia} ${sinAsistencia === 1 ? 'class' : 'classes'} without attendance`, ayuda: 'Past classes with no attendance recorded' }
  const sinGrabacion = s.pendientes?.sinGrabacion ?? 0
  if (sinGrabacion > 0) return { tono: 'peach', icono: 'play', texto: `${sinGrabacion} without recording`, ayuda: 'Past classes with no recording' }
  if (pl.tono === 'peach') return { ...pl }
  return null
}

// Menú «⋯» de la tarjeta: ver, editar y descargar el Excel del salón.
function MenuTarjeta({ salon, puedeEditar, onVer, onEditar }) {
  const [abierto, setAbierto] = useState(false)
  return (
    <div className="relative shrink-0">
      <button type="button" aria-label={`More actions for ${salon.nombre}`} aria-haspopup="menu" aria-expanded={abierto} onClick={() => setAbierto((v) => !v)} className="flex h-8 w-8 items-center justify-center rounded-lg text-lg leading-none text-slate-500 hover:bg-brand-50 hover:text-brand-700">
        ⋯
      </button>
      {abierto && (
        <>
          <button type="button" aria-label="Close menu" className="fixed inset-0 z-20 cursor-default" onClick={() => setAbierto(false)} />
          <div role="menu" className="absolute right-0 z-30 mt-1 w-48 overflow-hidden rounded-xl border border-slate-200 bg-white p-1 shadow-lg">
            <button role="menuitem" type="button" onClick={() => { setAbierto(false); onVer(salon.id) }} className="block w-full rounded-lg px-3 py-2 text-left text-sm font-semibold text-brand-700 hover:bg-brand-50">
              View
            </button>
            {puedeEditar && (
              <button role="menuitem" type="button" onClick={() => { setAbierto(false); onEditar(salon.id) }} className="block w-full rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-brand-50">
                Edit
              </button>
            )}
            {puedeEditar && <BotonCompendio salon={salon} variant="ghost" className="w-full justify-start px-3 py-2 text-sm" etiqueta="Download Excel" />}
          </div>
        </>
      )}
    </div>
  )
}

// Lista de salones en tarjetas: docente, nombre, horario y avance, con una sola alerta. Las acciones están en el menú «⋯».
export default function SalonesCards({ salones, colorDe = () => SIN_COLOR, puedeEditar, onVer, onEditar }) {
  const fotos = useFotosDocentes()
  return (
    <ul className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
      {salones.map((s) => {
        const paq = s.paquete // salón de un paquete de horas: el avance se mide en horas
        const pct = paq ? porcentajeAvance(paq.consumidas, paq.contratadas) : s.progreso ? porcentajeAvance(s.progreso.realizadas, s.progreso.total) : null
        const pl = plazo(s)
        const alerta = alertaPrincipal(s, pl)
        const col = colorDe(s.nivelId)
        return (
          <li key={s.id} className={`group relative flex flex-col overflow-hidden rounded-2xl border bg-white shadow-sm transition hover:shadow-md ${paq ? 'border-peach-200' : 'border-brand-100'}`}>
            <div className={`h-1.5 bg-gradient-to-r ${paq ? 'from-peach-200 to-peach-500' : col.barra}`} />
            <div className="flex flex-1 flex-col gap-3 p-4">
              <div className="flex items-start gap-3">
                <button type="button" onClick={() => onVer(s.id)} aria-label={`Open ${s.nombre}`} className="flex min-w-0 flex-1 items-center gap-3 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">
                  <Avatar nombre={s.docente || '?'} fotoUrl={fotos.get(s.docenteId)} tamano="md" className={s.docente ? '' : 'opacity-40'} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500">
                      {s.codigo} <EstadoBadge estado={s.estado} />
                    </span>
                    <span className="block truncate text-base font-semibold text-slate-900" title={s.nombre}>
                      {s.nombre}
                    </span>
                    <span className="block truncate text-sm text-slate-500">
                      {s.docente || 'No teacher'}
                    </span>
                    {s.nivel && <span className={`mt-0.5 inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${col.chip}`}>{s.nivel}</span>}
                  </span>
                </button>
                <MenuTarjeta salon={s} puedeEditar={puedeEditar} onVer={onVer} onEditar={onEditar} />
              </div>

              <button type="button" onClick={() => onVer(s.id)} tabIndex={-1} className="flex flex-col gap-3 text-left">
                <span className="flex items-center gap-1.5 text-sm text-slate-600">
                  <Icon name="clock" className="h-4 w-4 shrink-0 text-slate-400" />
                  <span className="truncate">{formatHorario(s.horarios)}</span>
                </span>
                <span className="flex items-center gap-3">
                  <Anillo valor={pct} size={44} grosor={5} color={paq ? 'var(--color-peach-700)' : undefined} fondo={paq ? 'var(--color-peach-100)' : undefined} etiqueta={`Progress of ${s.nombre}`} />
                  <span className="min-w-0 text-sm text-slate-600">
                    {paq ? (
                      <>
                        <span className="font-medium text-peach-700">Hour package</span> · {minutosTexto(paq.consumidas)} of {minutosTexto(paq.contratadas)} used
                        <span className="block text-xs text-slate-500">{minutosTexto(Math.max(paq.disponibles, 0))} left</span>
                      </>
                    ) : s.progreso?.total ? (
                      <>
                        {s.progreso.realizadas} of {s.progreso.total} classes
                        <span className="block text-xs text-slate-500">{pl.texto}</span>
                      </>
                    ) : (
                      'No calendar'
                    )}
                  </span>
                </span>
                {alerta && (
                  <span className={`inline-flex items-center gap-1.5 self-start rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${CHIP[alerta.tono]}`} title={alerta.ayuda}>
                    <Icon name={alerta.icono} className="h-3.5 w-3.5" /> {alerta.texto}
                  </span>
                )}
              </button>
            </div>
          </li>
        )
      })}
    </ul>
  )
}
