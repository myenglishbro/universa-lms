import test from 'node:test'
import assert from 'node:assert/strict'
import { bandaDe, comentarioPortada, comentariosHabilidades, notasPorHabilidad, propuestaComentarios } from './comentariosInforme.js'

const unidad = (u, crit) => ({ unidad: u, puntaje: 0, criterios: crit.map(([criterio, puntaje]) => ({ criterio, puntaje, max: 5 })) })
const mod = (n, form, extra = []) => ({ modulo_id: `m${n}`, nombre: `Module ${n}`, ciclo: 1, nota: 70, peso_evaluado: 25, parcial: false, evaluaciones: [{ nombre: 'Formative', tipo: 'formative', notas: form }, ...extra] })
const m1 = mod(1, [unidad('Unit 1', [['Speaking', 5], ['Listening', 2], ['Reading', 4]]), unidad('Unit 2', [['Speaking', 4], ['Listening', 3], ['Reading', 4]])], [{ nombre: 'Writing', tipo: 'writing', notas: [{ puntaje: 75 }] }, { nombre: 'Project', tipo: 'project', notas: [{ puntaje: 90 }] }])

test('bandas según la escala oficial', () => {
  assert.deepEqual([100, 85, 84.9, 70, 69.9, 60, 59.9, 0].map(bandaDe), ['outstanding', 'outstanding', 'achieved', 'achieved', 'developing', 'developing', 'beginning', 'beginning'])
  assert.equal(bandaDe(null), null)
})
test('notas por habilidad unen Formative, Writing y Oral Project; sin dato es null', () => {
  const n = notasPorHabilidad([m1])
  assert.equal(n.Listening, 50) // (2/5 + 3/5) / 2
  assert.equal(n.Reading, 80)
  assert.equal(n.Speaking, 90) // Formative 90 % y Oral Project 90
  assert.equal(n.Writing, 75) // sin Writing en Formative: solo el examen
  assert.equal(n.Grammar, null)
  assert.equal(n.Vocabulary, null)
})
test('los comentarios cambian con la banda y solo salen para habilidades con nota', () => {
  const c = comentariosHabilidades({ Speaking: 90, Listening: 50, Reading: null }, 'es')
  assert.deepEqual(Object.keys(c), ['Speaking', 'Listening'])
  assert.match(c.Speaking.fortalezas, /sobresaliente/)
  assert.match(c.Listening.mejora, /práctica frecuente/)
  assert.notEqual(c.Speaking.mejora, c.Listening.mejora)
  assert.match(comentariosHabilidades({ Speaking: 90 }, 'en').Speaking.fortalezas, /outstanding/)
  assert.doesNotMatch(c.Speaking.fortalezas, /\{/)
})
test('el comentario de portada nombra la mejor y la más débil, sin pronombres de género', () => {
  const t = comentarioPortada({ estudiante: 'Olga Zoraida Segovia', ciclo: 0.1, nota100: 72, notas: { Speaking: 90, Listening: 50, Reading: 80 } }, 'en')
  assert.match(t, /^Olga completed cycle 0.1/)
  assert.match(t, /strongest area is Speaking/)
  assert.match(t, /reinforce Listening/)
  assert.doesNotMatch(t, /\b(she|he|her|his)\b/i)
  assert.equal(comentarioPortada({ estudiante: 'Ana', ciclo: 1, nota100: null, notas: {} }), '')
})
test('propuesta completa para un informe', () => {
  const d = { estudiante: 'Ana Pérez', ciclos: [{ ciclo: 1, puntos: 80, escala_evaluada: 100, parcial: false }], modulos: [m1] }
  const p = propuestaComentarios(d, 1)
  assert.match(p.comentario, /^Ana completed cycle 1/)
  assert.ok(p.habilidades.Speaking && p.habilidades.Listening)
  const parcial = propuestaComentarios({ ...d, ciclos: [{ ciclo: 1, puntos: 80, escala_evaluada: 100, parcial: true }] }, 1)
  assert.equal(parcial.comentario, '') // sin ciclo completo no se redacta un cierre
})
