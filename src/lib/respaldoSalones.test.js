import test from 'node:test'
import assert from 'node:assert/strict'
import { COLUMNAS_ESTUDIANTES, COLUMNAS_NOTAS, COLUMNAS_SALONES, filasHorarios, filasMatriculas, filasNotas, filasSalones, matriculasActivasPorSalon, nombreRespaldo } from './respaldoSalones.js'

const salon = { id: 's1', codigo: 'A-01', nombre: 'Basic Monday', nivel: 'Basic', curso: 'English', docente: 'Ana', estado: 'en_curso', archivadoAt: null, fechaInicio: '2026-11-02', fechaFin: '2027-02-17', capacidad: 8, totalSesiones: 48, progreso: { porcentaje: 25.456 },
  horarios: [{ dia: 1, horaInicio: '19:00', horaFin: '20:00' }, { dia: 3, horaInicio: '19:00', horaFin: '20:00' }], frecuencia: { nombre: '2x week' }, plan: null, paquete: null }
const archivado = { id: 's2', codigo: 'B-02', nombre: 'Old', archivadoAt: '2026-10-01', cicloArchivo: 'Cycle 1', horarios: [] }
const alumnos = [{ id: 'a1', nombre: 'Zoe', correo: 'z@x.com', telefono: '999' }, { id: 'a2', nombre: 'Abel', correo: '', telefono: '' }]
const mats = [{ salon_id: 's1', alumno_id: 'a1', estado: 'activa', fecha_inicio: '2026-11-02' }, { salon_id: 's1', alumno_id: 'a2', estado: 'activa', fecha_inicio: '2026-11-02' }, { salon_id: 's2', alumno_id: 'a1', estado: 'retirada', fecha_fin: '2026-10-01', motivo_retiro: 'Ended' }, { salon_id: 'otro', alumno_id: 'a1', estado: 'activa' }]

test('filasSalones: una fila por salón con tantas celdas como columnas, matriculados y horario legible', () => {
  const f = filasSalones([salon, archivado], matriculasActivasPorSalon(mats))
  assert.equal(f.length, 2)
  assert.ok(f.every((r) => r.length === COLUMNAS_SALONES.length))
  assert.equal(f[0][5], 'In progress')
  assert.equal(f[0][10], 'Mon · Wed 19:00–20:00')
  assert.equal(f[0][14], 2)
  assert.equal(f[0][16], 25.46)
  assert.equal(f[1][6], 'Yes')
  assert.equal(f[1][7], 'Cycle 1')
  assert.equal(f[1][10], '')
})

test('filasMatriculas: ordena por salón y estudiante, ignora salones fuera del respaldo y conserva retiros', () => {
  const f = filasMatriculas([salon, archivado], alumnos, mats)
  assert.equal(f.length, 3)
  assert.ok(f.every((r) => r.length === COLUMNAS_ESTUDIANTES.length))
  assert.deepEqual(f.map((r) => [r[0], r[2]]), [['A-01', 'Abel'], ['A-01', 'Zoe'], ['B-02', 'Zoe']])
  assert.equal(f[2][8], 'Ended')
  assert.deepEqual(f.map((r) => r[5]), ['Active', 'Active', 'Withdrawn'])
})

test('filasHorarios: una fila por franja con el día en inglés', () => {
  assert.deepEqual(filasHorarios([salon]), [['A-01', 'Basic Monday', 'Monday', '19:00', '20:00'], ['A-01', 'Basic Monday', 'Wednesday', '19:00', '20:00']])
})

test('filasNotas: una fila por estudiante y módulo, sin módulos queda una fila con la nota de nivel', () => {
  const matriz = { alumnos: [
    { nombre: 'Zoe', nivel: { definido: true, nota: 81.256 }, resumen: { modulos: [{ ciclo: 0, nombre: 'Module 1', nota: 90, parcial: false, peso_evaluado: 100 }, { ciclo: 0, nombre: 'Module 2', nota: 72.5, parcial: true, peso_evaluado: 60 }, { nombre: 'Sin plantilla', sin_plantilla: true }] } },
    { nombre: 'Abel', nivel: { definido: false }, resumen: { modulos: [] } },
  ] }
  const f = filasNotas([{ salon, matriz }])
  assert.equal(f.length, 3)
  assert.ok(f.every((r) => r.length === COLUMNAS_NOTAS.length))
  assert.deepEqual(f[0].slice(3), [0, 'Module 1', 90, 'No', '100%', 81.26])
  assert.deepEqual(f[1].slice(5, 8), [72.5, 'Yes', '60%'])
  assert.deepEqual(f[2].slice(2), ['Abel', '', '', '', '', '', ''])
})

test('nombreRespaldo lleva la fecha', () => {
  assert.equal(nombreRespaldo(new Date('2026-11-19T12:00:00Z')), 'UNIVERSA classrooms backup 2026-11-19.xlsx')
})
