import { supabase } from '../lib/supabase'
import { datos } from './util'
export { cambiarClaveAcceso } from './accesos'

const rpc = async (nombre, args) => datos(await supabase.rpc(nombre, args))

// ---- Registro público de profesores (Edge Function «registro-docente»: la cuenta nace sin acceso a datos) ----
export async function registrarProfesor(v) {
  const { error } = await supabase.functions.invoke('registro-docente', { body: v })
  if (!error) return
  if (error.context?.status === 404) throw new Error('El registro todavía no está disponible. Avisa a administración.')
  let mensaje = ''
  if (typeof error.context?.json === 'function') {
    try {
      mensaje = (await error.context.json())?.error ?? ''
    } catch {
      /* respuesta sin cuerpo legible */
    }
  }
  throw new Error(mensaje || 'No se pudo completar el registro. Revisa tu conexión e inténtalo de nuevo.')
}

// ---- El propio profesor ----
export async function miRegistro() {
  const { data: sesion } = await supabase.auth.getSession()
  const { data, error } = await supabase.from('docente_registros').select('*').eq('user_id', sesion.session?.user.id ?? '').maybeSingle()
  if (error) throw new Error(error.message)
  return data
}
export const guardarMiRegistro = (v) =>
  rpc('guardar_mi_registro', { p_datos: { nombres: v.nombres, apellidos: v.apellidos, celular: v.celular, direccion: v.direccion, foto_url: v.fotoUrl } })
export async function miDisponibilidad() {
  return datos(await supabase.from('docente_disponibilidad').select('dia, hora'))
}
export const guardarMiDisponibilidad = (slots) => rpc('guardar_mi_disponibilidad', { p_slots: slots })

// ---- Administración ----
export const listarRegistros = () => rpc('admin_registros_docentes')
export const convertirEnDocente = (userId) => rpc('convertir_en_docente', { p_user: userId })
export const quitarDocente = (userId) => rpc('quitar_docente', { p_user: userId })

// ---- Personal (al crear un salón y en la ficha del docente) ----
export const disponibilidadDocentes = () => rpc('disponibilidad_docentes')
export const perfilesDocentes = () => rpc('docentes_perfil')
