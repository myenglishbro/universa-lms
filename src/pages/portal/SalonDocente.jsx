import { useCallback, useRef, useState } from 'react'
import LeccionForm from '../../components/portal/LeccionForm'
import SeccionForm from '../../components/portal/SeccionForm'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import Icon from '../../components/ui/Icon'
import EvaluacionesPanel from '../../components/evaluaciones/EvaluacionesPanel'
import EjerciciosSalon from '../../components/ejercicios/EjerciciosSalon'
import SeguimientoSalon from '../../components/seguimiento/SeguimientoSalon'
import useCarga from '../../hooks/useCarga'
import { agruparContenido, horariosTexto, moverId, portadaDe, tipoLabel } from '../../lib/recursos'
import { formatFecha } from '../../lib/salones'
import * as asistenciaReal from '../../services/asistencia'
import * as evaluacionesReal from '../../services/evaluaciones'
import * as servicioReal from '../../services/portal'

function Accion({ icono, etiqueta, onClick, disabled }) {
  return (
    <button
      type="button"
      title={etiqueta}
      aria-label={etiqueta}
      disabled={disabled}
      onClick={onClick}
      className="rounded-md p-1.5 text-slate-400 hover:bg-brand-50 hover:text-brand-700 disabled:opacity-30 disabled:hover:bg-transparent"
    >
      <Icon name={icono} className="h-4 w-4" />
    </button>
  )
}

// Salón del docente: gestión de secciones y lecciones (crear, editar, reordenar, ocultar) y lista de estudiantes matriculados.
export default function SalonDocente({ salon, onVolver, servicio = servicioReal, asistencia = asistenciaReal, evaluaciones = evaluacionesReal }) {
  const [pestana, setPestana] = useState('clases')
  const cargarContenido = useCallback(() => servicio.contenidoDelCurso(salon.salon_id).then(agruparContenido), [servicio, salon.salon_id])
  const cargarEstudiantes = useCallback(() => servicio.estudiantesDelSalon(salon.salon_id), [servicio, salon.salon_id])
  const cargarSesiones = useCallback(() => servicio.sesionesDelSalon(salon.salon_id), [servicio, salon.salon_id])
  const contenido = useCarga(cargarContenido, [])
  const estudiantes = useCarga(cargarEstudiantes, [])
  const sesiones = useCarga(cargarSesiones, [])

  const [modal, setModal] = useState(null) // { tipo: 'seccion' | 'leccion', seccion?, leccion? }
  const [error, setError] = useState('')
  const enCurso = useRef(false)

  // Acción directa (ocultar, mover): evita repeticiones mientras se procesa y vuelve a leer el contenido.
  const ejecutar = async (fn) => {
    if (enCurso.current) return
    enCurso.current = true
    setError('')
    try {
      await fn()
      await contenido.recargar()
    } catch (e) {
      setError(e.message)
    } finally {
      enCurso.current = false
    }
  }
  const enModal = async (fn) => {
    await fn()
    await contenido.recargar()
    setModal(null)
  }

  const secciones = contenido.datos
  const idsSecciones = secciones.map((s) => s.id)
  const mover = (lista, id, delta, guardar) => {
    const nuevo = moverId(lista, id, delta)
    if (nuevo) ejecutar(() => guardar(nuevo))
  }

  return (
    <>
      <button onClick={onVolver} className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-brand-700">
        <Icon name="back" className="h-4 w-4" /> Mis salones
      </button>
      <div className={`mb-6 rounded-2xl bg-gradient-to-br p-6 text-white shadow-sm ${portadaDe(salon.nombre)}`}>
        <p className="text-sm text-white/80">{salon.nivel || 'Sin nivel asignado'}</p>
        <h1 className="mt-1 text-2xl font-semibold">{salon.nombre}</h1>
        <p className="mt-2 text-sm text-white/90">
          {horariosTexto(salon.horarios)} · {salon.estudiantes} de {salon.capacidad} estudiantes
        </p>
      </div>

      <div className="mb-4 flex gap-1 border-b border-slate-200" role="tablist">
        {[
          ['clases', 'Clases y asistencia'],
          ['evaluaciones', 'Evaluaciones'],
          ['ejercicios', 'Ejercicios'],
          ['recursos', 'Recursos del curso'],
          ['estudiantes', `Estudiantes (${salon.estudiantes})`],
        ].map(([id, texto]) => (
          <button
            key={id}
            role="tab"
            aria-selected={pestana === id}
            onClick={() => setPestana(id)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${pestana === id ? 'border-brand-600 text-brand-700' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
          >
            {texto}
          </button>
        ))}
      </div>

      {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {pestana === 'clases' ? (
        <SeguimientoSalon salonId={salon.salon_id} servicio={asistencia} portal={servicio} />
      ) : pestana === 'ejercicios' ? (
        <EjerciciosSalon salonId={salon.salon_id} />
      ) : pestana === 'evaluaciones' ? (
        <EvaluacionesPanel salonId={salon.salon_id} servicio={evaluaciones} />
      ) : pestana === 'estudiantes' ? (
        <Card>
          {estudiantes.error ? (
            <p className="px-4 py-6 text-sm text-red-600">No se pudo cargar la lista: {estudiantes.error}</p>
          ) : estudiantes.cargando ? (
            <p className="px-4 py-6 text-center text-sm text-slate-500">Cargando…</p>
          ) : estudiantes.datos.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-slate-400">Este salón aún no tiene estudiantes matriculados.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {estudiantes.datos.map((e) => (
                <li key={e.alumno_id} className="flex items-center justify-between px-4 py-3 text-sm">
                  <span className="font-medium text-slate-900">{e.nombre}</span>
                  <span className="text-xs text-slate-500">Desde {formatFecha(e.desde)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-slate-500">Organiza el curso en secciones y lecciones. Lo oculto no se borra: solo deja de verse para los estudiantes.</p>
            <Button onClick={() => setModal({ tipo: 'seccion' })}>
              <Icon name="plus" className="h-4 w-4" /> Nueva sección
            </Button>
          </div>
          {contenido.error && <p className="mb-4 text-sm text-red-600">No se pudo cargar el contenido: {contenido.error}</p>}
          {contenido.cargando ? (
            <p className="py-10 text-center text-sm text-slate-500">Cargando…</p>
          ) : secciones.length === 0 ? (
            !contenido.error && (
              <p className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-10 text-center text-sm text-slate-500">
                Empieza creando una sección (por ejemplo «Semana 1») y publica dentro de ella tus grabaciones y materiales.
              </p>
            )
          ) : (
            <div className="space-y-4">
              {secciones.map((s, i) => (
                <Card key={s.id} className={s.oculta ? 'opacity-70' : ''}>
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-4 py-2.5">
                    <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                      {s.titulo} {s.oculta && <Badge color="slate">Oculta</Badge>}
                    </h2>
                    <div className="flex items-center">
                      <Accion icono="up" etiqueta={`Subir sección ${s.titulo}`} disabled={i === 0} onClick={() => mover(idsSecciones, s.id, -1, (ids) => servicio.reordenarSecciones(salon.salon_id, ids))} />
                      <Accion icono="down" etiqueta={`Bajar sección ${s.titulo}`} disabled={i === secciones.length - 1} onClick={() => mover(idsSecciones, s.id, 1, (ids) => servicio.reordenarSecciones(salon.salon_id, ids))} />
                      <Accion icono="pencil" etiqueta={`Editar sección ${s.titulo}`} onClick={() => setModal({ tipo: 'seccion', seccion: s })} />
                      <Accion icono={s.oculta ? 'eye' : 'eyeoff'} etiqueta={`${s.oculta ? 'Mostrar' : 'Ocultar'} sección ${s.titulo}`} onClick={() => ejecutar(() => servicio.ocultarSeccion(s.id, !s.oculta))} />
                    </div>
                  </div>
                  {s.lecciones.length === 0 ? (
                    <p className="px-4 py-3 text-sm text-slate-400">Sin lecciones.</p>
                  ) : (
                    <ul className="divide-y divide-slate-100">
                      {s.lecciones.map((l, j) => {
                        const ids = s.lecciones.map((x) => x.id)
                        return (
                          <li key={l.id} className={`flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 ${l.oculta ? 'opacity-60' : ''}`}>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-slate-900">
                                {l.titulo} {l.oculta && <Badge color="slate">Oculta</Badge>}
                              </p>
                              <p className="text-xs text-slate-500">
                                {tipoLabel(l.tipo)}
                                {l.sesionFecha && ` · Clase del ${formatFecha(l.sesionFecha)}`}
                              </p>
                            </div>
                            <div className="flex items-center">
                              <Accion icono="up" etiqueta={`Subir lección ${l.titulo}`} disabled={j === 0} onClick={() => mover(ids, l.id, -1, (n) => servicio.reordenarLecciones(s.id, n))} />
                              <Accion icono="down" etiqueta={`Bajar lección ${l.titulo}`} disabled={j === s.lecciones.length - 1} onClick={() => mover(ids, l.id, 1, (n) => servicio.reordenarLecciones(s.id, n))} />
                              <Accion icono="pencil" etiqueta={`Editar lección ${l.titulo}`} onClick={() => setModal({ tipo: 'leccion', seccion: s, leccion: l })} />
                              <Accion icono={l.oculta ? 'eye' : 'eyeoff'} etiqueta={`${l.oculta ? 'Mostrar' : 'Ocultar'} lección ${l.titulo}`} onClick={() => ejecutar(() => servicio.ocultarLeccion(l.id, !l.oculta))} />
                            </div>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                  <div className="border-t border-slate-100 px-4 py-2">
                    <Button variant="ghost" className="px-2 py-1" onClick={() => setModal({ tipo: 'leccion', seccion: s })}>
                      <Icon name="plus" className="h-4 w-4" /> Agregar lección
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      {modal?.tipo === 'seccion' && (
        <SeccionForm
          seccion={modal.seccion}
          onClose={() => setModal(null)}
          onSave={(titulo) => enModal(() => servicio.guardarSeccion(modal.seccion?.id ?? null, salon.salon_id, titulo))}
        />
      )}
      {modal?.tipo === 'leccion' && (
        <LeccionForm
          leccion={modal.leccion}
          sesiones={sesiones.datos}
          onClose={() => setModal(null)}
          onSave={(v) => enModal(() => servicio.guardarLeccion(modal.leccion?.id ?? null, modal.seccion.id, v))}
        />
      )}
    </>
  )
}
