import assert from 'node:assert/strict'
import { test } from 'node:test'
import { presenciaDe, repartirRincones } from './presencia.js'

test('presencia: el estado vale solo el día en que se marcó', () => {
  const fila = { estado: 'fuera', mensaje: 'Doctor', rincon: 'sala', estado_fecha: '2026-03-02' }
  assert.equal(presenciaDe(fila, '2026-03-02').estado, 'fuera')
  assert.equal(presenciaDe(fila, '2026-03-02').info.ausente, true)
  assert.equal(presenciaDe(fila, '2026-03-02').mensaje, 'Doctor')
  const manana = presenciaDe(fila, '2026-03-03')
  assert.equal(manana.estado, 'disponible')
  assert.equal(manana.mensaje, '')
  assert.equal(manana.rincon, 'sala') // el rincón elegido no se vence
})

test('presencia: sin fila o con datos raros vuelve a disponible', () => {
  assert.equal(presenciaDe(undefined, '2026-03-02').estado, 'disponible')
  assert.equal(presenciaDe({ estado: 'otro', estado_fecha: '2026-03-02', rincon: 'x' }, '2026-03-02').estado, 'disponible')
  assert.equal(presenciaDe({ estado: 'otro', estado_fecha: '2026-03-02', rincon: 'x' }, '2026-03-02').rincon, null)
})

test('rincones: respeta lo elegido y reparte el resto en los libres', () => {
  const r = repartirRincones(['a', 'b', 'c'], { b: 'escritorio' })
  assert.equal(r.b, 'escritorio')
  assert.notEqual(r.a, 'escritorio')
  assert.notEqual(r.c, 'escritorio')
  assert.notEqual(r.a, r.c)
})
