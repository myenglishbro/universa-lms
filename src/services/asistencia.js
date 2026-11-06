import { supabase } from '../lib/supabase'
import { datos } from './util'

const rpc = async (nombre, args) => datos(await supabase.rpc(nombre, args))

// Docente asignado o administración
export const clasesDelSalon = (salonId) => rpc('portal_clases_salon', { p_salon: salonId })
export const sesionRegistro = (sesionId) => rpc('sesion_registro', { p_sesion: sesionId })
export const resumenDelSalon = (salonId) => rpc('asistencia_resumen_salon', { p_salon: salonId })
// Guarda asistencia + tema + materiales de una vez (primera vez o corrección). `alumnos`: [{ alumnoId, estado }]
export const registrarClase = (sesionId, { alumnos, tema, observaciones, materiales }) =>
  rpc('registrar_clase', {
    p_sesion: sesionId,
    p_asistencia: alumnos.map((a) => ({ alumno_id: a.alumnoId, estado: a.estado })),
    p_tema: tema || null,
    p_observaciones: observaciones || null,
    p_materiales: materiales ?? null,
  })
// Avance por sesiones (administración, docente del salón, estudiantes matriculados)
export const progresoDelSalon = (salonId) => rpc('progreso_salon', { p_salon: salonId })
// Estudiante: solo su propio historial
export const miAsistencia = (salonId) => rpc('portal_mi_asistencia', { p_salon: salonId })
// Ficha del estudiante (personal)
export const resumenDelAlumno = (alumnoId) => rpc('asistencia_resumen_alumno', { p_alumno: alumnoId })
