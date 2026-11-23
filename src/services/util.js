// Convierte errores de Supabase en mensajes claros. `code` se conserva para que la UI reaccione.
// Los errores lanzados por las funciones SQL (raise exception) ya traen un mensaje legible.
export function fallo(error) {
  let mensaje = error.message
  if (error.code === '23505') {
    if (mensaje.includes('salones_codigo_unico')) mensaje = 'A classroom with this code already exists'
    else if (mensaje.includes('docentes')) mensaje = 'A teacher with that name already exists'
    else if (mensaje.includes('frecuencias_nombre_unico')) mensaje = 'A frequency with that name already exists in this format'
    else mensaje = 'A record with those details already exists'
  } else if (error.code === '42501') {
    mensaje = 'You do not have permission to perform this action'
  }
  return Object.assign(new Error(mensaje), { code: error.code })
}

export function datos({ data, error }) {
  if (error) throw fallo(error)
  return data
}

// Supabase corta cada consulta en 1000 filas SIN avisar: con más registros las listas quedaban incompletas (y los conteos, mal).
// `todas` lee por páginas de 1000 y se detiene en la primera página incompleta, así que con menos de 1000 filas sigue siendo UNA sola
// petición. `consulta` debe ser una función que arme la consulta (con un orden estable que incluya `id`) y NO la ejecute.
const PAGINA = 1000
export async function todas(consulta) {
  const filas = []
  for (let desde = 0; ; desde += PAGINA) {
    const pagina = datos(await consulta().range(desde, desde + PAGINA - 1))
    filas.push(...pagina)
    if (pagina.length < PAGINA) return filas
  }
}
