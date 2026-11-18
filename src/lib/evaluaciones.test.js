import test from 'node:test'
import assert from 'node:assert/strict'
import { acotarPuntaje, adaptarNivel, agruparCriterios, bandaDe, nombreEnGrupo, notaRubrica, subtotalGrupo, totalCriterios } from './evaluaciones.js'

const G = 'Discourse Fluency & Pronunciation'
const project = [
  { id: 'a', nombre: 'Visual Material & Non-Verbal Skills', max_puntaje: 10 },
  { id: 'b', nombre: 'Grammar Accuracy & Target Structures', max_puntaje: 20 },
  { id: 'c', nombre: 'Vocabulary Range & Resource', max_puntaje: 20 },
  { id: 'd', nombre: `${G} · Fluency`, max_puntaje: 15 },
  { id: 'e', nombre: `${G} · Pronunciation`, max_puntaje: 10 },
  { id: 'f', nombre: 'Interaction & Communicative Effectiveness', max_puntaje: 25 },
]

test('Project: cinco criterios principales con máximos 10, 20, 20, 25 y 25', () => {
  const g = agruparCriterios(project)
  assert.equal(g.length, 5)
  assert.deepEqual(g.map((x) => x.max), [10, 20, 20, 25, 25])
  assert.equal(g.reduce((s, x) => s + x.max, 0), 100)
})

test('Fluency (15) y Pronunciation (10) forman un grupo de 25 con subtotal', () => {
  const g = agruparCriterios(project)[3]
  assert.equal(g.grupo, G)
  assert.deepEqual(g.items.map((c) => nombreEnGrupo(c, g.grupo)), ['Fluency', 'Pronunciation'])
  assert.deepEqual(subtotalGrupo(g.items, { d: '12', e: '8.5' }), { suma: 20.5, max: 25, completo: true })
  assert.equal(subtotalGrupo(g.items, { d: '12', e: '' }).completo, false)
})

test('un prefijo que no se repite no forma grupo', () => {
  const g = agruparCriterios([{ id: '1', nombre: 'Oral · Elocution', max_puntaje: 10 }, { id: '2', nombre: 'Content', max_puntaje: 10 }])
  assert.deepEqual(g.map((x) => x.grupo), [null, null])
})

test('nota: completa suma ÷ 100; incompleta no es cero sino null; el máximo da 100', () => {
  const todo = { a: 10, b: 20, c: 20, d: 15, e: 10, f: 25 }
  assert.equal(notaRubrica(project, todo), 100)
  assert.equal(notaRubrica(project, { ...todo, f: '' }), null)
  assert.equal(totalCriterios(project, { a: 5, b: 10 }).completo, false)
  assert.equal(notaRubrica(project, { a: 5, b: 10, c: 10, d: 7.5, e: 5, f: 12.5 }), 50)
})

test('acotarPuntaje: sin negativos ni por encima del máximo; vacío sigue vacío', () => {
  assert.equal(acotarPuntaje('', 10), '')
  assert.equal(acotarPuntaje('-3', 10), '0')
  assert.equal(acotarPuntaje('11', 10), '10')
  assert.equal(acotarPuntaje('7.5', 10), '7.5')
})

test('bandaDe: nivel de desempeño según el valor', () => {
  const c = { max_puntaje: 10, bandas: [{ etiqueta: 'Excellent', desde: 9, hasta: 10 }, { etiqueta: 'Good', desde: 7, hasta: 8.5 }] }
  assert.equal(bandaDe(c, '9.5').etiqueta, 'Excellent')
  assert.equal(bandaDe(c, 8).etiqueta, 'Good')
  assert.equal(bandaDe(c, ''), null)
  assert.equal(bandaDe({ bandas: [{ etiqueta: 'Bajo' }] }, 3), null)
})

test('bandaDe: valores intermedios (4.5) caen en la banda inferior; 0–máx cubre todo', () => {
  const c = { bandas: [{ etiqueta: 'Low', desde: 0, hasta: 4 }, { etiqueta: 'Fair', desde: 5, hasta: 7 }, { etiqueta: 'Excellent', desde: 8, hasta: 10 }] }
  assert.equal(bandaDe(c, 0).etiqueta, 'Low')
  assert.equal(bandaDe(c, 4.5).etiqueta, 'Low')
  assert.equal(bandaDe(c, 7).etiqueta, 'Fair')
  assert.equal(bandaDe(c, 10).etiqueta, 'Excellent')
})

test('adaptarNivel: sustituye el nivel MCER del estudiante por el del salón; sin nivel no cambia', () => {
  const t = "Uses grammar appropriate to the student's CEFR level."
  assert.equal(adaptarNivel(t, 'A2.2 – B1.1'), 'Uses grammar appropriate to the A2.2 – B1.1 level.')
  assert.equal(adaptarNivel(t, null), t)
  assert.equal(adaptarNivel(null, 'A1'), '')
})

test('Fluency 15 + Pronunciation 10 = subtotal 25 y pendiente no cuenta como cero', () => {
  const g = agruparCriterios([
    { id: 'd', nombre: 'Discourse Fluency & Pronunciation · Fluency', max_puntaje: 15 },
    { id: 'e', nombre: 'Discourse Fluency & Pronunciation · Pronunciation', max_puntaje: 10 },
  ])[0]
  assert.equal(g.max, 25)
  const s = subtotalGrupo(g.items, { d: '12', e: '8' })
  assert.equal(s.suma, 20)
  assert.equal(s.completo, true)
  assert.equal(subtotalGrupo(g.items, { d: '12', e: '' }).completo, false)
})

// ---- Niveles 0–5, Writing por tareas y nota oficial ----
import { clasificarNota, criteriosDeUnidad, esPorNiveles, nivelDePuntaje, pesoUnidad, puntajeDeNivel, totalPorTareas, expectativasMcer } from './evaluaciones.js'

const bandas6 = [0, 1, 2, 3, 4, 5].map((n) => ({ nivel: n, etiqueta: `N${n}`, descripcion: `d${n}` }))
const W = (t, n, max, id) => ({ id, nombre: `Task ${t} · ${n}`, max_puntaje: max, bandas: bandas6 })
const writing = [
  W(1, 'Content', 14, 'a1'), W(1, 'Org', 7, 'b1'), W(1, 'Lang', 11, 'c1'), W(1, 'Mech', 3, 'd1'),
  W(2, 'Content', 23, 'a2'), W(2, 'Org', 13, 'b2'), W(2, 'Lang', 23, 'c2'), W(2, 'Mech', 6, 'd2'),
]
const todos = (t, n) => Object.fromEntries(writing.filter((c) => c.nombre.startsWith(`Task ${t}`)).map((c) => [c.id, puntajeDeNivel(c, n)]))

test('niveles: puntos = nivel/5 × peso y viaje de ida y vuelta', () => {
  const c = writing[0]
  assert.equal(esPorNiveles(c), true)
  assert.equal(puntajeDeNivel(c, 3), '8.4')
  assert.equal(nivelDePuntaje(c, '8.4'), 3)
  assert.equal(nivelDePuntaje(c, '8'), null)
  assert.equal(nivelDePuntaje(c, ''), null)
  assert.equal(nivelDePuntaje(writing[3], puntajeDeNivel(writing[3], 5)), 5)
})

test('Writing: Task 1 pesa 35 y Task 2 pesa 65; criterios por tarea', () => {
  assert.equal(pesoUnidad(writing, 'Task 1'), 35)
  assert.equal(pesoUnidad(writing, 'Task 2'), 65)
  assert.equal(criteriosDeUnidad(writing, 'Task 2').length, 4)
})

test('Writing: suma de puntos (no promedio 50/50) y sin total si falta una tarea', () => {
  const r = totalPorTareas(writing, ['Task 1', 'Task 2'], { ...todos(1, 5), ...todos(2, 3) })
  assert.equal(r.puntos, 35 + 39)
  assert.equal(r.nota, 74)
  assert.equal(r.completo, true)
  const sin = totalPorTareas(writing, ['Task 1', 'Task 2'], todos(1, 5))
  assert.equal(sin.completo, false)
  assert.equal(sin.puntos, null)
  assert.equal(sin.nota, null)
  assert.equal(sin.tareas[0].puntos, 35)
})

test('nota oficial: un solo redondeo y tramos 60/70/85', () => {
  const f = (n) => clasificarNota(n)
  assert.equal(f(59.49).oficial, 59); assert.equal(f(59.49).resultado, 'desaprobo')
  assert.equal(f(59.5).oficial, 60); assert.equal(f(59.5).resultado, 'reforzamiento')
  assert.equal(f(69.49).resultado, 'reforzamiento')
  assert.equal(f(69.5).resultado, 'aprobo')
  assert.equal(f(84.49).resultado, 'aprobo')
  assert.equal(f(84.5).resultado, 'excelencia')
  assert.equal(f(100).oficial, 100)
  assert.equal(f(null), null)
})

test('Grade Chart 28/24/28/20 y pendiente no es cero', () => {
  const nota = (t, w, p, f) => t * 0.28 + w * 0.24 + p * 0.28 + f * 0.2
  assert.equal(Math.round(nota(100, 100, 100, 100) * 100) / 100, 100)
  assert.equal(Math.round(nota(80, 74, 90, 85) * 100) / 100, 80 * 0.28 + 74 * 0.24 + 90 * 0.28 + 85 * 0.2)
  assert.equal(totalPorTareas(writing, ['Task 1', 'Task 2'], {}).nota, null)
})

test('expectativas MCER: solo los niveles del salón', () => {
  const c = { niveles_mcer: { A1: 'a', A2: 'b', B1: 'c', B2: 'd', C1: 'e' } }
  assert.deepEqual(expectativasMcer(c, 'A2.2 – B1.1').map((e) => e.nivel), ['A2', 'B1'])
  assert.equal(expectativasMcer(c, null).length, 5)
})
