import { useCallback, useRef, useState } from 'react'
import Badge from '../ui/Badge'
import Button from '../ui/Button'
import Card from '../ui/Card'
import useCarga from '../../hooks/useCarga'
import { fmtNota, notaRubrica } from '../../lib/evaluaciones'
import { formatFecha } from '../../lib/salones'
import * as servicioReal from '../../services/evaluaciones'

const claseInput = 'w-16 rounded-md border border-slate-300 px-2 py-1 text-right text-sm focus:border-brand-500 focus:outline-none disabled:bg-slate-50 disabled:text-slate-500'

// Enter baja a la misma casilla del estudiante siguiente (como en una hoja de cálculo).
function irAlSiguiente(e, tabla) {
  if (e.key !== 'Enter') return
  e.preventDefault()
  const col = e.target.dataset.col
  const fila = Number(e.target.dataset.fila)
  const sig = tabla.current?.querySelector(`input[data-col="${col}"][data-fila="${fila + 1}"]:not(:disabled)`)
  if (sig) sig.focus()
}

// ---- Notas directas (Test, SPARK…) y con rúbrica (Writing, Project): una fila por estudiante ----
function CapturaNotas({ evaluacionId, unidad, servicio, onCambio }) {
  const cargar = useCallback(() => servicio.detalleEvaluacion(evaluacionId), [servicio, evaluacionId])
  const detalle = useCarga(cargar, null)
  const [edits, setEdits] = useState({}) // alumnoId → { puntaje } | { valores }
  const [aviso, setAviso] = useState('')
  const [error, setError] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const enCurso = useRef(false)
  const tabla = useRef(null)

  if (detalle.error) return <p className="text-sm text-red-600">Could not open the assessment: {detalle.error}</p>
  if (detalle.cargando || !detalle.datos) return <p className="py-3 text-sm text-slate-400">Loading…</p>
  const { evaluacion, rubrica, alumnos } = detalle.datos
  const criterios = rubrica?.criterios ?? []
  const u = unidad ?? ''
  const filaDe = (a) => a.filas.find((f) => f.unidad === u)
  const base = (a) => {
    const f = filaDe(a)
    if (criterios.length) {
      const v = {}
      for (const c of criterios) v[c.id] = (f?.detalle ?? []).find((d) => d.criterio === c.nombre)?.puntaje ?? ''
      return { valores: v }
    }
    return { puntaje: f?.puntaje ?? '' }
  }
  const actual = (a) => edits[a.alumno_id] ?? base(a)
  const nota = (a) => {
    const x = actual(a)
    if (criterios.length) return notaRubrica(criterios, x.valores)
    return x.puntaje === '' || x.puntaje == null || Number.isNaN(Number(x.puntaje)) ? null : Number(x.puntaje)
  }
  const publicada = (a) => filaDe(a)?.estado === 'publicada'
  const cambiada = (a) => edits[a.alumno_id] !== undefined
  // Una fila que se escribió y se volvió a vaciar no cuenta como cambio: no se envía ni bloquea el guardado de las demás.
  const vacia = (a) => {
    const x = actual(a)
    return criterios.length ? criterios.every((c) => x.valores[c.id] === '' || x.valores[c.id] == null) : x.puntaje === '' || x.puntaje == null
  }
  const pendientesGuardar = alumnos.filter((a) => !publicada(a) && cambiada(a) && !vacia(a))

  const poner = (a, parche) => setEdits((p) => ({ ...p, [a.alumno_id]: { ...actual(a), ...parche } }))
  const payload = (a) => {
    const x = actual(a)
    if (criterios.length) {
      if (notaRubrica(criterios, x.valores) == null) throw new Error(`Complete all criteria for ${a.nombre}`)
      return { alumnoId: a.alumno_id, unidad: u, detalle: criterios.map((c) => ({ criterio_id: c.id, puntaje: Number(x.valores[c.id]) })) }
    }
    return { alumnoId: a.alumno_id, unidad: u, puntaje: x.puntaje }
  }

  const ejecutar = async (fn) => {
    if (enCurso.current) return
    enCurso.current = true
    setOcupado(true)
    setAviso('')
    setError('')
    try {
      setAviso(await fn())
      setEdits({})
      await detalle.recargar()
      await onCambio?.()
    } catch (e) {
      setError(e.message)
    } finally {
      enCurso.current = false
      setOcupado(false)
    }
  }
  const guardar = async (publicar) => {
    const filas = pendientesGuardar.map(payload)
    if (filas.length) await servicio.guardarCalificaciones(evaluacion.id, filas)
    if (!publicar) return filas.length ? `${filas.length} draft(s) saved. Students cannot see them yet.` : 'There were no changes to save.'
    // Se publican los estudiantes con nota completa (recién guardada o ya guardada en borrador); los vacíos quedan pendientes.
    const ids = alumnos.filter((a) => !publicada(a) && nota(a) != null).map((a) => a.alumno_id)
    if (ids.length === 0) return 'There are no completed grades to publish.'
    await servicio.publicarEvaluacion(evaluacion.id, ids)
    return `${ids.length} grade(s) published. Students without a grade remain pending.`
  }

  const sinNota = alumnos.filter((a) => !publicada(a) && nota(a) == null).length

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-xl border border-slate-200" ref={tabla}>
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs text-slate-600">
            <tr>
              <th className="px-3 py-2">Student</th>
              {criterios.length > 0 ? criterios.map((c) => <th key={c.id} className="px-2 py-2 text-right">{c.nombre} <span className="font-normal text-slate-400">/{c.max_puntaje}</span></th>) : <th className="px-2 py-2 text-right">Grade (0–100)</th>}
              <th className="px-3 py-2 text-right">Total /100</th>
              <th className="px-3 py-2 text-right">{evaluacion.tipo === 'formative' ? 'Unit' : 'Contribution'}</th>
              <th className="px-3 py-2">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {alumnos.map((a, i) => {
              const bloqueada = publicada(a)
              const n = nota(a)
              return (
                <tr key={a.alumno_id}>
                  <td className="px-3 py-2 font-medium text-slate-900">{a.nombre}</td>
                  {criterios.length > 0 ? (
                    criterios.map((c, j) => (
                      <td key={c.id} className="px-2 py-1 text-right">
                        <input
                          type="number"
                          min="0"
                          max={c.max_puntaje}
                          step="0.5"
                          className={claseInput}
                          data-col={`c${j}`}
                          data-fila={i}
                          aria-label={`${c.nombre} for ${a.nombre}`}
                          disabled={bloqueada || ocupado}
                          value={actual(a).valores[c.id] ?? ''}
                          onChange={(e) => poner(a, { valores: { ...actual(a).valores, [c.id]: e.target.value } })}
                          onKeyDown={(e) => irAlSiguiente(e, tabla)}
                        />
                      </td>
                    ))
                  ) : (
                    <td className="px-2 py-1 text-right">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.01"
                        className={claseInput}
                        data-col="nota"
                        data-fila={i}
                        aria-label={`Grade for ${a.nombre}`}
                        disabled={bloqueada || ocupado}
                        value={actual(a).puntaje ?? ''}
                        onChange={(e) => poner(a, { puntaje: e.target.value })}
                        onKeyDown={(e) => irAlSiguiente(e, tabla)}
                      />
                    </td>
                  )}
                  <td className="px-3 py-2 text-right font-semibold text-slate-900">{fmtNota(n)}</td>
                  <td className="px-3 py-2 text-right text-slate-600">{n == null ? '—' : evaluacion.tipo === 'formative' ? (u || '—') : fmtNota((Number(evaluacion.peso) * n) / 100)}</td>
                  <td className="px-3 py-2">
                    {bloqueada ? <Badge color="brand">Published</Badge> : filaDe(a) && !cambiada(a) ? <Badge color="peach">Draft</Badge> : cambiada(a) ? <Badge color="peach">Unsaved</Badge> : <Badge color="slate">No grade</Badge>}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-slate-500">Type the grade and press Enter to move to the next student. A published grade is corrected from its record in the matrix (with a reason).</p>
      {aviso && <p className="rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-800" role="status">{aviso}</p>}
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="secondary" disabled={ocupado || pendientesGuardar.length === 0} onClick={() => ejecutar(() => guardar(false))}>
          Save drafts
        </Button>
        <Button disabled={ocupado} onClick={() => ejecutar(() => guardar(true))}>
          Save and publish completed ones{sinNota > 0 ? ` (${sinNota} without a grade stay pending)` : ''}
        </Button>
      </div>
    </div>
  )
}

// ---- Participación: estudiantes × clases ya realizadas; un clic por casilla y «todos cumplieron» por clase ----
function CapturaParticipacion({ evaluacionId, servicio, onCambio }) {
  const cargar = useCallback(() => servicio.participacionDetalle(evaluacionId), [servicio, evaluacionId])
  const detalle = useCarga(cargar, null)
  const [edits, setEdits] = useState({}) // `${alumnoId}|${sesionId}` → true | false | null
  const [aviso, setAviso] = useState('')
  const [error, setError] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const enCurso = useRef(false)

  if (detalle.error) return <p className="text-sm text-red-600">Could not open the participation: {detalle.error}</p>
  if (detalle.cargando || !detalle.datos) return <p className="py-3 text-sm text-slate-400">Loading…</p>
  const { evaluacion, sesiones, alumnos } = detalle.datos
  if (sesiones.length === 0) return <p className="rounded-lg bg-amber-50 px-3 py-3 text-sm text-amber-800">This module has no classes assigned yet. Administration must indicate which classes it covers.</p>

  const k = (a, s) => `${a.alumno_id}|${s.id}`
  const marca = (a, s) => (k(a, s) in edits ? edits[k(a, s)] : (a.marcas[s.id] ?? null))
  const editable = (a) => !a.publicada
  const completa = (a) => sesiones.every((s) => s.hecha && marca(a, s) !== null)
  const ciclo = (v) => (v === null ? true : v === true ? false : null) // pendiente → cumplió → no cumplió → pendiente
  const cambios = alumnos.flatMap((a) => (editable(a) ? sesiones.filter((s) => k(a, s) in edits && (edits[k(a, s)] ?? null) !== (a.marcas[s.id] ?? null)).map((s) => ({ alumnoId: a.alumno_id, sesionId: s.id, cumplio: edits[k(a, s)] })) : []))

  const todos = (s) =>
    setEdits((p) => {
      const n = { ...p }
      for (const a of alumnos) if (editable(a) && marca(a, s) === null) n[k(a, s)] = true
      return n
    })

  const ejecutar = async (fn) => {
    if (enCurso.current) return
    enCurso.current = true
    setOcupado(true)
    setAviso('')
    setError('')
    try {
      setAviso(await fn())
      setEdits({})
      await detalle.recargar()
      await onCambio?.()
    } catch (e) {
      setError(e.message)
    } finally {
      enCurso.current = false
      setOcupado(false)
    }
  }
  const guardar = async () => {
    if (cambios.length) await servicio.guardarParticipacion(evaluacion.id, cambios)
  }

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs text-slate-600">
            <tr>
              <th className="px-3 py-2">Student</th>
              {sesiones.map((s) => (
                <th key={s.id} className="px-2 py-2 text-center">
                  <span className="block">Class {s.numero}</span>
                  <span className="block font-normal text-slate-400">{formatFecha(String(s.fecha).slice(0, 10))}</span>
                  {s.hecha ? (
                    <button type="button" className="mt-0.5 text-[10px] font-normal text-brand-700 underline" onClick={() => todos(s)} aria-label={`Everyone met class ${s.numero}`}>
                      Everyone met it
                    </button>
                  ) : (
                    <span className="text-[10px] font-normal text-slate-400">not held yet</span>
                  )}
                </th>
              ))}
              <th className="px-3 py-2">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {alumnos.map((a) => (
              <tr key={a.alumno_id}>
                <td className="px-3 py-2 font-medium text-slate-900">{a.nombre}</td>
                {sesiones.map((s) => {
                  const m = marca(a, s)
                  const texto = !s.hecha ? '·' : m === true ? '✓' : m === false ? '✗' : '?'
                  return (
                    <td key={s.id} className="px-2 py-1 text-center">
                      <button
                        type="button"
                        aria-label={`Class ${s.numero} for ${a.nombre}: ${!s.hecha ? 'not held yet' : m === true ? 'met' : m === false ? 'did not meet' : 'pending'}`}
                        disabled={!s.hecha || !editable(a) || ocupado}
                        onClick={() => setEdits((p) => ({ ...p, [k(a, s)]: ciclo(m) }))}
                        className={`h-8 w-8 rounded-md border text-sm font-semibold disabled:opacity-40 ${m === true ? 'border-brand-300 bg-brand-50 text-brand-700' : m === false ? 'border-rose-300 bg-rose-50 text-rose-700' : 'border-slate-300 text-slate-500'}`}
                      >
                        {texto}
                      </button>
                    </td>
                  )
                })}
                <td className="px-3 py-2">{a.publicada ? <Badge color="brand">Published</Badge> : completa(a) ? <Badge color="peach">Ready to publish</Badge> : <Badge color="slate">In progress</Badge>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-slate-500">Toca una casilla para alternar: ? pendiente → ✓ cumplió → ✗ no cumplió. Una casilla pendiente nunca cuenta como «no cumplió». Para cambiar una participación ya publicada usa su ficha (con motivo).</p>
      {aviso && <p className="rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-800" role="status">{aviso}</p>}
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="secondary" disabled={ocupado || cambios.length === 0} onClick={() => ejecutar(async () => { await guardar(); return 'Participation saved. Students cannot see it yet.' })}>
          Save
        </Button>
        <Button
          disabled={ocupado}
          onClick={() =>
            ejecutar(async () => {
              await guardar()
              const ids = alumnos.filter((a) => editable(a) && completa(a)).map((a) => a.alumno_id)
              if (ids.length === 0) return 'No student has all classes recorded yet.'
              await servicio.publicarParticipacion(evaluacion.id, ids)
              return `Participation published for ${ids.length} student(s).`
            })
          }
        >
          Save and publish completed ones
        </Button>
      </div>
    </div>
  )
}

// Captura rápida: se elige módulo y componente y se llena toda la lista de estudiantes de una vez.
function Captura({ datos, servicio, onCambio }) {
  const modulos = datos.modulos.filter((m) => m.evaluaciones?.length)
  const [moduloId, setModuloId] = useState(modulos[0]?.id ?? '')
  const modulo = modulos.find((m) => m.id === moduloId) ?? modulos[0]
  const [evalId, setEvalId] = useState('')
  const ev = modulo?.evaluaciones.find((e) => e.id === evalId) ?? modulo?.evaluaciones[0]
  const [unidad, setUnidad] = useState('')
  if (!modulo) return <p className="text-sm text-slate-500">There are no components to record.</p>
  // En el Formative la participación por clase es una «parte» más, junto a las 3 unidades.
  const PARTE_PARTICIPACION = '__participacion'
  const conParticipacion = ev.tipo === 'formative' && Number(ev.peso_participacion) > 0
  const unidades = [...(ev.unidades ?? []), ...(conParticipacion ? [PARTE_PARTICIPACION] : [])]
  const u = unidades.includes(unidad) ? unidad : (unidades[0] ?? '')
  const esParticipacion = ev.tipo === 'participacion' || u === PARTE_PARTICIPACION
  const sel = 'rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm'
  return (
    <Card className="space-y-3 p-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-xs text-slate-600">
          Module
          <select aria-label="Module to record" className={`${sel} mt-1 block`} value={modulo.id} onChange={(e) => { setModuloId(e.target.value); setEvalId('') }}>
            {modulos.map((m) => (
              <option key={m.id} value={m.id}>{m.nombre}</option>
            ))}
          </select>
        </label>
        <label className="text-xs text-slate-600">
          Componente
          <select aria-label="Component to record" className={`${sel} mt-1 block`} value={ev.id} onChange={(e) => setEvalId(e.target.value)}>
            {modulo.evaluaciones.map((e) => (
              <option key={e.id} value={e.id}>{e.nombre} (peso {fmtNota(e.peso)})</option>
            ))}
          </select>
        </label>
        {unidades.length > 0 && ev.tipo !== 'participacion' && (
          <label className="text-xs text-slate-600">
            {conParticipacion ? 'Part' : 'Unit'}
            <select aria-label="Unit to record" className={`${sel} mt-1 block`} value={u} onChange={(e) => setUnidad(e.target.value)}>
              {unidades.map((x) => (
                <option key={x} value={x}>{x === PARTE_PARTICIPACION ? 'Participation per class' : x}</option>
              ))}
            </select>
          </label>
        )}
      </div>
      {esParticipacion ? (
        <CapturaParticipacion key={ev.id} evaluacionId={ev.id} servicio={servicio} onCambio={onCambio} />
      ) : (
        <CapturaNotas key={`${ev.id}|${u}`} evaluacionId={ev.id} unidad={u} servicio={servicio} onCambio={onCambio} />
      )}
    </Card>
  )
}

export default function CapturaRapida({ salonId, servicio = servicioReal }) {
  const cargar = useCallback(() => servicio.matrizSalon(salonId), [servicio, salonId])
  const { datos, cargando, error, recargar } = useCarga(cargar, null)
  if (error) return <p className="text-sm text-red-600">Could not load the classroom: {error}</p>
  if (cargando && !datos) return <p className="py-6 text-center text-sm text-slate-500">Loading…</p>
  if (!datos || datos.modulos.length === 0) return <p className="text-sm text-slate-500">This classroom has no assessment modules yet. Administration sets them up.</p>
  if (datos.alumnos.length === 0) return <p className="text-sm text-slate-500">There are no students enrolled in this classroom.</p>
  return <Captura datos={datos} servicio={servicio} onCambio={recargar} />
}
