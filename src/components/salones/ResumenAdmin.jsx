import { useState } from 'react'
import Badge from '../ui/Badge'
import Card from '../ui/Card'
import Icon from '../ui/Icon'
import { cuposSalon } from '../../lib/matriculas'
import { descripcionPlan, textoCiclos } from '../../lib/catalogo'
import { estructuraTexto } from '../../lib/frecuencias'
import { diasSemana, fechaFinSalon, formatFecha, proximoAFinalizar, textoFin } from '../../lib/salones'

const TONO = {
  rose: 'bg-rose-50 text-rose-700 ring-rose-200',
  peach: 'bg-peach-50 text-peach-700 ring-peach-200',
  slate: 'bg-slate-50 text-slate-600 ring-slate-200',
}

// Franja «Por atender»: un aviso por línea, cada uno con acceso directo a la pestaña donde se resuelve.
export function PorAtender({ alertas, onIr, aviso = '' }) {
  const [copiado, setCopiado] = useState(false)
  const [abierto, setAbierto] = useState(false)
  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(aviso)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2500)
    } catch {
      window.prompt('Copy the message:', aviso)
    }
  }
  if (alertas.length === 0)
    return (
      <div id="por-atender" className="mb-5 flex items-center gap-3 rounded-2xl border border-brand-100 bg-white px-4 py-2.5 text-sm text-slate-600 shadow-sm">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-100 text-brand-600">
          <Icon name="check" className="h-4 w-4" />
        </span>
        All good: this classroom has nothing pending.
      </div>
    )
  // Plegable: cerrada es una sola línea con el primer aviso; abierta muestra cada aviso con su acceso directo.
  return (
    <section id="por-atender" aria-label="To review" className="mb-5 rounded-2xl border border-peach-200 bg-peach-50/60">
      <div className="flex flex-wrap items-center gap-2 px-4 py-2.5">
        <button type="button" onClick={() => setAbierto(!abierto)} aria-expanded={abierto} className="flex min-w-0 flex-1 items-center gap-2 text-left text-sm">
          <Icon name="alert" className="h-4 w-4 shrink-0 text-peach-700" />
          <span className="shrink-0 font-semibold text-slate-900">To review ({alertas.length})</span>
          {!abierto && (
            <span className="min-w-0 truncate text-peach-800">
              {alertas[0].texto}
              {alertas.length > 1 ? ` · +${alertas.length - 1} more` : ''}
            </span>
          )}
          <Icon name="back" className={`ml-auto h-4 w-4 shrink-0 text-peach-700 transition-transform ${abierto ? 'rotate-90' : '-rotate-90'}`} />
        </button>
        {aviso && (
          <button
            type="button"
            onClick={copiar}
            className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1 text-xs font-medium text-peach-700 ring-1 ring-inset ring-peach-200 hover:bg-peach-50"
          >
            <Icon name={copiado ? 'check' : 'copy'} className="h-3.5 w-3.5" /> {copiado ? 'Message copied' : 'Copy notice for the teacher'}
          </button>
        )}
      </div>
      {abierto && (
        <ul className="space-y-1.5 px-4 pb-4">
          {alertas.map((a) => (
            <li key={a.texto}>
              <button
                type="button"
                onClick={() => onIr(a.ir)}
                className={`flex w-full flex-wrap items-center gap-x-3 rounded-xl px-3 py-2 text-left text-sm ring-1 ring-inset transition hover:brightness-95 ${TONO[a.tono]}`}
              >
                <span className="font-medium">{a.texto}</span>
                {a.ayuda && <span className="text-xs opacity-80">{a.ayuda}</span>}
                <Icon name="back" className="ml-auto h-4 w-4 rotate-180" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function Bloque({ icono, titulo, children, className = '' }) {
  return (
    <Card className={`p-5 ${className}`}>
      <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-900">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-100 text-brand-600">
          <Icon name={icono} className="h-4 w-4" />
        </span>
        {titulo}
      </h2>
      {children}
    </Card>
  )
}

function Dato({ label, children, className = '' }) {
  return (
    <div className={`min-w-0 ${className}`}>
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="mt-1 text-sm text-slate-900">{children}</dd>
    </div>
  )
}

const iniciales = (nombre) =>
  nombre
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((x) => x[0].toUpperCase())
    .join('')

// Pestaña «Resumen»: los datos del salón agrupados por tema. Dos columnas independientes (sin huecos entre tarjetas):
// izquierda = qué se enseña (programa, fechas); derecha = quién y cuándo (docente y cupos, horario semanal).
export default function ResumenAdmin({ salon, estudiantes, puedeEditar, onVerDocente }) {
  const cupos = estudiantes && !estudiantes.cargando ? cuposSalon(salon, estudiantes.matriculas) : null
  const pctCupos = cupos ? Math.min(100, (cupos.ocupados / Math.max(cupos.capacidad, 1)) * 100) : 0
  const porDia = new Map()
  for (const h of salon.horarios) porDia.set(h.dia, [...(porDia.get(h.dia) ?? []), h])

  return (
    <div className="grid items-start gap-4 lg:grid-cols-2">
      <div className="space-y-4">
        <Bloque icono="doc" titulo="Academic program">
          <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
            <Dato label="Academic level">{salon.nivel || <span className="text-peach-700">No level assigned</span>}</Dato>
            {salon.curso && <Dato label="Course">{salon.curso}</Dato>}
            <Dato label="Academic plan" className="sm:col-span-2">
              {salon.plan ? (
                <>
                  {descripcionPlan({ ...salon.plan, tipoAlumno: ['nuevo', 'continuo'].includes(salon.plan.tipoAlumno) ? salon.plan.tipoAlumno : '' })}
                  <span className="mt-1 flex flex-wrap gap-1.5">
                    <Badge color="slate">{textoCiclos(salon.cicloDesde, salon.cicloHasta)}</Badge>
                    <Badge color="slate">{salon.plan.sesionesSemana} classes per week</Badge>
                  </span>
                </>
              ) : (
                <span className="text-slate-400">No plan</span>
              )}
            </Dato>
            <Dato label="Class frequency" className="sm:col-span-2">
              {salon.frecuencia ? (
                <>
                  {salon.frecuencia.nombre}
                  <span className="block text-xs text-slate-500">
                    {estructuraTexto(salon.frecuencia.minutos)} per week{salon.frecuencia.intensidad ? ` · ${salon.frecuencia.intensidad}` : ''}
                  </span>
                </>
              ) : (
                <span className="text-slate-400">No frequency</span>
              )}
            </Dato>
          </dl>
        </Bloque>

        <Bloque icono="calendar" titulo="Dates">
          <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
            <Dato label="Start">{formatFecha(salon.fechaInicio)}</Dato>
            <Dato label="Estimated end">
              {formatFecha(fechaFinSalon(salon))}
              {salon.fechaFin && salon.estado === 'en_curso' && (
                <span className="mt-1 block">
                  <Badge color={proximoAFinalizar(salon) ? 'peach' : 'slate'}>{textoFin(salon)}</Badge>
                </span>
              )}
            </Dato>
          </dl>
          <p className="mt-4 text-xs text-slate-400">Students can join after the classroom has started; this does not change the end date.</p>
        </Bloque>
      </div>

      <div className="space-y-4">
        <Bloque icono="users" titulo="Teacher and seats">
          <dl className="space-y-4">
            <Dato label="Assigned teacher">
              {salon.docente ? (
                <span className="flex items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-700">{iniciales(salon.docente)}</span>
                  {onVerDocente && salon.docenteId ? (
                    <button type="button" className="font-semibold text-brand-700 hover:underline" onClick={() => onVerDocente(salon.docenteId)}>
                      {salon.docente}
                    </button>
                  ) : (
                    <strong>{salon.docente}</strong>
                  )}
                </span>
              ) : (
                <span className="text-peach-700">No teacher assigned{puedeEditar && ': assign one under “Edit”'}</span>
              )}
            </Dato>
            <Dato label="Seats">
              <span className="flex items-baseline gap-1.5">
                <span className="text-2xl font-bold leading-none">{cupos ? cupos.ocupados : '…'}</span>
                <span className="text-slate-500">of {salon.capacidad} students</span>
              </span>
              {cupos && (
                <>
                  <div
                    role="progressbar"
                    aria-label="Seats taken"
                    aria-valuenow={cupos.ocupados}
                    aria-valuemin={0}
                    aria-valuemax={cupos.capacidad}
                    className="mt-2 h-2.5 overflow-hidden rounded-full bg-brand-50"
                  >
                    <div className={`h-full rounded-full ${cupos.lleno ? 'bg-peach-500' : 'bg-brand-500'}`} style={{ width: `${pctCupos}%` }} />
                  </div>
                  <span className="mt-1 block text-xs text-slate-500">
                    {cupos.lleno ? 'Classroom is full' : `${cupos.disponibles} ${cupos.disponibles === 1 ? 'seat available' : 'seats available'}`}
                  </span>
                </>
              )}
            </Dato>
          </dl>
        </Bloque>

        <Bloque icono="clock" titulo="Weekly schedule">
          {salon.horarios.length === 0 ? (
            <p className="text-sm text-slate-400">No schedule on record</p>
          ) : (
            <ul className="grid grid-cols-7 gap-1.5">
              {diasSemana.map((d) => {
                const franjas = porDia.get(d.value) ?? []
                return (
                  <li key={d.value} className={`rounded-xl px-1 py-2 text-center ${franjas.length ? 'bg-brand-50' : 'bg-slate-50'}`}>
                    <p className={`text-[11px] font-semibold uppercase ${franjas.length ? 'text-brand-700' : 'text-slate-300'}`}>{d.corto}</p>
                    {franjas.length ? (
                      franjas.map((h, i) => (
                        <p key={i} className="mt-1 text-[11px] leading-tight text-slate-900">
                          {h.horaInicio}
                          <span className="block text-slate-400">{h.horaFin}</span>
                        </p>
                      ))
                    ) : (
                      <p className="mt-1 text-[11px] text-slate-300">—</p>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </Bloque>
      </div>

      {salon.observaciones && (
        <Card className="p-5 lg:col-span-2">
          <h2 className="mb-2 text-sm font-semibold text-slate-900">Notes</h2>
          <p className="whitespace-pre-line text-sm text-slate-700">{salon.observaciones}</p>
        </Card>
      )}
    </div>
  )
}
