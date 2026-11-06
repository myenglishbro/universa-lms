import { supabase } from '../lib/supabase'
import { datos } from './util'

// Frecuencias con sus modalidades compatibles y su duración teórica (calculada por la base de datos).
export async function listarFrecuencias() {
  const [frecuencias, compatibles, duraciones] = await Promise.all([
    supabase.from('frecuencias').select('*').order('formato').order('orden'),
    supabase.from('frecuencia_modalidades').select('frecuencia_id, modalidad_id'),
    supabase.from('frecuencia_duraciones').select('frecuencia_id, modalidad_id, modalidad, horas_nivel, semanas_teoricas, meses_teoricos'),
  ])
  const comp = datos(compatibles)
  const dur = datos(duraciones)
  return datos(frecuencias).map((f) => ({
    id: f.id,
    codigo: f.codigo,
    nombre: f.nombre,
    formato: f.formato,
    intensidad: f.intensidad ?? '',
    clases: f.clases_semana,
    minutos: f.minutos_por_clase,
    dias: f.dias,
    horasSemana: f.horas_semana == null ? null : Number(f.horas_semana),
    activa: f.activa,
    estado: f.estado_dato,
    notas: f.notas ?? '',
    modalidadIds: comp.filter((c) => c.frecuencia_id === f.id).map((c) => c.modalidad_id),
    duraciones: dur
      .filter((d) => d.frecuencia_id === f.id)
      .map((d) => ({
        modalidadId: d.modalidad_id,
        modalidad: d.modalidad,
        horasNivel: Number(d.horas_nivel),
        semanas: Number(d.semanas_teoricas),
        meses: Number(d.meses_teoricos),
      })),
  }))
}

export async function listarModalidades() {
  return datos(await supabase.from('modalidades').select('id, codigo, nombre, horas_referencia_nivel').order('horas_referencia_nivel', { ascending: false }))
}

// Crea (id null) o edita una frecuencia y sus modalidades compatibles. Solo administradores.
export async function guardarFrecuencia(id, f) {
  return datos(
    await supabase.rpc('guardar_frecuencia', {
      p_id: id,
      p_datos: {
        nombre: f.nombre,
        formato: f.formato,
        intensidad: f.intensidad,
        clases_semana: f.clases,
        minutos_por_clase: f.minutos,
        dias: f.dias.length ? f.dias : null,
        estado_dato: f.estado,
        activa: f.activa,
        notas: f.notas,
      },
      p_modalidades: f.modalidadIds,
    }),
  )
}

export async function activarFrecuencia(id, activa) {
  datos(await supabase.rpc('activar_frecuencia', { p_id: id, p_activa: activa }))
}
