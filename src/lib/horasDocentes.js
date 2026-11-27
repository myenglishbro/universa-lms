// Horas del docente: periodos de pago y formatos. El periodo va del 28 de un mes al 27 del siguiente, ambos días incluidos
// (28-nov a 27-dic, 28-dic a 27-ene…). Lo trabajado el 28 y el 27 se paga en ese periodo. Las fechas son 'YYYY-MM-DD' (hora de Lima).
export const DIA_INICIO = 28
export const DIA_FIN = 27
const ZONA = 'America/Lima'

const pad = (n) => String(n).padStart(2, '0')
const iso = (indiceMes, dia) => `${Math.floor(indiceMes / 12)}-${pad((indiceMes % 12) + 1)}-${pad(dia)}`
const indiceMes = (fechaIso) => {
  const [y, m] = fechaIso.split('-').map(Number)
  return y * 12 + (m - 1)
}

// Periodo que empieza en el día 28 del mes con ese índice (año × 12 + mes).
const periodoDesdeMes = (i) => ({ desde: iso(i, DIA_INICIO), hasta: iso(i + 1, DIA_FIN) })

// Periodo al que pertenece una fecha: del día 28 en adelante abre el periodo de ese mes; antes, pertenece al que abrió el mes anterior.
export function periodoDe(fechaIso) {
  const dia = Number(fechaIso.split('-')[2])
  const i = indiceMes(fechaIso)
  return periodoDesdeMes(dia >= DIA_INICIO ? i : i - 1)
}

// Periodo anterior (delta -1) o siguiente (delta 1).
export const moverPeriodo = (p, delta) => periodoDesdeMes(indiceMes(p.desde) + delta)

const corta = (f, opciones) => new Date(`${f}T00:00:00Z`).toLocaleDateString('en-US', { timeZone: 'UTC', ...opciones })
export const etiquetaPeriodo = (p) => `${corta(p.desde, { month: 'short', day: 'numeric' })} – ${corta(p.hasta, { month: 'short', day: 'numeric', year: 'numeric' })}`

export const hoyLima = () => new Date().toLocaleDateString('en-CA', { timeZone: ZONA })

// 150 → «2 h 30 min»; 120 → «2 h»; 45 → «45 min».
export function fmtMinutos(min) {
  const m = Math.max(0, Math.round(Number(min) || 0))
  const h = Math.floor(m / 60)
  const r = m % 60
  return h && r ? `${h} h ${r} min` : h ? `${h} h` : `${r} min`
}
// Soles: 1234.5 → «S/ 1,234.50». Vacío (null) → «—».
export const fmtSoles = (v) => (v == null ? '—' : `S/ ${Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)
// Horas con decimales para exportar: 150 → «2.50».
export const horasDecimal = (min) => (Math.round(((Number(min) || 0) / 60) * 100) / 100).toFixed(2)

// Hora de un instante en Lima: «18:52». Vacío si no hay instante.
export const horaLima = (ts) => (ts ? new Date(ts).toLocaleTimeString('en-GB', { timeZone: ZONA, hour: '2-digit', minute: '2-digit' }) : '')
// De un instante al valor de <input type="datetime-local"> en hora de Lima, y de vuelta (Lima no tiene horario de verano: -05:00).
export const aInputLima = (ts) => (ts ? new Date(ts).toLocaleString('sv-SE', { timeZone: ZONA }).slice(0, 16).replace(' ', 'T') : '')
export const deInputLima = (valor) => (valor ? `${valor}:00-05:00` : null)

// Suma de las filas del resumen (por docente, por salón o todo).
export function totales(filas) {
  const t = { programadas: 0, dictadas: 0, sin_marca: 0, minutos_programados: 0, minutos_pagables: 0, minutos_tarde: 0, monto: 0 }
  for (const f of filas) for (const k of Object.keys(t)) t[k] += Number(f[k]) || 0
  t.monto = Math.round(t.monto * 100) / 100
  return t
}

// Agrupa el resumen por docente conservando el orden: [{ docente_id, docente, salones: [...], ...totales }].
export function porDocente(filas) {
  const mapa = new Map()
  for (const f of filas) {
    if (!mapa.has(f.docente_id)) mapa.set(f.docente_id, { docente_id: f.docente_id, docente: f.docente, nativo: !!f.nativo, salones: [] })
    mapa.get(f.docente_id).salones.push(f)
  }
  return [...mapa.values()].map((d) => ({ ...d, ...totales(d.salones) }))
}

const celda = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`
// CSV del resumen (una fila por docente y salón) listo para abrir en Excel.
export function resumenCsv(filas, periodo) {
  const cab = ['Teacher', 'Classroom', 'Period', 'Scheduled classes', 'Classes held', 'No entry mark', 'Scheduled hours', 'Hours to pay', 'Late minutes', 'Native', 'Service', 'Students', 'Rate per hour (S/)', 'Amount (S/)']
  const lineas = filas.map((f) => [f.docente, f.salon, `${periodo.desde} to ${periodo.hasta}`, f.programadas, f.dictadas, f.sin_marca, horasDecimal(f.minutos_programados), horasDecimal(f.minutos_pagables), f.minutos_tarde, f.nativo ? 'Yes' : 'No', f.servicio, f.alumnos, f.precio_hora ?? '', f.monto ?? ''])
  return `﻿${[cab, ...lineas].map((l) => l.map(celda).join(',')).join('\r\n')}`
}
