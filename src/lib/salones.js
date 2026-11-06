// Constantes y helpers de Salones grupales. Los valores coinciden con los de la base de datos.
export const estados = [
  { value: 'pendiente', label: 'Pendiente' },
  { value: 'en_curso', label: 'En curso' },
  { value: 'finalizado', label: 'Finalizado' },
]
// Valor de filtro para los salones que aún no tienen nivel académico (pendientes de reclasificar).
export const SIN_NIVEL = '__sin_nivel__'
export const coincideNivel = (salon, filtro) => !filtro || (filtro === SIN_NIVEL ? !salon.nivelId : salon.nivelId === filtro)

export const estadoLabel = (valor) => estados.find((e) => e.value === valor)?.label ?? valor

// dia: 1 = lunes ... 7 = domingo (igual que salon_horarios.dia)
export const diasSemana = [
  { value: 1, label: 'Lunes', corto: 'Lun' },
  { value: 2, label: 'Martes', corto: 'Mar' },
  { value: 3, label: 'Miércoles', corto: 'Mié' },
  { value: 4, label: 'Jueves', corto: 'Jue' },
  { value: 5, label: 'Viernes', corto: 'Vie' },
  { value: 6, label: 'Sábado', corto: 'Sáb' },
  { value: 7, label: 'Domingo', corto: 'Dom' },
]

// Días de anticipación para marcar un salón como "próximo a finalizar".
export const DIAS_ALERTA_FIN = 14

export const salonVacio = {
  codigo: '',
  nombre: '',
  nivelId: '',
  curso: '',
  docenteId: '',
  fechaInicio: '',
  fechaFin: '',
  capacidad: '',
  totalSesiones: '',
  estado: 'pendiente',
  observaciones: '',
  horarios: [],
  // Plan académico (opcional). modalidad/nivel/horario/tipo solo sirven para elegir el plan en el formulario.
  planId: '',
  frecuenciaId: '',
  cicloDesde: '',
  cicloHasta: '',
  modalidad: '',
  nivel: '',
  horario: '',
  tipo: '',
}

// Único punto donde se obtiene la fecha de finalización. Hoy es un valor manual;
// más adelante se calculará con sesiones, feriados, suspensiones y recuperaciones.
// La matrícula de estudiantes NUNCA debe intervenir aquí.
export const fechaFinSalon = (salon) => salon.fechaFin

// "Hoy" según America/Lima (misma referencia que usa la base de datos), en formato YYYY-MM-DD.
export const hoyLima = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima' }).format(new Date())

// Fechas ISO (YYYY-MM-DD) interpretadas en hora local para evitar desfases de zona horaria.
export function diasParaFin(salon) {
  const fin = fechaFinSalon(salon)
  if (!fin) return null
  return Math.round((new Date(`${fin}T00:00:00`) - new Date(`${hoyLima()}T00:00:00`)) / 86400000)
}

export function proximoAFinalizar(salon) {
  const dias = diasParaFin(salon)
  return salon.estado === 'en_curso' && dias !== null && dias <= DIAS_ALERTA_FIN
}

export function textoFin(salon) {
  const dias = diasParaFin(salon)
  if (dias === null) return ''
  if (dias < 0) return 'Fecha de fin vencida'
  if (dias === 0) return 'Finaliza hoy'
  return `Faltan ${dias} ${dias === 1 ? 'día' : 'días'}`
}

export const formatFecha = (iso) => (iso ? iso.split('-').reverse().join('/') : '—')

// Agrupa los días que comparten horario: "Lun · Mié · Vie 20:00–21:30 / Sáb 09:00–13:00".
export function formatHorario(horarios) {
  const grupos = new Map()
  for (const h of horarios) {
    const franja = `${h.horaInicio}–${h.horaFin}`
    grupos.set(franja, [...(grupos.get(franja) ?? []), diasSemana.find((d) => d.value === h.dia).corto])
  }
  return [...grupos].map(([franja, dias]) => `${dias.join(' · ')} ${franja}`).join(' / ') || '—'
}
