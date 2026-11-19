// Borrador del reporte del ciclo: solo lo que escribe quien lo emite. Horario, periodo, nivel y asistencia no se guardan porque salen del salón
// y cambian solos (guardarlos dejaría datos viejos).
const CAMPOS = ['idEstudiante', 'ranking', 'desempeno', 'estado', 'comentario', 'programa', 'siguiente']

// Lo que se guarda de lo escrito en el diálogo: campos de texto, informe por habilidad (sin textos vacíos) e idiomas elegidos.
export function borradorDe(v, idiomas) {
  const b = Object.fromEntries(CAMPOS.map((k) => [k, String(v[k] ?? '')]))
  b.habilidades = Object.fromEntries(
    Object.entries(v.habilidades ?? {})
      .map(([hab, s]) => [hab, Object.fromEntries(Object.entries(s ?? {}).filter(([, t]) => String(t ?? '').trim()))])
      .filter(([, s]) => Object.keys(s).length > 0),
  )
  b.idiomas = { idiomaPortada: idiomas?.idiomaPortada ?? 'en', idiomaHabilidades: idiomas?.idiomaHabilidades ?? 'es' }
  return b
}

// Aplica un borrador sobre los valores propuestos: lo guardado manda y lo que falte queda con la propuesta.
export function aplicarBorrador(base, borrador) {
  if (!borrador || typeof borrador !== 'object') return base
  const r = { ...base }
  for (const k of CAMPOS) if (typeof borrador[k] === 'string') r[k] = borrador[k]
  if (borrador.habilidades && typeof borrador.habilidades === 'object') r.habilidades = borrador.habilidades
  return r
}
