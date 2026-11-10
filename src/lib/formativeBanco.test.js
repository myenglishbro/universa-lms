// Pruebas de la lógica de presentación del banco → Formative.  Ejecutar: npm test   (node --test, sin dependencias nuevas)
import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  ELEMENTOS,
  agruparPorUnidad,
  estadoFila,
  etiquetaFormative,
  habilidadSugerida,
  leerSpark,
  nombreHabilidad,
  nota2,
  notaRubricaPct,
  pesoElemento,
  puedeConfirmar,
  requiereMotivo,
  rubricaPorDefecto,
  rubricasDelTipo,
  valoresDesdeDetalle,
} from './formativeBanco.js'

const fila = (o) => ({ alumno_id: 'a', nombre: 'Ana', unidad: 'Unit 1', completos: 5, valor: 80, registrada: null, ...o })

test('reparto interno: 5 elementos de 16 % + participación 20 % = 100 %', () => {
  assert.equal(ELEMENTOS.length, 5)
  assert.equal(pesoElemento(20), 16)
  assert.equal(pesoElemento(20) * ELEMENTOS.length + 20, 100)
  assert.deepEqual(ELEMENTOS.map((e) => e.id), ['listening', 'writing', 'reading', 'speaking', 'spark'])
  assert.equal(nombreHabilidad('listening'), 'Listening / Lessons')
})

test('etiqueta: práctica u oficial con módulo, unidad y habilidad', () => {
  assert.equal(etiquetaFormative(null), 'Práctica')
  assert.equal(etiquetaFormative({ modulo: 'Módulo 1', unidad: 'Unit 2', habilidad: 'reading' }), 'Formative · Módulo 1 · Unit 2 · Reading')
})

test('presentación: dos decimales al mostrar, el valor completo no se redondea', () => {
  assert.equal(nota2(200 / 3), '66.67')
  assert.equal(nota2(70), '70.00')
  assert.equal(nota2(null), '—')
  assert.equal(nota2(''), '—')
})

test('estado de la fila: con elementos pendientes es PARCIAL (no cero) y no se puede confirmar', () => {
  const parcial = fila({ completos: 3, valor: null })
  assert.equal(estadoFila(parcial), 'parcial')
  assert.equal(puedeConfirmar(parcial), false)
  assert.equal(estadoFila(fila({ completos: 0, valor: null })), 'parcial')
})

test('estado de la fila: listo, publicada y cambio', () => {
  assert.equal(estadoFila(fila({})), 'listo')
  assert.equal(estadoFila(fila({ registrada: { estado: 'borrador', puntaje: 10 } })), 'listo')
  assert.equal(estadoFila(fila({ valor: 200 / 3, registrada: { estado: 'publicada', puntaje: 66.67 } })), 'publicada')
  assert.equal(estadoFila(fila({ valor: 90, registrada: { estado: 'publicada', puntaje: 80 } })), 'cambio')
  assert.equal(puedeConfirmar(fila({})), true)
  assert.equal(puedeConfirmar(fila({ valor: 90, registrada: { estado: 'publicada', puntaje: 80 } })), true)
  assert.equal(puedeConfirmar(fila({ registrada: { estado: 'publicada', puntaje: 80 } })), false)
})

test('motivo: solo cuando cambia una nota ya publicada', () => {
  assert.equal(requiereMotivo([fila({})]), false)
  assert.equal(requiereMotivo([fila({}), fila({ valor: 90, registrada: { estado: 'publicada', puntaje: 80 } })]), true)
})

test('agrupar por unidad respeta el orden de las unidades del Formative', () => {
  const g = agruparPorUnidad([fila({ unidad: 'Unit 2' }), fila({ unidad: 'Unit 1' }), fila({ unidad: 'Unit 2', nombre: 'Beto' })], ['Unit 1', 'Unit 2', 'Unit 3'])
  assert.deepEqual(g.map((x) => [x.unidad, x.filas.length]), [['Unit 1', 1], ['Unit 2', 2]])
})

const rubricas = [
  { id: 'w1', nombre: 'Writing', tipo: 'writing', por_defecto: true },
  { id: 'w2', nombre: 'Writing B2', tipo: 'writing', por_defecto: false },
  { id: 's1', nombre: 'Speaking', tipo: 'speaking', por_defecto: true },
]

test('rúbricas: Writing usa Writing y Speaking usa Speaking (nunca Project); sin «por defecto» no se inventa una', () => {
  assert.deepEqual(rubricasDelTipo(rubricas, 'writing').map((r) => r.id), ['w1', 'w2'])
  assert.equal(rubricaPorDefecto(rubricas, 'writing'), 'w1')
  assert.equal(rubricaPorDefecto(rubricas, 'speaking'), 's1')
  assert.equal(rubricaPorDefecto([{ id: 'x', nombre: 'Foo', tipo: 'speaking', por_defecto: false }], 'speaking'), '')
  assert.equal(rubricaPorDefecto([], 'writing'), '')
})

test('habilidad sugerida por tipo de ejercicio; los demás tipos la dejan al docente', () => {
  assert.equal(habilidadSugerida('listening'), 'listening')
  assert.equal(habilidadSugerida('writing'), 'writing')
  assert.equal(habilidadSugerida('multiple_choice'), '')
})

test('nota de rúbrica: suma ÷ máximos × 100, sin mínimos; incompleta o fuera de rango → null', () => {
  const crit = [{ id: 'a', nombre: 'A', max_puntaje: 20 }, { id: 'b', nombre: 'B', max_puntaje: 20 }, { id: 'c', nombre: 'C', max_puntaje: 10 }]
  assert.equal(notaRubricaPct(crit, { a: 20, b: 20, c: 10 }), 100)
  assert.equal(notaRubricaPct(crit, { a: 0, b: 0, c: 0 }), 0)
  assert.ok(Math.abs(notaRubricaPct(crit, { a: 10, b: 15, c: 5 }) - 60) < 1e-9)
  assert.equal(notaRubricaPct(crit, { a: 10, b: '', c: 5 }), null)
  assert.equal(notaRubricaPct(crit, { a: 21, b: 1, c: 1 }), null)
  assert.equal(notaRubricaPct([], {}), null)
})

test('editar una revisión: los valores salen de la copia de criterios guardada', () => {
  const crit = [{ id: 'a', nombre: 'A', max_puntaje: 20 }, { id: 'b', nombre: 'B', max_puntaje: 20 }]
  assert.deepEqual(valoresDesdeDetalle(crit, { criterios: [{ criterio: 'A', max: 20, puntaje: 15 }] }), { a: '15', b: '' })
  assert.deepEqual(valoresDesdeDetalle(crit, null), { a: '', b: '' })
})

test('SPARK manual: 0 a 5; vacío = pendiente (no cero); fuera de rango o no numérico = inválido', () => {
  assert.equal(leerSpark('4.5'), 4.5)
  assert.equal(leerSpark('0'), 0)
  assert.equal(leerSpark(''), null)
  assert.equal(leerSpark(null), null)
  assert.equal(leerSpark('5.01'), undefined)
  assert.equal(leerSpark('-1'), undefined)
  assert.equal(leerSpark('abc'), undefined)
  assert.equal(leerSpark('7', 10), 7)
})
