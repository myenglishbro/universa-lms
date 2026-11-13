export const TIPOS_COMPONENTE = [
  { value: 'test', label: 'Test' },
  { value: 'writing', label: 'Writing' },
  { value: 'project', label: 'Project' },
  { value: 'formative', label: 'Formative (3 units × 5 criteria + participation)' },
  { value: 'participacion', label: 'Participation per class (standalone, legacy)' },
  { value: 'spark', label: 'SPARK' },
  { value: 'speaking', label: 'Speaking' },
  { value: 'otro', label: 'Other' },
]
export const TIPOS_RUBRICA = [
  { value: 'speaking', label: 'Speaking' },
  { value: 'writing', label: 'Writing' },
  { value: 'project', label: 'Project' },
  { value: 'formative', label: 'Formative' },
  { value: 'otra', label: 'Other' },
]
export const METODOS_CONSOLIDACION = [
  { value: 'sin_definir', label: 'Not defined (pending Coordination)' },
  { value: 'suma_puntos', label: 'Sum of module points' },
  { value: 'promedio_modulos', label: 'Weighted average of module grades' },
]
export const metodoLabel = (v) => METODOS_CONSOLIDACION.find((m) => m.value === v)?.label ?? v

// 84.1 → «84.1», 84 → «84», null → «—»
export const fmtNota = (n) => (n == null || n === '' ? '—' : String(Math.round(Number(n) * 100) / 100))

// Suma de pesos de una lista de componentes (con tolerancia de decimales).
export const sumaPesos = (componentes) => Math.round(componentes.reduce((s, c) => s + (Number(c.peso) || 0), 0) * 100) / 100

// Texto de lo que falta en un resultado parcial: «Writing, Formative Assessment (2 de 4 partes)».
export function textoFaltan(faltan = []) {
  return faltan
    .map((f) => (f.estado === 'incompleto' ? `${f.nombre} (${f.unidades_publicadas} of ${f.unidades_total} parts)` : f.nombre))
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

// Criterios agrupados para el formulario. Los criterios cuyo nombre empieza igual antes de « · » (p. ej. «Discourse Fluency & Pronunciation · Fluency» y
// «Discourse Fluency & Pronunciation · Pronunciation») forman un grupo con subtotal; el resto va suelto. Devuelve [{ grupo, items, max }].
export function agruparCriterios(criterios = []) {
  const prefijo = (c) => (String(c.nombre).includes(' · ') ? String(c.nombre).split(' · ')[0] : null)
  const cuenta = {}
  for (const c of criterios) if (prefijo(c)) cuenta[prefijo(c)] = (cuenta[prefijo(c)] ?? 0) + 1
  const grupos = []
  for (const c of criterios) {
    const g = prefijo(c) && cuenta[prefijo(c)] > 1 ? prefijo(c) : null
    const ultimo = grupos[grupos.length - 1]
    if (g && ultimo?.grupo === g) ultimo.items.push(c)
    else grupos.push({ grupo: g, items: [c] })
  }
  return grupos.map((x) => ({ ...x, max: x.items.reduce((s, c) => s + Number(c.max_puntaje), 0) }))
}

// Nombre corto de un criterio dentro de su grupo: «Discourse Fluency & Pronunciation · Fluency» → «Fluency».
export const nombreEnGrupo = (c, grupo) => (grupo && String(c.nombre).startsWith(`${grupo} · `) ? String(c.nombre).slice(grupo.length + 3) : c.nombre)

// Subtotal de un grupo de criterios con lo escrito hasta ahora: { suma, max, completo }.
export const subtotalGrupo = (items, valores) => totalCriterios(items, valores)

// Nivel de desempeño (banda) que corresponde a un valor: null si no hay bandas con rango o el valor está vacío.
export function bandaDe(criterio, valor) {
  if (valor === '' || valor == null || Number.isNaN(Number(valor))) return null
  const v = Number(valor)
  // Los rangos pueden dejar huecos entre decimales (p. ej. 0–4 y 5–7 con 4.5): gana la banda más alta cuyo inicio no supere el valor.
  const candidatas = (criterio.bandas ?? []).filter((b) => b.desde != null && b.hasta != null && v >= Number(b.desde))
  return candidatas.sort((a, b) => Number(b.desde) - Number(a.desde))[0] ?? null
}

// Adapta un descriptor al nivel MCER del salón: «the student's CEFR level» → «the A2.2 – B1.1 level». Sin nivel, el texto queda igual.
export function adaptarNivel(texto, mcer) {
  if (!texto || !mcer) return texto ?? ''
  return String(texto).replace(/the student[’']s (CEFR )?level/gi, `the ${mcer} level`).replace(/the student[’']s CEFR/gi, `the ${mcer}`)
}

// Mantiene lo escrito en un criterio dentro de 0 y su máximo (vacío sigue vacío: pendiente, nunca cero automático).
export function acotarPuntaje(texto, max) {
  if (texto === '' || texto == null) return ''
  const n = Number(texto)
  if (Number.isNaN(n)) return ''
  if (n < 0) return '0'
  if (n > Number(max)) return String(Number(max))
  return String(texto)
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
  publicada: { texto: 'Published', clase: 'bg-brand-100 text-brand-800' },
  borrador: { texto: 'Draft', clase: 'bg-peach-50 text-peach-700' },
  listo: { texto: 'Ready to publish', clase: 'bg-peach-50 text-peach-700' },
  parcial: { texto: 'Incomplete units', clase: 'bg-amber-50 text-amber-700' },
  en_curso: { texto: 'In progress', clase: 'bg-amber-50 text-amber-700' },
  sin_nota: { texto: 'Not recorded', clase: 'bg-white text-slate-400' },
  sin_clases: { texto: 'No classes assigned', clase: 'bg-slate-50 text-slate-400' },
}

// Nota de una unidad del Formative a partir de sus criterios: suma de los 5 criterios y su máximo (p. ej. 85 de 100).
export function totalCriterios(criterios, valores) {
  let suma = 0
  let max = 0
  let completo = criterios.length > 0
  for (const c of criterios) {
    const v = valores?.[c.id]
    max += Number(c.max_puntaje)
    if (v === '' || v == null || Number.isNaN(Number(v))) completo = false
    else suma += Number(v)
  }
  return { suma: Math.round(suma * 100) / 100, max, completo }
}

// Etiqueta de la fila de unidad vacía: en el Formative es la participación por clase.
export const etiquetaUnidad = (unidad, tipo) => unidad || (tipo === 'formative' ? 'Participation' : '')

// Texto corto de lo que contiene una celda: «80», «5/10 clases», «—».
export function textoCelda(c) {
  if (!c) return '—'
  if (c.tipo === 'formative') return c.puntaje != null ? fmtNota(c.puntaje) : '—'
  if (c.tipo === 'participacion') {
    if (c.puntaje != null) return fmtNota(c.puntaje)
    return c.total > 0 && c.registradas > 0 ? `${c.registradas}/${c.total}` : '—'
  }
  if (c.puntaje != null) return fmtNota(c.puntaje)
  return c.unidades_registradas > 0 ? `${c.unidades_registradas}/${c.unidades_total}` : '—'
}
