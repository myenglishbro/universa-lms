import test from 'node:test'
import assert from 'node:assert/strict'
import { aplicarBorrador, borradorDe } from './borradorReporte.js'

test('el borrador guarda solo lo escrito: sin horario ni asistencia y sin textos vacíos', () => {
  const b = borradorDe({ comentario: 'Hola', siguiente: 'Cycle 2', horario: 'Lun 7pm', presentes: 20, habilidades: { Speaking: { fortalezas: 'Bien', mejora: '  ' }, Reading: { fortalezas: '' } } }, { idiomaPortada: 'es' })
  assert.equal(b.comentario, 'Hola')
  assert.equal(b.ranking, '')
  assert.equal('horario' in b, false)
  assert.equal('presentes' in b, false)
  assert.deepEqual(b.habilidades, { Speaking: { fortalezas: 'Bien' } })
  assert.deepEqual(b.idiomas, { idiomaPortada: 'es', idiomaHabilidades: 'es' })
})
test('aplicar un borrador respeta lo guardado y conserva la propuesta en lo demás', () => {
  const base = { comentario: 'propuesto', siguiente: 'X', ranking: '3', habilidades: { Speaking: { fortalezas: 'auto' } }, horario: 'Lun' }
  const r = aplicarBorrador(base, { comentario: 'mío', habilidades: { Writing: { mejora: 'm' } } })
  assert.equal(r.comentario, 'mío')
  assert.equal(r.siguiente, 'X')
  assert.equal(r.horario, 'Lun')
  assert.deepEqual(r.habilidades, { Writing: { mejora: 'm' } })
  assert.equal(aplicarBorrador(base, null), base)
  assert.equal(aplicarBorrador(base, 'no'), base)
})
