import assert from 'node:assert/strict'
import { test } from 'node:test'
import { aInputLima, deInputLima, fmtMinutos, fmtSoles, horasDecimal, moverPeriodo, periodoDe, porDocente, totales } from './horasDocentes.js'

test('el 28 de noviembre abre el periodo que cierra el 27 de diciembre', () => {
  assert.deepEqual(periodoDe('2026-11-28'), { desde: '2026-11-28', hasta: '2026-12-27' })
})
test('el 27 todavía es del periodo anterior (se paga lo trabajado ese día)', () => {
  assert.deepEqual(periodoDe('2026-12-27'), { desde: '2026-11-28', hasta: '2026-12-27' })
  assert.deepEqual(periodoDe('2026-11-27'), { desde: '2026-10-28', hasta: '2026-11-27' })
})
test('cualquier día entre el 28 y el 27 cae en su periodo', () => {
  assert.deepEqual(periodoDe('2026-12-10'), { desde: '2026-11-28', hasta: '2026-12-27' })
  assert.deepEqual(periodoDe('2026-12-28'), { desde: '2026-12-28', hasta: '2027-01-27' })
})
test('cruza el año hacia atrás', () => {
  assert.deepEqual(periodoDe('2027-01-05'), { desde: '2026-12-28', hasta: '2027-01-27' })
})

test('avanza y retrocede de a un periodo, también entre años', () => {
  const p = periodoDe('2026-12-30')
  assert.deepEqual(moverPeriodo(p, 1), { desde: '2027-01-28', hasta: '2027-02-27' })
  assert.deepEqual(moverPeriodo(p, -1), { desde: '2026-11-28', hasta: '2026-12-27' })
  assert.deepEqual(moverPeriodo({ desde: '2027-01-28', hasta: '2027-02-27' }, -2), { desde: '2026-11-28', hasta: '2026-12-27' })
})
test('los periodos son consecutivos sin huecos ni solapes', () => {
  let p = periodoDe('2026-01-15')
  for (let i = 0; i < 24; i++) {
    const sig = moverPeriodo(p, 1)
    const dia = new Date(`${p.hasta}T00:00:00Z`)
    dia.setUTCDate(dia.getUTCDate() + 1)
    assert.equal(sig.desde, dia.toISOString().slice(0, 10))
    p = sig
  }
})

test('minutos a horas', () => {
  assert.equal(fmtMinutos(150), '2 h 30 min')
  assert.equal(fmtMinutos(120), '2 h')
  assert.equal(fmtMinutos(45), '45 min')
  assert.equal(horasDecimal(150), '2.50')
})
test('hora de Lima ida y vuelta', () => {
  assert.equal(deInputLima('2026-11-28T19:00'), '2026-11-28T19:00:00-05:00')
  assert.equal(aInputLima('2026-11-29T00:00:00Z'), '2026-11-28T19:00')
})

  const filas = [
  { docente_id: 'a', docente: 'Ana', salon: 'S1', programadas: 4, dictadas: 3, sin_marca: 1, minutos_programados: 240, minutos_pagables: 180, minutos_tarde: 5, monto: 40.5, nativo: true },
  { docente_id: 'a', docente: 'Ana', salon: 'S2', programadas: 2, dictadas: 2, sin_marca: 0, minutos_programados: 120, minutos_pagables: 120, minutos_tarde: 0, monto: 28 },
  { docente_id: 'b', docente: 'Beto', salon: 'S3', programadas: 1, dictadas: 0, sin_marca: 1, minutos_programados: 60, minutos_pagables: 0, minutos_tarde: 0 },
  ]
test('suma todo y agrupa por docente', () => {
  assert.equal(totales(filas).minutos_pagables, 300)
  const d = porDocente(filas)
  assert.equal(d.length, 2)
  assert.partialDeepStrictEqual(d[0], { docente: 'Ana', programadas: 6, dictadas: 5, minutos_pagables: 300 })
  assert.equal(d[0].salones.length, 2)
  assert.equal(totales(filas).monto, 68.5)
  assert.equal(d[0].monto, 68.5)
  assert.equal(d[0].nativo, true)
})
test('soles', () => {
  assert.equal(fmtSoles(1234.5), 'S/ 1,234.50')
  assert.equal(fmtSoles(null), '—')
})
