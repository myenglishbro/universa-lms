import { test } from 'node:test'
import assert from 'node:assert/strict'
import { PROGRAMA, fuenteTexto, modulosPermitidos, nivelDeCiclo, nombresUnidadesDeModulo, revisarModulos, ubicar, unidadesDeModulo } from './curriculo.js'

test('7 niveles y 13 ciclos (0 al 12), cada ciclo en un solo nivel', () => {
  assert.equal(PROGRAMA.length, 7)
  const ciclos = PROGRAMA.flatMap((n) => n.ciclos)
  assert.deepEqual(ciclos, Array.from({ length: 13 }, (_, i) => i))
  assert.deepEqual(PROGRAMA[0].ciclos, [0])
  for (const n of PROGRAMA.slice(1)) assert.equal(n.ciclos.length, 2)
})

test('cada módulo tiene 3 unidades: M1 = 1-3, M2 = 4-6, M3 = 7-9, M4 = 10-12', () => {
  assert.deepEqual([1, 2, 3, 4].map(unidadesDeModulo), [[1, 2, 3], [4, 5, 6], [7, 8, 9], [10, 11, 12]])
  assert.deepEqual(nombresUnidadesDeModulo(2), ['Unit 4', 'Unit 5', 'Unit 6'])
})

test('nivel + unidad → ciclo, módulo y MCER (Básico: ciclo 1 = módulos 1-2, ciclo 2 = módulos 3-4)', () => {
  const u = (id, n) => { const x = ubicar(id, n); return [x.ciclo, x.modulo, x.mcer] }
  assert.deepEqual(u('basic', 1), [1, 1, 'A1.2'])
  assert.deepEqual(u('basic', 6), [1, 2, 'A1.2'])
  assert.deepEqual(u('basic', 7), [2, 3, 'A2.1'])
  assert.deepEqual(u('basic', 12), [2, 4, 'A2.1'])
  assert.deepEqual(u('intermediate', 4), [3, 2, 'A2.2'])
  assert.deepEqual(u('functional', 11), [0, 4, 'A1.1']) // el ciclo 0 contiene los 4 módulos
  assert.equal(ubicar('basic', 0), null)
  assert.equal(ubicar('basic', 13), null)
  assert.equal(ubicar('nope', 3), null)
  assert.equal(ubicar('', ''), null)
})

test('libros por nivel; Master aún sin libro', () => {
  assert.equal(nivelDeCiclo(0).libro, 'World English Intro')
  assert.equal(nivelDeCiclo(2).libro, 'World English 1')
  assert.equal(nivelDeCiclo(9).libro, 'Keynote 2')
  assert.equal(nivelDeCiclo(12).libro, null)
  assert.equal(fuenteTexto({ ciclo: 2, fuente: ' p. 52 ' }), 'World English 1 · p. 52')
  assert.equal(fuenteTexto({ ciclo: 12, fuente: '' }), '')
})

test('módulos que le tocan a cada ciclo', () => {
  assert.deepEqual(modulosPermitidos(0), [1, 2, 3, 4])
  assert.deepEqual(modulosPermitidos(1), [1, 2])
  assert.deepEqual(modulosPermitidos(2), [3, 4])
  assert.deepEqual(modulosPermitidos(11), [1, 2])
  assert.deepEqual(modulosPermitidos(12), [3, 4])
  assert.deepEqual(modulosPermitidos(null), [1, 2, 3, 4])
})

test('revisarModulos detecta números que no corresponden, repetidos y faltantes', () => {
  assert.deepEqual(revisarModulos([1, 2], [{ orden: 1, ciclo: 1 }, { orden: 2, ciclo: 1 }, { orden: 3, ciclo: 2 }, { orden: 4, ciclo: 2 }]), [])
  assert.deepEqual(revisarModulos([0], [{ orden: 1, ciclo: 0 }, { orden: 2, ciclo: 0 }, { orden: 3, ciclo: 0 }, { orden: 4, ciclo: 0 }]), [])
  assert.deepEqual(revisarModulos([0], [{ orden: 1, ciclo: 0 }, { orden: 2, ciclo: 0 }]), ['Al ciclo 0 le faltan los módulos 3 y 4'])
  assert.deepEqual(revisarModulos([2], [{ orden: 1, ciclo: 2 }, { orden: 4, ciclo: 2 }]), ['El módulo 1 no corresponde al ciclo 2', 'Al ciclo 2 le faltan los módulos 3'])
  assert.deepEqual(revisarModulos([1], [{ orden: 1, ciclo: 1 }, { orden: 1, ciclo: 1 }, { orden: 2, ciclo: 1 }]), ['El módulo 1 está repetido'])
})
