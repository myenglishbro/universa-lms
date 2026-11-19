// Seguimiento del alumno: habilidades del Formative por unidad (0–100 %), tendencia y comparación con el módulo anterior.
// Solo usa lo publicado que ya devuelve el informe del alumno: modulos[].evaluaciones[] con tipo 'formative' y notas[{ unidad, criterios: [{ criterio, puntaje, max }] }].

const UNIDADES = ['Unit 1', 'Unit 2', 'Unit 3']

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
    const unidades = [...UNIDADES]
    for (const n of notas) if (!unidades.includes(n.unidad)) unidades.push(n.unidad)
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
