import { supabase } from '../lib/supabase'
import { datos } from './util'
import { listarFrecuencias, listarModalidades } from './frecuencias'

// Planes académicos con sus cuotas por ciclo (vista catalogo_planes + plan_ciclos), modalidades y frecuencias de clase.
// Las frecuencias son opcionales: si no se pueden leer, el resto del catálogo sigue disponible.
export async function listarCatalogo() {
  const [planes, modalidades, frecuencias] = await Promise.all([
    listarPlanes(),
    listarModalidades().catch(() => []),
    listarFrecuencias().then((f) => ({ lista: f, error: '' })).catch((e) => ({ lista: [], error: e.message })),
  ])
  return { planes, modalidades, frecuencias: frecuencias.lista, errorFrecuencias: frecuencias.error }
}

async function listarPlanes() {
  const [planes, ciclos] = await Promise.all([
    supabase.from('catalogo_planes').select('*').order('nivel_orden').order('minutos_clase'),
    supabase.from('plan_ciclos').select('plan_id, ciclo, sesiones, horas').order('ciclo'),
  ])
  const porPlan = new Map()
  for (const c of datos(ciclos)) {
    porPlan.set(c.plan_id, [...(porPlan.get(c.plan_id) ?? []), { ciclo: c.ciclo, sesiones: c.sesiones, horas: Number(c.horas) }])
  }
  return datos(planes).map((p) => ({
    id: p.plan_id,
    nivelCodigo: p.nivel_codigo,
    nivel: p.nivel,
    nivelOrden: p.nivel_orden,
    modalidadCodigo: p.modalidad_codigo,
    modalidad: p.modalidad,
    minutos: p.minutos_clase,
    sesionesSemana: p.sesiones_semana,
    tipoAlumno: p.tipo_alumno,
    totalSesiones: p.total_sesiones,
    horasTotales: Number(p.horas_totales),
    semanas: p.semanas,
    vigente: p.vigente,
    estadoDato: p.estado_dato,
    aprobado: p.aprobado,
    ciclos: porPlan.get(p.plan_id) ?? [],
  }))
}

// Valida los horarios contra el plan y/o la frecuencia en la base de datos (solo lectura). Devuelve [{ severidad, mensaje }]
// con severidad 'error' (el guardado será rechazado) o 'advertencia'.
export async function validarHorariosSalon(planId, frecuenciaId, horarios) {
  return datos(
    await supabase.rpc('validar_horarios_salon', {
      p_plan_id: planId || null,
      p_frecuencia_id: frecuenciaId || null,
      p_horarios: horarios.map((h) => ({ dia: h.dia, hora_inicio: h.horaInicio, hora_fin: h.horaFin })),
    }),
  )
}
