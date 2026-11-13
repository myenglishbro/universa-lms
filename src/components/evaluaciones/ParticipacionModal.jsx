import { useCallback, useRef, useState } from 'react'
import Badge from '../ui/Badge'
import Button from '../ui/Button'
import { inputClass } from '../ui/Field'
import Modal from '../ui/Modal'
import useCarga from '../../hooks/useCarga'
import { fmtNota } from '../../lib/evaluaciones'
import { formatFecha } from '../../lib/salones'
import * as servicioReal from '../../services/evaluaciones'

// Estado de una clase para este estudiante. Una casilla sin completar es «pendiente», nunca «no cumplió».
const MOTIVO_EXCLUIDA = { matricula: 'Not applicable · before they joined', justificado: 'Not applicable · excused' }
function estadoClase(sesion, marca, excluida) {
  if (excluida) return { id: 'excluida', texto: MOTIVO_EXCLUIDA[excluida] ?? 'Not applicable', color: 'slate' }
  if (marca === true) return { id: 'cumplio', texto: 'Met', color: 'brand' }
  if (marca === false) return { id: 'no', texto: 'Did not meet', color: 'rose' }
  if (!sesion.hecha) return { id: 'futura', texto: 'In advance', color: 'slate' }
  return { id: 'pendiente', texto: 'Pending record', color: 'peach' }
}

function Formulario({ detalle, alumnoId, servicio, onCambio, onClose, mensaje, setMensaje }) {
  const { evaluacion, sesiones } = detalle
  const alumno = detalle.alumnos.find((a) => a.alumno_id === alumnoId)
  const publicada = alumno.publicada
  const [marcas, setMarcas] = useState(alumno.marcas) // sesionId → true | false (ausente = pendiente)
  const [corrigiendo, setCorrigiendo] = useState(false)
  const [motivo, setMotivo] = useState('')
  const [error, setError] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const enCurso = useRef(false)

  const editable = !publicada || corrigiendo
  // Las clases justificadas o anteriores a su ingreso no suman ni restan: el total es el de sus clases aplicables.
  const excluidas = alumno.excluidas ?? {}
  const aplicables = sesiones.filter((s) => !excluidas[s.id])
  const total = aplicables.length
  const registradas = aplicables.filter((s) => marcas[s.id] === true || marcas[s.id] === false).length
  const cumplidas = aplicables.filter((s) => marcas[s.id] === true).length
  const completa = total > 0 && registradas === total
  const nota = total > 0 ? Math.round((cumplidas / total) * 10000) / 100 : null
  const aporte = nota == null ? null : Math.round(Number(evaluacion.peso) * nota) / 100
  const cambios = sesiones.filter((s) => (marcas[s.id] ?? null) !== (alumno.marcas[s.id] ?? null))

  const poner = (id, valor) => setMarcas((m) => {
    const n = { ...m }
    if (valor === null) delete n[id]
    else n[id] = valor
    return n
  })

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
  const guardar = async () => {
    if (cambios.length) await servicio.guardarParticipacion(evaluacion.id, cambios.map((s) => ({ alumnoId, sesionId: s.id, cumplio: marcas[s.id] ?? null })))
  }
  const corregir = () =>
    ejecutar(async () => {
      if (motivo.trim().length < 3) throw new Error('Enter the reason for the correction')
      for (const s of cambios) {
        if (marcas[s.id] == null) throw new Error('In a correction every class must be marked as met or not met')
        await servicio.corregirParticipacion(evaluacion.id, { alumnoId, sesionId: s.id, cumplio: marcas[s.id], motivo })
      }
    }, 'Correction saved. It is kept in the history.')

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500">
        {evaluacion.modulo} · participation per class{evaluacion.tipo === 'formative' ? ' (part of the Formative)' : ` · weight ${fmtNota(evaluacion.peso)} points`}. Mark only the classes in which the student met their participation. You can mark classes in advance. Excused classes or those before they joined do not count: they neither add nor subtract.
      </p>

      {sesiones.length === 0 ? (
        <p className="rounded-lg bg-amber-50 px-3 py-3 text-sm text-amber-800">Este módulo todavía no tiene clases asignadas. Administración debe indicar qué clases del calendario abarca (en el detalle del salón).</p>
      ) : (
        <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
          {sesiones.map((s) => {
            const marca = marcas[s.id]
            const excl = excluidas[s.id]
            const est = estadoClase(s, marca, excl)
            return (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                <span className="text-sm text-slate-800">
                  Class {s.numero} · {formatFecha(String(s.fecha).slice(0, 10))}
                </span>
                <span className="flex items-center gap-2">
                  <Badge color={est.color}>{est.texto}</Badge>
                  <label className="flex items-center gap-1 text-xs text-slate-700">
                    <input
                      type="checkbox"
                      aria-label={`Met class ${s.numero}`}
                      disabled={!editable || !!excl}
                      checked={marca === true}
                      onChange={(e) => poner(s.id, e.target.checked ? true : null)}
                    />
                    Met
                  </label>
                  <button
                    type="button"
                    aria-label={`Did not participate in class ${s.numero}`}
                    aria-pressed={marca === false}
                    disabled={!editable || !!excl}
                    onClick={() => poner(s.id, marca === false ? null : false)}
                    className={`rounded-md border px-2 py-0.5 text-xs disabled:opacity-40 ${marca === false ? 'border-rose-300 bg-rose-50 text-rose-700' : 'border-slate-300 text-slate-600 hover:bg-slate-50'}`}
                  >
                    Did not participate
                  </button>
                </span>
              </li>
            )
          })}
        </ul>
      )}

      <div className="rounded-xl bg-brand-50 px-4 py-3 text-sm text-brand-900" role="status">
        <p>
          Classes recorded: <strong>{registradas} of {total}</strong> · met: <strong>{cumplidas}</strong>
          {sesiones.length > total && <> · not applicable: {sesiones.length - total} (excused or before they joined)</>}
        </p>
        {completa ? (
          <p>
            {cumplidas}/{total} × 20 = <strong>{fmtNota(Math.round((cumplidas / total) * 2000) / 100)}/20</strong> · equivalente <strong>{fmtNota(nota)}/100</strong>
            {evaluacion.tipo === 'formative' ? (
              <> · combined with the unit average in the Formative grade</>
            ) : (
              <>
                {' '}· contribution to the module <strong>{fmtNota(aporte)} of {fmtNota(evaluacion.peso)} points</strong>
              </>
            )}
          </p>
        ) : (
          <p className="text-brand-800">
            There is no grade yet: classes are still to be recorded. What is pending does not count as “did not meet”. If the final result were {cumplidas}/{total}, it would be {fmtNota(nota)}/100.
          </p>
        )}
      </div>

      {publicada && (
        <p className="text-xs text-slate-500">
          Status: <Badge color="brand">{alumno.corregida ? 'Corrected' : 'Published'}</Badge> grade {fmtNota(alumno.puntaje)}/100. To change a class use “Correct” and enter the reason.
        </p>
      )}

      {corrigiendo && (
        <input className={inputClass} aria-label="Reason for the correction" placeholder="Reason for the correction (required)" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
      )}
      {mensaje && <p className="rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-800">{mensaje}</p>}
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>
          Close
        </Button>
        {publicada && !corrigiendo && (
          <Button variant="secondary" onClick={() => setCorrigiendo(true)}>
            Correct
          </Button>
        )}
        {publicada && corrigiendo && (
          <Button disabled={ocupado || cambios.length === 0} onClick={corregir}>
            Save correction
          </Button>
        )}
        {!publicada && (
          <>
            <Button variant="secondary" disabled={ocupado || sesiones.length === 0} onClick={() => ejecutar(async () => { await guardar() }, 'Participation saved. The student cannot see it yet.')}>
              Save
            </Button>
            <Button
              disabled={ocupado || !completa}
              onClick={() =>
                ejecutar(async () => {
                  await guardar()
                  await servicio.publicarParticipacion(evaluacion.id, [alumnoId])
                  return 'Participation published: the student can now see it.'
                }, '')
              }
            >
              Publish participation
            </Button>
          </>
        )}
      </div>
    </div>
  )
}

// Contenido (sin ventana): una casilla por cada clase del módulo, que se completa de a poco.
export function ContenidoParticipacion({ evaluacionId, alumnoId, servicio = servicioReal, onClose, onCambio }) {
  const cargar = useCallback(() => servicio.participacionDetalle(evaluacionId), [servicio, evaluacionId])
  const detalle = useCarga(cargar, null)
  const [version, setVersion] = useState(0)
  const [mensaje, setMensaje] = useState('')
  const refrescar = async () => {
    await detalle.recargar()
    setVersion((v) => v + 1)
    await onCambio?.()
  }
  if (detalle.error) return <p className="text-sm text-red-600">Could not open the participation: {detalle.error}</p>
  if (detalle.cargando || !detalle.datos) return <p className="py-4 text-sm text-slate-400">Loading…</p>
  if (!detalle.datos.alumnos.some((a) => a.alumno_id === alumnoId)) return <p className="text-sm text-slate-500">This student is no longer in the classroom.</p>
  return <Formulario key={version} detalle={detalle.datos} alumnoId={alumnoId} servicio={servicio} onCambio={refrescar} onClose={onClose} mensaje={mensaje} setMensaje={setMensaje} />
}

// Participación por clase sola (componente «participacion» de versiones anteriores del Grade Chart).
export default function ParticipacionModal({ evaluacionId, alumnoId, titulo, servicio = servicioReal, onClose, onCambio }) {
  return (
    <Modal title={titulo} onClose={onClose} wide>
      <ContenidoParticipacion evaluacionId={evaluacionId} alumnoId={alumnoId} servicio={servicio} onClose={onClose} onCambio={onCambio} />
    </Modal>
  )
}
