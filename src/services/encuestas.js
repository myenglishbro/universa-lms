import { supabase } from '../lib/supabase'
import { datos } from './util'

const rpc = async (nombre, args) => datos(await supabase.rpc(nombre, args))

// Estudiante: la clase reciente a la que asistió y aún no ha calificado (null = ninguna).
export const encuestaPendiente = () => rpc('portal_encuesta_pendiente')
export const guardarEncuesta = (sesionId, r, comentario) =>
  rpc('guardar_encuesta_clase', { p_sesion: sesionId, p_claridad: r.claridad, p_participacion: r.participacion, p_ritmo: r.ritmo, p_general: r.general, p_comentario: comentario || null })

// Administración: promedios por docente y del equipo (dias 0 = todo el tiempo), mes a mes y respuestas de cada estudiante (con su nombre).
export const resumenEncuestas = (dias) => rpc('admin_encuestas_resumen', { p_dias: dias })
export const mensualEncuestas = (meses = 6) => rpc('admin_encuestas_mensual', { p_meses: meses })
export const respuestasEncuestas = (docenteId, dias, mes = null) => rpc('admin_encuestas_respuestas', { p_docente: docenteId, p_dias: dias, p_mes: mes, p_limite: 200 })
