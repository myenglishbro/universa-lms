import { useCallback, useRef, useState } from 'react'
import Badge from '../ui/Badge'
import CriteriosRubrica from './CriteriosRubrica'
import Button from '../ui/Button'
import { inputClass } from '../ui/Field'
import Modal from '../ui/Modal'
import useCarga from '../../hooks/useCarga'
import { claveNota, fmtNota, notaRubrica } from '../../lib/evaluaciones'
import * as servicioReal from '../../services/evaluaciones'

// Valores iniciales de la rúbrica a partir de la copia guardada con la nota (se empareja por nombre de criterio).
function valoresDe(fila, criterios) {
  const v = {}
  for (const c of criterios) v[c.id] = (fila?.detalle ?? []).find((d) => d.criterio === c.nombre)?.puntaje ?? ''
  return v
}

function FilaNota({ alumno, fila, rubrica, edicion, onCambiar, onCorregir }) {
  const criterios = rubrica?.criterios ?? []
  const [abierta, setAbierta] = useState(false)
  const publicada = fila?.estado === 'publicada'
  const corrigiendo = edicion.corrigiendo
  const editable = !publicada || corrigiendo
  const total = criterios.length ? notaRubrica(criterios, edicion.valores) : null
  const estado = !fila ? null : publicada ? (fila.corregida ? 'Corrected' : 'Published') : 'Draft'

  return (
    <li className="px-3 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-medium text-slate-900">
          {alumno.nombre} {estado && <Badge color={publicada ? 'brand' : 'peach'}>{estado}</Badge>}
        </span>
        <div className="flex items-center gap-2">
          {criterios.length > 0 ? (
            <button type="button" aria-expanded={abierta} onClick={() => setAbierta((a) => !a)} className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50">
              Rubric · {total == null ? 'incomplete' : `${fmtNota(total)}/100`}
            </button>
          ) : editable ? (
            <input
              type="number"
              inputMode="decimal"
              min={0}
              max={100}
              step="0.01"
              aria-label={`Grade for ${alumno.nombre}`}
              value={edicion.puntaje}
              onChange={(e) => onCambiar({ puntaje: e.target.value })}
              className={`${inputClass} w-24 text-right`}
              placeholder="0–100"
            />
          ) : (
            <span className="text-sm font-semibold text-slate-900">{fmtNota(fila.puntaje)}</span>
          )}
          {publicada && !corrigiendo && (
            <Button variant="ghost" className="px-2 py-1 text-xs" onClick={() => onCambiar({ corrigiendo: true })}>
              Correct
            </Button>
          )}
        </div>
      </div>

      {criterios.length > 0 && abierta && (
        <div className="mt-2">
          <CriteriosRubrica
            criterios={criterios}
            valores={edicion.valores}
            deshabilitado={!editable}
            etiquetaSufijo={` for ${alumno.nombre}`}
            onCambiar={(id, v) => onCambiar({ valores: { ...edicion.valores, [id]: v } })}
          />
        </div>
      )}

      {editable ? (
        <input
          className={`${inputClass} mt-2`}
          aria-label={`Comment for ${alumno.nombre}`}
          placeholder="Comment for the student (optional)"
          maxLength={2000}
          value={edicion.comentario}
          onChange={(e) => onCambiar({ comentario: e.target.value })}
        />
      ) : (
        fila?.comentario && <p className="mt-1 text-xs text-slate-600">Comment: {fila.comentario}</p>
      )}

      {corrigiendo && (
        <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg bg-peach-50 p-2">
          <input
            className={`${inputClass} min-w-48 flex-1`}
            aria-label={`Reason for correcting ${alumno.nombre}'s grade`}
            placeholder="Reason for the correction (required)"
            value={edicion.motivo}
            onChange={(e) => onCambiar({ motivo: e.target.value })}
          />
          <Button type="button" className="px-3 py-1.5" onClick={onCorregir}>
            Save correction
          </Button>
          <Button type="button" variant="ghost" className="px-2 py-1" onClick={() => onCambiar({ corrigiendo: false, motivo: '' })}>
            Cancel
          </Button>
        </div>
      )}
    </li>
  )
}

function Cuerpo({ detalle, unidadInicial, onUnidad, servicio, onRefrescar, onClose, mensaje, setMensaje }) {
  const { evaluacion, rubrica, alumnos } = detalle
  const unidades = evaluacion.unidades
  const criterios = rubrica?.criterios ?? []
  const [unidad, setUnidad] = useState(unidades.includes(unidadInicial) ? unidadInicial : (unidades[0] ?? ''))
  const filaDe = (a, u) => a.filas.find((f) => f.unidad === u)
  const [edits, setEdits] = useState(() => {
    const e = {}
    for (const a of alumnos)
      for (const u of unidades.length ? unidades : ['']) {
        const f = filaDe(a, u)
        e[claveNota(a.alumno_id, u)] = { puntaje: f?.puntaje ?? '', comentario: f?.comentario ?? '', valores: valoresDe(f, criterios), corrigiendo: false, motivo: '' }
      }
    return e
  })
  const [textoUnidades, setTextoUnidades] = useState(unidades.join(', '))
  const [error, setError] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const enCurso = useRef(false)

  const cambiar = (alumnoId, u, parche) => setEdits((prev) => ({ ...prev, [claveNota(alumnoId, u)]: { ...prev[claveNota(alumnoId, u)], ...parche } }))

  // Convierte lo escrito en la fila que entiende el servidor. Con rúbrica exige completar todos los criterios.
  const payload = (alumno, u) => {
    const ed = edits[claveNota(alumno.alumno_id, u)]
    if (criterios.length) {
      const algun = criterios.some((c) => ed.valores[c.id] !== '' && ed.valores[c.id] != null)
      if (!algun) return { alumnoId: alumno.alumno_id, unidad: u, puntaje: '', comentario: ed.comentario }
      if (notaRubrica(criterios, ed.valores) == null) throw new Error(`Complete all rubric criteria for ${alumno.nombre}`)
      return { alumnoId: alumno.alumno_id, unidad: u, comentario: ed.comentario, detalle: criterios.map((c) => ({ criterio_id: c.id, puntaje: Number(ed.valores[c.id]) })) }
    }
    return { alumnoId: alumno.alumno_id, unidad: u, puntaje: ed.puntaje, comentario: ed.comentario }
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
      await onRefrescar()
    } catch (e) {
      setError(e.message)
    } finally {
      enCurso.current = false
      setOcupado(false)
    }
  }

  // Borradores de todas las unidades (las ya publicadas no se tocan aquí).
  const filasPorGuardar = () => {
    const filas = []
    for (const a of alumnos)
      for (const u of unidades.length ? unidades : ['']) {
        const f = filaDe(a, u)
        if (f?.estado === 'publicada') continue
        const p = payload(a, u)
        const vacio = (p.puntaje === '' || p.puntaje == null) && !p.comentario && !p.detalle
        if (vacio && !f) continue
        filas.push(p)
      }
    return filas
  }
  const guardar = async () => {
    const filas = filasPorGuardar()
    if (filas.length) await servicio.guardarCalificaciones(evaluacion.id, filas)
    return filas.length
  }
  const corregir = (alumno) => {
    const ed = edits[claveNota(alumno.alumno_id, unidad)]
    return ejecutar(async () => {
      const p = payload(alumno, unidad)
      await servicio.corregirCalificacion(evaluacion.id, { alumnoId: alumno.alumno_id, unidad, puntaje: p.puntaje, comentario: p.comentario, detalle: p.detalle, motivo: ed.motivo })
    }, 'Correction saved. It is kept in the history.')
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500">
        {evaluacion.modulo} · {evaluacion.componente} · weight {evaluacion.peso}. The student only sees published grades.
      </p>

      <details className="rounded-lg border border-slate-200 px-3 py-2">
        <summary className="cursor-pointer text-sm font-medium text-slate-700">Units of this assessment ({unidades.length || 'a single grade'})</summary>
        <div className="mt-2 flex flex-wrap gap-2">
          <input className={`${inputClass} min-w-48 flex-1`} aria-label="Units" value={textoUnidades} onChange={(e) => setTextoUnidades(e.target.value)} placeholder="E.g.: Unit 1, Unit 2, Unit 3 (empty = a single grade)" />
          <Button type="button" variant="secondary" disabled={ocupado} onClick={() => ejecutar(() => servicio.configurarUnidades(evaluacion.id, textoUnidades.split(',').map((x) => x.trim()).filter(Boolean)), 'Unidades guardadas.')}>
            Save units
          </Button>
        </div>
      </details>

      {unidades.length > 0 && (
        <div className="flex flex-wrap gap-1" role="tablist" aria-label="Units">
          {unidades.map((u) => (
            <button
              key={u}
              role="tab"
              aria-selected={unidad === u}
              onClick={() => {
                setUnidad(u)
                onUnidad(u)
              }}
              className={`rounded-full px-3 py-1 text-xs font-medium ${unidad === u ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            >
              {u}
            </button>
          ))}
        </div>
      )}

      {alumnos.length === 0 ? (
        <p className="rounded-lg bg-slate-50 px-3 py-4 text-sm text-slate-500">This classroom has no students enrolled.</p>
      ) : (
        <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
          {alumnos.map((a) => (
            <FilaNota
              key={a.alumno_id + unidad}
              alumno={a}
              fila={filaDe(a, unidad)}
              rubrica={rubrica}
              edicion={edits[claveNota(a.alumno_id, unidad)]}
              onCambiar={(parche) => cambiar(a.alumno_id, unidad, parche)}
              onCorregir={() => corregir(a)}
            />
          ))}
        </ul>
      )}

      {mensaje && <p className="rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-800">{mensaje}</p>}
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>
          Close
        </Button>
        <Button variant="secondary" disabled={ocupado || alumnos.length === 0} onClick={() => ejecutar(async () => { await guardar() }, 'Draft saved. Students cannot see it yet.')}>
          Save draft
        </Button>
        <Button
          disabled={ocupado || alumnos.length === 0}
          onClick={() =>
            ejecutar(async () => {
              await guardar()
              const n = await servicio.publicarEvaluacion(evaluacion.id)
              return `${n} ${n === 1 ? 'grade published' : 'grades published'}: students can now see them.`
            }, '')
          }
        >
          Publish grades
        </Button>
      </div>
    </div>
  )
}

// Registro de notas de una evaluación: una lista simple de estudiantes (nota + comentario, o rúbrica), sin tablas gigantes.
export default function RegistroNotas({ evaluacionId, titulo, onClose, onCambio, servicio = servicioReal }) {
  const cargar = useCallback(() => servicio.detalleEvaluacion(evaluacionId), [servicio, evaluacionId])
  const detalle = useCarga(cargar, null)
  const [version, setVersion] = useState(0)
  const [unidad, setUnidad] = useState('')
  const [mensaje, setMensaje] = useState('')
  const refrescar = async () => {
    await detalle.recargar()
    setVersion((v) => v + 1)
    await onCambio?.()
  }
  return (
    <Modal title={titulo} onClose={onClose} wide>
      {detalle.error ? (
        <p className="text-sm text-red-600">Could not open the assessment: {detalle.error}</p>
      ) : !detalle.datos ? (
        <p className="py-6 text-center text-sm text-slate-500">Loading…</p>
      ) : (
        <Cuerpo key={version} detalle={detalle.datos} unidadInicial={unidad} onUnidad={setUnidad} servicio={servicio} onRefrescar={refrescar} onClose={onClose} mensaje={mensaje} setMensaje={setMensaje} />
      )}
    </Modal>
  )
}
