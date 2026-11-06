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
  const [clases, pagos, movimientos] = await Promise.all([
    supabase.from('paquete_clases').select('*').eq('paquete_id', id).order('fecha').order('hora_inicio'),
    supabase.from('paquete_pagos').select('*').eq('paquete_id', id).order('fecha', { ascending: false }).order('created_at', { ascending: false }),
    supabase.from('paquete_movimientos').select('*').eq('paquete_id', id).order('created_at', { ascending: false }),
  ])
  return { clases: datos(clases), pagos: datos(pagos), movimientos: datos(movimientos) }
}

export const crearAlumno = (a) => rpc('guardar_alumno', { p_id: null, p_datos: a })

export const registrarPaquete = (p) =>
  rpc('registrar_paquete', {
    p_datos: {
      alumno_id: p.alumnoId,
      horas: p.horas,
      precio: p.precio,
      moneda: p.moneda,
      docente_id: p.docenteId,
      nivel_id: p.nivelId,
      vigencia_hasta: p.vigenciaHasta,
      paquete_origen_id: p.origenId,
      notas: p.notas,
      pago_monto: p.pagoMonto,
      pago_metodo: p.pagoMetodo,
    },
  })

export const registrarPago = (paqueteId, p) =>
  rpc('registrar_pago', { p_paquete: paqueteId, p_monto: p.monto, p_fecha: p.fecha || null, p_metodo: p.metodo || null, p_nota: p.nota || null })
export const anularPago = (pagoId, motivo) => rpc('anular_pago', { p_pago: pagoId, p_motivo: motivo })

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
