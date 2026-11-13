import { useCallback, useRef, useState } from 'react'
import Badge from '../ui/Badge'
import Button from '../ui/Button'
import { inputClass } from '../ui/Field'
import Modal from '../ui/Modal'
import useCarga from '../../hooks/useCarga'
import { claveNota, fmtNota, notaRubrica, totalCriterios } from '../../lib/evaluaciones'
import { formatFecha } from '../../lib/salones'
import * as servicioReal from '../../services/evaluaciones'

// Valores de la rúbrica a partir de la copia guardada con la nota (se empareja por nombre de criterio).
function valoresDe(fila, criterios) {
  const v = {}
  for (const c of criterios) v[c.id] = (fila?.detalle ?? []).find((d) => d.criterio === c.nombre)?.puntaje ?? ''
  return v
}

const aporte = (peso, nota) => (nota == null ? null : Math.round(Number(peso) * Number(nota)) / 100)

function Formulario({ detalle, alumnoId, servicio, onCambio, onClose, mensaje, setMensaje }) {
  const { evaluacion, rubrica } = detalle
  const alumno = detalle.alumnos.find((a) => a.alumno_id === alumnoId)
  const criterios = rubrica?.criterios ?? []
  const unidades = evaluacion.unidades
  const lista = unidades.length ? unidades : ['']
  const [unidad, setUnidad] = useState(lista[0])
  const filaDe = (u) => alumno.filas.find((f) => f.unidad === u)
  const [edits, setEdits] = useState(() => {
    const e = {}
    for (const u of lista) {
      const f = filaDe(u)
      e[claveNota(alumnoId, u)] = { puntaje: f?.puntaje ?? '', comentario: f?.comentario ?? '', valores: valoresDe(f, criterios), corrigiendo: false, motivo: '' }
    }
    return e
  })
  const [error, setError] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [historial, setHistorial] = useState(null)
  const enCurso = useRef(false)

  const clave = (u) => claveNota(alumnoId, u)
  const cambiar = (u, parche) => setEdits((p) => ({ ...p, [clave(u)]: { ...p[clave(u)], ...parche } }))
  const ed = edits[clave(unidad)]
  const fila = filaDe(unidad)
  const publicada = fila?.estado === 'publicada'
  const editable = !publicada || ed.corrigiendo

  // Nota 0–100 de una unidad según lo que hay escrito (rúbrica: suma ÷ máximos × 100; si no, la nota directa).
  const notaDe = (u) => {
    const x = edits[clave(u)]
    if (criterios.length) return notaRubrica(criterios, x.valores)
    return x.puntaje === '' || x.puntaje == null || Number.isNaN(Number(x.puntaje)) ? null : Number(x.puntaje)
  }
  const notaActual = notaDe(unidad)
  const esFormative = evaluacion.tipo === 'formative'
  const total = totalCriterios(criterios, ed.valores)
  const notasUnidades = lista.map(notaDe).filter((n) => n != null)
  const promedio = notasUnidades.length ? Math.round((notasUnidades.reduce((s, n) => s + n, 0) / notasUnidades.length) * 100) / 100 : null
  const completa = notasUnidades.length === lista.length

  const payload = (u) => {
    const x = edits[clave(u)]
    if (criterios.length) {
      const algun = criterios.some((c) => x.valores[c.id] !== '' && x.valores[c.id] != null)
      if (!algun) return { alumnoId, unidad: u, puntaje: '', comentario: x.comentario }
      if (notaRubrica(criterios, x.valores) == null) throw new Error('Complete all rubric criteria')
      return { alumnoId, unidad: u, comentario: x.comentario, detalle: criterios.map((c) => ({ criterio_id: c.id, puntaje: Number(x.valores[c.id]) })) }
    }
    return { alumnoId, unidad: u, puntaje: x.puntaje, comentario: x.comentario }
  }

  const ejecutar = async (fn, ok) => {
    if (enCurso.current) return
    enCurso.current = true
    setOcupado(true)
    setError('')
    setMensaje('')
    try {
      const r = await fn()
      setMensaje(typeof r === 'string' ? r : ok)
      await onCambio()
    } catch (e) {
      setError(e.message)
    } finally {
      enCurso.current = false
      setOcupado(false)
    }
  }

  // Borradores de las unidades que no están publicadas y tienen algo escrito.
  const guardar = async () => {
    const filas = []
    for (const u of lista) {
      const f = filaDe(u)
      if (f?.estado === 'publicada') continue
      const p = payload(u)
      const vacio = (p.puntaje === '' || p.puntaje == null) && !p.comentario && !p.detalle
      if (vacio && !f) continue
      filas.push(p)
    }
    if (filas.length) await servicio.guardarCalificaciones(evaluacion.id, filas)
    return filas.length
  }
  const corregir = () =>
    ejecutar(async () => {
      if (ed.motivo.trim().length < 3) throw new Error('Enter the reason for the correction')
      const p = payload(unidad)
      await servicio.corregirCalificacion(evaluacion.id, { alumnoId, unidad, puntaje: p.puntaje, comentario: p.comentario, detalle: p.detalle, motivo: ed.motivo })
    }, 'Correction saved. It is kept in the history.')
  const verHistorial = async () => {
    try {
      const h = await servicio.historialEvaluacion(evaluacion.id)
      setHistorial(h.filter((x) => x.alumno === alumno.nombre))
    } catch (e) {
      setError(e.message)
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500">
        {evaluacion.modulo} · {evaluacion.componente} · weight {fmtNota(evaluacion.peso)} points. The student only sees what is published.
      </p>

      {unidades.length > 0 && (
        <div className="flex flex-wrap gap-1" role="tablist" aria-label="Units">
          {unidades.map((u) => (
            <button
              key={u}
              role="tab"
              aria-selected={unidad === u}
              onClick={() => setUnidad(u)}
              className={`rounded-full px-3 py-1 text-xs font-medium ${unidad === u ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            >
              {u}
              {filaDe(u)?.estado === 'publicada' ? ' ✓' : ''}
            </button>
          ))}
        </div>
      )}

      {criterios.length > 0 ? (
        <ul className="space-y-2">
          {criterios.map((c) => (
            <li key={c.id} className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2">
              <span className="text-sm text-slate-800">
                {c.nombre} <span className="text-xs text-slate-400">0–{fmtNota(c.max_puntaje)}</span>
              </span>
              <input
                type="number"
                inputMode="decimal"
                min={0}
                max={c.max_puntaje}
                step="0.5"
                disabled={!editable}
                aria-label={c.nombre}
                value={ed.valores[c.id] ?? ''}
                onChange={(e) => cambiar(unidad, { valores: { ...ed.valores, [c.id]: e.target.value } })}
                className={`${inputClass} w-24 text-right`}
                placeholder={`/${fmtNota(c.max_puntaje)}`}
              />
            </li>
          ))}
        </ul>
      ) : (
        <div className="flex items-center gap-3">
          <label htmlFor="nota-directa" className="text-sm font-medium text-slate-700">
            Nota obtenida (0–100)
          </label>
          <input
            id="nota-directa"
            type="number"
            inputMode="decimal"
            min={0}
            max={100}
            step="0.01"
            disabled={!editable}
            aria-label="Grade obtained"
            value={ed.puntaje}
            onChange={(e) => cambiar(unidad, { puntaje: e.target.value })}
            className={`${inputClass} w-28 text-right`}
            placeholder="0–100"
          />
        </div>
      )}

      <div className="rounded-xl bg-brand-50 px-4 py-3 text-sm text-brand-900" role="status">
        {criterios.length > 0 && (
          <p>
            {esFormative ? `Total for ${unidad || 'the unit'}` : 'Rubric total'}:{' '}
            <strong>{notaActual == null ? `incomplete (${fmtNota(total.suma)} of ${fmtNota(total.max)} so far)` : `${fmtNota(total.suma)} of ${fmtNota(total.max)}${total.max === 100 ? '' : ` (${fmtNota(notaActual)}/100)`}`}</strong>
          </p>
        )}
        {esFormative ? (
          <p>
            Average of the graded units: <strong>{promedio == null ? '—' : fmtNota(promedio)}</strong> · {notasUnidades.length} of {lista.length} units. The Formative grade combines this average with class participation.
          </p>
        ) : (
          <p>
            Contribution to the module: <strong>{notaActual == null ? '—' : `${fmtNota(aporte(evaluacion.peso, notaActual))} of ${fmtNota(evaluacion.peso)} points`}</strong>
            {unidades.length > 0 && <span className="text-xs"> (with this unit alone)</span>}
          </p>
        )}
        {!esFormative && unidades.length > 1 && (
          <p>
            Accumulated component result: <strong>{promedio == null ? '—' : fmtNota(promedio)}</strong> · {notasUnidades.length} of {lista.length} graded units
            {completa && promedio != null && <> · aporte {fmtNota(aporte(evaluacion.peso, promedio))} de {fmtNota(evaluacion.peso)}</>}
          </p>
        )}
      </div>

      {editable ? (
        <input
          className={inputClass}
          aria-label="Comment for the student"
          placeholder="Comment for the student (optional)"
          maxLength={2000}
          value={ed.comentario}
          onChange={(e) => cambiar(unidad, { comentario: e.target.value })}
        />
      ) : (
        fila?.comentario && <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">Comment: {fila.comentario}</p>
      )}

      {fila && (
        <p className="text-xs text-slate-500">
          Status: <Badge color={publicada ? 'brand' : 'peach'}>{publicada ? (fila.corregida ? 'Corrected' : 'Published') : 'Draft'}</Badge>
          {fila.corregida && (
            <button type="button" className="ml-2 underline" onClick={verHistorial}>
              View correction history
            </button>
          )}
        </p>
      )}
      {historial && (
        <ul className="rounded-lg border border-slate-200 p-3 text-xs text-slate-600">
          {historial.length === 0 && <li>No corrections.</li>}
          {historial.map((h, i) => (
            <li key={i}>
              {h.unidad ? `${h.unidad}: ` : ''}
              {fmtNota(h.puntaje_anterior)} → {fmtNota(h.puntaje_nuevo)} · {h.motivo} · {formatFecha(String(h.cuando).slice(0, 10))}
            </li>
          ))}
        </ul>
      )}

      {ed.corrigiendo && (
        <div className="space-y-2 rounded-lg bg-peach-50 p-3">
          <input className={inputClass} aria-label="Reason for the correction" placeholder="Reason for the correction (required)" value={ed.motivo} onChange={(e) => cambiar(unidad, { motivo: e.target.value })} />
          <div className="flex gap-2">
            <Button type="button" disabled={ocupado} onClick={corregir}>
              Save correction
            </Button>
            <Button type="button" variant="ghost" onClick={() => cambiar(unidad, { corrigiendo: false, motivo: '' })}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {mensaje && <p className="rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-800">{mensaje}</p>}
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>
          Close
        </Button>
        {publicada && !ed.corrigiendo ? (
          <Button variant="secondary" onClick={() => cambiar(unidad, { corrigiendo: true })}>
            Correct
          </Button>
        ) : (
          !publicada && (
            <>
              <Button variant="secondary" disabled={ocupado} onClick={() => ejecutar(async () => { await guardar() }, 'Draft saved. The student cannot see it yet.')}>
                Save draft
              </Button>
              <Button
                disabled={ocupado}
                onClick={() =>
                  ejecutar(async () => {
                    await guardar()
                    await servicio.publicarEvaluacion(evaluacion.id, [alumnoId])
                    return 'Grade published: the student can now see it.'
                  }, '')
                }
              >
                Publish
              </Button>
            </>
          )
        )}
      </div>
    </div>
  )
}

// Contenido del editor (sin ventana): lo usan la ficha de una celda y la ficha del Formative (pestaña «Unidades»).
export function ContenidoCelda({ evaluacionId, alumnoId, servicio = servicioReal, onClose, onCambio }) {
  const cargar = useCallback(() => servicio.detalleEvaluacion(evaluacionId), [servicio, evaluacionId])
  const detalle = useCarga(cargar, null)
  const [version, setVersion] = useState(0)
  const [mensaje, setMensaje] = useState('')
  const refrescar = async () => {
    await detalle.recargar()
    setVersion((v) => v + 1)
    await onCambio?.()
  }
  if (detalle.error) return <p className="text-sm text-red-600">Could not open the assessment: {detalle.error}</p>
  if (detalle.cargando || !detalle.datos) return <p className="py-4 text-sm text-slate-400">Loading…</p>
  if (!detalle.datos.alumnos.some((a) => a.alumno_id === alumnoId)) return <p className="text-sm text-slate-500">This student is no longer in the classroom.</p>
  return <Formulario key={version} detalle={detalle.datos} alumnoId={alumnoId} servicio={servicio} onCambio={refrescar} onClose={onClose} mensaje={mensaje} setMensaje={setMensaje} />
}

// Editor de una celda de la matriz (un estudiante en una evaluación): nota directa o rúbrica, por unidad si corresponde.
export default function CeldaNota({ evaluacionId, alumnoId, titulo, servicio = servicioReal, onClose, onCambio }) {
  return (
    <Modal title={titulo} onClose={onClose} wide>
      <ContenidoCelda evaluacionId={evaluacionId} alumnoId={alumnoId} servicio={servicio} onClose={onClose} onCambio={onCambio} />
    </Modal>
  )
}
