import { useCallback, useState } from 'react'
import Badge from '../ui/Badge'
import Button from '../ui/Button'
import Card from '../ui/Card'
import Field from '../ui/Field'
import Icon from '../ui/Icon'
import useCarga from '../../hooks/useCarga'
import { formatFecha } from '../../lib/salones'
import { ELEMENTOS, ESTADOS_FILA, agruparPorUnidad, descriptorSpark, estadoFila, leerSpark, nota2 } from '../../lib/formativeBanco'

const ESTADO_ACTIVIDAD = { sin_entrega: 'not submitted', por_revisar: 'to review' }

// Un elemento: valor de 0 a max. Viene del promedio de las actividades oficiales calificadas o de la nota manual del docente (que prevalece).
// Todo se ve y se captura de 0 a 100 (como lo dan las plataformas); la conversión a la escala interna (0–max) se hace solo al guardar.
// Listening, Reading, Writing y Speaking son SOLO LECTURA: la nota llega del banco. El reemplazo manual queda detrás de «Override».
// SPARK Homework es el único campo que se escribe (la nota sale de la plataforma SPARK, que aquí no está conectada).
function CeldaElemento({ el, max, manual, onManual, etiqueta, conActividades }) {
  const [reemplazar, setReemplazar] = useState(false)
  const aPct = (v) => String(Math.round((Number(v) * 100 * 100) / Number(max)) / 100)
  const valorManual = manual !== undefined ? manual : el?.es_manual && el.valor != null ? aPct(el.valor) : ''
  const verInput = !conActividades || reemplazar || manual !== undefined || el?.es_manual
  const spark = !conActividades ? descriptorSpark(valorManual === '' ? '' : (Number(valorManual) * 5) / 100) : null
  return (
    <div className="space-y-1">
      {conActividades && (
        <span title={(el?.actividades ?? []).map((a) => `${a.titulo}: ${a.estado === 'calificada' ? nota2(a.nota) : ESTADO_ACTIVIDAD[a.estado]}`).join('\n')}>
          {!el || el.n_asignadas === 0 ? (
            <span className="text-slate-300">no activities</span>
          ) : (
            <>
              {el.promedio == null ? <span className="italic text-slate-400">pending</span> : <strong>{nota2(el.promedio)}</strong>}
              <span className="text-xs text-slate-400">
                {' '}
                / 100 · {el.n_calificadas} de {el.n_asignadas}
              </span>
            </>
          )}
        </span>
      )}
      {conActividades && !verInput && (
        <button type="button" onClick={() => setReemplazar(true)} className="block text-[11px] text-slate-500 underline">
          Override
        </button>
      )}
      {verInput && (
        <input
          type="number"
          min="0"
          max="100"
          step="any"
          aria-label={etiqueta}
          placeholder={conActividades ? 'override' : '0–100'}
          title={conActividades ? 'Manual override of the bank grade (0–100). Empty = automatic.' : 'SPARK platform grade (0–100)'}
          className={`w-20 rounded-lg border px-2 py-1 text-sm ${el?.es_manual || manual !== undefined ? 'border-brand-400 bg-brand-50' : 'border-slate-300'}`}
          value={valorManual}
          onChange={(ev) => onManual(ev.target.value)}
        />
      )}
      {spark && (
        <p className="max-w-[14rem] text-[11px] leading-snug text-slate-600" aria-live="polite">
          <strong>{spark.nivel} · {spark.etiqueta}:</strong> {spark.texto}
        </p>
      )}
    </div>
  )
}

// Una unidad: los 5 elementos de cada estudiante. La nota de la unidad se publica sola al completarse; aquí solo se corrige o se completa a mano.
function GrupoUnidad({ grupo, evaluacionId, max, servicio, onHecho }) {
  const [manual, setManual] = useState({})
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState('')
  const [aviso, setAviso] = useState('')

  const claves = Object.keys(manual)

  const guardar = async () => {
    setError('')
    setAviso('')
    const filas = []
    for (const k of claves) {
      const [alumno, elemento] = k.split('|')
      const v = leerSpark(manual[k], 100)
      if (v === undefined) return setError('Grades must be between 0 and 100')
      filas.push({ alumno_id: alumno, unidad: grupo.unidad, elemento, puntaje: v == null ? null : (v * max) / 100 })
    }
    setOcupado(true)
    try {
      await servicio.guardarFormativeManual(evaluacionId, filas)
      setManual({})
      setAviso('Saved. Units with all 5 elements complete were published automatically and the student can see them.')
      await onHecho()
    } catch (e) {
      setError(e.message)
    } finally {
      setOcupado(false)
    }
  }

  return (
    <Card className="mb-5 overflow-hidden">
      <div className="border-b border-slate-100 px-4 py-3">
        <h3 className="text-base font-semibold text-slate-900">{grupo.unidad}</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[56rem] text-sm">
          <thead className="bg-slate-50 text-left text-xs text-slate-600">
            <tr>
              <th className="px-3 py-2">Student</th>
              {ELEMENTOS.map((h) => (
                <th key={h.id} className="px-3 py-2">
                  {h.label}
                </th>
              ))}
              <th className="px-3 py-2 text-right">Unit</th>
              <th className="px-3 py-2">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {grupo.filas.map((f) => {
              const e = ESTADOS_FILA[estadoFila(f)]
              return (
                <tr key={f.alumno_id} className="align-top">
                  <td className="px-3 py-2 font-medium text-slate-900">
                    {f.nombre}
                    <span className="block text-xs font-normal text-slate-500">{f.completos} of 5 elements</span>
                  </td>
                  {ELEMENTOS.map((h) => {
                    const k = `${f.alumno_id}|${h.id}`
                    return (
                      <td key={h.id} className="px-3 py-2">
                        <CeldaElemento
                          el={f.elementos[h.id]}
                          max={max}
                          conActividades={h.id !== 'spark'}
                          manual={manual[k]}
                          etiqueta={`${h.label} for ${f.nombre}`}
                          onManual={(v) => setManual((m) => ({ ...m, [k]: v }))}
                        />
                      </td>
                    )
                  })}
                  <td className="px-3 py-2 text-right">
                    {f.valor != null ? (
                      <strong>{nota2(f.valor)}</strong>
                    ) : f.provisional != null ? (
                      <span className="text-slate-500">
                        <span className="text-xs">avance </span>
                        {nota2(f.provisional)}
                      </span>
                    ) : (
                      '—'
                    )}
                    <span className="block text-xs text-slate-500">{f.registrada ? `In the matrix: ${nota2(f.registrada.puntaje)} (${f.registrada.estado === 'publicada' ? 'published' : 'draft'})` : 'no grade'}</span>
                    {f.confirmacion && <span className="block text-xs text-slate-400">Actualizada {formatFecha(String(f.confirmacion.cuando).slice(0, 10))}</span>}
                  </td>
                  <td className="px-3 py-2">
                    <Badge color={e.color}>{e.texto}</Badge>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div className="space-y-3 border-t border-slate-100 bg-slate-50/60 px-4 py-3">
        {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
        {aviso && <p role="status" className="text-sm text-brand-700">{aviso}</p>}
        <div className="flex flex-wrap justify-end gap-2">
          <Button onClick={guardar} disabled={ocupado || claves.length === 0}>
            {ocupado ? 'Saving…' : `Save manual grades (${claves.length})`}
          </Button>
        </div>
      </div>
    </Card>
  )
}

function PropuestaModulo({ evaluacionId, servicio }) {
  // Al abrir se recalcula (por si se quitó o cambió una actividad) y luego se lee.
  const cargar = useCallback(async () => {
    try {
      await servicio.recalcularFormative(evaluacionId)
    } catch {
      // Si el recálculo falla igual se muestra lo guardado.
    }
    return servicio.propuestaFormative(evaluacionId)
  }, [servicio, evaluacionId])
  const { datos, cargando, error, recargar } = useCarga(cargar, null)
  if (cargando && !datos) return <p className="py-10 text-center text-sm text-slate-500">Loading…</p>
  if (error) return <p className="text-sm text-red-600">Could not load the Formative: {error}</p>
  if (!datos) return null
  const grupos = agruparPorUnidad(datos.filas, datos.unidades)
  return (
    <>
      <p className="mb-2 text-sm text-slate-500">
        La nota de cada unidad se calcula y se publica sola cuando el estudiante tiene sus 5 elementos (16 % del Formative cada uno): Listening / Lessons, Writing, Reading y Speaking salen del promedio de las actividades oficiales; SPARK Homework es lo único que anotas tú, de 0 a 100 como lo da la plataforma SPARK. La participación por clase (20 %) sale de los checks de las sesiones.
      </p>
      <p className="mb-4 text-sm text-slate-500">
        ¿Olvidaste asignar una actividad o la tomaste de forma oral? Usa «Override» en ese elemento y escribe la nota (0 a 100): prevalece sobre las actividades y, si lo vacías, vuelve el cálculo automático. Si falta algún elemento, la unidad queda en avance: no se publica y no cuenta como cero.
      </p>
      {datos.actividades.length === 0 && (
        <p className="mb-4 rounded-xl bg-peach-50 px-3 py-2 text-sm text-peach-700">This module has no official activities from the bank yet. In “Exercises” choose “Count toward Formative” on an assigned exercise, or assign a new one as an official activity.</p>
      )}
      {grupos.map((g) => (
        <GrupoUnidad key={g.unidad} grupo={g} evaluacionId={evaluacionId} max={datos.max} servicio={servicio} onHecho={recargar} />
      ))}
    </>
  )
}

// Vista «Calificaciones Formative» del salón: elige el módulo, revisa los 5 elementos por unidad y confirma.
export default function FormativePropuesta({ salonId, servicio, onVolver }) {
  const cargar = useCallback(() => servicio.opcionesFormative(salonId), [servicio, salonId])
  const { datos: opciones, cargando, error } = useCarga(cargar, null)
  const [elegida, setElegida] = useState('')
  const destinos = opciones?.destinos ?? []
  const actual = elegida || (destinos.length === 1 ? destinos[0].evaluacion_id : '')

  return (
    <>
      <button onClick={onVolver} className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-brand-700">
        <Icon name="back" className="h-4 w-4" /> Classroom exercises
      </button>
      <h2 className="mb-1 text-2xl font-bold text-brand-800">Formative grades by unit</h2>
      {cargando && <p className="py-10 text-center text-sm text-slate-500">Loading…</p>}
      {error && <p className="text-sm text-red-600">Could not load the modules: {error}</p>}
      {opciones && destinos.length === 0 && <p className="text-sm text-slate-500">This classroom has no modules with a Formative yet.</p>}
      {destinos.length > 1 && (
        <Field
          className="mb-4 max-w-sm"
          label="Module"
          value={actual}
          onChange={(e) => setElegida(e.target.value)}
          options={[{ value: '', label: 'Elige el módulo…' }, ...destinos.map((d) => ({ value: d.evaluacion_id, label: d.modulo }))]}
        />
      )}
      {actual && <PropuestaModulo key={actual} evaluacionId={actual} servicio={servicio} />}
    </>
  )
}
