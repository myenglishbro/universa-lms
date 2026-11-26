import { useCallback, useRef, useState } from 'react'
import Badge from '../ui/Badge'
import Button from '../ui/Button'
import Card from '../ui/Card'
import { PropuestaModulo } from '../ejercicios/FormativePropuesta'
import useCarga from '../../hooks/useCarga'
import { NIVELES_RUBRICA, criteriosDeUnidad, esPorNiveles, fmtNota, nivelDePuntaje, notaRubrica, puntajeDeNivel, valoresDeDetalleRubrica } from '../../lib/evaluaciones'
import { formatFecha } from '../../lib/salones'
import * as servicioReal from '../../services/evaluaciones'
import * as servicioEjercicios from '../../services/ejercicios'

// Selector de nivel 0–5: lo bastante ancho para leer «4 · Achieved» o «0 · Not demonstrated» completo; el color indica el nivel.
const claseSelectNivel = 'w-44 rounded-xl border px-2.5 py-2 text-left text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand-500/30 disabled:opacity-70'
const TONO_NIVEL = {
  vacio: 'border-slate-300 bg-white text-slate-500',
  0: 'border-rose-200 bg-rose-50 text-rose-800',
  1: 'border-orange-200 bg-orange-50 text-orange-800',
  2: 'border-amber-200 bg-amber-50 text-amber-800',
  3: 'border-sky-200 bg-sky-50 text-sky-800',
  4: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  5: 'border-brand-300 bg-brand-100 text-brand-800',
}
const claseInput = 'w-20 rounded-xl border border-slate-300 bg-white px-2.5 py-2 text-right text-sm font-semibold tabular-nums focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 disabled:bg-slate-50 disabled:text-slate-500'

const iniciales = (nombre) =>
  String(nombre ?? '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((x) => x[0].toUpperCase())
    .join('')

function Estado({ clase, punto, children }) {
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${clase}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${punto}`} /> {children}
    </span>
  )
}

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
  const u = unidad ?? ''
  // Writing por tareas: la captura de una tarea (Task 1 o Task 2) usa solo sus criterios.
  const criterios = criteriosDeUnidad(rubrica?.criterios ?? [], u)
  const filaDe = (a) => a.filas.find((f) => f.unidad === u)
  const base = (a) => {
    const f = filaDe(a)
    if (criterios.length) {
      return { valores: valoresDeDetalleRubrica(criterios, f?.detalle) }
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
  const nSinGuardar = alumnos.filter((a) => !publicada(a) && cambiada(a)).length
  const nPublicadas = alumnos.filter(publicada).length
  const etiquetaCriterio = (c) => (u && String(c.nombre).startsWith(`${u} · `) ? String(c.nombre).slice(u.length + 3) : c.nombre)

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm" ref={tabla}>
        <table className="w-full border-separate border-spacing-0 text-sm">
          <thead>
            <tr className="text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              <th className="sticky left-0 z-10 border-b border-slate-200 bg-slate-50 px-4 py-3">Student</th>
              {criterios.length > 0 ? (
                criterios.map((c) => (
                  <th key={c.id} className="border-b border-slate-200 bg-slate-50 px-2 py-3 align-bottom">
                    <span className="block max-w-[10rem] normal-case leading-tight tracking-normal text-slate-700">{etiquetaCriterio(c)}</span>
                    <span className="mt-1 inline-block rounded-full bg-white px-1.5 py-0.5 text-[10px] font-medium text-slate-500 ring-1 ring-inset ring-slate-200">{fmtNota(c.max_puntaje)} pts</span>
                  </th>
                ))
              ) : (
                <th className="border-b border-slate-200 bg-slate-50 px-2 py-3 text-right">Grade (0–100)</th>
              )}
              <th className="border-b border-slate-200 bg-slate-50 px-3 py-3 text-right">Total /100</th>
              <th className="border-b border-slate-200 bg-slate-50 px-3 py-3 text-right">{evaluacion.tipo === 'formative' ? 'Unit' : 'Contribution'}</th>
              <th className="border-b border-slate-200 bg-slate-50 px-3 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {alumnos.map((a, i) => {
              const bloqueada = publicada(a)
              const n = nota(a)
              const sucia = cambiada(a) && !bloqueada
              const fondo = sucia ? 'bg-amber-50/60' : 'bg-white'
              return (
                <tr key={a.alumno_id} className="group">
                  <td className={`sticky left-0 z-10 border-b border-slate-100 px-4 py-3 ${fondo}`}>
                    <span className="flex items-center gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-700">{iniciales(a.nombre)}</span>
                      <span className="min-w-[8rem] max-w-[11rem] text-sm font-medium leading-snug text-slate-900">{a.nombre}</span>
                    </span>
                  </td>
                  {criterios.length > 0 ? (
                    criterios.map((c, j) => (
                      <td key={c.id} className={`border-b border-slate-100 px-2 py-3 ${fondo}`}>
                        {esPorNiveles(c) ? (
                          // Criterio por niveles 0–5: la captura rápida elige el nivel; los puntos salen solos (nivel ÷ 5 × peso).
                          <select
                            className={`${claseSelectNivel} ${TONO_NIVEL[nivelDePuntaje(c, actual(a).valores[c.id])] ?? TONO_NIVEL.vacio}`}
                            data-col={`c${j}`}
                            data-fila={i}
                            aria-label={`${c.nombre} for ${a.nombre}`}
                            disabled={bloqueada || ocupado}
                            value={nivelDePuntaje(c, actual(a).valores[c.id]) ?? ''}
                            onChange={(e) => poner(a, { valores: { ...actual(a).valores, [c.id]: e.target.value === '' ? '' : puntajeDeNivel(c, e.target.value) } })}
                            onKeyDown={(e) => irAlSiguiente(e, tabla)}
                          >
                            <option value="">— Select —</option>
                            {NIVELES_RUBRICA.map((nv) => (
                              <option key={nv.nivel} value={nv.nivel}>
                                {nv.nivel} · {nv.etiqueta}
                              </option>
                            ))}
                          </select>
                        ) : (
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
                        )}
                      </td>
                    ))
                  ) : (
                    <td className={`border-b border-slate-100 px-2 py-3 text-right ${fondo}`}>
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
                  <td className={`border-b border-slate-100 px-3 py-3 text-right ${fondo}`}>
                    <span className={`text-lg font-bold tabular-nums ${n == null ? 'text-slate-300' : 'text-slate-900'}`}>{n == null ? '—' : fmtNota(n)}</span>
                    <span className="mt-1 block h-1 w-16 overflow-hidden rounded-full bg-slate-100 ml-auto" aria-hidden="true">
                      <span className={`block h-full rounded-full ${n == null ? '' : n >= 70 ? 'bg-emerald-500' : n >= 50 ? 'bg-brand-500' : 'bg-peach-500'}`} style={{ width: `${n == null ? 0 : Math.min(100, n)}%` }} />
                    </span>
                  </td>
                  <td className={`border-b border-slate-100 px-3 py-3 text-right text-slate-600 tabular-nums ${fondo}`}>{n == null ? '—' : evaluacion.tipo === 'formative' ? (u || '—') : fmtNota((Number(evaluacion.peso) * n) / 100)}</td>
                  <td className={`border-b border-slate-100 px-3 py-3 ${fondo}`}>
                    {bloqueada ? <Estado clase="bg-emerald-50 text-emerald-700" punto="bg-emerald-500">Published</Estado> : cambiada(a) ? <Estado clase="bg-amber-50 text-amber-800" punto="bg-amber-400">Unsaved</Estado> : filaDe(a) ? <Estado clase="bg-peach-100 text-peach-700" punto="bg-peach-500">Draft</Estado> : <Estado clase="bg-slate-100 text-slate-500" punto="bg-slate-300">No grade</Estado>}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-slate-500">
        {criterios.some(esPorNiveles) ? 'Pick a level for each criterion; ' : 'Type the grade and '}press <kbd className="rounded border border-slate-300 bg-white px-1 text-[10px]">Enter</kbd> to jump to the same box of the next student. A published grade is corrected from its record in the matrix (with a reason).
      </p>
      {aviso && <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800" role="status">{aviso}</p>}
      {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-slate-50 px-4 py-3">
        <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
          <span><strong className="text-slate-900">{alumnos.length}</strong> students</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-500" /> {nPublicadas} published</span>
          {nSinGuardar > 0 && <span className="inline-flex items-center gap-1.5 text-amber-800"><span className="h-2 w-2 rounded-full bg-amber-400" /> {nSinGuardar} unsaved</span>}
          {sinNota > 0 && <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-slate-300" /> {sinNota} without a grade</span>}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" disabled={ocupado || pendientesGuardar.length === 0} onClick={() => ejecutar(() => guardar(false))}>
            Save drafts
          </Button>
          <Button disabled={ocupado} onClick={() => ejecutar(() => guardar(true))}>
            Save and publish completed ones
          </Button>
        </div>
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
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
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
              <th className="px-3 py-2">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {alumnos.map((a) => (
              <tr key={a.alumno_id}>
                <td className="px-3 py-2">
                  <span className="flex items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-700">{iniciales(a.nombre)}</span>
                    <span className="min-w-[8rem] text-sm font-medium text-slate-900">{a.nombre}</span>
                  </span>
                </td>
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
                        className={`h-9 w-9 rounded-xl border text-sm font-semibold transition disabled:opacity-40 ${m === true ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : m === false ? 'border-rose-300 bg-rose-50 text-rose-700' : 'border-slate-300 text-slate-400 hover:border-brand-400 hover:bg-brand-50'}`}
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
      <p className="text-xs text-slate-500">Tap a box to cycle it: ? pending → ✓ met → ✗ did not meet. A pending box never counts as “did not meet”. To change a published participation use its record (with a reason).</p>
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

// Fila de botones (en vez de listas desplegables): lo elegido se ve de un vistazo y cambiar es un solo clic.
function Pildoras({ etiqueta, opciones, valor, onCambio }) {
  return (
    <div>
      <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">{etiqueta}</p>
      <div className="flex flex-wrap gap-1.5" role="tablist" aria-label={etiqueta}>
        {opciones.map((o) => {
          const on = o.id === valor
          return (
            <button
              key={o.id}
              role="tab"
              aria-selected={on}
              onClick={() => onCambio(o.id)}
              className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${on ? 'bg-brand-600 text-white shadow-sm' : 'bg-white text-slate-700 ring-1 ring-slate-200 hover:ring-brand-300'}`}
            >
              {o.texto}
              {o.nota && <span className={`text-[11px] ${on ? 'text-white/80' : 'text-slate-400'}`}>{o.nota}</span>}
            </button>
          )
        })}
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
  return (
    <Card className="space-y-4 p-4 sm:p-5">
      <div className="space-y-3 rounded-2xl bg-slate-50 p-3 sm:p-4">
        {modulos.length > 1 && (
          <Pildoras etiqueta="Module" valor={modulo.id} onCambio={(id) => { setModuloId(id); setEvalId('') }} opciones={modulos.map((m) => ({ id: m.id, texto: m.nombre }))} />
        )}
        <Pildoras etiqueta="Component" valor={ev.id} onCambio={setEvalId} opciones={modulo.evaluaciones.map((e) => ({ id: e.id, texto: e.nombre, nota: `${fmtNota(e.peso)} pts` }))} />
        {unidades.length > 0 && ev.tipo !== 'participacion' && (
          <Pildoras etiqueta={conParticipacion ? 'Part' : 'Unit'} valor={u} onCambio={setUnidad} opciones={unidades.map((x) => ({ id: x, texto: x === PARTE_PARTICIPACION ? 'Participation per class' : x }))} />
        )}
      </div>
      {esParticipacion ? (
        <CapturaParticipacion key={ev.id} evaluacionId={ev.id} servicio={servicio} onCambio={onCambio} />
      ) : ev.tipo === 'formative' ? (
        // La nota de una unidad del Formative sale de sus 5 elementos: se capturan aquí (0–100) y la unidad se calcula y publica sola.
        <PropuestaModulo key={ev.id} evaluacionId={ev.id} unidad={u} servicio={servicio.propuestaFormative ? servicio : servicioEjercicios} compacto onCambio={onCambio} />
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
