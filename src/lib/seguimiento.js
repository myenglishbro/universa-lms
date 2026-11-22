// Seguimiento del alumno: habilidades del Formative por unidad (0–100 %), tendencia y comparación con el módulo anterior.
// Solo usa lo publicado que ya devuelve el informe del alumno: modulos[].evaluaciones[] con tipo 'formative' y notas[{ unidad, criterios: [{ criterio, puntaje, max }] }].

// Las 3 unidades de un módulo: las que trae la evaluación o, si no vienen, el bloque de 3 al que pertenecen las notas
// (módulo 1 = Unit 1-3, módulo 2 = Unit 4-6…). Se suman las unidades extra que aparezcan en las notas.
export function unidadesDelModulo(e, notas = []) {
  const num = (u) => Number(String(u).match(/(\d+)$/)?.[1])
  let base = Array.isArray(e?.unidades) && e.unidades.length ? [...e.unidades] : null
  if (!base) {
    const nums = notas.map((n) => num(n.unidad)).filter((n) => Number.isFinite(n))
    const ini = nums.length ? Math.floor((Math.min(...nums) - 1) / 3) * 3 + 1 : 1
    base = [`Unit ${ini}`, `Unit ${ini + 1}`, `Unit ${ini + 2}`]
  }
  for (const n of notas) if (n.unidad && !base.includes(n.unidad)) base.push(n.unidad)
  return base
}

// Clave para emparejar la misma habilidad entre módulos con rúbricas distintas («Listening / Lessons» y «Listening» son la misma).
export const claveHabilidad = (nombre) => String(nombre ?? '').split('/')[0].trim().toLowerCase()

const pct = (c) => (c && Number(c.max) > 0 && c.puntaje != null ? Math.round((Number(c.puntaje) / Number(c.max)) * 1000) / 10 : null)
const promedio = (v) => {
  const x = v.filter((n) => n != null)
  return x.length ? Math.round((x.reduce((s, n) => s + n, 0) / x.length) * 10) / 10 : null
}

// Estado de una habilidad según sus notas publicadas (null = pendiente): bajo 50 % → atención; ±8 puntos desde la primera nota → sube / baja.
export function tendencia(valores) {
  const p = valores.filter((v) => v != null)
  if (p.length === 0) return { estado: 'sin_nota', delta: null }
  const ultimo = p[p.length - 1]
  const delta = p.length > 1 ? Math.round(ultimo - p[0]) : null
  if (ultimo < 50) return { estado: 'atencion', delta }
  if (delta == null) return { estado: 'primera', delta }
  if (delta >= 8) return { estado: 'mejora', delta }
  if (delta <= -8) return { estado: 'baja', delta }
  return { estado: 'estable', delta }
}

// Módulos con alguna nota de Formative por habilidad, en el orden del informe. Cada uno: unidades y habilidades con su % por unidad (null = sin publicar).
export function seguimientoFormative(modulos = []) {
  const out = []
  for (const m of modulos) {
    const e = (m.evaluaciones ?? []).find((x) => x.tipo === 'formative')
    const notas = (e?.notas ?? []).filter((n) => n.unidad && Array.isArray(n.criterios) && n.criterios.length > 0)
    if (!notas.length) continue
    const unidades = unidadesDelModulo(e, notas)
    const nombres = []
    for (const n of notas) for (const c of n.criterios) if (!nombres.includes(c.criterio)) nombres.push(c.criterio)
    const habilidades = nombres.map((nombre) => {
      const valores = unidades.map((u) => pct(notas.find((n) => n.unidad === u)?.criterios.find((c) => c.criterio === nombre)))
      const publicados = valores.filter((v) => v != null)
      return { nombre, clave: claveHabilidad(nombre), valores, ultimo: publicados.length ? publicados[publicados.length - 1] : null, promedio: promedio(valores), ...tendencia(valores) }
    })
    out.push({ id: m.modulo_id, nombre: m.nombre, unidades, habilidades })
  }
  return out
}

// Promedio del módulo anterior por habilidad (por clave); {} si no hay uno anterior con notas.
export function promedioAnterior(seguimiento, indice) {
  const prev = seguimiento[indice - 1]
  return prev ? Object.fromEntries(prev.habilidades.filter((h) => h.promedio != null).map((h) => [h.clave, h.promedio])) : {}
}

// ---- Detalle de Writing y Project (criterios 0–5 de las rúbricas por niveles) ----
// Etiqueta corta de un criterio: sin prefijo de tarea («Task 1 · ») ni de grupo («Grammar & Vocabulary · »).
export const nombreCriterio = (nombre) => String(nombre ?? '').replace(/^Task \d · /, '').split(' · ').pop()

// Por módulo: Writing (Task 1 + Task 2 sumadas por criterio) y Project, cada criterio como % de su máximo. Solo notas publicadas con detalle.
export function seguimientoDetalle(modulos = []) {
  const unir = (notas) => {
    const acc = new Map()
    for (const n of notas) for (const c of n.criterios ?? []) {
      const k = nombreCriterio(c.criterio)
      const a = acc.get(k) ?? { nombre: k, puntaje: 0, max: 0 }
      a.puntaje += Number(c.puntaje)
      a.max += Number(c.max)
      acc.set(k, a)
    }
    return [...acc.values()].filter((a) => a.max > 0).map((a) => ({ nombre: a.nombre, clave: a.nombre.toLowerCase(), pct: Math.round((a.puntaje / a.max) * 1000) / 10 }))
  }
  const out = []
  for (const m of modulos) {
    const de = (tipo) => unir((m.evaluaciones ?? []).filter((e) => e.tipo === tipo).flatMap((e) => e.notas ?? []))
    const writing = de('writing')
    const project = de('project')
    if (writing.length || project.length) out.push({ id: m.modulo_id, nombre: m.nombre, writing, project })
  }
  return out
}

// Nivel 0–5 que corresponde a un porcentaje (nivel ÷ 5 × peso = puntos).
export const nivelDePct = (pct) => Math.max(0, Math.min(5, Math.round((Number(pct) / 100) * 5)))
