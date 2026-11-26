// Mapa del currículo Universa, usado para clasificar los ejercicios del banco.
//
//  * 7 niveles de 120 horas. Cada nivel tiene 2 ciclos (el Funcional tiene un solo ciclo, el 0, que contiene los 4 módulos).
//  * Cada nivel tiene 4 módulos y 12 unidades, con la misma numeración en todos los niveles:
//      Módulo 1 = unidades 1 a 3, Módulo 2 = 4 a 6, Módulo 3 = 7 a 9, Módulo 4 = 10 a 12.
//      Primer ciclo del nivel = módulos 1 y 2; segundo ciclo = módulos 3 y 4.
//    Ejemplo (Básico): ciclo 1 → módulo 1 (u. 1-3) y módulo 2 (u. 4-6); ciclo 2 → módulo 3 (u. 7-9) y módulo 4 (u. 10-12).
//  * Por eso un ejercicio solo necesita nivel + unidad: ciclo, módulo y MCER se deducen.
//  * Cada nivel usa un libro. Si cambia un libro, se cambia aquí (un único lugar).
import { NIVELES_RUTA } from './rutaAprendizaje.js'

export const UNIDADES_POR_MODULO = 3
export const MODULOS_POR_NIVEL = 4

// Libro de cada nivel (id de NIVELES_RUTA). null = aún sin definir.
const LIBROS = {
  functional: 'World English Intro',
  basic: 'World English 1',
  intermediate: 'World English 2',
  upper: 'World English 3',
  advanced: 'Keynote 1',
  proficient: 'Keynote 2',
  master: null,
}

// [{ id, nombre, ciclos: [1, 2], mcer: ['A1.2', 'A2.1'], libro }]
export const PROGRAMA = NIVELES_RUTA.map((n) => ({
  id: n.id,
  nombre: n.nombre,
  ciclos: n.ciclos[0] === n.ciclos[1] ? [n.ciclos[0]] : [...n.ciclos],
  mcer: n.mcer.split(/\s*–\s*/),
  libro: LIBROS[n.id] ?? null,
}))

export const nivelPrograma = (id) => PROGRAMA.find((n) => n.id === id) ?? null
export const nivelDeCiclo = (ciclo) => (ciclo === null || ciclo === undefined || ciclo === '' ? null : (PROGRAMA.find((n) => n.ciclos.includes(Number(ciclo))) ?? null))
export const cicloTexto = (n) => (n.ciclos.length === 1 ? `Cycle ${n.ciclos[0]}` : `Cycles ${n.ciclos[0]}–${n.ciclos[1]}`)

// Módulo (1 a 4) al que pertenece una unidad (1 a 12).
export const moduloDeUnidad = (unidad) => Math.ceil(Number(unidad) / UNIDADES_POR_MODULO)
// Unidades de un módulo: moduloDeUnidad(2) → [4, 5, 6].
export const unidadesDeModulo = (modulo) => Array.from({ length: UNIDADES_POR_MODULO }, (_, i) => (modulo - 1) * UNIDADES_POR_MODULO + i + 1)

// Nivel + unidad → { ciclo, modulo, unidad, mcer, libro, nivel }. null si falta algo o la unidad no es del 1 al 12.
export function ubicar(nivelId, unidad) {
  const nivel = nivelPrograma(nivelId)
  const u = Number(unidad)
  if (!nivel || !Number.isInteger(u) || u < 1 || u > UNIDADES_POR_MODULO * MODULOS_POR_NIVEL) return null
  const modulo = moduloDeUnidad(u)
  const idx = nivel.ciclos.length === 1 ? 0 : modulo <= 2 ? 0 : 1
  return { ciclo: nivel.ciclos[idx], modulo, unidad: u, mcer: nivel.mcer[Math.min(idx, nivel.mcer.length - 1)], libro: nivel.libro, nivel }
}

// «World English 1 · p. 52»: de dónde sale el ejercicio (libro del nivel + referencia que escribe administración).
export const fuenteTexto = (e) => [nivelDeCiclo(e.ciclo)?.libro ?? '', String(e.fuente ?? '').trim()].filter(Boolean).join(' · ')

// Números de módulo que le tocan a un ciclo (igual que curriculo_modulos_permitidos en SQL):
// ciclo 0 = 1 a 4, ciclo impar (primero del nivel) = 1 y 2, ciclo par (segundo del nivel) = 3 y 4. Sin ciclo = 1 a 4.
export function modulosPermitidos(ciclo) {
  if (ciclo === null || ciclo === undefined || ciclo === '' || Number(ciclo) === 0) return [1, 2, 3, 4]
  return Number(ciclo) % 2 === 1 ? [1, 2] : [3, 4]
}

// Unidades de un módulo con el nombre que usa el Formative: módulo 2 → ['Unit 4', 'Unit 5', 'Unit 6'].
export const nombresUnidadesDeModulo = (modulo) => unidadesDeModulo(modulo).map((u) => `Unit ${u}`)

// Revisa los módulos de un salón: [{ orden, ciclo }] → lista de problemas en texto (vacía = cumple la estructura).
// `ciclos` = ciclos del salón (p. ej. [1, 2] o [0]); se espera el juego completo de módulos de cada ciclo.
export function revisarModulos(ciclos, modulos) {
  const problemas = []
  const vistos = new Set()
  for (const m of modulos) {
    if (!modulosPermitidos(m.ciclo).includes(Number(m.orden))) problemas.push(`El módulo ${m.orden} no corresponde al ciclo ${m.ciclo ?? '(sin ciclo)'}`)
    if (vistos.has(Number(m.orden))) problemas.push(`El módulo ${m.orden} está repetido`)
    vistos.add(Number(m.orden))
  }
  for (const c of ciclos) {
    const esperados = c === 0 ? [1, 2, 3, 4] : modulosPermitidos(c)
    const faltan = esperados.filter((n) => !vistos.has(n))
    if (faltan.length) problemas.push(`Al ciclo ${c} le faltan los módulos ${faltan.join(' y ')}`)
  }
  return problemas
}
