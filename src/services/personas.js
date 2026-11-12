import { supabase } from '../lib/supabase'
import { datos, fallo } from './util'

const rpc = async (nombre, args) => datos(await supabase.rpc(nombre, args))

// Estudiantes (tabla alumnos) y sus matrículas. Las escrituras pasan por funciones SQL que validan cupos y duplicados.
export async function listarEstudiantes() {
  return datos(
    await supabase
      .from('alumnos')
      .select('id, nombre, nombres, apellidos, telefono, correo, notas, activo, created_at, tipo_documento, numero_documento, fecha_nacimiento, pais_nacionalidad, genero')
      .order('nombre'),
  )
}

// Usuario y contraseña de MaskPark de un estudiante. Solo los administradores pueden leerla (RLS); para el resto devuelve null.
export async function plataformaEstudiante(alumnoId) {
  return datos(await supabase.from('alumno_plataforma').select('usuario, clave').eq('alumno_id', alumnoId).maybeSingle())
}
export async function listarMatriculas() {
  return datos(await supabase.from('matriculas').select('*').order('created_at', { ascending: false }))
}

// Si el formulario trae nombres/apellidos se envían separados (la base arma el nombre completo); los datos de MaskPark solo si vienen.
export const guardarEstudiante = (id, a) =>
  rpc('guardar_alumno', {
    p_id: id,
    p_datos: {
      nombre: a.nombre,
      ...('nombres' in a
        ? {
            nombres: a.nombres,
            apellidos: a.apellidos,
            tipo_documento: a.tipoDocumento,
            numero_documento: a.numeroDocumento,
            fecha_nacimiento: a.fechaNacimiento,
            pais_nacionalidad: a.paisNacionalidad,
            genero: a.genero,
          }
        : {}),
      ...('maskparkUsuario' in a ? { maskpark_usuario: a.maskparkUsuario, maskpark_clave: a.maskparkClave } : {}),
      telefono: a.telefono,
      correo: a.correo,
      notas: a.notas,
      ...(id ? { activo: a.activo } : {}),
    },
  })

export const matricularAlumnos = (salonId, alumnoIds) => rpc('matricular_alumnos', { p_salon: salonId, p_alumnos: alumnoIds })
export const retirarMatricula = (matriculaId, motivo) => rpc('retirar_matricula', { p_matricula: matriculaId, p_motivo: motivo || null })
// Matrículas retroactivas: lleva la fecha de inicio hacia atrás para poder registrar la asistencia de clases ya dictadas.
export const corregirFechaMatricula = (matriculaId, fecha) => rpc('corregir_fecha_matricula', { p_matricula: matriculaId, p_fecha: fecha })
export const corregirFechaMatriculasSalon = (salonId, fecha) => rpc('corregir_fecha_matriculas_salon', { p_salon: salonId, p_fecha: fecha })
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
