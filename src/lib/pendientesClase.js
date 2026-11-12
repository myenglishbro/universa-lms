// Pendientes de clase por salón: cada clase que ya ocurrió debe tener su asistencia registrada y su grabación subida.
// Se usa para el aviso al docente (texto listo para copiar) y para los avisos «Por atender».

// Lista de cosas que le faltan actualizar al docente: [{ clave, texto }]. Vacía si el salón está al día.
export function pendientesDeSalon(salon) {
  const lista = []
  const sinAsistencia = salon.progreso?.porRegistrar ?? 0
  const sinGrabacion = salon.pendientes?.sinGrabacion ?? 0
  if (sinAsistencia > 0) lista.push({ clave: 'asistencia', texto: `record attendance for ${sinAsistencia} ${sinAsistencia === 1 ? 'class' : 'classes'}` })
  if (sinGrabacion > 0) lista.push({ clave: 'grabacion', texto: `upload the recording for ${sinGrabacion} ${sinGrabacion === 1 ? 'class' : 'classes'}` })
  return lista
}

const unir = (items) => (items.length > 1 ? `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}` : items[0] ?? '')

// Mensaje corto para enviar al docente por el canal que use la institución.
export function mensajeAviso(salon) {
  const items = pendientesDeSalon(salon).map((p) => p.texto)
  if (!items.length) return ''
  const saludo = salon.docente ? `Hello ${salon.docente}` : 'Hello'
  return `${saludo}, for classroom ${salon.nombre} you still need to ${unir(items)}. Please update it in the teacher portal. Thank you!`
}
