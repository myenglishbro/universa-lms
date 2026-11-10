import { useCallback, useMemo, useRef, useState } from 'react'
import Button from '../ui/Button'
import { inputClass } from '../ui/Field'
import Modal from '../ui/Modal'
import useCarga from '../../hooks/useCarga'
import { ESTADOS_ASISTENCIA } from '../../lib/asistencia'
import { agruparContenido } from '../../lib/recursos'
import { formatFecha } from '../../lib/salones'
import * as asistenciaReal from '../../services/asistencia'
import * as portalReal from '../../services/portal'

const colorActivo = { presente: 'bg-brand-600 text-white', ausente: 'bg-rose-600 text-white', tardanza: 'bg-peach-500 text-white', justificado: 'bg-slate-600 text-white' }

function Formulario({ detalle, lecciones, onGuardar, onClose }) {
  const { sesion } = detalle
  const [estados, setEstados] = useState(() => Object.fromEntries(detalle.alumnos.map((a) => [a.alumno_id, a.estado ?? 'presente'])))
  const [tema, setTema] = useState(detalle.tema ?? '')
  const [obs, setObs] = useState(detalle.observaciones ?? '')
  const [materiales, setMateriales] = useState(() => new Set(detalle.materiales))
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)
  const enCurso = useRef(false)
  const editando = sesion.registrada

  const marcarTodos = () => setEstados(Object.fromEntries(detalle.alumnos.map((a) => [a.alumno_id, 'presente'])))
  const alternar = (id) =>
    setMateriales((prev) => {
      const nuevo = new Set(prev)
      if (nuevo.has(id)) nuevo.delete(id)
      else nuevo.add(id)
      return nuevo
    })

  const enviar = async (e) => {
    e.preventDefault()
    if (enCurso.current) return
    enCurso.current = true
    setGuardando(true)
    setError('')
    try {
      await onGuardar({
        alumnos: detalle.alumnos.map((a) => ({ alumnoId: a.alumno_id, estado: estados[a.alumno_id] })),
        tema: tema.trim(),
        observaciones: obs.trim(),
        materiales: [...materiales],
      })
    } catch (err) {
      setError(err.message)
      enCurso.current = false
      setGuardando(false)
    }
  }

  return (
    <form onSubmit={enviar} className="space-y-5">
      {sesion.futura && (
        <p className="rounded-lg bg-peach-50 px-3 py-2 text-sm text-peach-700">
          Esta clase es del {formatFecha(sesion.fecha)}: la estás registrando por adelantado. Seguirá como programada hasta que llegue su fecha.
        </p>
      )}
      <section>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-slate-900">Asistencia</h3>
          {detalle.alumnos.length > 0 && (
            <Button type="button" variant="ghost" className="px-2 py-1 text-xs" onClick={marcarTodos}>
              Marcar todos presentes
            </Button>
          )}
        </div>
        {detalle.alumnos.length === 0 ? (
          <p className="rounded-lg bg-slate-50 px-3 py-3 text-sm text-slate-500">No hay estudiantes matriculados en este salón para la fecha de la clase.</p>
        ) : (
          <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
            {detalle.alumnos.map((a) => (
              <li key={a.alumno_id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                <span className="text-sm font-medium text-slate-900">{a.nombre}</span>
                <div className="flex gap-1" role="group" aria-label={`Asistencia de ${a.nombre}`}>
                  {ESTADOS_ASISTENCIA.map((o) => {
                    const activo = estados[a.alumno_id] === o.value
                    return (
                      <button
                        key={o.value}
                        type="button"
                        aria-pressed={activo}
                        aria-label={`${o.label}: ${a.nombre}`}
                        title={o.label}
                        onClick={() => setEstados((prev) => ({ ...prev, [a.alumno_id]: o.value }))}
                        className={`min-w-9 rounded-md border px-2 py-1.5 text-xs font-medium ${activo ? `${colorActivo[o.value]} border-transparent` : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'}`}
                      >
                        <span className="sm:hidden">{o.corto}</span>
                        <span className="hidden sm:inline">{o.label}</span>
                      </button>
                    )
                  })}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-slate-900">Desarrollo de la clase</h3>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700">Tema desarrollado</span>
          <input className={inputClass} value={tema} maxLength={300} onChange={(e) => setTema(e.target.value)} placeholder="Ej.: Present simple, rutinas diarias" />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700">Observaciones (solo las ven docentes y administración)</span>
          <textarea className={inputClass} rows={2} value={obs} maxLength={3000} onChange={(e) => setObs(e.target.value)} />
        </label>
      </section>

      <section>
        <h3 className="mb-1 text-sm font-semibold text-slate-900">Grabaciones y materiales de esta clase</h3>
        {lecciones.length === 0 ? (
          <p className="text-xs text-slate-500">Aún no hay recursos publicados en el curso. Publícalos en «Recursos del curso» y vincúlalos aquí.</p>
        ) : (
          <ul className="max-h-40 space-y-1 overflow-y-auto rounded-lg border border-slate-200 p-2">
            {lecciones.map((l) => (
              <li key={l.id}>
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input type="checkbox" checked={materiales.has(l.id)} onChange={() => alternar(l.id)} />
                  <span className="truncate">{l.titulo}</span>
                  {l.oculta && <span className="text-xs text-slate-400">(oculta)</span>}
                </label>
              </li>
            ))}
          </ul>
        )}
      </section>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onClose}>
          Cancelar
        </Button>
        <Button type="submit" disabled={guardando}>
          {guardando ? 'Guardando…' : editando ? 'Guardar cambios' : 'Guardar registro'}
        </Button>
      </div>
    </form>
  )
}

// Registro rápido de una clase: asistencia (todos presentes por defecto), tema y materiales ya publicados.
export default function RegistroClase({ sesionId, salonId, titulo, onClose, onGuardado, servicio = asistenciaReal, portal = portalReal }) {
  const cargar = useCallback(() => servicio.sesionRegistro(sesionId), [servicio, sesionId])
  const cargarMateriales = useCallback(() => portal.contenidoDelCurso(salonId).then(agruparContenido), [portal, salonId])
  const detalle = useCarga(cargar, null)
  const contenido = useCarga(cargarMateriales, [])
  const lecciones = useMemo(() => contenido.datos.flatMap((s) => s.lecciones), [contenido.datos])
  const listo = detalle.datos && !contenido.cargando

  return (
    <Modal title={titulo} onClose={onClose} wide>
      {detalle.error ? (
        <p className="text-sm text-red-600">No se pudo abrir la clase: {detalle.error}</p>
      ) : !listo ? (
        <p className="py-6 text-center text-sm text-slate-500">Cargando…</p>
      ) : (
        <>
          {contenido.error && <p className="mb-3 text-xs text-red-600">No se pudieron cargar los materiales: {contenido.error}</p>}
          <Formulario
            detalle={detalle.datos}
            lecciones={lecciones}
            onClose={onClose}
            onGuardar={async (v) => {
              await servicio.registrarClase(sesionId, v)
              await onGuardado?.()
              onClose()
            }}
          />
        </>
      )}
    </Modal>
  )
}
