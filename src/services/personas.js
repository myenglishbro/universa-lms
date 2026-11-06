import { supabase } from '../lib/supabase'
import { datos, fallo } from './util'

const rpc = async (nombre, args) => datos(await supabase.rpc(nombre, args))

// Estudiantes (tabla alumnos) y sus matrículas. Las escrituras pasan por funciones SQL que validan cupos y duplicados.
export async function listarEstudiantes() {
  return datos(await supabase.from('alumnos').select('id, nombre, telefono, correo, notas, activo, created_at').order('nombre'))
}
export async function listarMatriculas() {
  return datos(await supabase.from('matriculas').select('*').order('created_at', { ascending: false }))
}

export const guardarEstudiante = (id, a) =>
  rpc('guardar_alumno', { p_id: id, p_datos: { nombre: a.nombre, telefono: a.telefono, correo: a.correo, notas: a.notas, ...(id ? { activo: a.activo } : {}) } })

export const matricularAlumnos = (salonId, alumnoIds) => rpc('matricular_alumnos', { p_salon: salonId, p_alumnos: alumnoIds })
export const retirarMatricula = (matriculaId, motivo) => rpc('retirar_matricula', { p_matricula: matriculaId, p_motivo: motivo || null })
export const cambiarSalonMatricula = (matriculaId, salonId, motivo) =>
  rpc('cambiar_salon_matricula', { p_matricula: matriculaId, p_salon_nuevo: salonId, p_motivo: motivo || null })

// Docentes: el alta ya existe en services/salones; aquí la edición (RLS: solo administradores).
export async function editarDocente(id, { nombre, correo, activo }) {
  const filas = datos(
    await supabase.from('docentes').update({ nombre: nombre.trim(), correo: correo.trim() || null, activo }).eq('id', id).select('id, nombre, correo, activo'),
  )
  if (filas.length === 0) throw fallo({ code: '42501', message: '' })
  return filas[0]
}
