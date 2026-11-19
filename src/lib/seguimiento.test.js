import test from 'node:test'
import assert from 'node:assert/strict'
import { claveHabilidad, promedioAnterior, seguimientoFormative, tendencia } from './seguimiento.js'

const crit = (criterio, puntaje, max = 20) => ({ criterio, puntaje, max })
const nota = (unidad, criterios) => ({ unidad, puntaje: 70, criterios })
const modulo = (id, nombre, notas) => ({ modulo_id: id, nombre, evaluaciones: [{ tipo: 'test', notas: [] }, { tipo: 'formative', notas }] })

test('claveHabilidad empareja «Listening / Lessons» con «Listening»', () => {
  assert.equal(claveHabilidad('Listening / Lessons'), 'listening')
  assert.equal(claveHabilidad('Listening'), 'listening')
})

test('tendencia: pendiente, primera nota, mejora, baja, estable y atención por debajo de 50 %', () => {
  assert.equal(tendencia([null, null, null]).estado, 'sin_nota')
  assert.deepEqual(tendencia([null, 70, null]), { estado: 'primera', delta: null })
  assert.deepEqual(tendencia([40, 55, 72]), { estado: 'mejora', delta: 32 })
  assert.deepEqual(tendencia([90, 80, 70]), { estado: 'baja', delta: -20 })
  assert.deepEqual(tendencia([70, 72, null]), { estado: 'estable', delta: 2 })
  assert.equal(tendencia([30, 45]).estado, 'atencion')
})

test('seguimientoFormative: % por unidad, sin publicar = null (no cero), y se ignoran módulos sin detalle', () => {
  const s = seguimientoFormative([
    modulo('m0', 'Module 0', []),
    modulo('m1', 'Module 1', [nota('Unit 1', [crit('Listening', 12), crit('Writing', 14)]), nota('Unit 2', [crit('Listening', 16), crit('Writing', 10)])]),
  ])
  assert.equal(s.length, 1)
  assert.deepEqual(s[0].unidades, ['Unit 1', 'Unit 2', 'Unit 3'])
  const l = s[0].habilidades.find((h) => h.nombre === 'Listening')
  assert.deepEqual(l.valores, [60, 80, null])
  assert.equal(l.ultimo, 80)
  assert.equal(l.promedio, 70)
  assert.equal(l.estado, 'mejora')
  assert.equal(s[0].habilidades.find((h) => h.nombre === 'Writing').estado, 'baja')
})

test('seguimientoFormative: ignora la participación (unidad vacía) y notas sin criterios', () => {
  const s = seguimientoFormative([modulo('m1', 'Module 1', [{ unidad: '', puntaje: 80, criterios: null }, nota('Unit 1', [])])])
  assert.equal(s.length, 0)
})

test('promedioAnterior toma el promedio del módulo previo por habilidad, aunque el nombre cambie', () => {
  const s = seguimientoFormative([
    modulo('m1', 'Module 1', [nota('Unit 1', [crit('Listening / Lessons', 10, 20)]), nota('Unit 2', [crit('Listening / Lessons', 14, 20)])]),
    modulo('m2', 'Module 2', [nota('Unit 1', [crit('Listening', 16)])]),
  ])
  assert.deepEqual(promedioAnterior(s, 1), { listening: 60 })
  assert.deepEqual(promedioAnterior(s, 0), {})
})
