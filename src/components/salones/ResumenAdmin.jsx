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
export function PorAtender({ alertas, onIr }) {
  if (alertas.length === 0)
    return (
      <div className="mb-6 flex items-center gap-3 rounded-2xl border border-brand-100 bg-white px-4 py-3 text-sm text-slate-600 shadow-sm">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-100 text-brand-600">
          <Icon name="check" className="h-5 w-5" />
        </span>
        Todo en orden: este salón no tiene pendientes.
      </div>
    )
  return (
    <section aria-label="Por atender" className="mb-6 rounded-2xl border border-peach-200 bg-peach-50/50 p-4">
      <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-900">
        <Icon name="alert" className="h-4 w-4 text-peach-700" /> Por atender ({alertas.length})
      </h2>
      <ul className="space-y-1.5">
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
    </section>
  )
}

function Bloque({ icono, titulo, children }) {
  return (
    <Card className="p-5">
      <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-900">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-100 text-brand-600">
          <Icon name={icono} className="h-4 w-4" />
        </span>
        {titulo}
      </h2>
      <dl className="space-y-3">{children}</dl>
    </Card>
  )
}

function Dato({ label, children }) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-sm text-slate-900">{children}</dd>
    </div>
  )
}

// Pestaña «Resumen»: los datos del salón agrupados por tema (programa, personas, fechas, horario).
export default function ResumenAdmin({ salon, estudiantes, puedeEditar, onVerDocente }) {
  const cupos = estudiantes && !estudiantes.cargando ? cuposSalon(salon, estudiantes.matriculas) : null
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Bloque icono="doc" titulo="Programa académico">
        <Dato label="Nivel académico">{salon.nivel || <span className="text-peach-700">Sin nivel asignado</span>}</Dato>
        <Dato label="Curso">{salon.curso || '—'}</Dato>
        <Dato label="Plan académico">
          {salon.plan ? (
            <>
              {descripcionPlan({ ...salon.plan, tipoAlumno: ['nuevo', 'continuo'].includes(salon.plan.tipoAlumno) ? salon.plan.tipoAlumno : '' })}
              <span className="block text-xs text-slate-500">
                {textoCiclos(salon.cicloDesde, salon.cicloHasta)} · {salon.plan.sesionesSemana} clases por semana
              </span>
            </>
          ) : (
            <span className="text-slate-400">Sin plan</span>
          )}
        </Dato>
        <Dato label="Frecuencia de clases">
          {salon.frecuencia ? (
            <>
              {salon.frecuencia.nombre}
              <span className="block text-xs text-slate-500">
                {estructuraTexto(salon.frecuencia.minutos)} por semana{salon.frecuencia.intensidad ? ` · ${salon.frecuencia.intensidad}` : ''}
              </span>
            </>
          ) : (
            <span className="text-slate-400">Sin frecuencia</span>
          )}
        </Dato>
      </Bloque>

      <Bloque icono="users" titulo="Docente y cupos">
        <Dato label="Docente asignado">
          {salon.docente ? (
            onVerDocente && salon.docenteId ? (
              <button type="button" className="font-semibold text-brand-700 hover:underline" onClick={() => onVerDocente(salon.docenteId)}>
                {salon.docente}
              </button>
            ) : (
              <strong>{salon.docente}</strong>
            )
          ) : (
            <span className="text-peach-700">Sin docente asignado{puedeEditar && ': asígnalo en «Editar»'}</span>
          )}
        </Dato>
        <Dato label="Capacidad">
          {salon.capacidad} estudiantes
          {cupos && (
            <>
              <div
                role="progressbar"
                aria-label="Cupos ocupados"
                aria-valuenow={cupos.ocupados}
                aria-valuemin={0}
                aria-valuemax={cupos.capacidad}
                className="mt-2 h-2.5 overflow-hidden rounded-full bg-brand-50"
              >
                <div className={`h-full rounded-full ${cupos.lleno ? 'bg-peach-500' : 'bg-brand-500'}`} style={{ width: `${Math.min(100, (cupos.ocupados / Math.max(cupos.capacidad, 1)) * 100)}%` }} />
              </div>
              <span className="mt-1 block text-xs text-slate-500">
                {cupos.ocupados} matriculados · {cupos.disponibles} {cupos.disponibles === 1 ? 'cupo libre' : 'cupos libres'}
              </span>
            </>
          )}
        </Dato>
      </Bloque>

      <Bloque icono="calendar" titulo="Fechas">
        <Dato label="Inicio">{formatFecha(salon.fechaInicio)}</Dato>
        <Dato label="Fin estimado">
          {formatFecha(fechaFinSalon(salon))}
          {salon.fechaFin && salon.estado === 'en_curso' && (
            <span className="ml-2">
              <Badge color={proximoAFinalizar(salon) ? 'peach' : 'slate'}>{textoFin(salon)}</Badge>
            </span>
          )}
        </Dato>
        <p className="text-xs text-slate-400">Los estudiantes pueden incorporarse con el salón ya iniciado; eso no cambia la fecha de fin.</p>
      </Bloque>

      <Bloque icono="clock" titulo="Horario semanal">
        {salon.horarios.length === 0 ? (
          <p className="text-sm text-slate-400">Sin horarios registrados</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {salon.horarios.map((h, i) => (
              <li key={i} className="rounded-xl bg-brand-50 px-3 py-2 text-center">
                <p className="text-xs font-semibold uppercase text-brand-700">{diasSemana.find((d) => d.value === h.dia).corto}</p>
                <p className="text-sm text-slate-900">
                  {h.horaInicio} – {h.horaFin}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Bloque>

      {salon.observaciones && (
        <Card className="p-5 lg:col-span-2">
          <h2 className="mb-2 text-sm font-semibold text-slate-900">Observaciones</h2>
          <p className="whitespace-pre-line text-sm text-slate-700">{salon.observaciones}</p>
        </Card>
      )}
    </div>
  )
}
