// Resumen en tiempo real del salón que se está creando o editando. Solo presenta lo que el formulario y el catálogo
// (Supabase) ya contienen; no calcula reglas académicas nuevas ni sustituye las validaciones de la base de datos.
import { cuota, descripcionPlan, formatHoras, seleccionDe, textoCiclos } from './catalogo'
import { duracionesParaMostrar, estructuraTexto, horasSemanaTexto, textoDuracion } from './frecuencias'
import { formatFecha, formatHorario } from './salones'

const tipoPlan = (p) => descripcionPlan({ ...p, tipoAlumno: ['nuevo', 'continuo'].includes(p.tipoAlumno) ? p.tipoAlumno : '' })

// Qué configuración usa el salón: 'ninguna' | 'plan' | 'frecuencia' | 'ambos'.
export function modoConfiguracion({ planId, frecuenciaId }) {
  if (planId && frecuenciaId) return 'ambos'
  if (planId) return 'plan'
  if (frecuenciaId) return 'frecuencia'
  return 'ninguna'
}

// Mensaje corto que explica qué ocurre con el modo actual.
export const mensajeModo = {
  ninguna: 'Sin plan ni frecuencia: tú indicas el total de sesiones y los horarios.',
  plan: 'Con plan: las sesiones y los ciclos se calculan solos.',
  frecuencia: 'Con frecuencia: se revisa que las clases por semana y su duración coincidan. El total de sesiones lo indicas tú.',
  ambos: 'Con plan y frecuencia: las sesiones salen del plan y los horarios deben cumplir ambos.',
}

export function resumenSalon({ values, catalogo, nivelNombre = '', avisos = [], usaPlan = false, usaFrecuencia = false, tieneCalendario = false }) {
  const planes = catalogo.planes ?? []
  const plan = planes.find((p) => p.id === values.planId) ?? null
  const frecuencia = (catalogo.frecuencias ?? []).find((f) => f.id === values.frecuenciaId) ?? null
  const modalidadCodigo = plan ? seleccionDe(plan).modalidad : values.modalidad
  const modalidad = (catalogo.modalidades ?? []).find((m) => m.codigo === modalidadCodigo)
  const cuotaPlan = plan && values.cicloDesde !== '' ? cuota(plan, Number(values.cicloDesde), Number(values.cicloHasta)) : null

  const totalManual = values.totalSesiones === '' || values.totalSesiones == null ? null : Number(values.totalSesiones)
  const sesiones = cuotaPlan && !tieneCalendario ? cuotaPlan.sesiones : totalManual

  // Duración estimada: la del plan si existe; si no, la teórica de la frecuencia. Nunca es una fecha de finalización.
  let duracion = []
  if (cuotaPlan) duracion = [`aprox. ${cuotaPlan.semanas} semanas de clase`]
  else if (frecuencia) duracion = duracionesParaMostrar(frecuencia, modalidad?.id).map(textoDuracion)

  const lista = []
  for (const a of avisos) lista.push({ nivel: a.severidad === 'error' ? 'error' : 'aviso', texto: a.mensaje })
  if (usaPlan && !plan) lista.push({ nivel: 'aviso', texto: 'Falta completar el plan académico.' })
  if (usaFrecuencia && !frecuencia) lista.push({ nivel: 'aviso', texto: 'Falta elegir la frecuencia.' })
  if (plan && !plan.aprobado) lista.push({ nivel: 'info', texto: 'Plan pendiente de aprobación de Coordinación.' })
  if (tieneCalendario && cuotaPlan && totalManual != null && totalManual !== cuotaPlan.sesiones)
    lista.push({ nivel: 'aviso', texto: `El plan indica ${cuotaPlan.sesiones} sesiones, pero el salón tiene ${totalManual}. El calendario no cambia solo.` })
  if (frecuencia && modalidad && !frecuencia.modalidadIds.includes(modalidad.id))
    lista.push({ nivel: 'aviso', texto: `Esta frecuencia no está definida para ${modalidad.nombre}.` })

  return {
    nivelTexto: nivelNombre || null,
    modo: modoConfiguracion({ planId: usaPlan || values.planId, frecuenciaId: usaFrecuencia || values.frecuenciaId }),
    planTexto: plan ? tipoPlan({ ...plan, nivel: '' }) : null,
    frecuenciaTexto: frecuencia ? frecuencia.nombre : null,
    clasesTexto: frecuencia ? `${estructuraTexto(frecuencia.minutos)} · ${horasSemanaTexto(frecuencia)}` : plan ? `${plan.sesionesSemana} clases por semana de ${plan.minutos} min` : null,
    ciclosTexto: plan && values.cicloDesde !== '' ? textoCiclos(Number(values.cicloDesde), Number(values.cicloHasta)) : null,
    sesiones,
    horas: cuotaPlan ? formatHoras(cuotaPlan.horas) : null,
    duracion,
    horario: values.horarios.length ? formatHorario(values.horarios.filter((h) => h.horaInicio && h.horaFin)) : null,
    inicio: values.fechaInicio ? formatFecha(values.fechaInicio) : null,
    fin: values.fechaFin ? formatFecha(values.fechaFin) : null,
    avisos: lista,
  }
}
