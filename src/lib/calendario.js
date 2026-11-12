import { nombreDia, sumarDias } from './agenda'

// Helpers de sesiones académicas.
export const estadosSesion = [
  { value: 'programada', label: 'Scheduled' },
  { value: 'realizada', label: 'Held' },
  { value: 'cancelada', label: 'Cancelled' },
]
export const estadoSesionLabel = (v) => estadosSesion.find((e) => e.value === v)?.label ?? v

const diasCortos = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

// "2026-11-10" -> "Mar 10/11"
export const formatFechaCorta = (iso) =>
  `${diasCortos[new Date(`${iso}T00:00:00`).getDay()]} ${iso.slice(8, 10)}/${iso.slice(5, 7)}`

// Número visible de cada sesión: orden cronológico entre las no canceladas (no se guarda en la base).
export function numerarSesiones(sesiones) {
  const numeros = new Map()
  sesiones
    .filter((s) => s.estado !== 'cancelada')
    .sort((a, b) => a.fecha.localeCompare(b.fecha) || a.horaInicio.localeCompare(b.horaInicio))
    .forEach((s, i) => numeros.set(s.id, i + 1))
  return numeros
}

const pad = (n) => String(n).padStart(2, '0')
export const hoyISO = () => {
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

// Texto relativo: «Hoy», «Mañana» o el día de la semana.
export function cuando(fecha, hoy = hoyISO()) {
  if (fecha === hoy) return 'Today'
  if (fecha === sumarDias(hoy, 1)) return 'Tomorrow'
  return nombreDia(fecha)
}
