import { supabase } from '../lib/supabase'
import { datos } from './util'

const rpc = async (nombre, args) => datos(await supabase.rpc(nombre, args))

// Lecturas del portal: cada función de Supabase devuelve solo lo que corresponde a la cuenta que consulta.
export const misCursos = () => rpc('portal_mis_cursos')
export const misSalones = () => rpc('portal_mis_salones')
export const proximasClases = () => rpc('portal_proximas_clases')
export const estudiantesDelSalon = (salonId) => rpc('portal_estudiantes_salon', { p_salon: salonId })
export const sesionesDelSalon = (salonId) => rpc('portal_sesiones_salon', { p_salon: salonId })
export const contenidoDelCurso = (salonId) => rpc('portal_contenido', { p_salon: salonId })

// Gestión de contenido (docente asignado o administración). Las reglas y la validación de enlaces viven en Supabase.
export const guardarSeccion = (id, salonId, titulo) => rpc('guardar_seccion', { p_id: id, p_salon: salonId, p_titulo: titulo })
export const guardarLeccion = (id, seccionId, l) =>
  rpc('guardar_leccion', {
    p_id: id,
    p_seccion: seccionId,
    p_datos: { titulo: l.titulo, descripcion: l.descripcion, tipo: l.tipo, url: l.url, sesion_id: l.sesionId || null },
  })
export const ocultarLeccion = (id, oculta) => rpc('ocultar_leccion', { p_id: id, p_oculta: oculta })
export const ocultarSeccion = (id, oculta) => rpc('ocultar_seccion', { p_id: id, p_oculta: oculta })
export const reordenarLecciones = (seccionId, ids) => rpc('reordenar_lecciones', { p_seccion: seccionId, p_ids: ids })
export const reordenarSecciones = (salonId, ids) => rpc('reordenar_secciones', { p_salon: salonId, p_ids: ids })

// Administración: vincular cuentas de Supabase Auth con alumnos y docentes existentes.
export const vincularCuenta = (correo, rol, personaId) => rpc('vincular_cuenta', { p_correo: correo, p_rol: rol, p_persona: personaId })
export const desvincularCuenta = (rol, personaId) => rpc('desvincular_cuenta', { p_rol: rol, p_persona: personaId })
export const cuentasDePersona = (rol, personaId) => rpc('cuentas_de_persona', { p_rol: rol, p_persona: personaId })

// Lecciones marcadas como «vistas»: se guardan solo en este navegador (no se envía nada a Supabase).
// La clave incluye la cuenta para que dos personas que usan el mismo equipo no vean las marcas de la otra.
const clave = async (salonId) => {
  const { data } = await supabase.auth.getSession()
  return `vistas:${data?.session?.user?.id ?? 'anonimo'}:${salonId}`
}

export async function leccionesVistas(salonId) {
  try {
    return JSON.parse(localStorage.getItem(await clave(salonId)) ?? '[]')
  } catch {
    return []
  }
}

export async function marcarLeccion(salonId, leccionId, vista) {
  const k = await clave(salonId)
  let ids
  try {
    ids = new Set(JSON.parse(localStorage.getItem(k) ?? '[]'))
  } catch {
    ids = new Set()
  }
  if (vista) ids.add(leccionId)
  else ids.delete(leccionId)
  try {
    localStorage.setItem(k, JSON.stringify([...ids]))
  } catch {
    throw new Error('Your browser does not allow saving your progress (private mode or blocked storage).')
  }
}
