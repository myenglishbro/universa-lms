import Badge from '../ui/Badge'
import Card from '../ui/Card'
import { Dona } from '../ui/Anillo'
import { ESTADOS_ASISTENCIA, estadoAsistencia, porcentajeAsistencia } from '../../lib/asistencia'
import { formatFecha } from '../../lib/salones'

const COLOR = { presente: '#6a2cc8', tardanza: '#ffb97e', justificado: '#94a3b8', ausente: '#e11d48' }

// Pestaña «Asistencia»: dona con el reparto, y el historial clase por clase con el tema y los materiales vinculados.
export default function AsistenciaEstudiante({ historial, conteo, onVerMaterial }) {
  const marcadas = Object.values(conteo).reduce((a, b) => a + b, 0)
  const pct = porcentajeAsistencia(conteo)
  return (
    <div className="grid gap-6 lg:grid-cols-[18rem_minmax(0,1fr)]">
      <Card className="h-fit p-5">
        <h2 className="mb-4 text-base font-semibold text-slate-900">Mi asistencia</h2>
        {marcadas === 0 ? (
          <p className="text-sm text-slate-400">Aún no hay clases con asistencia registrada.</p>
        ) : (
          <>
            <div className="flex justify-center">
              <Dona size={150} grosor={18} etiqueta="Reparto de mi asistencia" segmentos={ESTADOS_ASISTENCIA.map((e) => ({ valor: conteo[e.value], color: COLOR[e.value] }))}>
                <span className="text-3xl font-bold text-brand-800">{pct == null ? '—' : `${pct}%`}</span>
                <span className="text-xs text-slate-500">asistencia</span>
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

      <Card className="p-5">
        <h2 className="mb-3 text-base font-semibold text-slate-900">Historial de clases</h2>
        {historial.length === 0 ? (
          <p className="text-sm text-slate-400">Aún no hay clases realizadas en este curso.</p>
        ) : (
          <ol className="relative space-y-4 border-l-2 border-brand-100 pl-5">
            {historial.map((h) => {
              const e = estadoAsistencia(h.asistencia)
              return (
                <li key={h.sesion_id} className="relative">
                  <span className="absolute -left-[1.7rem] top-1.5 h-3 w-3 rounded-full border-2 border-white" style={{ background: e ? COLOR[e.value] : '#cbd5e1' }} />
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-medium text-slate-900">
                      Clase {h.numero} <span className="font-normal text-slate-400">· {formatFecha(h.fecha)}</span>
                    </p>
                    {e ? <Badge color={e.color}>{e.label}</Badge> : <Badge color="slate">{h.estado_registro === 'pendiente' ? 'Por registrar' : 'Sin marca'}</Badge>}
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
