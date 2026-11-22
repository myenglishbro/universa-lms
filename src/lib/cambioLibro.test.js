import test from 'node:test'
import assert from 'node:assert/strict'
import { resumenCambioLibro } from './cambioLibro.js'

const fila = (cicloHasta, dias, estudiantes, estado = 'en_curso') => ({ salon: { estado, cicloHasta, estudiantes, codigo: 'X' }, a: { dias, fin: null } })

test('solo cuentan ciclos pares y salones en curso, por tramo de días', () => {
  const r = resumenCambioLibro([fila(2, 10, 8), fila(2, 45, 5), fila(3, 5, 9), fila(4, -2, 3), fila(4, 100, 7), fila(6, 5, 4, 'pendiente'), fila(2, null, 2)])
  assert.deepEqual(r.ciclos.map((c) => [c.ciclo, c.estudiantes, c.d30, c.d60, c.ya, c.mas, c.sinFecha]), [[2, 15, 8, 5, 0, 0, 2], [4, 10, 0, 0, 3, 7, 0]])
  assert.equal(r.urgentes, 11)
  assert.equal(r.proximos, 5)
})

test('sin dato de matrícula no inventa estudiantes', () => {
  const r = resumenCambioLibro([fila(2, 10, null)])
  assert.equal(r.ciclos[0].sinDatoEstudiantes, true)
  assert.equal(r.total, 0)
})
