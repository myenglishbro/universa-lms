import test from 'node:test'
import assert from 'node:assert/strict'
import { radarCapas } from './progresoHabilidades.js'

test('el radar dibuja un eje por habilidad, una capa por serie y deja lo pendiente en el centro', () => {
  const svg = radarCapas(['Speaking', 'Reading', 'Listening'], [{ valores: [80, null, 100], color: '#410099', destacada: true }, { valores: [50, 60, 70], color: '#94a3b8', punteada: true }])
  assert.match(svg, /^<svg/)
  assert.equal((svg.match(/<line /g) ?? []).length, 3)
  assert.equal((svg.match(/<circle /g) ?? []).length, 2) // marcas solo de la capa destacada y con nota
  assert.match(svg, /stroke-dasharray/)
  assert.doesNotMatch(svg, /NaN/)
})
test('un porcentaje fuera de rango se acota y las etiquetas se escapan', () => {
  const svg = radarCapas(['A<b>', 'B', 'C'], [{ valores: [250, -5, 50], color: '#000', destacada: true }])
  assert.doesNotMatch(svg, /NaN/)
  assert.match(svg, /A&lt;b&gt;/)
})
