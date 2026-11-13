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
export function contarAsistencia(filas, campo = 'asistencia') {
  const c = { presente: 0, ausente: 0, tardanza: 0, justificado: 0 }
  for (const f of filas) if (f[campo] in c) c[f[campo]]++
  return c
}

// Porcentaje de asistencia: presentes y tardanzas sobre las clases con marca (las justificadas no cuentan en contra).
export function porcentajeAsistencia(conteo) {
  const base = conteo.presente + conteo.tardanza + conteo.ausente
  return base ? Math.round(((conteo.presente + conteo.tardanza) / base) * 100) : null
}
