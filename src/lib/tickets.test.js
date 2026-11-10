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
