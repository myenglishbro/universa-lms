import { cuposSalon } from './matriculas'
import { diasParaFin } from './salones'

// Cosas que la administración debería atender en un salón. `ir` indica a qué pestaña lleva cada aviso.
export function alertasSalon(salon, estudiantes, puedeEditar) {
  const p = salon.progreso
  const lista = []
  const activo = salon.estado !== 'finalizado'
  const dias = diasParaFin(salon)
  if (activo && !salon.docente) lista.push({ tono: 'peach', texto: 'No tiene docente asignado', ir: 'resumen', ayuda: puedeEditar ? 'Asígnalo con «Editar».' : '' })
  if (activo && !salon.nivel) lista.push({ tono: 'peach', texto: 'No tiene nivel académico', ir: 'resumen', ayuda: puedeEditar ? 'Clasifícalo con «Editar».' : '' })
  if (salon.estado === 'en_curso' && dias !== null && dias < 0) lista.push({ tono: 'rose', texto: `La fecha de fin ya pasó (hace ${-dias} ${dias === -1 ? 'día' : 'días'})`, ir: 'calendario', ayuda: 'Revisa si sigue activo o hay que cerrarlo.' })
  if (activo && !(p && p.sesiones > 0)) lista.push({ tono: 'slate', texto: 'Aún no tiene calendario de clases', ir: 'calendario', ayuda: 'Genera las sesiones para poder dar seguimiento.' })
  if (p?.porRegistrar > 0) lista.push({ tono: 'peach', texto: `${p.porRegistrar} ${p.porRegistrar === 1 ? 'clase ya pasó' : 'clases ya pasaron'} sin registrar`, ir: puedeEditar ? 'asistencia' : 'calendario', ayuda: 'Márcalas como realizadas o canceladas.' })
  if (p?.sinProgramar > 0) lista.push({ tono: 'peach', texto: `Faltan ${p.sinProgramar} sesiones por programar`, ir: 'calendario', ayuda: 'Por eso la fecha de fin es solo una estimación.' })
  if (salon.estado === 'en_curso' && estudiantes && !estudiantes.cargando && cuposSalon(salon, estudiantes.matriculas).ocupados === 0)
    lista.push({ tono: 'slate', texto: 'No tiene estudiantes matriculados', ir: 'estudiantes', ayuda: '' })
  return lista
}
