export const TIPOS_COMPONENTE = [
  { value: 'test', label: 'Test' },
  { value: 'writing', label: 'Writing' },
  { value: 'project', label: 'Project' },
  { value: 'formative', label: 'Formative (con rúbrica, anterior)' },
  { value: 'participacion', label: 'Participación por clase' },
  { value: 'spark', label: 'SPARK' },
  { value: 'speaking', label: 'Speaking' },
  { value: 'otro', label: 'Otro' },
]
export const TIPOS_RUBRICA = [
  { value: 'speaking', label: 'Speaking' },
  { value: 'writing', label: 'Writing' },
  { value: 'project', label: 'Project' },
  { value: 'formative', label: 'Formative' },
  { value: 'otra', label: 'Otra' },
]
export const METODOS_CONSOLIDACION = [
  { value: 'sin_definir', label: 'Sin definir (pendiente de Coordinación)' },
  { value: 'suma_puntos', label: 'Suma de puntos de los módulos' },
  { value: 'promedio_modulos', label: 'Promedio ponderado de las notas de módulo' },
]
export const metodoLabel = (v) => METODOS_CONSOLIDACION.find((m) => m.value === v)?.label ?? v

// 84.1 → «84.1», 84 → «84», null → «—»
export const fmtNota = (n) => (n == null || n === '' ? '—' : String(Math.round(Number(n) * 100) / 100))

// Suma de pesos de una lista de componentes (con tolerancia de decimales).
export const sumaPesos = (componentes) => Math.round(componentes.reduce((s, c) => s + (Number(c.peso) || 0), 0) * 100) / 100

// Texto de lo que falta en un resultado parcial: «Writing, Formative Assessment (2 de 3 unidades)».
export function textoFaltan(faltan = []) {
  return faltan
    .map((f) => (f.estado === 'incompleto' ? `${f.nombre} (${f.unidades_publicadas} de ${f.unidades_total} unidades)` : f.nombre))
    .join(', ')
}

// Nota de una rúbrica a partir de lo que va marcando el docente: suma / máximos × 100. null hasta que esté completa.
export function notaRubrica(criterios, valores) {
  if (!criterios.length) return null
  let suma = 0
  let max = 0
  for (const c of criterios) {
    const v = valores?.[c.id]
    if (v === '' || v == null || Number.isNaN(Number(v))) return null
    suma += Number(v)
    max += Number(c.max_puntaje)
  }
  return Math.round((suma / max) * 10000) / 100
}

// Clave de una fila de notas: estudiante + unidad.
export const claveNota = (alumnoId, unidad = '') => `${alumnoId}|${unidad}`

// Módulos agrupados por ciclo, en orden; los módulos sin ciclo van al final en un grupo propio.
export function agruparPorCiclo(modulos = []) {
  const grupos = []
  for (const m of [...modulos].sort((a, b) => a.orden - b.orden)) {
    let g = grupos.find((x) => x.ciclo === (m.ciclo ?? null))
    if (!g) {
      g = { ciclo: m.ciclo ?? null, modulos: [] }
      grupos.push(g)
    }
    g.modulos.push(m)
  }
  return grupos.sort((a, b) => (a.ciclo ?? 1e9) - (b.ciclo ?? 1e9))
}

// Nota 0–100 sobre lo evaluado de un subtotal {puntos, escala_evaluada}. null si todavía no hay nada evaluado (nunca 0).
export const notaSobreEvaluado = (r) => (r && Number(r.escala_evaluada) > 0 ? Math.round((Number(r.puntos) / Number(r.escala_evaluada)) * 10000) / 100 : null)

// Qué mostrar en una celda de la matriz según su estado.
export const ESTADOS_CELDA = {
  publicada: { texto: 'Publicada', clase: 'bg-brand-100 text-brand-800' },
  borrador: { texto: 'Borrador', clase: 'bg-peach-50 text-peach-700' },
  listo: { texto: 'Lista para publicar', clase: 'bg-peach-50 text-peach-700' },
  parcial: { texto: 'Unidades incompletas', clase: 'bg-amber-50 text-amber-700' },
  en_curso: { texto: 'En curso', clase: 'bg-amber-50 text-amber-700' },
  sin_nota: { texto: 'Sin registrar', clase: 'bg-white text-slate-400' },
  sin_clases: { texto: 'Sin clases asignadas', clase: 'bg-slate-50 text-slate-400' },
}

// Texto corto de lo que contiene una celda: «80», «5/10 clases», «—».
export function textoCelda(c) {
  if (!c) return '—'
  if (c.tipo === 'participacion') {
    if (c.puntaje != null) return fmtNota(c.puntaje)
    return c.total > 0 && c.registradas > 0 ? `${c.registradas}/${c.total}` : '—'
  }
  if (c.puntaje != null) return fmtNota(c.puntaje)
  return c.unidades_registradas > 0 ? `${c.unidades_registradas}/${c.unidades_total}` : '—'
}
