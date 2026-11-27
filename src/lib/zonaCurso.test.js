import assert from 'node:assert/strict'
import { test } from 'node:test'
import { esNombreDeModulo, separarZona, tituloModulo } from './zonaCurso.js'

const d = (id, categoria, url, extra = {}) => ({ id, categoria, titulo: id, url, ...extra })
const YT = 'https://www.youtube.com/watch?v=abcdefghijk'
const DOC = 'https://drive.google.com/file/d/abc123/view'

test('esNombreDeModulo: número o Module/Unit al inicio', () => {
  assert.equal(esNombreDeModulo('1. Getting started'), true)
  assert.equal(esNombreDeModulo('Module 2'), true)
  assert.equal(esNombreDeModulo('Módulo 3 · Notas'), true)
  assert.equal(esNombreDeModulo('Reglamentos'), false)
  assert.equal(esNombreDeModulo(''), false)
})

test('separarZona: videos y documentos de un módulo son lecciones; el resto, recursos', () => {
  const r = separarZona([
    d('v1', '2. Classrooms', YT, { created_at: '2' }),
    d('p1', '2. Classrooms', DOC, { created_at: '1' }),
    d('v0', '1. Getting started', YT),
    d('reg', 'Reglamentos', DOC),
    d('pdf-con-videos', 'Onboarding', DOC),
    d('v-onb', 'Onboarding', YT),
  ])
  assert.deepEqual(r.modulos.map((m) => m.nombre), ['1. Getting started', '2. Classrooms', 'Onboarding'])
  assert.deepEqual(r.modulos[1].items.map((x) => x.id), ['p1', 'v1']) // por fecha
  assert.deepEqual(r.modulos[1].items.map((x) => x.tipoLeccion), ['documento', 'video'])
  assert.deepEqual(r.recursos.map((x) => x.id), ['reg'])
  assert.equal(r.lecciones.length, 5)
  assert.deepEqual(r.gruposRecursos.map((g) => [g.nombre, g.items[0].recurso]), [['Reglamentos', true]])
})

test('separarZona: orden manual y orden natural de módulos (2 antes que 10)', () => {
  const r = separarZona([d('a', '10. Final', YT), d('b', '2. Mid', YT), d('c', '2. Mid', YT, { orden: -1 })])
  assert.deepEqual(r.modulos.map((m) => m.nombre), ['2. Mid', '10. Final'])
  assert.deepEqual(r.modulos[0].items.map((x) => x.id), ['c', 'b'])
})

test('tituloModulo quita el número inicial', () => {
  assert.equal(tituloModulo('1. Getting started'), 'Getting started')
  assert.equal(tituloModulo('Onboarding'), 'Onboarding')
})
