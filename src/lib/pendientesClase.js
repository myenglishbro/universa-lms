// Pendientes de clase por salón: cada clase que ya ocurrió debe tener su asistencia registrada y su grabación subida.
// Se usa para el aviso al docente (texto listo para copiar) y para los avisos «Por atender».

// Lista de cosas que le faltan actualizar al docente: [{ clave, texto }]. Vacía si el salón está al día.
export function pendientesDeSalon(salon) {
  const lista = []
  const sinAsistencia = salon.progreso?.porRegistrar ?? 0
  const sinGrabacion = salon.pendientes?.sinGrabacion ?? 0
  if (sinAsistencia > 0) lista.push({ clave: 'asistencia', texto: `registrar la asistencia de ${sinAsistencia} ${sinAsistencia === 1 ? 'clase' : 'clases'}` })
  if (sinGrabacion > 0) lista.push({ clave: 'grabacion', texto: `subir la grabación de ${sinGrabacion} ${sinGrabacion === 1 ? 'clase' : 'clases'}` })
  return lista
}

const unir = (items) => (items.length > 1 ? `${items.slice(0, -1).join(', ')} y ${items[items.length - 1]}` : items[0] ?? '')

// Mensaje corto para enviar al docente por el canal que use la institución.
export function mensajeAviso(salon) {
  const items = pendientesDeSalon(salon).map((p) => p.texto)
  if (!items.length) return ''
  const saludo = salon.docente ? `Hola ${salon.docente}` : 'Hola'
  return `${saludo}, del salón ${salon.nombre} falta ${unir(items)}. Por favor actualízalo en el portal docente. ¡Gracias!`
}
