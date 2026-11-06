import { supabase } from '../lib/supabase'
import { datos } from './util'

const hora = (t) => t.slice(0, 5)

// Lecturas ---------------------------------------------------------------

export async function listarSesiones(salonId) {
  const filas = datos(
    await supabase
      .from('salon_sesiones')
      .select('id, fecha, hora_inicio, hora_fin, estado, tipo, recupera_a, manual, nota')
      .eq('salon_id', salonId)
      .order('fecha')
      .order('hora_inicio'),
  )
  return filas.map((r) => ({
    id: r.id,
    fecha: r.fecha,
    horaInicio: hora(r.hora_inicio),
    horaFin: hora(r.hora_fin),
    estado: r.estado,
    tipo: r.tipo,
    recuperaA: r.recupera_a,
    manual: r.manual,
    nota: r.nota ?? '',
  }))
}

// Sesiones pendientes del salón que se superponen con otro salón del mismo docente (solo advertencia).
export async function listarConflictos(salonId) {
  const filas = datos(
    await supabase
      .from('sesiones_con_conflicto')
      .select('sesion_id, otro_salon_codigo, otra_hora_inicio, otra_hora_fin')
      .eq('salon_id', salonId),
  )
  return filas.map((r) => ({
    sesionId: r.sesion_id,
    texto: `${r.otro_salon_codigo} (${hora(r.otra_hora_inicio)}–${hora(r.otra_hora_fin)})`,
  }))
}

// Los feriados cambian rara vez y los piden el calendario de cada salón y la agenda: se guardan en memoria unos minutos
// (y se descartan al crear/borrar uno). `forzar` salta la memoria.
const VIGENCIA_FERIADOS = 5 * 60 * 1000
let feriadosEnMemoria = null // { hasta, promesa }
export async function listarFeriados({ forzar = false } = {}) {
  if (!forzar && feriadosEnMemoria && feriadosEnMemoria.hasta > Date.now()) return feriadosEnMemoria.promesa
  const promesa = (async () => datos(await supabase.from('feriados').select('fecha, nombre').order('fecha')))()
  feriadosEnMemoria = { hasta: Date.now() + VIGENCIA_FERIADOS, promesa }
  promesa.catch(() => {
    if (feriadosEnMemoria?.promesa === promesa) feriadosEnMemoria = null // un fallo no se queda guardado
  })
  return promesa
}

// Escrituras: todas son funciones transaccionales de la base (solo admin) -------------------

export const generarCalendario = async (salonId) =>
  datos(await supabase.rpc('generar_calendario', { p_salon_id: salonId }))

export const registrarRealizada = async (id, nota) =>
  datos(await supabase.rpc('registrar_realizada', { p_sesion_id: id, p_nota: nota || null }))

// Devuelve { fecha, hora_inicio, hora_fin } o null si el salón no tiene horarios. No escribe nada.
export const proponerRecuperacion = async (id) =>
  datos(await supabase.rpc('proponer_recuperacion', { p_sesion_id: id }))

// recuperacion: { fecha, hora_inicio, hora_fin } para crearla al cancelar, o null para dejarla pendiente.
export const cancelarSesion = async (id, nota, recuperacion) =>
  datos(
    await supabase.rpc('cancelar_sesion', {
      p_sesion_id: id,
      p_nota: nota || null,
      p_recuperacion: recuperacion,
    }),
  )

export const crearRecuperacion = async (canceladaId, fecha, horaInicio, horaFin) =>
  datos(
    await supabase.rpc('crear_recuperacion', {
      p_cancelada_id: canceladaId,
      p_fecha: fecha,
      p_hora_inicio: horaInicio,
      p_hora_fin: horaFin,
    }),
  )

export const reprogramarSesion = async (id, fecha, horaInicio, horaFin, nota) =>
  datos(
    await supabase.rpc('reprogramar_sesion', {
      p_sesion_id: id,
      p_fecha: fecha,
      p_hora_inicio: horaInicio,
      p_hora_fin: horaFin,
      p_nota: nota || null,
    }),
  )

export const corregirSesion = async (id, nuevoEstado, motivo) =>
  datos(await supabase.rpc('corregir_sesion', { p_sesion_id: id, p_nuevo_estado: nuevoEstado, p_motivo: motivo }))

export const guardarFeriado = async (fecha, nombre) => {
  feriadosEnMemoria = null
  return datos(await supabase.rpc('guardar_feriado', { p_fecha: fecha, p_nombre: nombre }))
}

export const eliminarFeriado = async (fecha) => {
  feriadosEnMemoria = null
  return datos(await supabase.rpc('eliminar_feriado', { p_fecha: fecha }))
}
