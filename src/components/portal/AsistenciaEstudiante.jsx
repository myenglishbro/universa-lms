import Badge from '../ui/Badge'
import Card from '../ui/Card'
import { Dona } from '../ui/Anillo'
import { ESTADOS_ASISTENCIA, LIMITE_INASISTENCIA, estadoAsistencia, porcentajeAsistencia, riesgoAsistencia } from '../../lib/asistencia'
import { formatFecha } from '../../lib/salones'

const COLOR = { presente: '#6a2cc8', tardanza: '#ffb97e', justificado: '#94a3b8', ausente: '#e11d48' }

// Aviso de inasistencias: 2 tardanzas = 1 inasistencia; con 25 % o más el estudiante repite aunque su puntaje sea perfecto.
export function AvisoInasistencias({ riesgo, conteo }) {
  if (!riesgo.base) return null
  const detalle = `${conteo.ausente} ${conteo.ausente === 1 ? 'absence' : 'absences'} + ${conteo.tardanza} late (2 late = 1 absence) = ${riesgo.equivalentes} of ${riesgo.base} classes · ${riesgo.pct}%`
  if (riesgo.enRiesgo)
    return (
      <div role="alert" className="rounded-2xl border border-rose-300 bg-rose-50 p-4">
        <p className="text-sm font-bold text-rose-800">You reached {LIMITE_INASISTENCIA}% absences: you repeat the course</p>
        <p className="mt-1 text-xs text-rose-700">Even with a perfect score, {LIMITE_INASISTENCIA}% or more absences means repeating. Please talk to your teacher or the academic team.</p>
        <p className="mt-2 text-xs font-medium text-rose-800">{detalle}</p>
      </div>
    )
  if (riesgo.cercano)
    return (
      <div role="status" className="rounded-2xl border border-amber-300 bg-amber-50 p-4">
        <p className="text-sm font-bold text-amber-900">Careful: you are close to {LIMITE_INASISTENCIA}% absences</p>
        <p className="mt-1 text-xs text-amber-800">At {LIMITE_INASISTENCIA}% you repeat the course, whatever your score. Two late arrivals count as one absence.</p>
        <p className="mt-2 text-xs font-medium text-amber-900">{detalle}</p>
      </div>
    )
  return (
    <p className="rounded-2xl bg-slate-50 px-4 py-3 text-xs text-slate-600">
      Absences: <strong>{riesgo.pct}%</strong> (limit {LIMITE_INASISTENCIA}%). Two late arrivals count as one absence.
    </p>
  )
}

// Pestaña «Asistencia»: dona con el reparto, y el historial clase por clase con el tema y los materiales vinculados.
export default function AsistenciaEstudiante({ historial, conteo, onVerMaterial }) {
  const marcadas = Object.values(conteo).reduce((a, b) => a + b, 0)
  const pct = porcentajeAsistencia(conteo)
  const riesgo = riesgoAsistencia(conteo)
  return (
    <div className="grid gap-6 lg:grid-cols-[18rem_minmax(0,1fr)]">
      <div className="space-y-4">
      <AvisoInasistencias riesgo={riesgo} conteo={conteo} />
      <Card className="h-fit p-5">
        <h2 className="mb-4 text-base font-semibold text-slate-900">My attendance</h2>
        {marcadas === 0 ? (
          <p className="text-sm text-slate-400">There are no classes with recorded attendance yet.</p>
        ) : (
          <>
            <div className="flex justify-center">
              <Dona size={150} grosor={18} etiqueta="Breakdown of my attendance" segmentos={ESTADOS_ASISTENCIA.map((e) => ({ valor: conteo[e.value], color: COLOR[e.value] }))}>
                <span className="text-3xl font-bold text-brand-800">{pct == null ? '—' : `${pct}%`}</span>
                <span className="text-xs text-slate-500">attendance</span>
              </Dona>
            </div>
            <ul className="mt-5 space-y-2">
              {ESTADOS_ASISTENCIA.map((e) => (
                <li key={e.value} className="flex items-center justify-between text-sm">
                  <span className="inline-flex items-center gap-2 text-slate-600">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: COLOR[e.value] }} /> {e.label}
                  </span>
                  <strong className="text-slate-900">{conteo[e.value]}</strong>
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>
      </div>

      <Card className="p-5">
        <h2 className="mb-3 text-base font-semibold text-slate-900">Class history</h2>
        {historial.length === 0 ? (
          <p className="text-sm text-slate-400">There are no classes held in this course yet.</p>
        ) : (
          <ol className="relative space-y-4 border-l-2 border-brand-100 pl-5">
            {historial.map((h) => {
              const e = estadoAsistencia(h.asistencia)
              return (
                <li key={h.sesion_id} className="relative">
                  <span className="absolute -left-[1.7rem] top-1.5 h-3 w-3 rounded-full border-2 border-white" style={{ background: e ? COLOR[e.value] : '#cbd5e1' }} />
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-medium text-slate-900">
                      Class {h.numero} <span className="font-normal text-slate-400">· {formatFecha(h.fecha)}</span>
                    </p>
                    {e ? <Badge color={e.color}>{e.label}</Badge> : <Badge color="slate">{h.estado_registro === 'pendiente' ? 'To be recorded' : 'No mark'}</Badge>}
                  </div>
                  {h.tema && <p className="mt-0.5 text-sm text-slate-600">{h.tema}</p>}
                  {h.materiales.length > 0 && (
                    <p className="mt-1.5 flex flex-wrap gap-2">
                      {h.materiales.map((m) => (
                        <button key={m.id} type="button" onClick={() => onVerMaterial?.(m.id)} className="rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700 hover:bg-brand-100">
                          {m.titulo}
                        </button>
                      ))}
                    </p>
                  )}
                </li>
              )
            })}
          </ol>
        )}
      </Card>
    </div>
  )
}
