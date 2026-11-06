import { supabase } from '../lib/supabase'
import { compilar } from '../lib/ejercicios'
import { datos } from './util'

const rpc = async (nombre, args) => datos(await supabase.rpc(nombre, args))
const BUCKET = 'ejercicios-audio'

// Banco: administración ve el banco; cada docente, el banco y lo suyo (lo decide RLS).
export async function listarEjercicios() {
  return datos(
    await supabase
      .from('ejercicios')
      .select('id, titulo, tipo, nivel, tema, datos, publico, autor_user_id, autor_nombre, created_at')
      .order('created_at', { ascending: false }),
  )
}

// `e`: { titulo, tipo, nivel, tema, datos }. Se compila aquí lo que verá el estudiante y la clave de respuestas.
export function guardarEjercicio(id, e) {
  const { contenido, clave } = compilar(e.tipo, e.datos)
  return rpc('guardar_ejercicio', {
    p_id: id,
    p_datos: { titulo: e.titulo, tipo: e.tipo, nivel: e.nivel || '', tema: e.tema || '', datos: e.datos, contenido, clave },
  })
}
export const archivarEjercicio = (id) => rpc('archivar_ejercicio', { p_id: id })

// Salón (docente o administración)
export const asignarEjercicio = (ejercicioId, salonId, limite) => rpc('asignar_ejercicio', { p_ejercicio: ejercicioId, p_salon: salonId, p_limite: limite || null })
export const quitarAsignacion = (id) => rpc('quitar_asignacion', { p_asignacion: id })
export const ejerciciosDelSalon = (salonId) => rpc('ejercicios_salon', { p_salon: salonId })
export const entregasDeEjercicio = (asignacionId) => rpc('entregas_ejercicio', { p_asignacion: asignacionId })
export const calificarEntrega = (id, puntaje, feedback) => rpc('calificar_entrega', { p_entrega: id, p_puntaje: puntaje, p_feedback: feedback })

// Estudiante
export const misEjercicios = (salonId) => rpc('portal_ejercicios', { p_salon: salonId })
export const entregarEjercicio = (asignacionId, respuestas, audioPath = null) =>
  rpc('entregar_ejercicio', { p_asignacion: asignacionId, p_respuestas: respuestas, p_audio: audioPath })

// Audio de speaking: se sube a la carpeta <asignación>/<usuario>/ (lo exige la política de Storage).
export async function subirAudio(asignacionId, blob) {
  const { data } = await supabase.auth.getUser()
  const uid = data?.user?.id
  if (!uid) throw new Error('Tu sesión expiró; vuelve a ingresar')
  const ext = blob.type.includes('mp4') ? 'm4a' : blob.type.includes('ogg') ? 'ogg' : 'webm'
  const ruta = `${asignacionId}/${uid}/${Date.now()}.${ext}`
  const { error } = await supabase.storage.from(BUCKET).upload(ruta, blob, { contentType: blob.type || 'audio/webm', upsert: false })
  if (error) throw new Error(`No se pudo subir tu grabación: ${error.message}`)
  return ruta
}
export async function urlAudio(ruta) {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(ruta, 3600)
  if (error) throw new Error(error.message)
  return data.signedUrl
}
