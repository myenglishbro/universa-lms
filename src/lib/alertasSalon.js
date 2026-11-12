import { cuposSalon } from './matriculas'
import { diasParaFin } from './salones'

// Cosas que la administración debería atender en un salón. `ir` indica a qué pestaña lleva cada aviso.
export function alertasSalon(salon, estudiantes, puedeEditar) {
  const p = salon.progreso
  const lista = []
  const activo = salon.estado !== 'finalizado'
  const dias = diasParaFin(salon)
  if (activo && !salon.docente) lista.push({ tono: 'peach', texto: 'No teacher assigned', ir: 'resumen', ayuda: puedeEditar ? 'Assign one with “Edit”.' : '' })
  if (activo && !salon.nivel) lista.push({ tono: 'peach', texto: 'No academic level', ir: 'resumen', ayuda: puedeEditar ? 'Set it with “Edit”.' : '' })
  if (salon.estado === 'en_curso' && dias !== null && dias < 0) lista.push({ tono: 'rose', texto: `The end date has passed (${-dias} ${dias === -1 ? 'day' : 'days'} ago)`, ir: 'calendario', ayuda: 'Check whether it is still active or should be closed.' })
  if (salon.estado === 'en_curso' && p && p.total > 0 && p.realizadas >= p.total && !(p.porRegistrar > 0))
    lista.push({ tono: 'brand', texto: 'All sessions have been held', ir: 'resumen', ayuda: puedeEditar ? 'Change the status to “Finished” to free the teacher and close enrollments.' : '' })
  if (activo && !(p && p.sesiones > 0)) lista.push({ tono: 'slate', texto: 'No class calendar yet', ir: 'calendario', ayuda: 'Generate the sessions to be able to track progress.' })
  if (p?.porRegistrar > 0) lista.push({ tono: 'peach', texto: `${p.porRegistrar} ${p.porRegistrar === 1 ? 'class has passed' : 'classes have passed'} without being recorded`, ir: puedeEditar ? 'asistencia' : 'calendario', ayuda: 'Mark them as held or cancelled.' })
  const sinGrab = salon.pendientes?.sinGrabacion ?? 0
  if (sinGrab > 0) lista.push({ tono: 'peach', texto: `${sinGrab} ${sinGrab === 1 ? 'class' : 'classes'} without a recording`, ir: puedeEditar ? 'asistencia' : 'calendario', ayuda: 'Ask the teacher to upload the recording of each class.' })
  if (p?.sinProgramar > 0) lista.push({ tono: 'peach', texto: `${p.sinProgramar} sessions still to schedule`, ir: 'calendario', ayuda: 'That is why the end date is only an estimate.' })
  if (salon.estado === 'en_curso' && estudiantes && !estudiantes.cargando && cuposSalon(salon, estudiantes.matriculas).ocupados === 0)
    lista.push({ tono: 'slate', texto: 'No students enrolled', ir: 'estudiantes', ayuda: '' })
  return lista
}
