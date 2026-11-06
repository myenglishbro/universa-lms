import { supabase } from '../lib/supabase'
export { cuentasDePersona, desvincularCuenta, vincularCuenta } from './portal'

// La creación de cuentas y los enlaces de restablecimiento se hacen en el SERVIDOR (Edge Function «gestionar-acceso»), que es
// quien usa la API administrativa de Supabase Auth. React solo envía la petición con la sesión del administrador.
async function traducir(error) {
  if (error.context?.status === 404) {
    return new Error('La función «gestionar-acceso» no está desplegada en Supabase. Despliégala con: supabase functions deploy gestionar-acceso')
  }
  if (typeof error.context?.json === 'function') {
    try {
      const j = await error.context.json()
      if (j?.error) return new Error(j.error)
    } catch {
      /* respuesta sin cuerpo legible */
    }
  }
  if (error.name === 'FunctionsFetchError' || error.name === 'FunctionsRelayError') {
    return new Error('No se pudo contactar la función «gestionar-acceso». Verifica que esté desplegada.')
  }
  return new Error(error.message)
}

async function invocar(body) {
  const { data, error } = await supabase.functions.invoke('gestionar-acceso', { body })
  if (error) throw await traducir(error)
  return data
}

// Crea la cuenta en Auth (correo confirmado) y la vincula con el estudiante o docente. Devuelve { estado: 'creada' | 'existe' }.
export const crearAcceso = ({ correo, password, rol, personaId }) => invocar({ accion: 'crear', correo, password, rol, persona: personaId })

// Devuelve { enlace }: un enlace de un solo uso para que la persona elija una contraseña nueva. No revela la actual.
export const restablecerAcceso = (rol, personaId) => invocar({ accion: 'restablecer', rol, persona: personaId, redirectTo: window.location.origin })

// Administración fija una contraseña nueva (solo administración puede hacerlo). Se indica la persona (rol + id) o la cuenta (userId).
export const cambiarClaveAcceso = ({ rol, personaId, userId, password }) => invocar({ accion: "cambiar_clave", rol, persona: personaId, user_id: userId, password })
