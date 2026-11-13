// Reglas de contraseña. La contraseña inicial la valida también la Edge Function (mismas reglas); Supabase Auth guarda solo su hash.
export const CLAVE_MIN = 8

// Devuelve el mensaje de error o '' si la contraseña es aceptable.
export function validarClaveNueva(clave, correo = '') {
  if (!clave || clave.length < CLAVE_MIN) return `Must be at least ${CLAVE_MIN} characters long`
  if (clave.length > 72) return 'It is too long (maximum 72 characters)'
  if (correo && clave.toLowerCase() === correo.toLowerCase()) return 'It cannot be the same as the email'
  if (!/[A-Za-z]/.test(clave) || !/[0-9]/.test(clave)) return 'It must combine letters and numbers'
  return ''
}

const ALFABETO = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789' // sin caracteres que se confunden (0/O, 1/l/I)

// Contraseña inicial aleatoria y legible, generada en el navegador (no se guarda ni se envía a ningún lado hasta crear el acceso).
export function generarClave(largo = 12, cripto = globalThis.crypto) {
  for (;;) {
    const bytes = cripto.getRandomValues(new Uint32Array(largo))
    const clave = Array.from(bytes, (b) => ALFABETO[b % ALFABETO.length]).join('')
    if (!validarClaveNueva(clave)) return clave
  }
}
