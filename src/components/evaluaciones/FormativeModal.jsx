import { useCallback, useState } from 'react'
import Badge from '../ui/Badge'
import Modal from '../ui/Modal'
import useCarga from '../../hooks/useCarga'
import { ELEMENTOS, leerSpark, nota2 } from '../../lib/formativeBanco'
import { formativeDeAlumno, guardarFormativeManual } from '../../services/ejercicios'
import { fmtNota } from '../../lib/evaluaciones'
import * as servicioReal from '../../services/evaluaciones'
import { ContenidoParticipacion } from './ParticipacionModal'

// Resumen en vivo del Formative de un estudiante: las 3 unidades, la participación y la nota que resulta.
export function ResumenFormative({ celda }) {
  if (!celda || celda.tipo !== 'formative') return null
  const part = celda.participacion
  const pp = Number(celda.peso_participacion) || 0
  return (
    <div className="space-y-2 rounded-xl bg-brand-50 px-4 py-3 text-sm text-brand-900" role="status" aria-label="Resumen del Formative">
      <ul className="grid gap-2 sm:grid-cols-3">
        {celda.unidades.map((u) => (
          <li key={u.unidad} className="rounded-lg bg-white/70 px-3 py-2">
            <p className="text-xs text-brand-700">{u.unidad}</p>
            <p className="font-semibold">
              {u.puntaje == null ? '—' : fmtNota(u.puntaje)} <span className="text-[10px] font-normal text-slate-500">{u.estado === 'publicada' ? 'publicada' : u.estado === 'borrador' ? 'borrador' : 'sin nota'}</span>
            </p>
          </li>
        ))}
      </ul>
      <p>
        Promedio de unidades: <strong>{celda.promedio_unidades == null ? '—' : fmtNota(celda.promedio_unidades)}</strong>
        {part?.aplica && (
          <>
            {' '}
            · Participación ({fmtNota(pp)} %): <strong>{part.puntaje == null ? '—' : fmtNota(part.puntaje)}</strong>{' '}
            <span className="text-xs">
              ({part.cumplidas} cumplidas de {part.registradas} registradas · {part.total} clases en el módulo{part.publicada ? ' · publicada' : ''})
            </span>
          </>
        )}
      </p>
      <p>
        {celda.provisional ? 'Avance provisional del Formative' : 'Nota del Formative'}: <strong>{celda.puntaje == null ? '—' : `${fmtNota(celda.puntaje)}/100`}</strong>
        {celda.aporte != null && <> · aporta {fmtNota(celda.aporte)} puntos al módulo</>}
        {celda.provisional && <Badge color="peach">Aún no suma al módulo</Badge>}
      </p>
      {celda.provisional && <p className="text-xs text-brand-800">Cuenta para el módulo cuando estén publicadas las 3 unidades{part?.aplica ? ' y la participación' : ''}. Lo que falta no se cuenta como cero.</p>}
    </div>
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
  if (error) return <p className="text-sm text-red-600">No se pudo cargar el Formative: {error}</p>
  if (cargando && !datos) return <p className="text-sm text-slate-500">Cargando…</p>
  if (!datos || datos.length === 0) return <p className="text-sm text-slate-500">Este módulo no tiene unidades de Formative para este estudiante.</p>
  const actual = datos.find((u) => u.unidad === unidad) ?? datos[0]
  const claves = Object.keys(editado)

  const guardar = async () => {
    setFalla('')
    setAviso('')
    const filas = []
    for (const k of claves) {
      const [u, elemento] = k.split('|')
      const v = leerSpark(editado[k], 5)
      if (v === undefined) return setFalla('Las notas deben estar entre 0 y 5')
      filas.push({ alumno_id: alumnoId, unidad: u, elemento, puntaje: v })
    }
    setOcupado(true)
    try {
      await guardarFormativeManual(evaluacionId, filas)
      setEditado({})
      setAviso('Guardado. Si la unidad tiene los 5 elementos, ya se publicó sola.')
      await recargar()
      onCambio?.()
    } catch (e) {
      setFalla(e.message)
    } finally {
      setOcupado(false)
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Unidades">
        {datos.map((u) => (
          <button
            key={u.unidad}
            role="tab"
            aria-selected={u.unidad === actual.unidad}
            onClick={() => setUnidad(u.unidad)}
            className={`rounded-full px-3 py-1 text-xs font-medium ${u.unidad === actual.unidad ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
          >
            {u.unidad}
          </button>
        ))}
      </div>
      {ELEMENTOS.map((h) => {
        const el = actual.elementos?.[h.id]
        const k = `${actual.unidad}|${h.id}`
        const valor = k in editado ? editado[k] : el?.valor == null ? '' : String(Number(Number(el.valor).toFixed(2)))
        const origen = k in editado ? 'sin guardar' : el?.valor == null ? 'pendiente' : el.es_manual ? 'manual' : 'automático'
        return (
          <label key={h.id} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2 text-sm">
            <span className="font-medium text-slate-800">
              {h.label} <span className="block text-[11px] font-normal text-slate-400">{origen}</span>
            </span>
            <span className="flex items-center gap-1.5">
              <input
                type="number"
                min="0"
                max="5"
                step="any"
                aria-label={`${h.label} de ${actual.unidad}`}
                className="w-24 rounded-lg border border-slate-300 px-2 py-1 text-sm"
                value={valor}
                onChange={(ev) => setEditado((e) => ({ ...e, [k]: ev.target.value }))}
              />
              <span className="text-xs text-slate-400">/5</span>
            </span>
          </label>
        )
      })}
      <p className="text-sm text-slate-700">
        {actual.valor != null ? (
          <>Nota de {actual.unidad}: <strong>{nota2(actual.valor)}</strong> / 100</>
        ) : actual.provisional != null ? (
          <>Avance de {actual.unidad}: <strong>{nota2(actual.provisional)}</strong> / 100 · {actual.completos} de 5 elementos. Aún no se publica; lo que falta no cuenta como cero.</>
        ) : (
          'Sin notas todavía en esta unidad.'
        )}
      </p>
      {falla && <p role="alert" className="text-sm text-rose-700">{falla}</p>}
      {aviso && <p role="status" className="text-sm text-brand-700">{aviso}</p>}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={guardar}
          disabled={ocupado || claves.length === 0}
          className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {ocupado ? 'Guardando…' : `Guardar (${claves.length})`}
        </button>
      </div>
    </div>
  )
}

// Ficha del Formative de un estudiante: pestaña «Unidades» (5 criterios por unidad) y pestaña «Participación» (clases del módulo).
export default function FormativeModal({ evaluacionId, alumnoId, titulo, celda, servicio = servicioReal, onClose, onCambio }) {
  const conParticipacion = celda?.participacion?.aplica !== false
  const [pestana, setPestana] = useState('unidades')
  return (
    <Modal title={titulo} onClose={onClose} wide>
      <div className="space-y-4">
        <ResumenFormative celda={celda} />
        {conParticipacion && (
          <div className="flex gap-1" role="tablist" aria-label="Partes del Formative">
            {[['unidades', 'Unidades (5 elementos)'], ['participacion', 'Participación por clase']].map(([id, t]) => (
              <button
                key={id}
                role="tab"
                aria-selected={pestana === id}
                onClick={() => setPestana(id)}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium ${pestana === id ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
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
