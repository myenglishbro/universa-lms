import { supabase } from '../lib/supabase'
import { datos } from './util'

const rpc = async (nombre, args) => datos(await supabase.rpc(nombre, args))

// ---- Administración: plantillas, rúbricas, módulos y consolidación ----
export const listarPlantillas = async () =>
  datos(
    await supabase
      .from('eval_plantillas')
      .select('id, nombre, descripcion, nivel_id, eval_versiones(id, version, estado, escala_puntos, notas, variante, eval_componentes(id, nombre, tipo, peso, peso_final, nombre_final, orden, rubrica_id))')
      .order('nombre'),
  ).map((p) => ({
    ...p,
    versiones: [...p.eval_versiones]
      .filter((v) => v.variante !== 'final') // la copia interna del módulo final no se muestra
      .sort((a, b) => b.version - a.version)
      .map((v) => ({ ...v, componentes: [...v.eval_componentes].sort((a, b) => a.orden - b.orden) })),
  }))
export const listarRubricas = async () =>
  datos(await supabase.from('eval_rubricas').select('id, nombre, tipo, descripcion, activa, eval_rubrica_criterios(id, nombre, descripcion, max_puntaje, orden, bandas)').order('nombre')).map((r) => ({
    ...r,
    criterios: [...r.eval_rubrica_criterios].sort((a, b) => a.orden - b.orden),
  }))
export const guardarRubrica = (id, r) => rpc('guardar_rubrica', { p_id: id, p_datos: r })
export const guardarPlantilla = (id, { nombre, descripcion, nivelId }) => rpc('guardar_plantilla', { p_id: id, p_nombre: nombre, p_descripcion: descripcion || null, p_nivel: nivelId || null })
export const guardarVersion = (versionId, datosVersion) => rpc('guardar_version', { p_version: versionId, p_datos: datosVersion })
export const activarVersion = (versionId) => rpc('activar_version', { p_version: versionId })
export const nuevaVersion = (plantillaId) => rpc('nueva_version', { p_plantilla: plantillaId })
export const guardarModulo = (id, salonId, { nombre, ciclo, aporte }) => rpc('guardar_modulo', { p_id: id, p_salon: salonId, p_nombre: nombre, p_ciclo: ciclo === '' || ciclo == null ? null : Number(ciclo), p_aporte: Number(aporte) || 1 })
export const eliminarModulo = (id) => rpc('eliminar_modulo', { p_id: id })
export const definirSesionesModulo = (moduloId, desde, hasta) => rpc('definir_sesiones_modulo', { p_modulo: moduloId, p_desde: desde === '' || desde == null ? null : Number(desde), p_hasta: hasta === '' || hasta == null ? null : Number(hasta) })
export const crearEstructuraEstandar = (salonId) => rpc('crear_estructura_estandar', { p_salon: salonId })
export const pendientes = () => rpc('eval_pendientes', {})
export const aplicarRemedial = (id) => rpc('aplicar_remedial', { p_id: id })
export const anularRemedial = (id, motivo) => rpc('anular_remedial', { p_id: id, p_motivo: motivo })
export const definirModuloFinal = (moduloId, esFinal) => rpc('definir_modulo_final', { p_modulo: moduloId, p_final: esFinal })
export const asignarPlantilla = (moduloId, versionId) => rpc('asignar_plantilla', { p_modulo: moduloId, p_version: versionId })
export const guardarConsolidacion = (salonId, metodo, confirmada) => rpc('guardar_consolidacion', { p_salon: salonId, p_metodo: metodo, p_confirmada: confirmada })

// ---- Docente asignado o administración ----
export const estructuraSalon = (salonId) => rpc('eval_estructura_salon', { p_salon: salonId })
export const detalleEvaluacion = (evaluacionId) => rpc('eval_evaluacion_detalle', { p_evaluacion: evaluacionId })
export const resultadosSalon = (salonId) => rpc('eval_resultados_salon', { p_salon: salonId })
export const historialEvaluacion = (evaluacionId) => rpc('eval_historial_evaluacion', { p_evaluacion: evaluacionId })
export const configurarUnidades = (evaluacionId, unidades) => rpc('configurar_unidades', { p_evaluacion: evaluacionId, p_unidades: unidades })
// filas: [{ alumnoId, unidad, puntaje, comentario, detalle: [{ criterio_id, puntaje }] }]
export const guardarCalificaciones = (evaluacionId, filas) =>
  rpc('guardar_calificaciones', {
    p_evaluacion: evaluacionId,
    p_filas: filas.map((f) => ({ alumno_id: f.alumnoId, unidad: f.unidad ?? '', puntaje: f.puntaje === '' ? null : f.puntaje, comentario: f.comentario || null, detalle: f.detalle ?? null })),
  })
export const publicarEvaluacion = (evaluacionId, alumnos = null) => rpc('publicar_evaluacion', { p_evaluacion: evaluacionId, p_alumnos: alumnos })
export const corregirCalificacion = (evaluacionId, { alumnoId, unidad, puntaje, comentario, motivo, detalle }) =>
  rpc('corregir_calificacion', { p_evaluacion: evaluacionId, p_alumno: alumnoId, p_unidad: unidad ?? '', p_puntaje: puntaje === '' ? null : puntaje, p_comentario: comentario || null, p_motivo: motivo, p_detalle: detalle ?? null })

// Matriz del salón (docente asignado o administración): alumnos × evaluaciones, subtotales por módulo y ciclo.
export const matrizSalon = (salonId) => rpc('eval_matriz_salon', { p_salon: salonId })
// Participación por clase (Formative Assessment)
export const participacionDetalle = (evaluacionId) => rpc('eval_participacion_detalle', { p_evaluacion: evaluacionId })
// filas: [{ alumnoId, sesionId, cumplio: true | false | null }]; null = pendiente
export const guardarParticipacion = (evaluacionId, filas) =>
  rpc('guardar_participacion', { p_evaluacion: evaluacionId, p_filas: filas.map((f) => ({ alumno_id: f.alumnoId, sesion_id: f.sesionId, cumplio: f.cumplio })) })
export const publicarParticipacion = (evaluacionId, alumnos = null) => rpc('publicar_participacion', { p_evaluacion: evaluacionId, p_alumnos: alumnos })
export const corregirParticipacion = (evaluacionId, { alumnoId, sesionId, cumplio, motivo }) =>
  rpc('corregir_participacion', { p_evaluacion: evaluacionId, p_alumno: alumnoId, p_sesion: sesionId, p_cumplio: cumplio, p_motivo: motivo })
// Remediales: el docente registra; solo administración aplica o anula.
export const remedialesSalon = (salonId) => rpc('eval_remediales_salon', { p_salon: salonId })
export const registrarRemedial = (salonId, { alumnoId, ambito, moduloId, ciclo, nota, comentario }) =>
  rpc('registrar_remedial', { p_salon: salonId, p_alumno: alumnoId, p_ambito: ambito, p_modulo: ambito === 'modulo' ? moduloId : null, p_ciclo: ambito === 'ciclo' ? Number(ciclo) : null, p_nota: Number(nota), p_comentario: comentario || null })

// ---- Estudiante ----
export const informeAlumno = (salonId, alumnoId) => rpc('informe_alumno', { p_salon: salonId, p_alumno: alumnoId })
export const misCalificaciones = (salonId) => rpc('portal_mis_calificaciones', { p_salon: salonId })
