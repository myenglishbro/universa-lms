// Reglas de presentación de matrículas. La validación real (cupos, duplicados) vive en Supabase; aquí solo se muestran cifras.

export const matriculasActivas = (matriculas, salonId) => matriculas.filter((m) => m.salon_id === salonId && m.estado === 'activa')
export const matriculasDeAlumno = (matriculas, alumnoId) => matriculas.filter((m) => m.alumno_id === alumnoId)

// Cupos de un salón: capacidad, ocupados (matrículas activas) y disponibles.
export function cuposSalon(salon, matriculas) {
  const ocupados = matriculasActivas(matriculas, salon.id).length
  const disponibles = Math.max(salon.capacidad - ocupados, 0)
  return { capacidad: salon.capacidad, ocupados, disponibles, lleno: disponibles === 0 }
}

const sinTildes = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
export const coincideTexto = (e, texto) => {
  const t = sinTildes(texto.trim())
  return !t || sinTildes(`${e.nombre} ${e.correo ?? ''} ${e.telefono ?? ''}`).includes(t)
}

// Estudiantes que se pueden matricular en un salón: activos y sin matrícula activa en él.
export const candidatosParaSalon = (estudiantes, matriculas, salonId, texto = '') => {
  const dentro = new Set(matriculasActivas(matriculas, salonId).map((m) => m.alumno_id))
  return estudiantes.filter((e) => e.activo !== false && !dentro.has(e.id) && coincideTexto(e, texto))
}

// Por qué un salón no ofrece más candidatos: «5 registrados: 2 ya matriculados aquí, 1 inactivo».
export function resumenCandidatos(estudiantes, matriculas, salonId) {
  const dentro = new Set(matriculasActivas(matriculas, salonId).map((m) => m.alumno_id))
  const ya = estudiantes.filter((e) => dentro.has(e.id)).length
  const inactivos = estudiantes.filter((e) => e.activo === false && !dentro.has(e.id)).length
  return `${estudiantes.length} registrados: ${ya} ya matriculados aquí, ${inactivos} inactivos`
}

export const SIN_MATRICULA = '__sin_matricula__'

// Salones a los que se puede trasladar una matrícula. No hay restricción por nivel, docente ni plan (no están definidas):
// solo se descartan el salón actual, los finalizados, aquellos donde ya está matriculado y los que no tienen cupos.
export function destinosCambio(matricula, salones, matriculas) {
  const yaEsta = new Set(matriculas.filter((m) => m.alumno_id === matricula.alumno_id && m.estado === 'activa').map((m) => m.salon_id))
  const elegibles = []
  const excluidos = { finalizados: 0, llenos: 0, yaMatriculado: 0 }
  for (const s of salones) {
    if (s.id === matricula.salon_id) continue
    if (s.estado === 'finalizado') excluidos.finalizados++
    else if (yaEsta.has(s.id)) excluidos.yaMatriculado++
    else {
      const c = cuposSalon(s, matriculas)
      if (c.lleno) excluidos.llenos++
      else elegibles.push({ salon: s, cupos: c })
    }
  }
  return { elegibles, excluidos, otros: salones.filter((s) => s.id !== matricula.salon_id).length }
}

export function motivoSinDestinos({ excluidos, otros }) {
  if (otros === 0) return 'No hay otros salones registrados.'
  const partes = []
  if (excluidos.finalizados) partes.push(`${excluidos.finalizados} finalizado${excluidos.finalizados === 1 ? '' : 's'}`)
  if (excluidos.llenos) partes.push(`${excluidos.llenos} sin cupos`)
  if (excluidos.yaMatriculado) partes.push(`${excluidos.yaMatriculado} donde ya está matriculado`)
  return `No hay salones disponibles para el traslado (${partes.join(', ')}). Un salón finalizado o lleno no admite traslados: aumenta su capacidad o cambia su estado desde «Editar».`
}
