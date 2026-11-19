import test from 'node:test'
import assert from 'node:assert/strict'
import { SIN_COLOR, coloresDeNiveles } from './coloresNivel.js'

test('cada nivel tiene su color, por id o por nombre, y se repite igual', () => {
  const de = coloresDeNiveles([{ id: 'a', nombre: 'Basic' }, { id: 'b', nombre: 'Intermediate' }])
  assert.notEqual(de('a'), de('b'))
  assert.equal(de('a'), de('Basic'))
  assert.equal(de('a'), coloresDeNiveles([{ id: 'a', nombre: 'Basic' }])('a'))
})
test('con más niveles que colores se reutiliza la paleta y lo desconocido va en gris', () => {
  const niv = Array.from({ length: 10 }, (_, i) => ({ id: `n${i}`, nombre: `L${i}` }))
  const de = coloresDeNiveles(niv)
  assert.equal(de('n0'), de('n8'))
  assert.equal(de(''), SIN_COLOR)
  assert.equal(de(undefined), SIN_COLOR)
})
