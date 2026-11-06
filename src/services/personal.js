import { supabase } from '../lib/supabase'
import { datos } from './util'

// Usuarios del personal (admin, rrhh, comercial). Crear, cambiar de rol y activar/desactivar pasan por la Edge Function
// «gestionar-acceso» (usa la API administrativa de Auth); la lista la lee una función SQL solo para administración.
export const listarPersonal = async () => datos(await supabase.rpc('admin_personal'))

async function invocar(body) {
  const { data, error } = await supabase.functions.invoke('gestionar-acceso', { body })
  if (!error) return data
  if (error.context?.status === 404) throw new Error('La función «gestionar-acceso» no está desplegada. Despliégala con: supabase functions deploy gestionar-acceso')
  if (typeof error.context?.json === 'function') {
    try {
      const j = await error.context.json()
      if (j?.error) throw new Error(j.error)
    } catch (e) {
      if (e instanceof Error && e.message) throw e
    }
  }
  throw new Error('No se pudo contactar la función «gestionar-acceso». Verifica que esté desplegada.')
}

export const crearPersonal = ({ correo, password, rol }) => invocar({ accion: 'personal_crear', correo, password, rol })
export const cambiarRolPersonal = (userId, rol) => invocar({ accion: 'personal_rol', user_id: userId, rol })
export const cambiarEstadoPersonal = (userId, activo) => invocar({ accion: 'personal_estado', user_id: userId, activo })
