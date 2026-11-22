// Encuesta de experiencia de clase: preguntas Likert (1 a 5) y comparación entre docentes.
export const PREGUNTAS = [
  { id: 'claridad', label: 'The teacher explained things clearly', corta: 'Clarity' },
  { id: 'participacion', label: 'I had enough chances to speak and practice', corta: 'Participation' },
  { id: 'ritmo', label: 'The pace and difficulty were right for me', corta: 'Pace' },
  { id: 'general', label: 'I would recommend this teacher’s class', corta: 'Overall' },
]
export const ESCALA = [
  { valor: 1, texto: 'Strongly disagree' },
  { valor: 2, texto: 'Disagree' },
  { valor: 3, texto: 'Neutral' },
  { valor: 4, texto: 'Agree' },
  { valor: 5, texto: 'Strongly agree' },
]

const MIN_RESPUESTAS = 5 // con menos respuestas, el promedio de un docente todavía no es confiable
const UMBRAL = 0.3 // diferencia contra el equipo para marcar a alguien por encima o por debajo
const ALERTA = 3.5 // por debajo de este promedio siempre se marca «watch»

const num = (v) => (v == null ? null : Number(v))
const redondear = (x) => Math.round(x * 100) / 100

// Nota del docente: promedio de sus cuatro preguntas (null si no hay respuestas).
export function notaDe(fila) {
  const v = PREGUNTAS.map((p) => num(fila?.[p.id])).filter((x) => x != null && !Number.isNaN(x))
  return v.length ? redondear(v.reduce((a, b) => a + b, 0) / v.length) : null
}

// Cada docente con su nota, la diferencia contra el equipo y una etiqueta:
// 'poco' (pocas respuestas) · 'destacado' (por encima del equipo) · 'normal' · 'atencion' (por debajo del equipo o bajo 3.5).
export function compararDocentes(docentes = [], equipo = null) {
  const base = notaDe(equipo)
  return docentes
    .map((d) => {
      const nota = notaDe(d)
      const delta = nota != null && base != null ? redondear(nota - base) : null
      let etiqueta = 'normal'
      if (d.n < MIN_RESPUESTAS || nota == null) etiqueta = 'poco'
      else if (nota < ALERTA || (delta != null && delta <= -UMBRAL)) etiqueta = 'atencion'
      else if (delta != null && delta >= UMBRAL) etiqueta = 'destacado'
      return { ...d, nota, delta, etiqueta }
    })
    .sort((a, b) => (b.nota ?? -1) - (a.nota ?? -1))
}

export const MIN_RESPUESTAS_CONFIABLES = MIN_RESPUESTAS

// ---- Mes a mes ----
const MIN_MES = 3 // en un mes hay menos respuestas: con 3 ya se muestra, con menos se marca «pocas»
const MESES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
export const nombreMes = (mes) => `${MESES[Number(mes.slice(5, 7)) - 1] ?? mes.slice(5, 7)} ${mes.slice(0, 4)}`

// Parte de quienes asistieron que respondió (0 a 1; null si no hay asistentes).
export const tasaRespuesta = (d) => (d?.asistentes > 0 ? Math.min(1, d.n / d.asistentes) : null)

// Estado de una nota frente al equipo: 'poco' · 'destacado' · 'normal' · 'atencion'.
function estadoCelda(n, nota, delta) {
  if (n < MIN_MES || nota == null) return 'poco'
  if (nota < ALERTA || (delta != null && delta <= -UMBRAL)) return 'atencion'
  if (delta != null && delta >= UMBRAL) return 'destacado'
  return 'normal'
}

// Matriz docente × mes: la nota de cada docente en cada mes, la diferencia con el equipo ESE mes y con su propio mes anterior.
// `mensual` = { docentes: [{ docente_id, docente, mes, n, claridad… }], equipo: [{ mes, n, claridad… }] } (lo que devuelve la base).
export function matrizMensual(mensual) {
  const docentes = mensual?.docentes ?? []
  const equipo = mensual?.equipo ?? []
  const meses = [...new Set([...docentes.map((d) => d.mes), ...equipo.map((e) => e.mes)])].sort()
  const equipoPorMes = Object.fromEntries(equipo.map((e) => [e.mes, { ...e, nota: notaDe(e) }]))
  const ids = [...new Map(docentes.map((d) => [d.docente_id ?? 'sin', d.docente])).entries()]
  const filas = ids
    .map(([id, nombre]) => {
      let anterior = null
      const celdas = meses.map((mes) => {
        const f = docentes.find((d) => (d.docente_id ?? 'sin') === id && d.mes === mes)
        if (!f) return { mes, n: 0, nota: null, deltaEquipo: null, deltaMes: null, estado: 'sin' }
        const nota = notaDe(f)
        const base = equipoPorMes[mes]?.nota
        const deltaEquipo = nota != null && base != null ? redondear(nota - base) : null
        const deltaMes = nota != null && anterior != null ? redondear(nota - anterior) : null
        if (f.n >= MIN_MES && nota != null) anterior = nota
        return { mes, n: f.n, nota, deltaEquipo, deltaMes, estado: estadoCelda(f.n, nota, deltaEquipo) }
      })
      return { docente_id: id === 'sin' ? null : id, docente: nombre, celdas }
    })
    .sort((a, b) => a.docente.localeCompare(b.docente))
  return { meses, filas, equipo: meses.map((mes) => ({ mes, n: equipoPorMes[mes]?.n ?? 0, nota: equipoPorMes[mes]?.nota ?? null })) }
}
