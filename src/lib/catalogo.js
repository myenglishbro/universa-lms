// Helpers del catálogo académico. NO contienen reglas académicas: solo filtran, agrupan y suman los datos que
// entrega Supabase (planes y cuotas por ciclo). La base de datos valida y recalcula todo al guardar el salón.
//
// Forma de un plan (ver services/catalogo.js):
// { id, nivelCodigo, nivel, nivelOrden, modalidadCodigo, modalidad, minutos, sesionesSemana, tipoAlumno,
//   totalSesiones, horasTotales, semanas, vigente, estadoDato, aprobado, ciclos: [{ ciclo, sesiones, horas }] }

export const tipoAlumnoLabel = { nuevo: 'Alumno nuevo', continuo: 'Alumno continuo' }

export const claveHorario = (p) => `${p.minutos}-${p.sesionesSemana}`
export const etiquetaHorario = (p) => `${p.minutos} min · ${p.sesionesSemana} ${p.sesionesSemana === 1 ? 'clase' : 'clases'} por semana`

const unicos = (lista, clave) => [...new Map(lista.map((x) => [clave(x), x])).values()]

export const modalidadesDe = (planes) =>
  unicos(planes, (p) => p.modalidadCodigo)
    .map((p) => ({ value: p.modalidadCodigo, label: p.modalidad }))
    .sort((a, b) => a.label.localeCompare(b.label))

export const nivelesDe = (planes, modalidad) =>
  unicos(
    planes.filter((p) => p.modalidadCodigo === modalidad),
    (p) => p.nivelCodigo,
  )
    .sort((a, b) => a.nivelOrden - b.nivelOrden)
    .map((p) => ({ value: p.nivelCodigo, label: p.nivel }))

export const horariosDe = (planes, modalidad, nivel) =>
  unicos(
    planes.filter((p) => p.modalidadCodigo === modalidad && p.nivelCodigo === nivel),
    claveHorario,
  )
    .sort((a, b) => a.minutos - b.minutos)
    .map((p) => ({ value: claveHorario(p), label: etiquetaHorario(p) }))

const candidatos = (planes, { modalidad, nivel, horario }) =>
  planes.filter((p) => p.modalidadCodigo === modalidad && p.nivelCodigo === nivel && claveHorario(p) === horario)

// Tipos de alumno entre los que hay que elegir (solo cuando el catálogo distingue alumno nuevo y continuo).
export const tiposAlumnoDe = (planes, sel) => {
  const c = candidatos(planes, sel)
  return c.length > 1 ? c.map((p) => ({ value: p.tipoAlumno, label: tipoAlumnoLabel[p.tipoAlumno] ?? p.tipoAlumno })) : []
}

// Plan que corresponde a la selección, o null si falta algún dato.
export function resolverPlan(planes, sel) {
  const c = candidatos(planes, sel)
  if (c.length === 1) return c[0]
  return c.find((p) => p.tipoAlumno === sel.tipo) ?? null
}

// Selección (modalidad, nivel, horario, tipo) que describe a un plan existente.
export const seleccionDe = (plan) =>
  plan
    ? {
        modalidad: plan.modalidadCodigo,
        nivel: plan.nivelCodigo,
        horario: claveHorario(plan),
        tipo: plan.tipoAlumno === 'nuevo' || plan.tipoAlumno === 'continuo' ? plan.tipoAlumno : '',
      }
    : { modalidad: '', nivel: '', horario: '', tipo: '' }

// Completa lo que solo tiene una opción posible (un único nivel, horario o tipo) para ahorrar clics.
export function normalizarSeleccion(planes, sel) {
  const s = { ...sel }
  const niveles = s.modalidad ? nivelesDe(planes, s.modalidad) : []
  if (!niveles.some((n) => n.value === s.nivel)) s.nivel = niveles.length === 1 ? niveles[0].value : ''
  const horarios = s.nivel ? horariosDe(planes, s.modalidad, s.nivel) : []
  if (!horarios.some((h) => h.value === s.horario)) s.horario = horarios.length === 1 ? horarios[0].value : ''
  const tipos = s.horario ? tiposAlumnoDe(planes, s) : []
  if (!tipos.some((t) => t.value === s.tipo)) s.tipo = ''
  return s
}

export const textoCiclos = (desde, hasta) => (desde === hasta ? `Ciclo ${desde}` : `Ciclos ${desde}–${hasta}`)

// Opciones de ciclos: nivel completo o cada ciclo por separado. value = "desde-hasta".
export function opcionesCiclos(plan) {
  const n = plan.ciclos.map((c) => c.ciclo)
  if (n.length <= 1) return [{ value: `${n[0]}-${n[0]}`, label: `Ciclo único (${n[0]})` }]
  return [
    { value: `${n[0]}-${n[n.length - 1]}`, label: `Nivel completo · ${textoCiclos(n[0], n[n.length - 1]).toLowerCase()}` },
    ...n.map((c) => ({ value: `${c}-${c}`, label: `Solo ciclo ${c}` })),
  ]
}

export const rangoPorDefecto = (plan) => {
  const n = plan.ciclos.map((c) => c.ciclo)
  return { cicloDesde: n[0], cicloHasta: n[n.length - 1] }
}

// Sesiones, horas y semanas lectivas de los ciclos elegidos (suma de las cuotas del catálogo).
// Las semanas son un estimado (sesiones / clases por semana, redondeado hacia arriba): no incluyen feriados ni receso.
export function cuota(plan, desde, hasta) {
  const filas = plan.ciclos.filter((c) => c.ciclo >= desde && c.ciclo <= hasta)
  const sesiones = filas.reduce((t, c) => t + c.sesiones, 0)
  const horas = Math.round(filas.reduce((t, c) => t + c.horas, 0) * 10) / 10
  return { sesiones, horas, semanas: Math.ceil(sesiones / plan.sesionesSemana) }
}

export const formatHoras = (h) => h.toLocaleString('es-PE', { minimumFractionDigits: 1, maximumFractionDigits: 1 })

export const descripcionPlan = (p) =>
  [p.nivel, p.modalidad, `${p.minutos} min`, tipoAlumnoLabel[p.tipoAlumno]].filter(Boolean).join(' · ')
