import Card from '../ui/Card'
import Icon from '../ui/Icon'
import { Anillo } from '../ui/Anillo'
import { NOTA_PROGRESO, porcentajeAsistencia, porcentajeAvance } from '../../lib/asistencia'
import { diaMes } from '../../lib/agenda'
import { horariosTexto } from '../../lib/recursos'
import { cuando } from '../../lib/calendario'

function Barra({ valor, total, etiqueta }) {
  const pct = total ? Math.min(100, Math.round((valor / total) * 100)) : 0
  return (
    <div role="progressbar" aria-label={etiqueta} aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} className="h-2.5 overflow-hidden rounded-full bg-brand-50">
      <div className="h-full rounded-full bg-gradient-to-r from-brand-500 to-peach-500 transition-all duration-700" style={{ width: `${pct}%` }} />
    </div>
  )
}

function Dato({ icono, etiqueta, children, pie }) {
  return (
    <Card className="flex items-center gap-4 p-4">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
        <Icon name={icono} className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-slate-500">{etiqueta}</p>
        <p className="truncate text-lg font-semibold text-slate-900">{children}</p>
        {pie && <p className="truncate text-xs text-slate-400">{pie}</p>}
      </div>
    </Card>
  )
}

// Pestaña «Resumen»: avance del curso en gráficos, datos clave y accesos rápidos a las demás pestañas.
export default function ResumenCurso({ curso, progreso, conteoAsistencia, proxima, secciones, vistas, onIrA }) {
  const pct = progreso ? porcentajeAvance(progreso.realizadas, progreso.total) : null
  const asist = porcentajeAsistencia(conteoAsistencia)
  const ciclos = progreso?.ciclos ?? []
  const lecciones = secciones.flatMap((s) => s.lecciones)
  const nVistas = lecciones.filter((l) => vistas.has(l.id)).length
  const pendientes = lecciones.filter((l) => !vistas.has(l.id)).slice(0, 3)
  const completo = lecciones.length > 0 && pendientes.length === 0

  return (
    <div className="space-y-6">
      <Card className="flex flex-wrap items-center gap-x-8 gap-y-3 p-4">
        <span className="inline-flex items-center gap-2 text-sm text-slate-700">
          <Icon name="teacher" className="h-4 w-4 text-brand-500" /> {curso.docente || 'Docente por asignar'}
        </span>
        <span className="inline-flex items-center gap-2 text-sm text-slate-700">
          <Icon name="clock" className="h-4 w-4 text-brand-500" /> {horariosTexto(curso.horarios)}
        </span>
        {curso.nivel && (
          <span className="inline-flex items-center gap-2 text-sm text-slate-700">
            <Icon name="box" className="h-4 w-4 text-brand-500" /> {curso.nivel}
          </span>
        )}
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Dato icono="calendar" etiqueta="Próxima clase" pie={proxima ? `${proxima.hora_inicio.slice(0, 5)}–${proxima.hora_fin.slice(0, 5)}` : undefined}>
          {proxima ? `${cuando(proxima.fecha)} · ${diaMes(proxima.fecha)}` : 'Sin programar'}
        </Dato>
        <Dato icono="check" etiqueta="Lecciones vistas" pie={lecciones.length ? `${Math.round((nVistas / lecciones.length) * 100)}% del contenido` : undefined}>
          {nVistas} / {lecciones.length}
        </Dato>
        <Dato icono="users" etiqueta="Clases realizadas" pie={progreso?.programadas ? `${progreso.programadas} programadas` : undefined}>
          {progreso ? progreso.realizadas : '—'}
        </Dato>
        <Dato icono="clock" etiqueta="Por registrar">{progreso ? progreso.por_registrar : '—'}</Dato>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="mb-4 text-base font-semibold text-slate-900">Avance del curso</h2>
          <div className="flex items-center gap-6">
            <Anillo valor={pct} size={112} grosor={12} etiqueta="Avance del curso" />
            <div className="min-w-0 flex-1 space-y-1">
              <p className="text-sm font-medium text-slate-900">
                {progreso?.total ? `${progreso.realizadas} de ${progreso.total} sesiones realizadas` : 'Total de sesiones por definir'}
              </p>
              <p className="text-xs text-slate-500">{progreso?.programadas ?? 0} programadas</p>
            </div>
          </div>
          {ciclos.length > 0 && (
            <ul className="mt-5 space-y-3 border-t border-brand-100 pt-4">
              {ciclos.map((c) => (
                <li key={c.ciclo}>
                  <p className="mb-1 flex justify-between text-xs text-slate-600">
                    <span className="font-medium">Ciclo {c.ciclo}</span>
                    <span>
                      {c.realizadas} de {c.sesiones}
                    </span>
                  </p>
                  <Barra valor={c.realizadas} total={c.sesiones} etiqueta={`Avance del ciclo ${c.ciclo}`} />
                </li>
              ))}
            </ul>
          )}
          <p className="mt-4 text-xs text-slate-400">{NOTA_PROGRESO}</p>
        </Card>

        <Card className="p-5">
          <h2 className="mb-4 text-base font-semibold text-slate-900">Mi asistencia</h2>
          <div className="flex items-center gap-6">
            <Anillo valor={asist} size={112} grosor={12} color="var(--color-peach-700)" fondo="var(--color-peach-100)" etiqueta="Mi asistencia" />
            <div className="min-w-0 flex-1 space-y-1 text-sm text-slate-600">
              <p>
                Presente: <strong className="text-slate-900">{conteoAsistencia.presente}</strong>
              </p>
              <p>
                Tardanza: <strong className="text-slate-900">{conteoAsistencia.tardanza}</strong>
              </p>
              <p>
                Ausente: <strong className="text-slate-900">{conteoAsistencia.ausente}</strong>
              </p>
            </div>
          </div>
          <button type="button" onClick={() => onIrA('asistencia')} className="mt-4 text-sm font-medium text-brand-700 hover:underline">
            Ver historial de clases →
          </button>
        </Card>
      </div>

      {lecciones.length > 0 && (
        <Card className="p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-900">{completo ? '¡Completaste todo el contenido!' : nVistas > 0 ? 'Continúa estudiando' : 'Empieza a estudiar'}</h2>
            <button type="button" onClick={() => onIrA('contenido')} className="text-sm font-medium text-brand-700 hover:underline">
              Ver todo el contenido →
            </button>
          </div>
          {completo ? (
            <p className="text-sm text-slate-500">Has marcado como vistas las {lecciones.length} lecciones. Puedes repasarlas cuando quieras.</p>
          ) : (
            <ul className="grid gap-2 sm:grid-cols-3">
              {pendientes.map((l) => (
                <li key={l.id}>
                  <button
                    type="button"
                    onClick={() => onIrA('contenido', l.id)}
                    className="flex h-full w-full items-start gap-3 rounded-xl border border-brand-100 p-3 text-left text-sm text-slate-800 transition hover:border-brand-500 hover:bg-brand-50"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-100 text-brand-700">
                      <Icon name={l.tipo === 'documento' ? 'doc' : l.tipo === 'enlace' ? 'link' : 'play'} className="h-4 w-4" />
                    </span>
                    <span className="line-clamp-2">{l.titulo}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}
    </div>
  )
}
