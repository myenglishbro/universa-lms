export const ESTADOS_ASISTENCIA = [
  { value: 'presente', label: 'Present', corto: 'P', color: 'brand' },
  { value: 'ausente', label: 'Absent', corto: 'A', color: 'rose' },
  { value: 'tardanza', label: 'Late', corto: 'L', color: 'peach' },
  { value: 'justificado', label: 'Excused', corto: 'E', color: 'slate' },
]
export const estadoAsistencia = (valor) => ESTADOS_ASISTENCIA.find((e) => e.value === valor) ?? null

// Estado de registro de una sesión: registrada / pendiente (ya ocurrió y falta registrar) / próxima.
export const REGISTRO = {
  registrada: { label: 'Recorded', color: 'brand' },
  pendiente: { label: 'Pending', color: 'peach' },
  proxima: { label: 'Upcoming', color: 'slate' },
}

// Avance por sesiones del calendario. NO es aprobación académica. null si el salón no tiene total definido.
export function porcentajeAvance(realizadas, total) {
  if (!total) return null
  return Math.min(100, Math.round((realizadas / total) * 100))
}

export const NOTA_PROGRESO = 'Progress by calendar sessions. It does not indicate academic approval.'

// Cuenta estados de una lista [{ asistencia }].
// Las clases extra se registran pero no cuentan para el porcentaje ni para el 25 % de inasistencias.
export function contarAsistencia(filas, campo = 'asistencia') {
  const c = { presente: 0, ausente: 0, tardanza: 0, justificado: 0 }
  for (const f of filas) if (f.tipo !== 'extra' && f[campo] in c) c[f[campo]]++
  return c
}

// Porcentaje de asistencia: presentes y tardanzas sobre las clases con marca (las justificadas no cuentan en contra).
export function porcentajeAsistencia(conteo) {
  const base = conteo.presente + conteo.tardanza + conteo.ausente
  return base ? Math.round(((conteo.presente + conteo.tardanza) / base) * 100) : null
}

// Regla de inasistencias: 2 tardanzas suman 1 inasistencia (la tardanza suelta no cuenta). Con 25 % o más de inasistencias SOBRE EL TOTAL DE CLASES
// del curso el estudiante REPITE, aunque tenga el puntaje perfecto. Las justificadas no cuentan. Sin total definido en el salón se usa, como respaldo,
// las clases con marca hasta hoy (orientativo).
export const LIMITE_INASISTENCIA = 25
export function riesgoAsistencia(conteo, total = null) {
  const tardanzas = conteo.tardanza ?? 0
  const marcadas = (conteo.presente ?? 0) + tardanzas + (conteo.ausente ?? 0)
  const equivalentes = (conteo.ausente ?? 0) + Math.floor(tardanzas / 2)
  const porTotal = Number(total) > 0
  const base = porTotal ? Number(total) : marcadas
  const pct = base ? Math.round((equivalentes / base) * 1000) / 10 : 0
  // Inasistencias equivalentes con las que se llega al límite (25 % del total, redondeado hacia arriba).
  const limiteClases = base ? Math.ceil((base * LIMITE_INASISTENCIA) / 100) : null
  const enRiesgo = base > 0 && equivalentes > 0 && pct >= LIMITE_INASISTENCIA
  const cercano = !enRiesgo && base > 0 && pct >= LIMITE_INASISTENCIA - 5
  // Margen que queda ANTES de llegar al límite: faltas completas y, si solo llegara tarde, cuántas tardanzas (2 = 1 falta; una tardanza que completa un par ya cuesta una).
  const faltasRestantes = limiteClases == null || enRiesgo ? 0 : Math.max(0, limiteClases - 1 - equivalentes)
  const tardanzasRestantes = faltasRestantes === 0 && limiteClases != null && !enRiesgo ? (tardanzas % 2 === 0 ? 1 : 0) : faltasRestantes * 2 + (tardanzas % 2 === 0 ? 1 : 0)
  return { base, porTotal, equivalentes, pct, limiteClases, enRiesgo, cercano, faltasRestantes, tardanzasRestantes }
}
