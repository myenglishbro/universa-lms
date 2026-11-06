import { supabase } from '../lib/supabase'
import { datos, fallo } from './util'

const hora = (t) => t.slice(0, 5) // "18:00:00" -> "18:00"

// Forma que usa la interfaz (camelCase, sin nulos para que los inputs sean controlados).
function aSalon(r) {
  return {
    id: r.id,
    codigo: r.codigo,
    nombre: r.nombre,
    nivelId: r.nivel_id ?? '',
    nivel: r.niveles?.nombre ?? '',
    planId: r.plan_id ?? '',
    frecuenciaId: r.frecuencia_id ?? '',
    frecuencia: r.frecuencias
      ? { nombre: r.frecuencias.nombre, intensidad: r.frecuencias.intensidad ?? '', formato: r.frecuencias.formato, minutos: r.frecuencias.minutos_por_clase }
      : null,
    cicloDesde: r.ciclo_desde ?? '',
    cicloHasta: r.ciclo_hasta ?? '',
    plan: r.planes_academicos
      ? {
          nivel: r.planes_academicos.niveles.nombre,
          modalidad: r.planes_academicos.modalidades.nombre,
          minutos: r.planes_academicos.minutos_clase,
          sesionesSemana: r.planes_academicos.sesiones_semana,
          tipoAlumno: r.planes_academicos.tipo_alumno,
        }
      : null,
    curso: r.curso ?? '',
    docenteId: r.docente_id ?? '',
    docente: r.docentes?.nombre ?? '',
    fechaInicio: r.fecha_inicio,
    fechaFin: r.fecha_fin_estimada ?? '',
    capacidad: r.capacidad,
    totalSesiones: r.total_sesiones ?? '',
    estado: r.estado,
    archivadoAt: r.archivado_at ?? null,
    cicloArchivo: r.ciclo_archivo ?? '',
    observaciones: r.observaciones ?? '',
    horarios: r.salon_horarios
      .map((h) => ({ dia: h.dia, horaInicio: hora(h.hora_inicio), horaFin: hora(h.hora_fin) }))
      .sort((a, b) => a.dia - b.dia || a.horaInicio.localeCompare(b.horaInicio)),
  }
}

export async function listarSalones() {
  const filas = datos(
    await supabase
      .from('salones')
      .select(
        '*, niveles!salones_nivel_fk(nombre), docentes(nombre), salon_horarios(dia, hora_inicio, hora_fin), planes_academicos(minutos_clase, sesiones_semana, tipo_alumno, niveles(nombre), modalidades(nombre)), frecuencias(nombre, intensidad, formato, minutos_por_clase)',
      )
      .order('fecha_inicio', { ascending: false }),
  )
  return filas.map(aSalon)
}

// Progreso académico por salón (solo salones con total de sesiones), indexado por id.
export async function listarProgreso() {
  const filas = datos(await supabase.from('salon_progreso').select('*'))
  return Object.fromEntries(
    filas.map((r) => [
      r.salon_id,
      {
        total: r.total_sesiones,
        sesiones: r.sesiones,
        realizadas: r.realizadas,
        programadas: r.programadas,
        canceladas: r.canceladas,
        porRegistrar: r.por_registrar,
        restantes: r.restantes,
        sinProgramar: r.sin_programar,
        proximaFecha: r.proxima_fecha,
      },
    ]),
  )
}

// Niveles académicos oficiales (clasificación única de los salones).
export async function listarNiveles() {
  return datos(await supabase.from('niveles').select('id, codigo, nombre, orden').order('orden'))
}

export async function listarDocentes() {
  return datos(await supabase.from('docentes').select('id, nombre, correo, activo').order('nombre'))
}

// Crea (id null) o edita un salón junto con sus horarios en una sola transacción (función guardar_salon).
export async function guardarSalon(id, s) {
  datos(
    await supabase.rpc('guardar_salon', {
      p_id: id,
      p_salon: {
        nombre: s.nombre,
        nivel_id: s.nivelId,
        docente_id: s.docenteId,
        fecha_inicio: s.fechaInicio,
        fecha_fin_estimada: s.fechaFin,
        capacidad: s.capacidad,
        total_sesiones: s.totalSesiones,
        estado: s.estado,
        observaciones: s.observaciones,
        plan_id: s.planId,
        frecuencia_id: s.frecuenciaId,
        ciclo_desde: s.planId ? s.cicloDesde : '',
        ciclo_hasta: s.planId ? s.cicloHasta : '',
      },
      p_horarios: s.horarios.map((h) => ({ dia: h.dia, hora_inicio: h.horaInicio, hora_fin: h.horaFin })),
    }),
  )
}

export async function cambiarEstado(id, estado) {
  const filas = datos(await supabase.from('salones').update({ estado }).eq('id', id).select('id'))
  // RLS no devuelve error cuando bloquea un UPDATE: simplemente no afecta filas.
  if (filas.length === 0) throw fallo({ code: '42501', message: '' })
}

export async function crearDocente({ nombre, correo, activo }) {
  return datos(
    await supabase
      .from('docentes')
      .insert({ nombre: nombre.trim(), correo: correo.trim() || null, activo })
      .select('id, nombre, correo, activo')
      .single(),
  )
}

// Archivo de ciclos: cierra los salones finalizados bajo un nombre de ciclo (ver migración archivo_ciclos).
export async function archivarSalones(ids, ciclo) {
  return datos(await supabase.rpc('archivar_salones', { p_salones: ids, p_ciclo: ciclo }))
}

// Copia fija de cada estudiante por salón archivado (solo administración; incluye el informe de notas).
export async function listarArchivoAlumnos() {
  return datos(
    await supabase
      .from('archivo_alumnos')
      .select('id, salon_id, alumno_id, alumno_nombre, ciclo, matricula_estado, fecha_inicio, fecha_fin, motivo_retiro, informe')
      .order('alumno_nombre'),
  )
}
