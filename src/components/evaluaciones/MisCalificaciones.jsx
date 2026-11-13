import { useCallback } from 'react'
import Badge from '../ui/Badge'
import Card from '../ui/Card'
import useCarga from '../../hooks/useCarga'
import { etiquetaUnidad, fmtNota, textoFaltan } from '../../lib/evaluaciones'
import { descargarInforme } from '../../lib/informeNotas'
import Button from '../ui/Button'
import ComoMeEvaluan from './ComoMeEvaluan'
import { formatFecha } from '../../lib/salones'
import * as servicioReal from '../../services/evaluaciones'

// Una nota publicada. En participación se explica con las clases; en lo demás, con el comentario del docente.
function Nota({ n, tipo }) {
  const unidad = etiquetaUnidad(n.unidad, tipo)
  return (
    <div className="mt-0.5 text-xs text-slate-600">
      {unidad ? `${unidad}: ` : ''}
      <strong className="text-slate-900">{fmtNota(n.puntaje)}</strong>
      {n.participacion && <span className="ml-1">({n.participacion.cumplidas} of {n.participacion.total} classes with participation)</span>}
      {Array.isArray(n.criterios) && n.criterios.length > 0 && (
        <span className="ml-1 text-slate-500">
          ({n.criterios.map((c) => `${c.criterio} ${fmtNota(c.puntaje)}/${fmtNota(c.max)}`).join(' · ')})
        </span>
      )}
      {n.corregida && <span className="ml-1 text-slate-400">(corrected)</span>}
      {n.fecha && <span className="ml-1 text-slate-400">· {formatFecha(String(n.fecha).slice(0, 10))}</span>}
      {n.comentario && <p className="mt-0.5 rounded bg-slate-50 px-2 py-1 text-slate-700">{n.comentario}</p>}
    </div>
  )
}

function ResultadoCiclo({ c }) {
  // Un ciclo sin nada evaluado no muestra números: ni ceros ni notas ficticias.
  const evaluado = Number(c.escala_evaluada) > 0
  return (
    <li className="px-3 py-2.5 text-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="font-medium text-slate-800">{c.ciclo != null ? `Cycle ${c.ciclo}` : 'Modules without a cycle'}</span>
        {evaluado ? (
          <span className="text-slate-600">
            Cycle grade: <strong className="text-slate-900">{fmtNota(c.puntos)}</strong> / 100 {c.parcial && <Badge color="peach">Partial</Badge>}{' '}
            {c.remedial && <Badge color="rose">Includes remedial</Badge>}
          </span>
        ) : (
          <span className="text-slate-400">No published grades yet</span>
        )}
      </div>
      {evaluado && (
        <div
          role="progressbar"
          aria-label={`Cycle grade ${c.ciclo ?? ''}`}
          aria-valuenow={Math.round(Number(c.puntos))}
          aria-valuemin={0}
          aria-valuemax={100}
          className="mt-2 h-2.5 overflow-hidden rounded-full bg-brand-50"
        >
          <div className="h-full rounded-full bg-gradient-to-r from-brand-500 to-peach-500 transition-all duration-700" style={{ width: `${Math.max(0, Math.min(100, Number(c.puntos)))}%` }} />
        </div>
      )}
    </li>
  )
}

// Vista del estudiante: solo sus notas publicadas, con comentarios. Un resultado incompleto se muestra como parcial, nunca como cero.
export default function MisCalificaciones({ salonId, servicio = servicioReal }) {
  const cargar = useCallback(() => servicio.misCalificaciones(salonId), [servicio, salonId])
  const { datos, cargando, error } = useCarga(cargar, null)
  const ciclos = datos?.ciclos ?? []
  const acumulado = datos?.acumulado
  return (
    <Card className="p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-slate-900">My grades</h2>
        {datos && datos.modulos.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <ComoMeEvaluan modulos={datos.modulos} />
            <Button variant="secondary" className="px-3 py-1 text-xs" onClick={() => descargarInforme(datos)}>
              Descargar informe (PDF)
            </Button>
          </div>
        )}
      </div>
      {error ? (
        <p className="text-sm text-red-600">Could not load your grades: {error}</p>
      ) : cargando || !datos ? (
        <p className="text-sm text-slate-400">Loading…</p>
      ) : datos.modulos.length === 0 ? (
        <p className="text-sm text-slate-400">There are no assessments configured for this course yet.</p>
      ) : (
        <div className="space-y-5">
          {datos.nivel?.definido && datos.nivel.confirmada && (
            <div className="rounded-xl bg-brand-50 px-4 py-3">
              <p className="text-xs uppercase text-brand-700">Final level grade</p>
              <p className="text-2xl font-semibold text-brand-800">
                {fmtNota(datos.nivel.nota)} {datos.nivel.parcial && <Badge color="peach">Partial</Badge>}
              </p>
            </div>
          )}
          {ciclos.length > 0 && (
            <section>
              <h3 className="text-sm font-semibold text-slate-900">Result per cycle</h3>
              <ul className="mt-1 divide-y divide-slate-100 rounded-lg border border-slate-200">
                {ciclos.map((c) => (
                  <ResultadoCiclo key={c.ciclo ?? 'sin'} c={c} />
                ))}
              </ul>
              {acumulado && Number(acumulado.escala_evaluada) > 0 && (
                <p className="mt-1 text-xs text-slate-500">
                  Average published so far: {fmtNota(acumulado.puntos)} / 100. This is not yet the final level grade.
                </p>
              )}
            </section>
          )}
          {datos.modulos.map((m) => (
            <section key={m.modulo_id}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="text-sm font-semibold text-slate-900">{m.nombre}</h3>
                {!m.sin_plantilla && (
                  <p className="text-sm text-slate-600">
                    Module grade: <strong className="text-slate-900">{fmtNota(m.nota)}</strong> {m.parcial && <Badge color="peach">Partial</Badge>}{' '}
                    {m.remedial && <Badge color="rose">Remedial</Badge>}
                  </p>
                )}
              </div>
              {m.remedial && (
                <p className="mt-1 rounded bg-rose-50 px-2 py-1 text-xs text-rose-700">
                  This result was obtained through a remedial exam{m.remedial_ambito === 'ciclo' ? ' (applied to the cycle)' : ''}: grade {fmtNota(m.remedial_nota)}. Your previous result was {m.nota_original == null ? 'no grade' : fmtNota(m.nota_original)}.
                </p>
              )}
              {m.sin_plantilla ? (
                <p className="mt-1 text-xs text-slate-400">This module has no assessments yet.</p>
              ) : (
                <>
                  {m.parcial && (
                    <p className="mt-1 text-xs text-slate-500">
                      {m.peso_evaluado > 0 ? 'Partial result: ' : 'No published grades yet. '}
                      {m.faltan.length > 0 && `still missing ${textoFaltan(m.faltan)}.`}
                    </p>
                  )}
                  <ul className="mt-2 divide-y divide-slate-100 rounded-lg border border-slate-200">
                    {m.evaluaciones.map((e) => (
                      <li key={e.nombre} className="px-3 py-2">
                        <p className="text-sm font-medium text-slate-900">
                          {e.nombre} <span className="text-xs font-normal text-slate-500">weight {fmtNota(e.peso)}</span>
                        </p>
                        {e.tipo === 'formative' && Number(e.peso_participacion) > 0 && (
                          <p className="text-[11px] text-slate-400">Average of 3 units + {fmtNota(e.peso_participacion)} % class participation.</p>
                        )}
                        {e.notas.length === 0 ? <p className="text-xs text-slate-400">No published grade.</p> : e.notas.map((n) => <Nota key={n.unidad} n={n} tipo={e.tipo} />)}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </section>
          ))}
        </div>
      )}
    </Card>
  )
}
