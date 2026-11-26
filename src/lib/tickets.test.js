import assert from 'node:assert/strict'
import { test } from 'node:test'
import { filtrarTickets, ordenarTickets, vencido } from './tickets.js'

const base = { archivado: false, estado: 'pendiente', prioridad: 'media', tipo: 'tarea', responsable_id: null, creado_por: 'a', fecha_limite: null, updated_at: '2026-01-01', codigo: 'TK-0001', titulo: 'Agendar examen de nivelación' }
const t = (o) => ({ ...base, ...o })

test('vencido: fecha pasada y no realizado', () => {
  assert.equal(vencido(t({ fecha_limite: '2026-01-01' }), '2026-01-02'), true)
  assert.equal(vencido(t({ fecha_limite: '2026-01-02' }), '2026-01-02'), false)
  assert.equal(vencido(t({ fecha_limite: '2026-01-01', estado: 'realizado' }), '2026-01-02'), false)
  assert.equal(vencido(t({}), '2026-01-02'), false)
})

test('filtros por vista; los archivados solo salen en su vista', () => {
  const lista = [t({ id: 1 }), t({ id: 2, responsable_id: 'b' }), t({ id: 3, creado_por: 'b', prioridad: 'urgente' }), t({ id: 4, archivado: true })]
  const ids = (f) => filtrarTickets(lista, f, 'b', '2026-02-01').map((x) => x.id)
  assert.deepEqual(ids({ vista: 'todos' }), [1, 2, 3])
  assert.deepEqual(ids({ vista: 'mios' }), [2])
  assert.deepEqual(ids({ vista: 'creados' }), [3])
  assert.deepEqual(ids({ vista: 'urgentes' }), [3])
  assert.deepEqual(ids({ vista: 'archivados' }), [4])
  assert.deepEqual(ids({ vista: 'todos', responsable: 'sin' }), [1, 3])
})

test('búsqueda por título (sin tildes) o código', () => {
  const lista = [t({ id: 1 }), t({ id: 2, codigo: 'TK-0042', titulo: 'Enviar correo' })]
  assert.deepEqual(filtrarTickets(lista, { texto: 'nivelacion' }, 'x').map((x) => x.id), [1])
  assert.deepEqual(filtrarTickets(lista, { texto: 'tk-0042' }, 'x').map((x) => x.id), [2])
})

test('orden: urgente primero, luego fecha límite más cercana', () => {
  const l = [t({ id: 1 }), t({ id: 2, prioridad: 'urgente' }), t({ id: 3, fecha_limite: '2026-03-01' })].sort(ordenarTickets)
  assert.deepEqual(l.map((x) => x.id), [2, 3, 1])
})

test('orden: con igual prioridad y fecha, el ticket más antiguo va primero', () => {
  const l = [t({ id: 1, created_at: '2026-02-03' }), t({ id: 2, created_at: '2026-02-01' }), t({ id: 3, created_at: '2026-02-02' })].sort(ordenarTickets)
  assert.deepEqual(l.map((x) => x.id), [2, 3, 1])
})

test('varios responsables: «mis tickets» y el filtro por responsable incluyen a todos los asignados', () => {
  const lista = [t({ id: 1, responsables: ['a', 'b'], responsable_id: 'a' }), t({ id: 2, responsables: ['a'], responsable_id: 'a' }), t({ id: 3 }), t({ id: 4, responsable_id: 'b' })]
  const ids = (f) => filtrarTickets(lista, f, 'b', '2026-02-01').map((x) => x.id)
  assert.deepEqual(ids({ vista: 'mios' }), [1, 4])
  assert.deepEqual(ids({ vista: 'todos', responsable: 'a' }), [1, 2])
  assert.deepEqual(ids({ vista: 'todos', responsable: 'sin' }), [3])
})

import { DIAS_ESTANCADO, estancado, mesGrid, progresoChecklist, ticketsPorFecha } from './tickets.js'

test('estancado: en proceso o en espera sin movimiento desde hace 5 días', () => {
  const ahora = new Date('2026-02-10T12:00:00Z').getTime()
  assert.equal(DIAS_ESTANCADO, 5)
  assert.equal(estancado(t({ estado: 'en_proceso', updated_at: '2026-02-05T12:00:00Z' }), ahora), true)
  assert.equal(estancado(t({ estado: 'en_proceso', updated_at: '2026-02-06T12:00:01Z' }), ahora), false)
  assert.equal(estancado(t({ estado: 'en_espera', updated_at: '2026-01-01T00:00:00Z' }), ahora), true)
  assert.equal(estancado(t({ estado: 'pendiente', updated_at: '2026-01-01T00:00:00Z' }), ahora), false)
  assert.equal(estancado(t({ estado: 'realizado', updated_at: '2026-01-01T00:00:00Z' }), ahora), false)
  assert.equal(estancado(t({ estado: 'en_proceso', archivado: true, updated_at: '2026-01-01T00:00:00Z' }), ahora), false)
})

test('vista «estancados» y avance del checklist', () => {
  const ahora = new Date('2026-02-10T12:00:00Z').getTime()
  const lista = [t({ id: 'a', estado: 'en_proceso', updated_at: '2026-01-01T00:00:00Z' }), t({ id: 'b', estado: 'en_proceso', updated_at: '2026-02-10T00:00:00Z' })]
  assert.deepEqual(filtrarTickets(lista, { vista: 'estancados' }, 'u', '2026-02-10', ahora).map((x) => x.id), ['a'])
  assert.deepEqual(progresoChecklist(t({})), { hechos: 0, total: 0, completo: false })
  assert.deepEqual(progresoChecklist(t({ checklist: [{ hecho: true }, { hecho: false }] })), { hechos: 1, total: 2, completo: false })
  assert.equal(progresoChecklist(t({ checklist: [{ hecho: true }] })).completo, true)
})

test('mesGrid: semanas de lunes a domingo que cubren el mes', () => {
  const g = mesGrid(2026, 1) // febrero 2026 empieza en domingo
  assert.equal(g.length, 5)
  assert.equal(g[0][0].fecha, '2026-01-26')
  assert.equal(g[0][6].fecha, '2026-02-01')
  assert.equal(g[0][6].delMes, true)
  assert.equal(g[0][0].delMes, false)
  assert.equal(g.at(-1)[6].fecha, '2026-03-01')
  assert.equal(mesGrid(2026, 2).flat().filter((d) => d.delMes).length, 31)
})

test('ticketsPorFecha agrupa por fecha límite y omite los que no la tienen', () => {
  const m = ticketsPorFecha([t({ id: '1', fecha_limite: '2026-02-03', prioridad: 'baja' }), t({ id: '2', fecha_limite: '2026-02-03', prioridad: 'urgente' }), t({ id: '3' })])
  assert.deepEqual(m.get('2026-02-03').map((x) => x.id), ['2', '1'])
  assert.equal(m.size, 1)
})

test('carga por persona: abiertos, ánimo y cerrados de la semana', async () => {
  const { cargaPorPersona } = await import('./tickets.js')
  const ahora = Date.parse('2026-02-10T12:00:00Z')
  const l = [
    t({ id: 1, responsables: ['a'], prioridad: 'urgente', fecha_limite: '2026-02-01' }),
    t({ id: 2, responsables: ['a'], estado: 'realizado', updated_at: '2026-02-08T10:00:00Z' }),
    t({ id: 3, responsables: ['a'], estado: 'realizado', updated_at: '2026-01-01T10:00:00Z' }),
    t({ id: 4, responsables: ['a'], archivado: true }),
    t({ id: 5, responsables: ['b'] }),
  ]
  const [a, b, c] = cargaPorPersona(l, [{ user_id: 'a', correo: 'a@x.com' }, { user_id: 'b', correo: 'b@x.com' }, { user_id: 'c', correo: 'c@x.com' }], ahora, '2026-02-10')
  assert.deepEqual([a.abiertos, a.vencidos, a.hechosSemana, a.animo], [1, 1, 1, 'tranquilo'])
  assert.equal(a.porPrioridad.urgente, 1)
  assert.deepEqual([b.abiertos, b.animo], [1, 'tranquilo'])
  assert.deepEqual([c.abiertos, c.animo], [0, 'libre'])
  const muchos = Array.from({ length: 8 }, (_, i) => t({ id: 10 + i, responsables: ['a'] }))
  assert.equal(cargaPorPersona(muchos, [{ user_id: 'a', correo: 'a' }], ahora, '2026-02-10')[0].animo, 'agobiado')
})

test('filtrar por área: una concreta o los que no tienen área', () => {
  const lista = [t({ id: 'a', area: 'finanzas' }), t({ id: 'b', area: 'academica' }), t({ id: 'c' })]
  assert.deepEqual(filtrarTickets(lista, { area: 'finanzas' }, 'x').map((x) => x.id), ['a'])
  assert.deepEqual(filtrarTickets(lista, { area: 'sin' }, 'x').map((x) => x.id), ['c'])
  assert.equal(filtrarTickets(lista, {}, 'x').length, 3)
})
