import assert from 'node:assert/strict'
import { test } from 'node:test'
import { nombreDePeticion, resumir } from './tiempos.js'

test('el nombre de la consulta no incluye filtros ni parámetros', () => {
  assert.equal(nombreDePeticion('https://x.supabase.co/rest/v1/rpc/eval_matriz_salon'), 'rpc/eval_matriz_salon')
  assert.equal(nombreDePeticion('https://x.supabase.co/rest/v1/alumnos?select=id,nombre&id=eq.123&correo=eq.a@b.com'), 'alumnos')
  assert.equal(nombreDePeticion('https://x.supabase.co/auth/v1/token?grant_type=password'), 'auth/token')
  assert.equal(nombreDePeticion('no es una url'), 'otra')
})

test('el resumen agrupa por consulta y pone primero la que más tiempo suma', () => {
  const r = (nombre, ms, fallo = false) => ({ nombre, ms, fallo, cuando: 0 })
  const lista = [r('alumnos', 100), r('alumnos', 300), r('rpc/pesada', 900), r('alumnos', 200, true)]
  const [a, b] = resumir(lista)
  assert.equal(a.consulta, 'rpc/pesada')
  assert.deepEqual([b.consulta, b.veces, b.promedio, b.maximo, b.fallos], ['alumnos', 3, 200, 300, 1])
})
