import test from 'node:test'
import assert from 'node:assert/strict'
import { compararDocentes, notaDe } from './encuestas.js'

const fila = (n, v) => ({ n, claridad: v, participacion: v, ritmo: v, general: v })

test('la nota es el promedio de las cuatro preguntas', () => {
  assert.equal(notaDe({ claridad: 5, participacion: 4, ritmo: 4, general: 3 }), 4)
  assert.equal(notaDe(null), null)
})

test('compara con el equipo: destacado, atención y pocas respuestas', () => {
  const equipo = fila(40, 4.2)
  const r = compararDocentes([{ docente: 'A', ...fila(12, 4.7) }, { docente: 'B', ...fila(12, 3.8) }, { docente: 'C', ...fila(12, 4.2) }, { docente: 'D', ...fila(2, 2) }], equipo)
  const por = Object.fromEntries(r.map((x) => [x.docente, x]))
  assert.equal(por.A.etiqueta, 'destacado')
  assert.equal(por.B.etiqueta, 'atencion')
  assert.equal(por.C.etiqueta, 'normal')
  assert.equal(por.D.etiqueta, 'poco') // 2 respuestas: no se juzga
  assert.equal(r[0].docente, 'A') // ordenados de mayor a menor nota
})

test('bajo 3.5 siempre es atención, aunque todo el equipo sea bajo', () => {
  const r = compararDocentes([{ docente: 'A', ...fila(10, 3.2) }], fila(10, 3.2))
  assert.equal(r[0].etiqueta, 'atencion')
})

import { matrizMensual, nombreMes, tasaRespuesta } from './encuestas.js'

const mf = (id, nombre, mes, n, v) => ({ docente_id: id, docente: nombre, mes, n, claridad: v, participacion: v, ritmo: v, general: v })

test('matriz mensual: nota por mes, diferencia con el equipo y con el mes anterior', () => {
  const m = matrizMensual({
    docentes: [mf('a', 'Ana', '2026-10', 10, 4), mf('a', 'Ana', '2026-11', 10, 4.6), mf('b', 'Beto', '2026-11', 2, 3)],
    equipo: [{ mes: '2026-10', n: 10, claridad: 4, participacion: 4, ritmo: 4, general: 4 }, { mes: '2026-11', n: 12, claridad: 4.2, participacion: 4.2, ritmo: 4.2, general: 4.2 }],
  })
  assert.deepEqual(m.meses, ['2026-10', '2026-11'])
  const ana = m.filas.find((f) => f.docente === 'Ana')
  assert.equal(ana.celdas[1].deltaMes, 0.6)
  assert.equal(ana.celdas[1].deltaEquipo, 0.4)
  assert.equal(ana.celdas[1].estado, 'destacado')
  const beto = m.filas.find((f) => f.docente === 'Beto')
  assert.equal(beto.celdas[0].estado, 'sin') // no hubo respuestas en octubre
  assert.equal(beto.celdas[1].estado, 'poco') // 2 respuestas: no se juzga
})

test('nombre del mes y tasa de respuesta', () => {
  assert.equal(nombreMes('2026-11'), 'Nov 2026')
  assert.equal(tasaRespuesta({ n: 6, asistentes: 8 }), 0.75)
  assert.equal(tasaRespuesta({ n: 9, asistentes: 8 }), 1)
  assert.equal(tasaRespuesta({ n: 3, asistentes: 0 }), null)
})
