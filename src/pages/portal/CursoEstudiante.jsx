import { useCallback, useMemo, useState } from 'react'
import AsistenciaEstudiante from '../../components/portal/AsistenciaEstudiante'
import CalendarioClases from '../../components/portal/CalendarioClases'
import ContenidoCurso from '../../components/portal/ContenidoCurso'
import ResumenCurso from '../../components/portal/ResumenCurso'
import Badge from '../../components/ui/Badge'
import Icon from '../../components/ui/Icon'
import Tabs from '../../components/ui/Tabs'
import EjerciciosEstudiante from '../../components/ejercicios/EjerciciosEstudiante'
import MisCalificaciones from '../../components/evaluaciones/MisCalificaciones'
import useCarga from '../../hooks/useCarga'
import { contarAsistencia } from '../../lib/asistencia'
import { hoyISO } from '../../lib/calendario'
import { agruparContenido, totalLecciones } from '../../lib/recursos'
import * as asistenciaReal from '../../services/asistencia'
import * as evaluacionesReal from '../../services/evaluaciones'
import * as servicioReal from '../../services/portal'

// Curso del estudiante en pestañas: Resumen, Contenido (estilo plataforma de aprendizaje), Calendario, Calificaciones y Asistencia.
// El encabezado es mínimo a propósito: los datos del curso (docente, horario, avance) viven en «Resumen».
export default function CursoEstudiante({ curso, proximas = [], onVolver, vistaPrevia = false, servicio = servicioReal, asistencia = asistenciaReal, evaluaciones = evaluacionesReal }) {
  const cargarContenido = useCallback(() => servicio.contenidoDelCurso(curso.salon_id).then(agruparContenido), [servicio, curso.salon_id])
  const cargarProgreso = useCallback(() => asistencia.progresoDelSalon(curso.salon_id), [asistencia, curso.salon_id])
  const cargarHistorial = useCallback(() => asistencia.miAsistencia(curso.salon_id), [asistencia, curso.salon_id])
  const cargarVistas = useCallback(() => servicio.leccionesVistas(curso.salon_id), [servicio, curso.salon_id])
  const contenido = useCarga(cargarContenido, [])
  const progreso = useCarga(cargarProgreso, null)
  const historial = useCarga(cargarHistorial, [])
  const vistasBase = useCarga(cargarVistas, [])

  const [tab, setTab] = useState('resumen')
  const [elegida, setElegida] = useState(null)
  const [cambios, setCambios] = useState({}) // id de lección -> true/false mientras se guarda o ya se guardó en esta sesión
  const [errorMarca, setErrorMarca] = useState('')

  const secciones = contenido.datos
  const mias = useMemo(() => proximas.filter((c) => c.salon_id === curso.salon_id), [proximas, curso.salon_id])
  const hoy = hoyISO()
  const proxima = [...mias].filter((c) => c.fecha >= hoy).sort((a, b) => a.fecha.localeCompare(b.fecha) || a.hora_inicio.localeCompare(b.hora_inicio))[0]
  const conteo = contarAsistencia(historial.datos)
  const nLecciones = totalLecciones(secciones)

  // Lecciones vistas = lo guardado + los cambios de esta sesión (se muestran al instante, sin esperar al servidor).
  const vistas = useMemo(() => {
    const s = new Set(vistasBase.datos)
    for (const [id, v] of Object.entries(cambios)) {
      if (v) s.add(id)
      else s.delete(id)
    }
    return s
  }, [vistasBase.datos, cambios])

  const marcar = async (id, vista) => {
    setErrorMarca('')
    setCambios((c) => ({ ...c, [id]: vista }))
    try {
      await servicio.marcarLeccion(curso.salon_id, id, vista)
    } catch (e) {
      setCambios((c) => ({ ...c, [id]: !vista }))
      setErrorMarca(`Could not save your progress: ${e.message}`)
    }
  }

  const irA = (id, leccionId) => {
    if (leccionId) setElegida(leccionId)
    setTab(id)
    window.scrollTo?.({ top: 0, behavior: 'smooth' })
  }

  // En la vista previa de la administración solo van las pestañas iguales para todos los estudiantes: ejercicios, notas y asistencia son personales.
  const tabs = [
    { id: 'resumen', label: 'Overview' },
    { id: 'contenido', label: 'Content', conteo: nLecciones || null },
    { id: 'calendario', label: 'Calendar', conteo: mias.length || null },
    ...(vistaPrevia
      ? []
      : [
          { id: 'ejercicios', label: 'Exercises' },
          { id: 'notas', label: 'Grades' },
          { id: 'asistencia', label: 'Attendance' },
        ]),
  ]

  return (
    <>
      {!vistaPrevia && <button onClick={onVolver} className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-brand-700">
        <Icon name="back" className="h-4 w-4" /> My courses
      </button>}

      <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1">
        <h1 className="text-2xl font-bold tracking-tight text-brand-800 sm:text-3xl">{curso.nombre}</h1>
        {curso.nivel && <span className="rounded-full bg-brand-100 px-3 py-1 text-xs font-medium text-brand-700">{curso.nivel}</span>}
        {curso.estado === 'finalizado' && <Badge color="slate">Finalizado</Badge>}
      </div>

      {contenido.error && (
        <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          Could not load the course content: {contenido.error}{' '}
          <button className="font-medium underline" onClick={contenido.recargar}>
            Retry
          </button>
        </p>
      )}
      {progreso.error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">Could not load progress: {progreso.error}</p>}

      <Tabs tabs={tabs} activa={tab} onCambiar={setTab} etiqueta="Course sections" />

      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="pt-6">
        {tab === 'resumen' && (
          <ResumenCurso curso={curso} progreso={progreso.datos} conteoAsistencia={conteo} proxima={proxima} secciones={secciones} vistas={vistas} onIrA={irA} />
        )}
        {tab === 'contenido' && (
          <ContenidoCurso secciones={secciones} cargando={contenido.cargando} elegida={elegida} onElegir={setElegida} vistas={vistas} onMarcar={marcar} errorMarca={errorMarca} />
        )}
        {tab === 'calendario' && <CalendarioClases clases={mias} titulo="Calendar of this course" />}
        {tab === 'ejercicios' && <EjerciciosEstudiante salonId={curso.salon_id} />}
        {tab === 'notas' && <MisCalificaciones salonId={curso.salon_id} servicio={evaluaciones} />}
        {tab === 'asistencia' &&
          (historial.error ? (
            <p className="text-sm text-red-600">Could not load your attendance: {historial.error}</p>
          ) : (
            <AsistenciaEstudiante historial={historial.datos} conteo={conteo} onVerMaterial={(id) => irA('contenido', id)} />
          ))}
      </div>

      {curso.estado === 'finalizado' && (
        <p className="mt-4">
          <Badge color="slate">This course has finished; you can keep consulting its content.</Badge>
        </p>
      )}
    </>
  )
}
