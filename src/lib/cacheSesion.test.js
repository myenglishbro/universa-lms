import test from 'node:test'
import assert from 'node:assert/strict'
import { borrarCache, guardarCache, leerCache } from './cacheSesion.js'

// sessionStorage de mentira: las claves son propiedades enumerables (como en el navegador) y los métodos no.
function crearAlmacen() {
  const a = {}
  Object.defineProperties(a, {
    getItem: { value: (k) => (Object.hasOwn(a, k) ? a[k] : null) },
    setItem: { value: (k, v) => { a[k] = String(v) } },
    removeItem: { value: (k) => { delete a[k] } },
  })
  return a
}
globalThis.sessionStorage = crearAlmacen()

test('guardarCache y leerCache respetan el vencimiento', () => {
  guardarCache('a', { x: 1 })
  assert.deepEqual(leerCache('a', 60000), { x: 1 })
  assert.equal(leerCache('a', -1), null)
  assert.equal(leerCache('no-existe', 60000), null)
})

test('borrarCache borra una clave o todas las de la app', () => {
  guardarCache('b'); guardarCache('c'); sessionStorage.setItem('otra', '1')
  borrarCache('b')
  assert.equal(leerCache('b', 60000), null)
  assert.notEqual(leerCache('c', 60000), null)
  borrarCache()
  assert.equal(leerCache('c', 60000), null)
  assert.equal(sessionStorage.getItem('otra'), '1')
})

test('si el almacenamiento falla, no hay caché pero nada se rompe', () => {
  const guardado = globalThis.sessionStorage
  globalThis.sessionStorage = { getItem() { throw new Error('bloqueado') }, setItem() { throw new Error('bloqueado') }, removeItem() { throw new Error('bloqueado') } }
  assert.equal(leerCache('a', 60000), null)
  assert.doesNotThrow(() => guardarCache('a'))
  assert.doesNotThrow(() => borrarCache('a'))
  globalThis.sessionStorage = guardado
})
