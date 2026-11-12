import { useCallback, useMemo } from 'react'
import CursoEstudiante from '../../pages/portal/CursoEstudiante'
import Icon from '../ui/Icon'
import useCarga from '../../hooks/useCarga'
import { soloVisibleParaEstudiante } from '../../lib/recursos'
import * as asistenciaReal from '../../services/asistencia'
import * as portalReal from '../../services/portal'

// Vista previa para la administración: el curso tal como lo ve un estudiante (resumen, contenido y calendario), sin lo oculto.
// Es solo lectura: no marca lecciones como vistas ni guarda nada. Ejercicios, calificaciones y asistencia son personales de cada estudiante;
// para revisarlos están las pestañas de administración de este mismo salón.
export default function VistaEstudianteSalon({ salon, servicio = portalReal, asistencia = asistenciaReal }) {
  const cargarSesiones = useCallback(() => servicio.sesionesDelSalon(salon.id), [servicio, salon.id])
  const sesiones = useCarga(cargarSesiones, [])

  // Lo que el estudiante recibiría de sus funciones del portal, armado con los datos del salón.
  const curso = useMemo(
    () => ({
      salon_id: salon.id,
      codigo: salon.codigo,
      nombre: salon.nombre,
      nivel: salon.nivel,
      docente: salon.docente,
      estado: salon.estado,
      fecha_inicio: salon.fechaInicio,
      horarios: salon.horarios.map((h) => ({ dia: h.dia, hora_inicio: `${h.horaInicio}:00`, hora_fin: `${h.horaFin}:00` })),
    }),
    [salon],
  )
  const clases = useMemo(
    () =>
      sesiones.datos
        .filter((s) => s.estado === 'programada')
        .map((s) => ({ rol: 'estudiante', origen: 'grupal', id: s.id, salon_id: salon.id, titulo: salon.nombre, fecha: s.fecha, hora_inicio: s.hora_inicio, hora_fin: s.hora_fin, docente: salon.docente })),
    [sesiones.datos, salon],
  )
  const servicioVista = useMemo(
    () => ({
      ...servicio,
      contenidoDelCurso: (id) => servicio.contenidoDelCurso(id).then(soloVisibleParaEstudiante),
      leccionesVistas: async () => [],
      marcarLeccion: async () => {},
    }),
    [servicio],
  )

  return (
    <>
      <p className="mb-4 flex items-start gap-2 rounded-xl bg-brand-50 px-4 py-3 text-sm text-brand-800">
        <Icon name="eye" className="mt-0.5 h-4 w-4 shrink-0" />
        <span>
          Student view (read-only): this is how students see this course. They do not see hidden items. Exercises, grades and attendance are personal to each
          student: review them in this classroom's administration tabs.
        </span>
      </p>
      <CursoEstudiante curso={curso} proximas={clases} vistaPrevia servicio={servicioVista} asistencia={asistencia} onVolver={() => {}} />
    </>
  )
}
