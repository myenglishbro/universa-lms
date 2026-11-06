// Convierte errores de Supabase en mensajes claros. `code` se conserva para que la UI reaccione.
// Los errores lanzados por las funciones SQL (raise exception) ya traen un mensaje legible.
export function fallo(error) {
  let mensaje = error.message
  if (error.code === '23505') {
    if (mensaje.includes('salones_codigo_unico')) mensaje = 'Ya existe un salón con este código'
    else if (mensaje.includes('docentes')) mensaje = 'Ya existe un docente con ese nombre'
    else if (mensaje.includes('frecuencias_nombre_unico')) mensaje = 'Ya existe una frecuencia con ese nombre en este formato'
    else mensaje = 'Ya existe un registro con esos datos'
  } else if (error.code === '42501') {
    mensaje = 'No tienes permisos para realizar esta acción'
  }
  return Object.assign(new Error(mensaje), { code: error.code })
}

export function datos({ data, error }) {
  if (error) throw fallo(error)
  return data
}
