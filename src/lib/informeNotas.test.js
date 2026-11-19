import test from 'node:test'
import assert from 'node:assert/strict'
import { htmlInforme, modulosTexto, puntosModulo } from './informeNotas.js'

const ev = (nombre, peso, notas) => ({ nombre, peso, tipo: 'test', notas: notas.map((p) => ({ puntaje: p })) })
const modulo = (n, nota, evs) => ({ modulo_id: `m${n}`, nombre: `Module ${n}`, ciclo: 1, nota, peso_evaluado: 25, parcial: false, evaluaciones: evs })
const m1 = modulo(1, 64, [ev('Test', 7, [66]), ev('Writing', 6, [75]), ev('Project', 7, [58]), ev('SPARK', 2, [100]), ev('Formative', 3, [100])])
const m2 = modulo(2, 76, [ev('Test', 7, [81]), ev('Writing', 6, [77]), ev('Project', 7, [54]), ev('SPARK', 2, [100]), ev('Formative', 3, [59])])
const datos = { estudiante: 'Ana <Pérez>', salon: 'Aula 1', docente: 'Felipe', generado: '2026-11-19', ciclos: [{ ciclo: 1, puntos: 70, escala_evaluada: 100, parcial: false }], modulos: [m1, m2] }

test('modulosTexto resume «Module 1/2» como 1–2', () => {
  assert.equal(modulosTexto([m1, m2]), '1–2')
  assert.equal(modulosTexto([{ nombre: 'Intro' }]), 'Intro')
})
test('puntos del módulo sobre la suma de sus pesos', () => {
  assert.equal(Math.round(puntosModulo(m1) * 100) / 100, 16) // 64 % de 25
  assert.equal(puntosModulo({ sin_plantilla: true }), null)
  assert.equal(puntosModulo({ peso_evaluado: 0, nota: 0 }), null)
})
test('el reporte trae portada, tabla de notas, resultado /50 y escapa el nombre', () => {
  const h = htmlInforme(datos, { comentario: 'Great progress', siguiente: 'Continue with Functional · Cycle 2' })
  assert.match(h, /Report Card/)
  assert.match(h, /Grades chart/)
  assert.match(h, /Ana &lt;Pérez&gt;/)
  assert.doesNotMatch(h, /Ana <Pérez>/)
  assert.match(h, /Cycle 1 result/)
  assert.match(h, /35<i> \/ 50/) // 70 / 100 sobre 50 puntos
  assert.match(h, /Cycle completed/)
  assert.match(h, /Functional · Cycle 2/)
  assert.doesNotMatch(h, /Academic report/) // sin textos por habilidad no hay hoja extra
})
test('la hoja por habilidad solo sale con textos y respeta lo escrito', () => {
  const h = htmlInforme(datos, { habilidades: { Speaking: { fortalezas: 'Buen énfasis', mejora: '', recomendaciones: 'Practicar' } } })
  assert.match(h, /Academic report/)
  assert.match(h, /Speaking report/)
  assert.match(h, /Buen énfasis/)
  assert.doesNotMatch(h, /Reading report/)
})
test('un ciclo sin notas no inventa resultado', () => {
  const vacio = { ...datos, ciclos: [{ ciclo: 1, puntos: 0, escala_evaluada: 0 }], modulos: [] }
  const h = htmlInforme(vacio, {})
  assert.match(h, /In progress/)
  assert.match(h, /No published grades yet/)
})

test('el reporte trae el seguimiento del alumno: radar por unidad con el módulo anterior y detalle de Writing y Oral Project', () => {
  const unidad = (u, crit) => ({ unidad: u, puntaje: 0, criterios: crit.map(([criterio, puntaje]) => ({ criterio, puntaje, max: 5 })) })
  const f = (n, crit, extra = []) => modulo(n, 70, [{ nombre: 'Formative', tipo: 'formative', peso: 3, notas: [unidad('Unit 1', crit[0]), unidad('Unit 2', crit[1])] }, ...extra])
  const crit = (a, b, c) => [['Speaking', a], ['Listening', b], ['Reading', c]]
  const wr = { nombre: 'Writing', tipo: 'writing', peso: 6, notas: [{ puntaje: 70, criterios: [{ criterio: 'Task 1 · Grammar', puntaje: 4, max: 5 }, { criterio: 'Task 1 · Vocabulary', puntaje: 3, max: 5 }, { criterio: 'Task 1 · Cohesion', puntaje: 5, max: 5 }] }] }
  const d = { ...datos, modulos: [f(1, [crit(3, 4, 5), crit(4, 4, 5)]), f(2, [crit(5, 5, 5), crit(5, 4, 5)], [wr])] }
  const h = htmlInforme(d, {})
  assert.match(h, /Student progress/)
  assert.match(h, /Module 1 · Formative by skill/)
  assert.match(h, /Module 2 · Formative by skill/)
  assert.match(h, /Module 1 average/) // el Módulo 2 se compara con el promedio del 1
  assert.match(h, /stroke-dasharray/)
  assert.match(h, /Improving|Steady|Dropping|First grade/)
  assert.match(h, /Writing &amp; Oral Project detail/)
  assert.match(h, /Writing Assessment/)
  assert.match(h, /Level 4/)
  const sinSeg = htmlInforme(datos, {})
  assert.doesNotMatch(sinSeg, /Student progress/) // sin notas por habilidad no hay hojas de seguimiento
})

test('el reporte abre por defecto en el ciclo más reciente con notas y reconoce «Módulo»', async () => {
  const { cicloPorDefecto } = await import('./informeNotas.js')
  const mk = (n, ciclo, notas) => ({ ...modulo(n, 80, []), nombre: `Módulo ${n}`, ciclo, evaluaciones: notas })
  const wr = { nombre: 'Writing', tipo: 'writing', peso: 6, notas: [{ puntaje: 70, criterios: [{ criterio: 'Task 1 · Grammar', puntaje: 4, max: 5 }, { criterio: 'Task 1 · Vocabulary', puntaje: 3, max: 5 }, { criterio: 'Task 1 · Cohesion', puntaje: 5, max: 5 }] }] }
  const d = { ...datos, ciclos: [{ ciclo: 1, puntos: 100, escala_evaluada: 100 }, { ciclo: 2, puntos: 82, escala_evaluada: 100 }, { ciclo: 3, puntos: 0, escala_evaluada: 0 }], modulos: [mk(1, 1, []), mk(2, 1, []), mk(3, 2, [wr]), mk(4, 2, [])] }
  assert.equal(cicloPorDefecto(d), 2)
  assert.equal(modulosTexto([{ nombre: 'Módulo 3' }, { nombre: 'Módulo 4' }]), '3–4')
  const h = htmlInforme(d, {})
  assert.match(h, /Writing &amp; Oral Project detail/) // el ciclo 2 sí trae el detalle por criterio
})
