import { supabase } from '../lib/supabase'
import { datos } from './util'

const rpc = async (nombre, args) => datos(await supabase.rpc(nombre, args))

// Saldos por paquete (vista paquete_saldos: horas compradas, consumidas, disponibles y programadas, en minutos).
export async function listarPaquetes() {
  return datos(await supabase.from('paquete_saldos').select('*').order('created_at', { ascending: false }))
}

export async function listarAlumnos() {
  return datos(await supabase.from('alumnos').select('id, nombre, telefono, correo').order('nombre'))
}

export async function detallePaquete(id) {
  const [clases, movimientos] = await Promise.all([
    supabase.from('paquete_clases').select('*').eq('paquete_id', id).order('fecha').order('hora_inicio'),
    supabase.from('paquete_movimientos').select('*').eq('paquete_id', id).order('created_at', { ascending: false }),
  ])
  return { clases: datos(clases), movimientos: datos(movimientos) }
}

export const crearAlumno = (a) => rpc('guardar_alumno', { p_id: null, p_datos: a })

// Paquete nuevo (con `salon`): crea además su salón individual en la misma transacción. Renovación (sin `salon`): reutiliza el salón anterior.
export const registrarPaquete = (p) =>
  rpc('registrar_paquete_salon', {
    p_paquete: {
      alumno_id: p.alumnoId,
      horas: p.horas,
      docente_id: p.docenteId,
      nivel_id: p.nivelId,
      vigencia_hasta: p.vigenciaHasta,
      paquete_origen_id: p.origenId,
      notas: p.notas,
    },
    p_salon: p.salon
      ? {
          nombre: p.salon.nombre,
          nivel_id: p.nivelId,
          docente_id: p.docenteId,
          fecha_inicio: p.salon.fechaInicio,
          total_sesiones: p.salon.totalSesiones,
          estado: 'pendiente',
          observaciones: p.notas,
          plan_id: p.salon.planId,
          frecuencia_id: p.salon.frecuenciaId,
          ciclo_desde: p.salon.planId ? p.salon.cicloDesde : '',
          ciclo_hasta: p.salon.planId ? p.salon.cicloHasta : '',
        }
      : null,
    p_horarios: (p.salon?.horarios ?? []).map((h) => ({ dia: h.dia, hora_inicio: h.horaInicio, hora_fin: h.horaFin })),
  })

export const programarClase = (paqueteId, c) =>
  rpc('programar_clase', { p_paquete: paqueteId, p_fecha: c.fecha, p_inicio: c.horaInicio, p_fin: c.horaFin, p_docente: c.docenteId || null, p_nota: c.nota || null })
export const reprogramarClase = (claseId, c) =>
  rpc('reprogramar_clase', { p_clase: claseId, p_fecha: c.fecha, p_inicio: c.horaInicio, p_fin: c.horaFin, p_docente: c.docenteId || null })
// Solo cambia el docente por defecto del paquete: las clases ya programadas conservan el suyo.
export const asignarDocentePaquete = (paqueteId, docenteId) => rpc('editar_paquete', { p_id: paqueteId, p_datos: { docente_id: docenteId || null } })
export const cancelarClase = (claseId, { tardia, motivo, minutos }) =>
  rpc('cancelar_clase', { p_clase: claseId, p_tardia: Boolean(tardia), p_motivo: motivo || null, p_minutos: tardia ? minutos ?? null : null })
export const marcarDictada = (claseId) => rpc('marcar_dictada', { p_clase: claseId })
export const corregirClase = (claseId, motivo) => rpc('corregir_clase', { p_clase: claseId, p_motivo: motivo })

// `clave` evita registrar dos veces el mismo movimiento si la petición se repite.
export const ajustarPaquete = (paqueteId, { horas, tipo, motivo, clave }) =>
  rpc('ajustar_paquete', { p_paquete: paqueteId, p_horas: horas, p_tipo: tipo, p_motivo: motivo, p_clave: clave })
export const anularPaquete = (id, motivo) => rpc('anular_paquete', { p_id: id, p_motivo: motivo })

// Crea el salón de un paquete que no lo tiene (registrado antes de que los paquetes tuvieran salón).
export const crearSalonDePaquete = (paqueteId, s) =>
  rpc('crear_salon_paquete', {
    p_paquete: paqueteId,
    p_salon: {
      nombre: s.nombre,
      nivel_id: s.nivelId,
      fecha_inicio: s.fechaInicio,
      total_sesiones: s.totalSesiones === '' ? '' : Number(s.totalSesiones),
      estado: 'pendiente',
      plan_id: s.planId,
      frecuencia_id: s.frecuenciaId,
      ciclo_desde: s.planId ? s.cicloDesde : '',
      ciclo_hasta: s.planId ? s.cicloHasta : '',
    },
    p_horarios: s.horarios.map((h) => ({ dia: h.dia, hora_inicio: h.horaInicio, hora_fin: h.horaFin })),
  })

// Elimina el paquete con su historial y libera al docente. Devuelve 'eliminado' o 'finalizado' (si su salón no se pudo borrar).
export const eliminarPaquete = (id) => rpc('eliminar_paquete', { p_id: id })
