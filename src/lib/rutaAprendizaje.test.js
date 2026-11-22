import test from 'node:test'
import assert from 'node:assert/strict'
import { cicloActualDeCurso, estadoNiveles, posicionEnRuta } from './rutaAprendizaje.js'

test('el ciclo actual es el primero sin completar, con su avance', () => {
  const r = cicloActualDeCurso([{ ciclo: 3, sesiones: 20, realizadas: 20 }, { ciclo: 4, sesiones: 20, realizadas: 5 }])
  assert.deepEqual(r, { ciclo: 4, fraccion: 0.25 })
  assert.equal(cicloActualDeCurso([]), null)
  assert.equal(cicloActualDeCurso([{ ciclo: 2, sesiones: 10, realizadas: 10 }]).ciclo, 2)
})

test('con varios cursos manda el ciclo más alto', () => {
  assert.equal(posicionEnRuta([[{ ciclo: 1, sesiones: 10, realizadas: 2 }], [{ ciclo: 5, sesiones: 10, realizadas: 0 }]]).ciclo, 5)
  assert.equal(posicionEnRuta([]), null)
})

test('niveles: hechos, actual con avance y pendientes', () => {
  const e = estadoNiveles({ ciclo: 4, fraccion: 0.5 })
  assert.deepEqual(e.map((n) => n.estado), ['hecho', 'hecho', 'actual', 'pendiente', 'pendiente', 'pendiente', 'pendiente'])
  assert.equal(e[2].avance, 0.75)
  assert.ok(estadoNiveles(null).every((n) => n.estado === 'pendiente'))
})
