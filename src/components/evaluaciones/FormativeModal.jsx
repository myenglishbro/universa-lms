import { useCallback, useState } from 'react'
import Badge from '../ui/Badge'
import Modal from '../ui/Modal'
import useCarga from '../../hooks/useCarga'
import { ELEMENTOS, descriptorSpark, leerSpark, nota2 } from '../../lib/formativeBanco'
import { formativeDeAlumno, guardarFormativeManual } from '../../services/ejercicios'
import { fmtNota } from '../../lib/evaluaciones'
import * as servicioReal from '../../services/evaluaciones'
import { ContenidoParticipacion } from './ParticipacionModal'

// Resumen en vivo del Formative de un estudiante: las 3 unidades, la participación y la nota que resulta.
const ESTADO_UNIDAD = {
  publicada: { texto: 'Published', punto: 'bg-emerald-500', caja: 'border-emerald-200 bg-emerald-50/60' },
  borrador: { texto: 'Draft', punto: 'bg-amber-400', caja: 'border-amber-200 bg-amber-50/60' },
  vacia: { texto: 'No grade', punto: 'bg-slate-300', caja: 'border-slate-200 bg-slate-50' },
}

export function ResumenFormative({ celda }) {
  if (!celda || celda.tipo !== 'formative') return null
  const part = celda.participacion
  const pp = Number(celda.peso_participacion) || 0
  const pct = celda.puntaje == null ? 0 : Math.max(0, Math.min(100, Number(celda.puntaje)))
  return (
    <section className="overflow-hidden rounded-2xl border border-brand-100 bg-gradient-to-br from-brand-50 to-white" role="status" aria-label="Formative summary">
      <div className="grid gap-4 p-4 sm:grid-cols-[1fr_auto] sm:items-center">
        <ul className="grid grid-cols-3 gap-2">
          {celda.unidades.map((u) => {
            const e = ESTADO_UNIDAD[u.estado] ?? ESTADO_UNIDAD.vacia
            return (
              <li key={u.unidad} className={`rounded-xl border px-3 py-2 ${e.caja}`}>
                <p className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
                  <span className={`h-2 w-2 rounded-full ${e.punto}`} /> {u.unidad}
                </p>
                <p className="mt-1 text-xl font-bold leading-none text-slate-900">{u.puntaje == null ? '—' : fmtNota(u.puntaje)}</p>
                <p className="mt-1 text-[11px] text-slate-500">{e.texto}</p>
              </li>
            )
          })}
        </ul>
        <div className="rounded-xl bg-white px-4 py-3 text-center shadow-sm ring-1 ring-brand-100 sm:min-w-[9.5rem]">
          <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{celda.provisional ? 'Provisional' : 'Formative grade'}</p>
          <p className="mt-0.5 text-3xl font-bold leading-none text-brand-700">
            {celda.puntaje == null ? '—' : fmtNota(celda.puntaje)}
            <span className="text-sm font-medium text-slate-400"> /100</span>
          </p>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-brand-100" aria-hidden="true">
            <div className="h-full rounded-full bg-brand-600 transition-all" style={{ width: `${pct}%` }} />
          </div>
          {celda.aporte != null && <p className="mt-1.5 text-[11px] text-slate-500">+{fmtNota(celda.aporte)} pts to the module</p>}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-1 border-t border-brand-100/70 bg-white/60 px-4 py-2.5 text-xs text-slate-600">
        <span>
          Unit average <strong className="ml-1 text-sm text-slate-900">{celda.promedio_unidades == null ? '—' : fmtNota(celda.promedio_unidades)}</strong>
        </span>
        {part?.aplica && (
          <span>
            Participation ({fmtNota(pp)} %) <strong className="ml-1 text-sm text-slate-900">{part.puntaje == null ? '—' : fmtNota(part.puntaje)}</strong>
            <span className="ml-1 text-slate-400">
              {part.cumplidas} of {part.registradas} recorded · {part.total} classes{part.publicada ? ' · published' : ''}
            </span>
          </span>
        )}
        {celda.provisional && <Badge color="peach">Does not count toward the module yet</Badge>}
      </div>
      {celda.provisional && (
        <p className="border-t border-brand-100/70 bg-peach-50/50 px-4 py-2 text-xs text-peach-800">
          Counts toward the module once the 3 units are published{part?.aplica ? ' and the participation' : ''}. What is missing is not counted as zero.
        </p>
      )}
    </section>
  )
}

// Los 5 elementos de cada unidad (0 a 5), ya calculados desde el banco de ejercicios y las notas manuales. Lo que escribas aquí queda como nota
// manual (prevalece sobre las actividades); lo que no toques sigue automático. Con los 5 completos la nota de la unidad se publica sola.
function ElementosEditable({ evaluacionId, alumnoId, onCambio }) {
  const cargar = useCallback(() => formativeDeAlumno(evaluacionId, alumnoId), [evaluacionId, alumnoId])
  const { datos, cargando, error, recargar } = useCarga(cargar, null)
  const [unidad, setUnidad] = useState('')
  const [editado, setEditado] = useState({})
  const [ocupado, setOcupado] = useState(false)
  const [falla, setFalla] = useState('')
  const [aviso, setAviso] = useState('')
  if (error) return <p className="text-sm text-red-600">Could not load the Formative: {error}</p>
  if (cargando && !datos) return <p className="text-sm text-slate-500">Loading…</p>
  if (!datos || datos.length === 0) return <p className="text-sm text-slate-500">This module has no Formative units for this student.</p>
  const actual = datos.find((u) => u.unidad === unidad) ?? datos[0]
  const claves = Object.keys(editado)

  const guardar = async () => {
    setFalla('')
    setAviso('')
    const filas = []
    for (const k of claves) {
      const [u, elemento] = k.split('|')
      const v = leerSpark(editado[k], 100)
      if (v === undefined) return setFalla('Grades must be between 0 and 100')
      filas.push({ alumno_id: alumnoId, unidad: u, elemento, puntaje: v == null ? null : v / 20 })
    }
    setOcupado(true)
    try {
      await guardarFormativeManual(evaluacionId, filas)
      setEditado({})
      setAviso('Saved. If the unit has all 5 elements, it was published automatically.')
      await recargar()
      onCambio?.()
    } catch (e) {
      setFalla(e.message)
    } finally {
      setOcupado(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="inline-flex flex-wrap gap-1 rounded-xl bg-slate-100 p-1" role="tablist" aria-label="Units">
        {datos.map((u) => (
          <button
            key={u.unidad}
            role="tab"
            aria-selected={u.unidad === actual.unidad}
            onClick={() => setUnidad(u.unidad)}
            className={`rounded-lg px-3.5 py-1.5 text-sm font-medium transition ${u.unidad === actual.unidad ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
          >
            {u.unidad}
          </button>
        ))}
      </div>

      <ul className="space-y-2">
        {ELEMENTOS.map((h) => {
          const el = actual.elementos?.[h.id]
          const k = `${actual.unidad}|${h.id}`
          // Todo de 0 a 100 (como lo dan las plataformas). Los 5 elementos se pueden corregir: lo escrito reemplaza al cálculo del banco; vacío = vuelve el automático.
          const valor = k in editado ? editado[k] : el?.valor == null ? '' : String(Number((Number(el.valor) * 20).toFixed(2)))
          const origen = k in editado ? 'unsaved' : el?.valor == null ? 'pending' : el.es_manual ? 'manual' : 'automatic'
          const pctBarra = valor === '' || Number.isNaN(Number(valor)) ? 0 : Math.max(0, Math.min(100, Number(valor)))
          // Aviso de escala: escribir 3.5 o 4.75 casi siempre es una nota de 0–5 digitada en una casilla de 0–100.
          const sospechosa = k in editado && valor !== '' && Number(valor) > 0 && Number(valor) <= 5
          const etiquetaOrigen = ORIGEN[origen]
          return (
            <li key={h.id} className="rounded-2xl border border-slate-200 bg-white p-3 transition focus-within:border-brand-400 focus-within:ring-2 focus-within:ring-brand-500/15">
              <label className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-900">
                    {h.label}
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${etiquetaOrigen.clase}`}>{etiquetaOrigen.texto}</span>
                  </span>
                  <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-slate-100" aria-hidden="true">
                    <span className={`block h-full rounded-full transition-all ${pctBarra >= 70 ? 'bg-emerald-500' : pctBarra >= 50 ? 'bg-brand-500' : pctBarra > 0 ? 'bg-peach-500' : 'bg-slate-200'}`} style={{ width: `${pctBarra}%` }} />
                  </span>
                </span>
                <span className="flex items-center gap-1.5">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="any"
                    inputMode="decimal"
                    aria-label={`${h.label} for ${actual.unidad}`}
                    className="w-24 rounded-xl border border-slate-300 bg-white px-3 py-2 text-right text-base font-semibold tabular-nums focus:border-brand-500 focus:outline-none"
                    title={h.id === 'spark' ? 'SPARK platform grade (0–100)' : 'Grade from the activity bank (0–100). Type to override it; empty = automatic.'}
                    value={valor}
                    placeholder="—"
                    onChange={(ev) => setEditado((e) => ({ ...e, [k]: ev.target.value }))}
                  />
                  <span className="text-xs text-slate-400">/100</span>
                </span>
              </label>
              {sospechosa && (
                <p role="alert" className="mt-2 rounded-lg bg-amber-50 px-3 py-1.5 text-xs text-amber-900">
                  This box is out of <strong>100</strong>. Did you mean <strong>{fmtNota(Number(valor) * 20)}</strong>? ({valor} out of 5 = {fmtNota(Number(valor) * 20)}/100)
                  <button type="button" className="ml-2 font-semibold underline" onClick={() => setEditado((e) => ({ ...e, [k]: String(Number((Number(valor) * 20).toFixed(2))) }))}>
                    Convert to {fmtNota(Number(valor) * 20)}
                  </button>
                </p>
              )}
              {h.id === 'spark' && descriptorSpark(valor === '' ? '' : Number(valor) / 20) && (
                <p className="mt-2 rounded-lg bg-slate-50 px-3 py-1.5 text-xs leading-snug text-slate-600" aria-live="polite">
                  <strong>
                    {descriptorSpark(Number(valor) / 20).nivel} · {descriptorSpark(Number(valor) / 20).etiqueta}:
                  </strong>{' '}
                  {descriptorSpark(Number(valor) / 20).texto}
                </p>
              )}
            </li>
          )
        })}
      </ul>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-slate-50 px-4 py-3">
        <p className="min-w-0 text-sm text-slate-700">
          {actual.valor != null ? (
            <>
              Grade for {actual.unidad}: <strong className="text-lg text-slate-900">{nota2(actual.valor)}</strong> <span className="text-slate-400">/ 100</span>
            </>
          ) : actual.provisional != null ? (
            <>
              Progress for {actual.unidad}: <strong className="text-lg text-slate-900">{nota2(actual.provisional)}</strong> <span className="text-slate-400">/ 100</span>
              <span className="block text-xs text-slate-500">
                {actual.completos} of 5 elements · not published yet; what is missing does not count as zero.
              </span>
            </>
          ) : (
            'No grades yet in this unit.'
          )}
        </p>
        <button
          type="button"
          onClick={guardar}
          disabled={ocupado || claves.length === 0}
          className="rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {ocupado ? 'Saving…' : claves.length ? `Save ${claves.length} change${claves.length === 1 ? '' : 's'}` : 'Save'}
        </button>
      </div>
      {falla && <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{falla}</p>}
      {aviso && <p role="status" className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{aviso}</p>}
    </div>
  )
}

const ORIGEN = {
  unsaved: { texto: 'Unsaved', clase: 'bg-amber-100 text-amber-800' },
  pending: { texto: 'Pending', clase: 'bg-slate-100 text-slate-500' },
  manual: { texto: 'Manual', clase: 'bg-brand-100 text-brand-700' },
  automatic: { texto: 'Automatic', clase: 'bg-emerald-100 text-emerald-700' },
}

// Ficha del Formative de un estudiante: pestaña «Unidades» (5 criterios por unidad) y pestaña «Participación» (clases del módulo).
export default function FormativeModal({ evaluacionId, alumnoId, titulo, celda, servicio = servicioReal, onClose, onCambio }) {
  const conParticipacion = celda?.participacion?.aplica !== false
  const [pestana, setPestana] = useState('unidades')
  const [nombre, ...resto] = String(titulo ?? '').split(' · ')
  return (
    <Modal title={nombre} subtitulo={resto.join(' · ')} onClose={onClose} wide="xl">
      <div className="space-y-5">
        <ResumenFormative celda={celda} />
        {conParticipacion && (
          <div className="flex gap-1 border-b border-slate-200" role="tablist" aria-label="Formative parts">
            {[
              ['unidades', 'Units (5 elements)'],
              ['participacion', 'Participation per class'],
            ].map(([id, t]) => (
              <button
                key={id}
                role="tab"
                aria-selected={pestana === id}
                onClick={() => setPestana(id)}
                className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-medium transition ${pestana === id ? 'border-brand-600 text-brand-700' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
              >
                {t}
              </button>
            ))}
          </div>
        )}
        {pestana === 'unidades' || !conParticipacion ? (
          <ElementosEditable evaluacionId={evaluacionId} alumnoId={alumnoId} onCambio={onCambio} />
        ) : (
          <ContenidoParticipacion evaluacionId={evaluacionId} alumnoId={alumnoId} servicio={servicio} onClose={onClose} onCambio={onCambio} />
        )}
      </div>
    </Modal>
  )
}
