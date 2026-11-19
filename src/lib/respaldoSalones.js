// Respaldo en Excel de todos los salones (vigentes y archivados): una hoja de salones, otra de estudiantes matriculados, otra de horarios y,
// si se pidieron, las notas por módulo. Las filas se arman aquí (funciones puras, con pruebas) y ExcelJS solo escribe el libro al descargar.
import { diasSemana, estados, formatHorario } from './salones.js'

const estadoDe = (v) => estados.find((e) => e.value === v)?.label ?? v ?? ''
const dia = (n) => diasSemana.find((d) => d.value === n)?.label ?? String(n)
const estadoMatricula = (v) => ({ activa: 'Active', retirada: 'Withdrawn' })[v] ?? v ?? ''
const num = (n) => (n == null || n === '' || Number.isNaN(Number(n)) ? '' : Math.round(Number(n) * 100) / 100)

export const COLUMNAS_SALONES = ['Code', 'Classroom', 'Level', 'Course', 'Teacher', 'Status', 'Archived', 'Archive cycle', 'Start', 'End (estimated)', 'Schedule', 'Frequency', 'Plan', 'Capacity', 'Enrolled', 'Total sessions', 'Progress %', 'Cycle from', 'Cycle to', 'Hours package', 'Notes']

// matriculasActivas: Map(salon_id → n). progreso: { [salonId]: { porcentaje } } (el que ya cargó el panel).
export function filasSalones(salones, matriculasActivas = new Map()) {
  return salones.map((s) => [
    s.codigo ?? '', s.nombre ?? '', s.nivel ?? '', s.curso ?? '', s.docente ?? '', estadoDe(s.estado), s.archivadoAt ? 'Yes' : 'No', s.cicloArchivo ?? '',
    s.fechaInicio ?? '', s.fechaFin ?? '', formatHorario(s.horarios ?? []).replace('—', ''), s.frecuencia?.nombre ?? '',
    s.plan ? `${s.plan.nivel} · ${s.plan.modalidad} · ${s.plan.minutos} min · ${s.plan.sesionesSemana}/week` : '',
    s.capacidad ?? '', matriculasActivas.get(s.id) ?? 0, s.totalSesiones ?? '', num(s.progreso?.porcentaje), s.cicloDesde ?? '', s.cicloHasta ?? '',
    s.paquete ? `${num(s.paquete.contratadas / 60)} h contracted · ${num(s.paquete.consumidas / 60)} h used` : '', s.observaciones ?? '',
  ])
}

export const COLUMNAS_ESTUDIANTES = ['Classroom code', 'Classroom', 'Student', 'Email', 'Phone', 'Enrollment status', 'Enrolled since', 'Left on', 'Reason for leaving']

export function filasMatriculas(salones, estudiantes, matriculas) {
  const salonPor = new Map(salones.map((s) => [s.id, s]))
  const alumnoPor = new Map(estudiantes.map((a) => [a.id, a]))
  return matriculas
    .filter((m) => salonPor.has(m.salon_id))
    .map((m) => [salonPor.get(m.salon_id), alumnoPor.get(m.alumno_id), m])
    .sort((x, y) => (x[0].codigo ?? '').localeCompare(y[0].codigo ?? '') || (x[1]?.nombre ?? '').localeCompare(y[1]?.nombre ?? ''))
    .map(([s, a, m]) => [s.codigo ?? '', s.nombre ?? '', a?.nombre ?? '(unknown student)', a?.correo ?? '', a?.telefono ?? '', estadoMatricula(m.estado), m.fecha_inicio ?? '', m.fecha_fin ?? '', m.motivo_retiro ?? ''])
}

export const COLUMNAS_HORARIOS = ['Classroom code', 'Classroom', 'Day', 'Start', 'End']

export function filasHorarios(salones) {
  return salones.flatMap((s) => (s.horarios ?? []).map((h) => [s.codigo ?? '', s.nombre ?? '', dia(h.dia), h.horaInicio, h.horaFin]))
}

export const COLUMNAS_NOTAS = ['Classroom code', 'Classroom', 'Student', 'Cycle', 'Module', 'Module grade (/100)', 'Partial', 'Published through', 'Final level grade']

// matrices: [{ salon, matriz }] con la respuesta de eval_matriz_salon. Una fila por estudiante y módulo (y una sin módulo si no hay módulos con notas).
export function filasNotas(matrices) {
  const filas = []
  for (const { salon, matriz } of matrices) {
    for (const a of matriz?.alumnos ?? []) {
      const nivel = a.nivel?.definido ? num(a.nivel.nota) : ''
      const mods = (a.resumen?.modulos ?? []).filter((m) => !m.sin_plantilla)
      if (mods.length === 0) filas.push([salon.codigo ?? '', salon.nombre ?? '', a.nombre, '', '', '', '', '', nivel])
      for (const m of mods) {
        filas.push([salon.codigo ?? '', salon.nombre ?? '', a.nombre, m.ciclo ?? '', m.nombre ?? '', num(m.nota), m.parcial ? 'Yes' : 'No', num(m.peso_evaluado) === '' ? '' : `${num(m.peso_evaluado)}%`, nivel])
      }
    }
  }
  return filas
}

export const nombreRespaldo = (fecha = new Date()) => `UNIVERSA classrooms backup ${fecha.toISOString().slice(0, 10)}.xlsx`

// Cuenta de matrículas activas por salón.
export function matriculasActivasPorSalon(matriculas) {
  const por = new Map()
  for (const m of matriculas) if (m.estado === 'activa') por.set(m.salon_id, (por.get(m.salon_id) ?? 0) + 1)
  return por
}

// Libro de Excel. `notas` es opcional (null = sin hoja de notas). Devuelve un Blob.
export async function construirRespaldo({ salones, estudiantes, matriculas, notas = null }) {
  const { default: ExcelJS } = await import('exceljs')
  const wb = new ExcelJS.Workbook()
  wb.creator = 'UNIVERSA'
  wb.created = new Date()
  const hoja = (nombre, columnas, filas, anchos = []) => {
    const ws = wb.addWorksheet(nombre, { views: [{ state: 'frozen', ySplit: 1 }] })
    ws.columns = columnas.map((c, i) => ({ header: c, key: `c${i}`, width: anchos[i] ?? Math.min(40, Math.max(12, c.length + 4)) }))
    filas.forEach((f) => ws.addRow(f))
    const cab = ws.getRow(1)
    cab.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    cab.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF410099' } }
    cab.alignment = { vertical: 'middle', wrapText: true }
    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columnas.length } }
    return ws
  }
  hoja('Classrooms', COLUMNAS_SALONES, filasSalones(salones, matriculasActivasPorSalon(matriculas)), [12, 28, 16, 18, 22, 12, 10, 12, 12, 14, 34, 18, 34])
  hoja('Students', COLUMNAS_ESTUDIANTES, filasMatriculas(salones, estudiantes, matriculas), [14, 28, 28, 30, 16, 16, 14, 12, 28])
  hoja('Schedules', COLUMNAS_HORARIOS, filasHorarios(salones), [14, 28, 14, 10, 10])
  if (notas) hoja('Grades', COLUMNAS_NOTAS, filasNotas(notas), [14, 28, 28, 8, 20, 18, 9, 16, 16])
  const info = wb.addWorksheet('About')
  info.addRows([
    ['UNIVERSA classrooms backup'],
    ['Generated', new Date().toISOString().slice(0, 16).replace('T', ' ')],
    ['Classrooms', salones.length],
    ['Enrollments', filasMatriculas(salones, estudiantes, matriculas).length],
    ['Grades included', notas ? 'Yes (published and draft module results of active classrooms)' : 'No'],
    ['Note', 'Contains personal data of students. Store it securely. For the full assessment file of one classroom (rubrics, attendance, charts) use its own "Download Excel".'],
  ])
  info.getColumn(1).width = 24
  info.getColumn(2).width = 90
  info.getRow(1).font = { bold: true, size: 14 }
  const buffer = await wb.xlsx.writeBuffer()
  return new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
}
