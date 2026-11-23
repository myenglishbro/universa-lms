import test from 'node:test'
import assert from 'node:assert/strict'
import { claveHabilidad, nivelDePct, nombreCriterio, promedioAnterior, seguimientoDetalle, seguimientoFormative, tendencia } from './seguimiento.js'

const crit = (criterio, puntaje, max = 20) => ({ criterio, puntaje, max })
const nota = (unidad, criterios) => ({ unidad, puntaje: 70, criterios })
const modulo = (id, nombre, notas) => ({ modulo_id: id, nombre, evaluaciones: [{ tipo: 'test', notas: [] }, { tipo: 'formative', notas }] })

test('claveHabilidad empareja «Listening / Lessons» con «Listening»', () => {
  assert.equal(claveHabilidad('Listening / Lessons'), 'listening')
  assert.equal(claveHabilidad('Listening'), 'listening')
})

test('tendencia: pendiente, primera nota, mejora, baja, estable y atención por debajo de 50 %', () => {
  assert.equal(tendencia([null, null, null]).estado, 'sin_nota')
  assert.deepEqual(tendencia([null, 70, null]), { estado: 'primera', delta: null })
  assert.deepEqual(tendencia([40, 55, 72]), { estado: 'mejora', delta: 32 })
  assert.deepEqual(tendencia([90, 80, 70]), { estado: 'baja', delta: -20 })
  assert.deepEqual(tendencia([70, 72, null]), { estado: 'estable', delta: 2 })
  assert.equal(tendencia([30, 45]).estado, 'atencion')
})

test('seguimientoFormative: % por unidad, sin publicar = null (no cero), y se ignoran módulos sin detalle', () => {
  const s = seguimientoFormative([
    modulo('m0', 'Module 0', []),
    modulo('m1', 'Module 1', [nota('Unit 1', [crit('Listening', 12), crit('Writing', 14)]), nota('Unit 2', [crit('Listening', 16), crit('Writing', 10)])]),
  ])
  assert.equal(s.length, 1)
  assert.deepEqual(s[0].unidades, ['Unit 1', 'Unit 2', 'Unit 3'])
  const l = s[0].habilidades.find((h) => h.nombre === 'Listening')
  assert.deepEqual(l.valores, [60, 80, null])
  assert.equal(l.ultimo, 80)
  assert.equal(l.promedio, 70)
  assert.equal(l.estado, 'mejora')
  assert.equal(s[0].habilidades.find((h) => h.nombre === 'Writing').estado, 'baja')
})

test('seguimientoFormative: ignora la participación (unidad vacía) y notas sin criterios', () => {
  const s = seguimientoFormative([modulo('m1', 'Module 1', [{ unidad: '', puntaje: 80, criterios: null }, nota('Unit 1', [])])])
  assert.equal(s.length, 0)
})

test('promedioAnterior toma el promedio del módulo previo por habilidad, aunque el nombre cambie', () => {
  const s = seguimientoFormative([
    modulo('m1', 'Module 1', [nota('Unit 1', [crit('Listening / Lessons', 10, 20)]), nota('Unit 2', [crit('Listening / Lessons', 14, 20)])]),
    modulo('m2', 'Module 2', [nota('Unit 1', [crit('Listening', 16)])]),
  ])
  assert.deepEqual(promedioAnterior(s, 1), { listening: 60 })
  assert.deepEqual(promedioAnterior(s, 0), {})
})

const mw = (id, nombre, evals) => ({ modulo_id: id, nombre, evaluaciones: evals })
test('nombreCriterio quita el prefijo de tarea y de grupo', () => {
  assert.equal(nombreCriterio('Task 1 · Content & Task Achievement'), 'Content & Task Achievement')
  assert.equal(nombreCriterio('Grammar & Vocabulary · Grammar'), 'Grammar')
  assert.equal(nombreCriterio('Fluency & Coherence'), 'Fluency & Coherence')
})

test('seguimientoDetalle suma Task 1 y Task 2 por criterio y lee Project criterio por criterio', () => {
  const s = seguimientoDetalle([
    mw('m1', 'Module 1', [
      { tipo: 'writing', notas: [
        { unidad: 'Task 1', criterios: [{ criterio: 'Task 1 · Mechanics', puntaje: 2.4, max: 3 }] },
        { unidad: 'Task 2', criterios: [{ criterio: 'Task 2 · Mechanics', puntaje: 3.6, max: 6 }] },
      ] },
      { tipo: 'project', notas: [{ unidad: '', criterios: [{ criterio: 'Grammar & Vocabulary · Grammar', puntaje: 10, max: 12.5 }, { criterio: 'Visual Support & Delivery', puntaje: 5, max: 5 }] }] },
      { tipo: 'test', notas: [{ unidad: '', criterios: null }] },
    ]),
    mw('m2', 'Module 2', [{ tipo: 'writing', notas: [] }]),
  ])
  assert.equal(s.length, 1)
  assert.deepEqual(s[0].writing, [{ nombre: 'Mechanics', clave: 'mechanics', pct: 66.7 }])
  assert.deepEqual(s[0].project.map((c) => [c.nombre, c.pct]), [['Grammar', 80], ['Visual Support & Delivery', 100]])
})

test('nivelDePct convierte el porcentaje en nivel 0–5', () => {
  assert.deepEqual([0, 20, 59, 60, 100].map(nivelDePct), [0, 1, 3, 3, 5])
})

import { riesgoAsistencia } from './asistencia.js'
test('riesgoAsistencia: 2 tardanzas = 1 inasistencia y 25 % repite', () => {
  assert.equal(riesgoAsistencia({ presente: 21, ausente: 7, tardanza: 2, justificado: 0 }).enRiesgo, true)
  // Sobre el total del curso: 8 inasistencias de 48 clases = 16,7 % (no repite); de 32 = 25 % (repite).
  assert.equal(riesgoAsistencia({ presente: 21, ausente: 7, tardanza: 2 }, 48).enRiesgo, false)
  assert.equal(riesgoAsistencia({ presente: 21, ausente: 7, tardanza: 2 }, 32).enRiesgo, true)
  assert.equal(riesgoAsistencia({ presente: 21, ausente: 7, tardanza: 2 }, 48).limiteClases, 12)
  // Margen: límite 12, lleva 8 → puede tener 3 faltas más; solo tardanzas: 7 (2 ya forman un par → 6 llegan a 11, la 7.ª aún no completa par).
  const m = riesgoAsistencia({ presente: 21, ausente: 7, tardanza: 2 }, 48)
  assert.equal(m.faltasRestantes, 3)
  assert.equal(m.tardanzasRestantes, 7)
  assert.equal(riesgoAsistencia({ presente: 21, ausente: 7, tardanza: 3 }, 48).tardanzasRestantes, 6)
  assert.equal(riesgoAsistencia({ presente: 21, ausente: 7, tardanza: 2 }, 32).faltasRestantes, 0)
  const r = riesgoAsistencia({ presente: 20, ausente: 2, tardanza: 1, justificado: 0 })
  assert.equal(r.equivalentes, 2)
  assert.equal(r.enRiesgo, false)
  assert.equal(riesgoAsistencia({ presente: 3, ausente: 0, tardanza: 1 }).equivalentes, 0)
  assert.equal(riesgoAsistencia({ presente: 3, ausente: 1, tardanza: 0 }).pct, 25)
  assert.equal(riesgoAsistencia({ presente: 0, ausente: 0, tardanza: 0 }).enRiesgo, false)
})
