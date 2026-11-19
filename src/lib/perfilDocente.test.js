import test from 'node:test'
import assert from 'node:assert/strict'
import { alternarOpcion, coincidePerfil, filtrosVacios, hayFiltros, valoresDe } from './perfilDocente.js'

const perfil = { descripcion: 'Great with teenagers, patient', atributos: { a: ['Teens', 'Adults'], b: ['Business English'] } }

test('sin filtros todo coincide, incluso sin perfil', () => {
  assert.equal(hayFiltros(filtrosVacios), false)
  assert.equal(coincidePerfil(undefined, filtrosVacios), true)
})
test('el texto busca en la descripción sin distinguir mayúsculas', () => {
  assert.equal(coincidePerfil(perfil, { texto: 'PATIENT', sel: {} }), true)
  assert.equal(coincidePerfil(perfil, { texto: 'strict', sel: {} }), false)
  assert.equal(coincidePerfil(undefined, { texto: 'x', sel: {} }), false)
})
test('dentro de un campo basta una opción y entre campos se exigen todos', () => {
  assert.equal(coincidePerfil(perfil, { texto: '', sel: { a: ['Kids', 'Teens'] } }), true)
  assert.equal(coincidePerfil(perfil, { texto: '', sel: { a: ['Kids'] } }), false)
  assert.equal(coincidePerfil(perfil, { texto: '', sel: { a: ['Teens'], b: ['Exam preparation'] } }), false)
  assert.equal(coincidePerfil(perfil, { texto: '', sel: { a: ['Teens'], b: ['Business English'] } }), true)
  assert.equal(coincidePerfil(undefined, { texto: '', sel: { a: ['Teens'] } }), false)
})
test('alternarOpcion agrega y quita sin mutar', () => {
  const f1 = alternarOpcion(filtrosVacios, 'a', 'Kids')
  assert.deepEqual(f1.sel, { a: ['Kids'] })
  assert.deepEqual(filtrosVacios.sel, {})
  assert.deepEqual(alternarOpcion(f1, 'a', 'Kids').sel, { a: [] })
  assert.equal(hayFiltros(alternarOpcion(f1, 'a', 'Kids')), false)
})
test('valoresDe ignora campos inactivos y vacíos', () => {
  const campos = [{ id: 'a', nombre: 'Age', activo: true }, { id: 'b', nombre: 'Spec', activo: false }, { id: 'c', nombre: 'Style', activo: true }]
  assert.deepEqual(valoresDe(perfil, campos), [{ campo: 'Age', opciones: ['Teens', 'Adults'] }])
})
