// Compendio Excel de un salón (ASSESSMENT FILE): ficha, rendimiento del salón (con gráficos), una hoja por estudiante (grades chart + notas por módulo), asistencia, detalle de notas y rúbricas.
// Se arma en el navegador con ExcelJS (se carga solo al descargar). Las sumas y los porcentajes quedan como fórmulas vivas.
import { etiquetaUnidad } from './evaluaciones'
import { nivelDesempeno } from './informeNotas'
import { formatFecha, formatHorario } from './salones'
import { graficoBarras, PALETA } from './compendioGraficos'

const MARCA = {
  morado: 'FF410099',
  moradoOscuro: 'FF1B0042',
  lila: 'FFE6DCF7',
  lilaSuave: 'FFF4EFFC',
  durazno: 'FFFFB97E',
  duraznoSuave: 'FFFFE9D6',
  gris: 'FF64748B',
  linea: 'FFCBB5EE',
  verde: 'FFD9F2E3',
  rojo: 'FFFBE0E4',
  ambar: 'FFFFF1CC',
}
const FUENTE = 'Calibri'
const MESES = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC']

const num = (v) => (v == null || v === '' || Number.isNaN(Number(v)) ? null : Number(v))
const r2 = (v) => Math.round(v * 100) / 100
// Letra de columna de ExcelJS (1 = A).
const col = (n) => {
  let s = ''
  for (let x = n; x > 0; x = Math.floor((x - 1) / 26)) s = String.fromCharCode(65 + ((x - 1) % 26)) + s
  return s
}
const borde = { style: 'thin', color: { argb: MARCA.linea } }
const bordes = { top: borde, left: borde, bottom: borde, right: borde }

export function nombreArchivo(salon) {
  const anio = (salon.fechaInicio || '').slice(0, 4) || String(new Date().getFullYear())
  const mes = (iso) => (iso && MESES[Number(iso.slice(5, 7)) - 1]) || ''
  const periodo = [mes(salon.fechaInicio), mes(salon.fechaFin)].filter(Boolean)
  const base = `ASSESSMENT FILE ${anio} - ${(salon.nivel || salon.nombre).toUpperCase()} GROUP${periodo.length ? ` ${[...new Set(periodo)].join('-')}` : ''} (${salon.codigo || salon.nombre})`
  return `${base.replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim()}.xlsx`
}

// Encabezado de marca de cada hoja: banda morada con el logo, línea durazno, título y subtítulo. Devuelve la primera fila libre.
function cabecera(wb, ws, logoId, titulo, subtitulo, columnas) {
  const ancho = Math.max(columnas, 8)
  ws.getRow(1).height = 44
  for (let c = 1; c <= ancho; c++) ws.getCell(1, c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: MARCA.morado } }
  ws.getRow(2).height = 5
  for (let c = 1; c <= ancho; c++) ws.getCell(2, c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: MARCA.durazno } }
  if (logoId != null) ws.addImage(logoId, { tl: { col: 0.15, row: 0.18 }, ext: { width: 118, height: 30 } })
  ws.getCell(3, 1).value = titulo
  ws.getCell(3, 1).font = { name: FUENTE, size: 18, bold: true, color: { argb: MARCA.morado } }
  ws.getRow(3).height = 30
  ws.getCell(4, 1).value = subtitulo
  ws.getCell(4, 1).font = { name: FUENTE, size: 10, color: { argb: MARCA.gris } }
  ws.views = [{ showGridLines: false, state: 'normal' }]
  ws.properties.tabColor = { argb: MARCA.morado }
  return 6
}

function celdaTitulo(cell, texto, { fondo = MARCA.morado, color = 'FFFFFFFF', alinear = 'center' } = {}) {
  cell.value = texto
  cell.font = { name: FUENTE, size: 10, bold: true, color: { argb: color } }
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fondo } }
  cell.alignment = { vertical: 'middle', horizontal: alinear, wrapText: true }
  cell.border = bordes
}
function celda(cell, valor, { negrita = false, fondo, alinear = 'left', formato, color } = {}) {
  cell.value = valor
  cell.font = { name: FUENTE, size: 10, bold: negrita, color: color ? { argb: color } : undefined }
  if (fondo) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fondo } }
  cell.alignment = { vertical: 'middle', horizontal: alinear, wrapText: true }
  cell.border = bordes
  if (formato) cell.numFmt = formato
}

const primeraConModulos = (alumnos) => alumnos.map((a) => a.informe).find((i) => i?.modulos?.length) ?? null
const notaFinal = (inf) => (inf?.acumulado && Number(inf.acumulado.escala_evaluada) > 0 ? num(inf.acumulado.puntos) : null)

// ---------------------------------------------------------------------------
function hojaFicha(wb, logoId, d) {
  const { salon, alumnos } = d
  const ws = wb.addWorksheet('FICHA DE CURSO')
  ws.columns = [{ width: 26 }, { width: 44 }, { width: 16 }, { width: 22 }, { width: 16 }]
  let f = cabecera(wb, ws, logoId, 'Ficha de curso', `${salon.nombre} · ${salon.codigo}`, 5)

  const inf = primeraConModulos(alumnos)
  const filas = [
    ['Programa', 'UNIVERSA'],
    ['Salón', salon.nombre],
    ['Código', salon.codigo],
    ['Nivel', [salon.nivel, inf?.mcer && `(${inf.mcer})`].filter(Boolean).join(' ') || '—'],
    ['Modalidad', salon.plan?.modalidad || inf?.modalidad || 'Grupal'],
    ['Ciclos', salon.cicloDesde ? `${salon.cicloDesde}${salon.cicloHasta && salon.cicloHasta !== salon.cicloDesde ? ` a ${salon.cicloHasta}` : ''}` : '—'],
    ['Horario', formatHorario(salon.horarios)],
    ['Docente', salon.docente || '—'],
    ['Inicio de clases', formatFecha(salon.fechaInicio)],
    ['Fin de clases', formatFecha(salon.fechaFin)],
    ['Estado', salon.cicloArchivo ? `Archivado · ciclo ${salon.cicloArchivo}` : salon.estado === 'finalizado' ? 'Finalizado' : salon.estado === 'en_curso' ? 'En curso' : 'Pendiente'],
    ['Estudiantes', `${alumnos.length}${salon.capacidad ? ` de ${salon.capacidad}` : ''}`],
    ['Archivo generado', formatFecha(new Date().toISOString().slice(0, 10))],
  ]
  for (const [k, v] of filas) {
    celda(ws.getCell(f, 1), k, { negrita: true, fondo: MARCA.lila })
    ws.mergeCells(f, 2, f, 4)
    celda(ws.getCell(f, 2), v)
    for (let c = 3; c <= 4; c++) ws.getCell(f, c).border = bordes
    f++
  }

  f += 1
  ws.getCell(f, 1).value = 'ESTUDIANTES'
  ws.getCell(f, 1).font = { name: FUENTE, size: 12, bold: true, color: { argb: MARCA.morado } }
  f += 1
  ;['N°', 'Estudiante', 'Nota final', 'Desempeño', 'Asistencia'].forEach((t, i) => celdaTitulo(ws.getCell(f, i + 1), t))
  ws.getRow(f).height = 22
  f += 1
  alumnos.forEach((a, i) => {
    const nota = notaFinal(a.informe)
    const as = a.informe?.asistencia
    const pctAsis = as && Number(as.programadas) > 0 ? (Number(as.presentes) + Number(as.tardanzas) * 0.5 + Number(as.justificadas)) / Number(as.programadas) : null
    celda(ws.getCell(f, 1), i + 1, { alinear: 'center' })
    celda(ws.getCell(f, 2), a.nombre, { negrita: true })
    celda(ws.getCell(f, 3), nota, { alinear: 'center', formato: '0.0' })
    celda(ws.getCell(f, 4), nivelDesempeno(nota) ?? '—', { alinear: 'center' })
    celda(ws.getCell(f, 5), pctAsis, { alinear: 'center', formato: '0%' })
    f++
  })
  if (alumnos.some((a) => a.informe?.acumulado?.parcial)) {
    ws.getCell(f + 1, 1).value = 'Nota final parcial: hay evaluaciones del ciclo que aún no se publican.'
    ws.getCell(f + 1, 1).font = { name: FUENTE, size: 9, italic: true, color: { argb: MARCA.gris } }
  }
}

// ---------------------------------------------------------------------------
// Nota 0–100 de un módulo (solo si ya tiene algo evaluado).
const notaModulo = (m) => (m && Number(m.peso_evaluado) > 0 && !m.sin_plantilla ? num(m.nota) : null)
const promedio = (vs) => {
  const v = vs.filter((x) => x != null)
  return v.length ? r2(v.reduce((s, x) => s + x, 0) / v.length) : null
}
const NIVELES = ['Outstanding', 'Achieved', 'Developing', 'Beginning']

// Estadísticas del salón por módulo y por alumno (alimentan la hoja de rendimiento y la comparación de cada alumno).
function estadisticas(alumnos) {
  const base = primeraConModulos(alumnos)
  const mods = base?.modulos ?? []
  const porModulo = mods.map((m, mi) => {
    const vals = alumnos.map((a) => notaModulo(a.informe?.modulos?.[mi]))
    return { nombre: m.nombre, ciclo: m.ciclo, promedio: promedio(vals) }
  })
  const finales = alumnos.map((a) => notaFinal(a.informe))
  return { base, mods, porModulo, finales, promedioFinal: promedio(finales) }
}

// Columna (fraccionaria) que queda a `px` píxeles del borde izquierdo de la hoja, según el ancho de sus columnas.
function colEnPx(ws, px) {
  let acum = 0
  const cols = ws.columns
  for (let i = 0; i < cols.length; i++) {
    const w = (cols[i].width ?? 8.43) * 7 + 5
    if (acum + w > px) return i + (px - acum) / w
    acum += w
  }
  return cols.length + (px - acum) / 64
}

async function insertarGrafico(wb, ws, grafico, col0, fila0) {
  if (!grafico) return 0
  const id = wb.addImage({ buffer: grafico.buffer, extension: 'png' })
  ws.addImage(id, { tl: { col: col0, row: fila0 }, ext: { width: grafico.ancho, height: grafico.alto } })
  return Math.ceil(grafico.alto / 20) + 1 // filas (de 15pt ≈ 20px) que ocupa
}

// ---------------------------------------------------------------------------
// Una hoja por estudiante: su Grades Chart (componentes y nota ponderada) y sus notas por módulo y ciclo.
const nombreHoja = (nombre, i, usados) => {
  const limpio = String(nombre).replace(/[\\/?*[\]:]/g, ' ').replace(/\s+/g, ' ').trim()
  let base = `${i + 1}. ${limpio}`.slice(0, 31).trim()
  let n = 2
  while (usados.has(base.toLowerCase())) base = `${`${i + 1}. ${limpio}`.slice(0, 28)}~${n++}`
  usados.add(base.toLowerCase())
  return base
}

async function hojaAlumno(wb, logoId, d, a, i, est, usados) {
  const { salon } = d
  const inf = a.informe
  const ws = wb.addWorksheet(nombreHoja(a.nombre, i, usados))
  ws.columns = [{ width: 11 }, { width: 26 }, { width: 32 }, { width: 9 }, { width: 12 }, { width: 16 }, { width: 3 }]
  let f = cabecera(wb, ws, logoId, a.nombre, `${salon.nombre} · Grades chart y notas por módulo`, 6)
  ws.properties.tabColor = { argb: MARCA.durazno }

  if (!inf?.modulos?.length) {
    ws.getCell(f, 1).value = 'Este estudiante aún no tiene módulos con evaluaciones.'
    ws.getCell(f, 1).font = { name: FUENTE, size: 10, italic: true, color: { argb: MARCA.gris } }
    return
  }

  // Resumen
  const nota = notaFinal(inf)
  const as = inf.asistencia
  const pctAsis = as && Number(as.programadas) > 0 ? (Number(as.presentes) + Number(as.tardanzas) * 0.5 + Number(as.justificadas)) / Number(as.programadas) : null
  const resumen = [
    ['Nivel', [salon.nivel, inf.mcer && `(${inf.mcer})`].filter(Boolean).join(' ') || '—', null],
    ['Nota acumulada (0–100)', nota, '0.0'],
    ['Desempeño', nivelDesempeno(nota) ?? '—', null],
    ['Asistencia', pctAsis, '0%'],
    ['Estado de la nota', inf.acumulado?.parcial ? 'Parcial' : 'Completa', null],
  ]
  for (const [k, v, fmt] of resumen) {
    ws.mergeCells(f, 1, f, 2)
    celda(ws.getCell(f, 1), k, { negrita: true, fondo: MARCA.lila })
    ws.getCell(f, 2).border = bordes
    ws.mergeCells(f, 3, f, 4)
    celda(ws.getCell(f, 3), v, { alinear: 'center', formato: fmt ?? undefined, negrita: true })
    ws.getCell(f, 4).border = bordes
    f++
  }
  f++

  // GRADES CHART
  ws.getCell(f, 1).value = 'GRADES CHART'
  ws.getCell(f, 1).font = { name: FUENTE, size: 12, bold: true, color: { argb: MARCA.morado } }
  f++
  ;['CICLO', 'MÓDULO', 'COMPONENTE', 'PESO', 'PUNTAJE', 'NOTA PONDERADA'].forEach((t, k) => celdaTitulo(ws.getCell(f, k + 1), t, k === 5 ? { fondo: MARCA.durazno, color: MARCA.moradoOscuro } : undefined))
  ws.getRow(f).height = 24
  f++
  const subtotales = []
  inf.modulos.forEach((m) => {
    const comps = m.componentes ?? []
    const ini = f
    comps.forEach((c, ci) => {
      celda(ws.getCell(f, 1), ci === 0 ? (m.ciclo != null ? `CYCLE ${m.ciclo}` : '') : '', { alinear: 'center', fondo: MARCA.lilaSuave })
      celda(ws.getCell(f, 2), ci === 0 ? m.nombre : '', { negrita: true, fondo: MARCA.lilaSuave })
      celda(ws.getCell(f, 3), c.nombre)
      celda(ws.getCell(f, 4), num(c.peso), { alinear: 'center', formato: '0.##' })
      const punt = c.estado === 'completo' ? num(c.nota) : null
      celda(ws.getCell(f, 5), punt, { alinear: 'center', formato: '0.0' })
      celda(ws.getCell(f, 6), { formula: `IF(ISNUMBER(E${f}),E${f}*D${f}/100,"")`, result: punt != null ? r2((punt * Number(c.peso)) / 100) : '' }, { alinear: 'center', formato: '0.00', fondo: MARCA.duraznoSuave })
      f++
    })
    if (!comps.length) return
    ws.mergeCells(f, 1, f, 3)
    celdaTitulo(ws.getCell(f, 1), `TOTAL ${m.nombre.toUpperCase()}`, { fondo: MARCA.lila, color: MARCA.moradoOscuro, alinear: 'right' })
    for (let c = 2; c <= 3; c++) ws.getCell(f, c).border = bordes
    celda(ws.getCell(f, 4), { formula: `SUM(D${ini}:D${f - 1})`, result: r2(comps.reduce((s, c) => s + Number(c.peso || 0), 0)) }, { negrita: true, alinear: 'center', fondo: MARCA.lila, formato: '0.##' })
    celda(ws.getCell(f, 5), null, { fondo: MARCA.lila })
    celda(ws.getCell(f, 6), { formula: `SUM(F${ini}:F${f - 1})`, result: num(m.puntos) ?? 0 }, { negrita: true, alinear: 'center', fondo: MARCA.lila, formato: '0.00' })
    subtotales.push(f)
    f++
  })
  f++
  ws.mergeCells(f, 1, f, 5)
  celdaTitulo(ws.getCell(f, 1), 'FINAL SCORE (suma de los módulos)', { alinear: 'right' })
  for (let c = 2; c <= 5; c++) ws.getCell(f, c).border = bordes
  celda(ws.getCell(f, 6), { formula: subtotales.map((r) => `F${r}`).join('+') || '0', result: r2(inf.modulos.reduce((s, m) => s + (num(m.puntos) ?? 0), 0)) }, { negrita: true, alinear: 'center', fondo: MARCA.durazno, formato: '0.00', color: MARCA.moradoOscuro })
  ws.getRow(f).height = 24
  f += 2

  // NOTAS POR MÓDULO (con el promedio del salón para comparar)
  ws.getCell(f, 1).value = 'NOTAS POR MÓDULO'
  ws.getCell(f, 1).font = { name: FUENTE, size: 12, bold: true, color: { argb: MARCA.morado } }
  f++
  ;['CICLO', 'MÓDULO', 'AVANCE DE EVALUACIÓN', 'NOTA 0–100', 'PROMEDIO SALÓN', 'DIFERENCIA'].forEach((t, k) => celdaTitulo(ws.getCell(f, k + 1), t, k >= 3 ? { fondo: MARCA.moradoOscuro } : undefined))
  ws.getRow(f).height = 30
  f++
  const ini = f
  const etiquetas = []
  const suyas = []
  const delSalon = []
  inf.modulos.forEach((m, mi) => {
    const n = notaModulo(m)
    const prom = est.porModulo[mi]?.promedio ?? null
    const avance = Number(m.peso_evaluado) > 0 ? `${r2(Number(m.peso_evaluado))}% evaluado` : 'Sin evaluar'
    celda(ws.getCell(f, 1), m.ciclo != null ? `CYCLE ${m.ciclo}` : '', { alinear: 'center', fondo: MARCA.lilaSuave })
    celda(ws.getCell(f, 2), m.nombre, { negrita: true, fondo: MARCA.lilaSuave })
    celda(ws.getCell(f, 3), avance, { alinear: 'center' })
    celda(ws.getCell(f, 4), n, { alinear: 'center', formato: '0.0', negrita: true })
    celda(ws.getCell(f, 5), prom, { alinear: 'center', formato: '0.0' })
    celda(ws.getCell(f, 6), { formula: `IF(AND(ISNUMBER(D${f}),ISNUMBER(E${f})),D${f}-E${f},"")`, result: n != null && prom != null ? r2(n - prom) : '' }, { alinear: 'center', formato: '+0.0;-0.0;0.0' })
    etiquetas.push(m.nombre)
    suyas.push(n)
    delSalon.push(prom)
    f++
  })
  ws.addConditionalFormatting({
    ref: `D${ini}:D${f - 1}`,
    rules: [
      { type: 'cellIs', operator: 'lessThan', formulae: [60], style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: MARCA.rojo } } } },
      { type: 'cellIs', operator: 'greaterThanOrEqual', formulae: [70], style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: MARCA.verde } } } },
    ],
  })
  ws.addConditionalFormatting({
    ref: `F${ini}:F${f - 1}`,
    rules: [
      { type: 'cellIs', operator: 'lessThan', formulae: [0], style: { font: { color: { argb: 'FFC2415A' } } } },
      { type: 'cellIs', operator: 'greaterThan', formulae: [0], style: { font: { color: { argb: 'FF15803D' } } } },
    ],
  })
  ws.getCell(f + 1, 1).value = 'Escala: Outstanding ≥ 86 · Achieved ≥ 70 · Developing ≥ 60 · Beginning < 60.'
  ws.getCell(f + 1, 1).font = { name: FUENTE, size: 9, italic: true, color: { argb: MARCA.gris } }

  // Gráfico: el estudiante frente al promedio del salón, módulo por módulo (a la derecha de las tablas)
  const grafico = await graficoBarras({
    titulo: 'Notas por módulo: estudiante vs. promedio del salón',
    etiquetas,
    series: [
      { nombre: 'Estudiante', valores: suyas, color: PALETA.morado },
      { nombre: 'Promedio salón', valores: delSalon, color: PALETA.durazno },
    ],
    linea: { valor: 70, etiqueta: 'Achieved 70' },
    ancho: 600,
    alto: 320,
  })
  await insertarGrafico(wb, ws, grafico, 7, 5)
}

// ---------------------------------------------------------------------------
// Rendimiento del salón: matriz de notas por módulo + gráficos para compararlo entre módulos.
async function hojaRendimiento(wb, logoId, d, est) {
  const { salon, alumnos } = d
  const { mods, porModulo, finales } = est
  const ciclos = est.base?.ciclos ?? []
  const ws = wb.addWorksheet('RENDIMIENTO DEL SALÓN')
  const nCols = 2 + mods.length + ciclos.length + 3
  ws.columns = [{ width: 6 }, { width: 34 }, ...mods.map(() => ({ width: 14 })), ...ciclos.map(() => ({ width: 13 })), { width: 15 }, { width: 16 }, { width: 14 }]
  let f = cabecera(wb, ws, logoId, 'Rendimiento del salón', `${salon.nombre} · notas de 0 a 100 por módulo y comparación entre módulos`, Math.max(nCols, 10))
  ws.properties.tabColor = { argb: MARCA.durazno }
  if (!mods.length || !alumnos.length) {
    ws.getCell(f, 1).value = 'Aún no hay módulos con evaluaciones para este salón.'
    ws.getCell(f, 1).font = { name: FUENTE, size: 10, italic: true, color: { argb: MARCA.gris } }
    return
  }

  const cab = ['N°', 'Estudiante', ...mods.map((m) => m.nombre), ...ciclos.map((c) => (c.ciclo != null ? `Ciclo ${c.ciclo}` : 'Sin ciclo')), 'NOTA ACUMULADA', 'Desempeño', 'Estado']
  const filaCab = f
  cab.forEach((t, k) => celdaTitulo(ws.getCell(f, k + 1), t, k >= cab.length - 3 ? { fondo: MARCA.moradoOscuro } : undefined))
  ws.getRow(f).height = 30
  ws.views = [{ showGridLines: false, state: 'frozen', xSplit: 2, ySplit: f }]
  f++
  const ini = f
  alumnos.forEach((a, i) => {
    const inf = a.informe
    celda(ws.getCell(f, 1), i + 1, { alinear: 'center' })
    celda(ws.getCell(f, 2), a.nombre, { negrita: true })
    let c = 3
    mods.forEach((_, mi) => celda(ws.getCell(f, c++), notaModulo(inf?.modulos?.[mi]), { alinear: 'center', formato: '0.0' }))
    ciclos.forEach((_, ci) => {
      const cc = inf?.ciclos?.[ci]
      celda(ws.getCell(f, c++), cc && Number(cc.escala_evaluada) > 0 ? num(cc.puntos) : null, { alinear: 'center', formato: '0.0' })
    })
    celda(ws.getCell(f, c++), finales[i], { alinear: 'center', formato: '0.0', negrita: true, fondo: MARCA.duraznoSuave })
    celda(ws.getCell(f, c++), nivelDesempeno(finales[i]) ?? '—', { alinear: 'center' })
    celda(ws.getCell(f, c++), !inf ? 'Sin informe' : inf.acumulado?.parcial ? 'Parcial' : 'Completa', { alinear: 'center' })
    f++
  })
  const fin = f - 1
  const colNota = 2 + mods.length + ciclos.length + 1 // columna de NOTA ACUMULADA

  // Resumen del salón (fórmulas vivas sobre la matriz)
  const resumen = [
    ['PROMEDIO DEL SALÓN', 'AVERAGE', 'AVERAGE'],
    ['NOTA MÁXIMA', 'MAX', 'MAX'],
    ['NOTA MÍNIMA', 'MIN', 'MIN'],
  ]
  const datosCol = (c) => {
    const k = c - 3
    if (k < mods.length) return alumnos.map((a) => notaModulo(a.informe?.modulos?.[k]))
    if (c === colNota) return finales
    const ci = k - mods.length
    return alumnos.map((a) => {
      const cc = a.informe?.ciclos?.[ci]
      return cc && Number(cc.escala_evaluada) > 0 ? num(cc.puntos) : null
    })
  }
  f++
  for (const [titulo, fn] of resumen) {
    ws.mergeCells(f, 1, f, 2)
    celdaTitulo(ws.getCell(f, 1), titulo, { fondo: MARCA.lila, color: MARCA.moradoOscuro, alinear: 'right' })
    ws.getCell(f, 2).border = bordes
    for (let c = 3; c <= colNota; c++) {
      const v = datosCol(c).filter((x) => x != null)
      const calc = !v.length ? '' : fn === 'AVERAGE' ? r2(v.reduce((s, x) => s + x, 0) / v.length) : fn === 'MAX' ? Math.max(...v) : Math.min(...v)
      celda(ws.getCell(f, c), { formula: `IFERROR(${fn}(${col(c)}${ini}:${col(c)}${fin}),"")`, result: calc }, { alinear: 'center', formato: '0.0', negrita: true, fondo: MARCA.lila })
    }
    f++
  }
  ws.mergeCells(f, 1, f, 2)
  celdaTitulo(ws.getCell(f, 1), '% DE ALUMNOS CON 70 O MÁS (Achieved)', { fondo: MARCA.lila, color: MARCA.moradoOscuro, alinear: 'right' })
  ws.getCell(f, 2).border = bordes
  for (let c = 3; c <= colNota; c++) {
    const v = datosCol(c).filter((x) => x != null)
    celda(ws.getCell(f, c), { formula: `IF(COUNT(${col(c)}${ini}:${col(c)}${fin})=0,"",COUNTIF(${col(c)}${ini}:${col(c)}${fin},">=70")/COUNT(${col(c)}${ini}:${col(c)}${fin}))`, result: v.length ? v.filter((x) => x >= 70).length / v.length : '' }, { alinear: 'center', formato: '0%', negrita: true, fondo: MARCA.lila })
  }
  const filaPorc = f
  f++

  ws.addConditionalFormatting({
    ref: `C${ini}:${col(colNota - 1)}${fin}`,
    rules: [
      { type: 'cellIs', operator: 'lessThan', formulae: [60], style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: MARCA.rojo } } } },
      { type: 'cellIs', operator: 'greaterThanOrEqual', formulae: [70], style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: MARCA.verde } } } },
    ],
  })
  void filaCab
  void filaPorc

  // Distribución por nivel de desempeño
  f += 1
  ws.getCell(f, 1).value = 'DISTRIBUCIÓN POR NIVEL DE DESEMPEÑO'
  ws.getCell(f, 1).font = { name: FUENTE, size: 12, bold: true, color: { argb: MARCA.morado } }
  f++
  ws.mergeCells(f, 1, f, 2)
  celdaTitulo(ws.getCell(f, 1), 'Nivel', {})
  ws.getCell(f, 2).border = bordes
  celdaTitulo(ws.getCell(f, 3), 'Alumnos')
  celdaTitulo(ws.getCell(f, 4), '%')
  f++
  const rangoDesemp = `${col(colNota + 1)}${ini}:${col(colNota + 1)}${fin}`
  const conteos = NIVELES.map((n) => finales.filter((x) => nivelDesempeno(x) === n).length)
  const filaNiv0 = f
  NIVELES.forEach((n, k) => {
    ws.mergeCells(f, 1, f, 2)
    celda(ws.getCell(f, 1), n, { negrita: true, fondo: MARCA.lilaSuave })
    ws.getCell(f, 2).border = bordes
    celda(ws.getCell(f, 3), { formula: `COUNTIF(${rangoDesemp},"${n}")`, result: conteos[k] }, { alinear: 'center' })
    celda(ws.getCell(f, 4), { formula: `IF(SUM(C$${filaNiv0}:C$${filaNiv0 + NIVELES.length - 1})=0,0,C${f}/SUM(C$${filaNiv0}:C$${filaNiv0 + NIVELES.length - 1}))`, result: conteos.reduce((s, x) => s + x, 0) ? conteos[k] / conteos.reduce((s, x) => s + x, 0) : 0 }, { alinear: 'center', formato: '0%' })
    f++
  })
  f += 1

  // GRÁFICOS
  ws.getCell(f, 1).value = 'GRÁFICOS DE RENDIMIENTO'
  ws.getCell(f, 1).font = { name: FUENTE, size: 12, bold: true, color: { argb: MARCA.morado } }
  f++
  const alto = 320
  const g1 = await graficoBarras({
    titulo: 'Promedio del salón por módulo',
    etiquetas: porModulo.map((m) => m.nombre),
    series: [{ nombre: 'Promedio', valores: porModulo.map((m) => m.promedio), color: PALETA.morado }],
    linea: { valor: 70, etiqueta: 'Achieved 70' },
    ancho: 620,
    alto,
  })
  const g2 = await graficoBarras({
    titulo: 'Nota acumulada por estudiante',
    etiquetas: alumnos.map((a) => a.nombre),
    series: [{ nombre: 'Nota acumulada', valores: finales.map((x) => (x == null ? null : r2(x))), color: PALETA.durazno }],
    linea: { valor: 70, etiqueta: 'Achieved 70' },
    ancho: 620,
    alto,
  })
  const g3 = await graficoBarras({
    titulo: 'Estudiantes por nivel de desempeño',
    etiquetas: NIVELES,
    series: [{ nombre: 'Alumnos', valores: conteos, color: PALETA.morado }],
    max: Math.max(5, Math.ceil(Math.max(...conteos) / 5) * 5),
    ancho: 620,
    alto,
  })
  const g4 = await graficoBarras({
    titulo: '% de alumnos con 70 o más por módulo',
    etiquetas: porModulo.map((m) => m.nombre),
    series: [
      {
        nombre: '% Achieved',
        valores: mods.map((_, mi) => {
          const v = alumnos.map((a) => notaModulo(a.informe?.modulos?.[mi])).filter((x) => x != null)
          return v.length ? Math.round((v.filter((x) => x >= 70).length / v.length) * 100) : null
        }),
        color: PALETA.durazno,
      },
    ],
    ancho: 620,
    alto,
  })
  const filas = Math.ceil(alto / 20) + 1
  const x2 = colEnPx(ws, 640)
  await insertarGrafico(wb, ws, g1, 0, f - 1)
  await insertarGrafico(wb, ws, g2, x2, f - 1)
  await insertarGrafico(wb, ws, g4, 0, f - 1 + filas)
  await insertarGrafico(wb, ws, g3, x2, f - 1 + filas)
}


// ---------------------------------------------------------------------------
const CODIGO_ASIS = { presente: 'A', tardanza: 'T', ausente: 'F', justificado: 'J' }
function hojaAsistencia(wb, logoId, d) {
  const { salon, alumnos, clases, asistencia } = d
  const ws = wb.addWorksheet('ATTENDANCE')
  const FIJAS = 12
  const nClases = clases.length
  ws.columns = [{ width: 5 }, { width: 32 }, { width: 11 }, { width: 11 }, { width: 11 }, { width: 10 }, { width: 11 }, { width: 8 }, { width: 11 }, { width: 10 }, { width: 9 }, { width: 14 }, ...clases.map(() => ({ width: 8 }))]
  let f = cabecera(wb, ws, logoId, "Student's attendance", `${salon.nombre} · A = asistió · T = tardanza · F = faltó · J = justificada · 2 tardanzas = 1 falta`, FIJAS + nClases)
  const filaNum = f
  const filaFecha = f + 1
  // Filas de encabezado de clases
  ws.getCell(filaNum, FIJAS).value = '# CLASE'
  ws.getCell(filaFecha, FIJAS).value = 'FECHA'
  for (const c of [FIJAS]) {
    celdaTitulo(ws.getCell(filaNum, c), '# CLASE', { fondo: MARCA.lila, color: MARCA.moradoOscuro, alinear: 'right' })
    celdaTitulo(ws.getCell(filaFecha, c), 'FECHA', { fondo: MARCA.lila, color: MARCA.moradoOscuro, alinear: 'right' })
  }
  clases.forEach((c, i) => {
    const cc = FIJAS + 1 + i
    celdaTitulo(ws.getCell(filaNum, cc), String(c.numero), { fondo: MARCA.lila, color: MARCA.moradoOscuro })
    celdaTitulo(ws.getCell(filaFecha, cc), `${c.fecha.slice(8, 10)}/${c.fecha.slice(5, 7)}`, { fondo: MARCA.lila, color: MARCA.moradoOscuro })
    ws.getCell(filaFecha, cc).alignment = { textRotation: 90, horizontal: 'center', vertical: 'middle' }
  })
  ws.getRow(filaFecha).height = 36
  const filaCab = f + 2
  ;['N°', 'Estudiante', 'Total clases asignadas', 'Clases dictadas', 'Asistencias', 'Tardanzas', 'Faltas x tardanza (2T = 1F)', 'Faltas', 'Justificadas', 'Faltas totales', '% de falta', 'Estado'].forEach((t, i) =>
    celdaTitulo(ws.getCell(filaCab, i + 1), t, i >= 9 ? { fondo: MARCA.moradoOscuro } : undefined),
  )
  ws.getRow(filaCab).height = 44
  ws.views = [{ showGridLines: false, state: 'frozen', xSplit: 2, ySplit: filaCab }]
  f = filaCab + 1
  const ultima = col(FIJAS + nClases)
  alumnos.forEach((a, i) => {
    const marcas = clases.map((c) => CODIGO_ASIS[asistencia.get(c.sesion_id)?.get(a.id)] ?? '')
    const rng = nClases ? `${col(FIJAS + 1)}${f}:${ultima}${f}` : null
    const cuenta = (l) => marcas.filter((x) => x === l).length
    const tard = cuenta('T')
    const faltas = cuenta('F')
    const total = nClases
    celda(ws.getCell(f, 1), i + 1, { alinear: 'center' })
    celda(ws.getCell(f, 2), a.nombre, { negrita: true })
    celda(ws.getCell(f, 3), total, { alinear: 'center' })
    celda(ws.getCell(f, 4), rng ? { formula: `COUNTA(${rng})`, result: marcas.filter(Boolean).length } : 0, { alinear: 'center' })
    celda(ws.getCell(f, 5), rng ? { formula: `COUNTIF(${rng},"A")`, result: cuenta('A') } : 0, { alinear: 'center' })
    celda(ws.getCell(f, 6), rng ? { formula: `COUNTIF(${rng},"T")`, result: tard } : 0, { alinear: 'center' })
    celda(ws.getCell(f, 7), { formula: `F${f}/2`, result: tard / 2 }, { alinear: 'center', formato: '0.0' })
    celda(ws.getCell(f, 8), rng ? { formula: `COUNTIF(${rng},"F")`, result: faltas } : 0, { alinear: 'center' })
    celda(ws.getCell(f, 9), rng ? { formula: `COUNTIF(${rng},"J")`, result: cuenta('J') } : 0, { alinear: 'center' })
    celda(ws.getCell(f, 10), { formula: `G${f}+H${f}`, result: tard / 2 + faltas }, { alinear: 'center', formato: '0.0' })
    const pct = total ? (tard / 2 + faltas) / total : 0
    celda(ws.getCell(f, 11), { formula: `IF(C${f}=0,0,J${f}/C${f})`, result: pct }, { alinear: 'center', formato: '0.0%' })
    celda(ws.getCell(f, 12), { formula: `IF(K${f}>0.2,"DESAPROBADO",IF(K${f}>=0.1,"EN ALERTA","EXCELENTE"))`, result: pct > 0.2 ? 'DESAPROBADO' : pct >= 0.1 ? 'EN ALERTA' : 'EXCELENTE' }, { alinear: 'center', negrita: true })
    marcas.forEach((m, k) => celda(ws.getCell(f, FIJAS + 1 + k), m, { alinear: 'center' }))
    f++
  })
  if (alumnos.length) {
    ws.addConditionalFormatting({
      ref: `L${filaCab + 1}:L${f - 1}`,
      rules: [
        { type: 'containsText', operator: 'containsText', text: 'DESAPROBADO', style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: MARCA.rojo } } } },
        { type: 'containsText', operator: 'containsText', text: 'ALERTA', style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: MARCA.ambar } } } },
        { type: 'containsText', operator: 'containsText', text: 'EXCELENTE', style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: MARCA.verde } } } },
      ],
    })
    if (nClases) {
      ws.addConditionalFormatting({
        ref: `${col(FIJAS + 1)}${filaCab + 1}:${ultima}${f - 1}`,
        rules: [
          { type: 'cellIs', operator: 'equal', formulae: ['"F"'], style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: MARCA.rojo } } } },
          { type: 'cellIs', operator: 'equal', formulae: ['"T"'], style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: MARCA.ambar } } } },
        ],
      })
    }
  }
  if (!nClases) {
    ws.getCell(f + 1, 1).value = 'Este salón todavía no tiene clases en el calendario.'
    ws.getCell(f + 1, 1).font = { name: FUENTE, size: 10, italic: true, color: { argb: MARCA.gris } }
  }
}

// ---------------------------------------------------------------------------
function hojaDetalle(wb, logoId, d) {
  const { salon, alumnos } = d
  const ws = wb.addWorksheet('DETALLE DE NOTAS')
  ws.columns = [{ width: 32 }, { width: 9 }, { width: 14 }, { width: 26 }, { width: 14 }, { width: 14 }, { width: 9 }, { width: 12 }, { width: 70 }]
  let f = cabecera(wb, ws, logoId, 'Detalle de notas', `${salon.nombre} · cada nota publicada, por unidad, con su fecha y comentario del docente`, 9)
  const ini = f
  ;['Estudiante', 'Ciclo', 'Módulo', 'Componente', 'Tipo', 'Unidad / clase', 'Nota', 'Fecha', 'Comentario del docente'].forEach((t, i) => celdaTitulo(ws.getCell(f, i + 1), t))
  ws.getRow(f).height = 24
  ws.views = [{ showGridLines: false, state: 'frozen', xSplit: 1, ySplit: f }]
  f++
  for (const a of alumnos) {
    for (const m of a.informe?.modulos ?? []) {
      for (const e of m.evaluaciones ?? []) {
        for (const n of e.notas ?? []) {
          celda(ws.getCell(f, 1), a.nombre, { negrita: true })
          celda(ws.getCell(f, 2), m.ciclo ?? '', { alinear: 'center' })
          celda(ws.getCell(f, 3), m.nombre)
          celda(ws.getCell(f, 4), e.nombre)
          celda(ws.getCell(f, 5), e.tipo ?? '')
          celda(ws.getCell(f, 6), etiquetaUnidad(n.unidad, e.tipo) || '—', { alinear: 'center' })
          celda(ws.getCell(f, 7), num(n.puntaje), { alinear: 'center', formato: '0.0', negrita: true })
          celda(ws.getCell(f, 8), n.fecha ? formatFecha(String(n.fecha).slice(0, 10)) : '', { alinear: 'center' })
          celda(ws.getCell(f, 9), n.comentario ?? '')
          f++
        }
      }
    }
  }
  if (f === ini + 1) {
    ws.getCell(f, 1).value = 'Todavía no hay notas publicadas.'
    ws.getCell(f, 1).font = { name: FUENTE, size: 10, italic: true, color: { argb: MARCA.gris } }
  } else {
    ws.autoFilter = { from: { row: ini, column: 1 }, to: { row: f - 1, column: 9 } }
  }
}

// ---------------------------------------------------------------------------
function hojaRubricas(wb, logoId, d) {
  if (!d.rubricas?.length) return
  const ws = wb.addWorksheet('RÚBRICAS')
  ws.columns = [{ width: 28 }, { width: 14 }, { width: 28 }, { width: 70 }, { width: 12 }]
  let f = cabecera(wb, ws, logoId, 'Rúbricas', 'Criterios de evaluación vigentes al generar este archivo', 5)
  ;['Rúbrica', 'Tipo', 'Criterio', 'Descripción', 'Puntaje máx.'].forEach((t, i) => celdaTitulo(ws.getCell(f, i + 1), t))
  f++
  for (const r of d.rubricas.filter((x) => x.activa !== false)) {
    r.criterios.forEach((c, i) => {
      celda(ws.getCell(f, 1), i === 0 ? r.nombre : '', { negrita: true, fondo: MARCA.lilaSuave })
      celda(ws.getCell(f, 2), i === 0 ? r.tipo : '', { fondo: MARCA.lilaSuave })
      celda(ws.getCell(f, 3), c.nombre, { negrita: true })
      celda(ws.getCell(f, 4), c.descripcion ?? '')
      celda(ws.getCell(f, 5), num(c.max_puntaje), { alinear: 'center' })
      f++
    })
  }
}

// ---------------------------------------------------------------------------
// datos: { salon, alumnos: [{ id, nombre, informe }], clases: [{ sesion_id, numero, fecha }], asistencia: Map(sesion_id → Map(alumno_id → estado)), rubricas?, logo?: ArrayBuffer }
export async function construirCompendio(datos) {
  const { default: ExcelJS } = await import('exceljs')
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Universa'
  wb.company = 'Universa'
  wb.title = `Assessment file · ${datos.salon.nombre}`
  wb.created = new Date()
  let logoId = null
  if (datos.logo) {
    try {
      logoId = wb.addImage({ buffer: datos.logo, extension: 'png' })
    } catch {
      logoId = null
    }
  }
  hojaFicha(wb, logoId, datos)
  const est = estadisticas(datos.alumnos)
  await hojaRendimiento(wb, logoId, datos, est)
  const usados = new Set(['ficha de curso', 'rendimiento del salón', 'attendance', 'detalle de notas', 'rúbricas'])
  for (const [i, a] of datos.alumnos.entries()) await hojaAlumno(wb, logoId, datos, a, i, est, usados)
  hojaAsistencia(wb, logoId, datos)
  hojaDetalle(wb, logoId, datos)
  hojaRubricas(wb, logoId, datos)
  const buffer = await wb.xlsx.writeBuffer()
  return new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
}
