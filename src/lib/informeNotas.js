import { fmtNota } from './evaluaciones'

const esc = (t) =>
  String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])

const fecha = (f) => {
  if (!f) return ''
  const [a, m, d] = String(f).slice(0, 10).split('-')
  return `${d}/${m}/${a}`
}

// Nombre de archivo seguro: «Informe de notas - Ana Pérez - Salón Uno».
export const nombreInforme = (d) =>
  `Informe de notas - ${d.estudiante ?? 'Estudiante'} - ${d.salon ?? 'Salón'}`.replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim()

const vacio = '<span class="mut">—</span>'
const num = (v) => (v === '' || v == null || Number.isNaN(Number(v)) ? null : Number(v))

// Escala del ciclo sobre 100 (la del modelo de Coordinación sobre 50, duplicada): aprueba con 70.
export const APRUEBA_CICLO = 70
export function nivelDesempeno(nota) {
  if (nota == null) return null
  if (nota >= 86) return 'Outstanding'
  if (nota >= APRUEBA_CICLO) return 'Achieved'
  if (nota >= 60) return 'Developing'
  return 'Beginning'
}

// Nota de un componente en un módulo: promedio de sus notas publicadas (null si no hay).
const notaComponente = (e) => {
  const n = e?.notas ?? []
  return n.length ? n.reduce((s, k) => s + Number(k.puntaje), 0) / n.length : null
}

// Un ciclo = una hoja. Los módulos se agrupan por su ciclo; si el informe no lo trae, se reparten de 2 en 2 en el orden de los ciclos.
export function hojasPorCiclo(d) {
  const ciclos = d.ciclos ?? []
  const mods = d.modulos ?? []
  if (!ciclos.length) return [{ ciclo: null, info: null, mods }]
  const conCiclo = mods.some((m) => m.ciclo != null)
  return ciclos.map((c, i) => ({
    ciclo: c.ciclo,
    info: c,
    mods: conCiclo ? mods.filter((m) => m.ciclo === c.ciclo) : mods.slice(i * 2, i * 2 + 2),
  }))
}

// Ciclos del informe y el que se imprime por defecto: el primero con notas publicadas (el informe es de un solo ciclo, de 2 módulos).
export const ciclosDelInforme = (d) => hojasPorCiclo(d)
export function cicloPorDefecto(d) {
  const hs = hojasPorCiclo(d)
  return (hs.find((h) => h.info && Number(h.info.escala_evaluada) > 0) ?? hs[0])?.ciclo ?? null
}

function matriz(cols) {
  const nombres = []
  for (const m of cols) for (const e of m.evaluaciones ?? []) if (!nombres.includes(e.nombre)) nombres.push(e.nombre)
  const peso = (n) => cols.flatMap((m) => m.evaluaciones ?? []).find((e) => e.nombre === n)?.peso
  const pc = cols.length ? Math.round(100 / cols.length) : 0
  const cab = cols.map((m, i) => `<th class="n">M${i + 1} (${pc}%)</th>`).join('')
  const filas = nombres
    .map((n) => {
      const vals = cols.map((m) => notaComponente((m.evaluaciones ?? []).find((e) => e.nombre === n)))
      const ok = vals.filter((v) => v != null)
      const prom = ok.length ? ok.reduce((a, b) => a + b, 0) / ok.length : null
      const celdas = vals.map((v) => `<td class="n">${v == null ? vacio : `<strong>${fmtNota(v)}</strong>`}</td>`).join('')
      return `<tr><td>${esc(n)}</td><td class="n">${fmtNota(peso(n))}%</td>${celdas}<td class="n">${prom == null ? vacio : `<strong>${fmtNota(prom)}</strong>`}</td></tr>`
    })
    .join('')
  const ev = cols.map((m) => (m.sin_plantilla || !(Number(m.peso_evaluado) > 0) ? null : Number(m.nota)))
  const okm = ev.filter((v) => v != null)
  const promM = okm.length ? okm.reduce((a, b) => a + b, 0) / okm.length : null
  const subC = ev.map((v, i) => `<td class="n">${v == null ? vacio : `${fmtNota(v)}${cols[i].parcial ? ' <small>Partial</small>' : ''}`}</td>`).join('')
  const sub = `<tr class="sub"><td>Module score</td><td></td>${subC}<td class="n">${promM == null ? vacio : fmtNota(promM)}</td></tr>`
  const vacioMsg = `<tr><td colspan="${cols.length + 3}" class="mut">Este ciclo aún no tiene evaluaciones.</td></tr>`
  return `<table><thead><tr><th>Component</th><th class="n">Weight</th>${cab}<th class="n">Average</th></tr></thead><tbody>${filas || vacioMsg}${sub}</tbody></table>`
}

const CSS = `
@page{size:Letter;margin:0}
*{box-sizing:border-box}
body{margin:0;font-family:Inter,Arial,Helvetica,sans-serif;color:#1b1340;font-size:11.5px;line-height:1.4;-webkit-print-color-adjust:exact;print-color-adjust:exact;background:#eef3f9}
.hoja{width:8.5in;height:11in;margin:0 auto 12px;background:#fff;padding:0 0 .35in;position:relative;page-break-after:always;overflow:hidden}
.hoja:last-child{page-break-after:auto}
.band{background:#410099;color:#fff;padding:.2in .5in;display:flex;align-items:center;justify-content:space-between}
.band img{height:30px;display:block}.band b{font-size:10.5px;letter-spacing:.2em;text-transform:uppercase;color:#ffb97e}
.sub1{padding:.14in .5in 0;color:#6b5fa0;font-size:10.5px;letter-spacing:.04em}
.in{padding:0 .5in}
h1{font-size:25px;line-height:1.1;margin:.14in 0 8px;letter-spacing:-.02em;color:#410099}
h2{font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:#fff;background:#5b1fb8;margin:.12in 0 0;padding:5px 12px;border-radius:10px 10px 0 0}
.mut{color:#7a72a3}small{font-size:9px;color:#8a3b00}
.datos{display:grid;grid-template-columns:repeat(2,1fr);gap:0;border:1px solid #e1daf3;border-radius:12px;overflow:hidden}
.datos div{display:flex;gap:10px;padding:4px 12px;border-bottom:1px solid #ece8f7}.datos div:nth-last-child(-n+2){border-bottom:0}
.datos small{width:84px;flex:none;font-size:9px;letter-spacing:.1em;text-transform:uppercase;color:#6b5fa0}
.datos b{font-size:11.5px}
table{border-collapse:collapse;width:100%;border:1px solid #e1daf3}
th{font-size:9px;letter-spacing:.1em;text-transform:uppercase;color:#fff;background:#410099;text-align:left;padding:6px 10px}
td{padding:3.5px 10px;border-bottom:1px solid #ece8f7;vertical-align:top}
.n{text-align:right;white-space:nowrap}
.sub td{background:#f5f2fc;font-weight:700;border-bottom:0}
.final{display:grid;grid-template-columns:1.2fr 1fr;margin-top:.15in;border:1px solid #e1daf3;border-radius:12px;overflow:hidden}
.final .score{background:#410099;color:#fff;padding:14px 16px}.final .score small{color:#ffb97e;font-size:10px;letter-spacing:.12em;text-transform:uppercase}
.final .score b{display:block;font-size:40px;line-height:1.05;margin-top:2px}.final .score i{font-style:normal;font-size:13px;opacity:.8}
.final .score em{display:block;font-style:normal;font-size:10px;opacity:.8;margin-top:2px}
.final dl{margin:0}.final dl div{display:flex;justify-content:space-between;padding:5px 12px;border-bottom:1px solid #ece8f7}.final dl div:last-child{border-bottom:0}
.final dt{color:#6b5fa0;font-size:10px;text-transform:uppercase;letter-spacing:.08em}.final dd{margin:0;font-weight:700}
.dos{display:grid;grid-template-columns:1fr 1fr;gap:0}
.dos table td:last-child{text-align:right}
.barra{height:6px;border-radius:9px;background:#ece8f7;overflow:hidden;min-width:70px}.barra i{display:block;height:100%;background:#ffb97e}
.texto{border:1px solid #e1daf3;border-radius:0 0 12px 12px;padding:10px 14px;min-height:.5in;white-space:pre-wrap}
.escala{margin-top:.12in;border:1px solid #e1daf3;border-radius:10px;padding:6px 12px;color:#6b5fa0;font-size:10px}
.aviso{margin:6px 0 0;background:#fff3e8;color:#8a3b00;padding:6px 12px;font-size:10.5px;border-radius:8px}
.firmas{display:grid;grid-template-columns:1fr 1fr;gap:.6in;margin:.22in .5in 0}
.firmas div{border-top:1px solid #1b1340;padding-top:4px;font-size:11px;text-align:center;font-weight:700}.firmas span{display:block;font-weight:400;color:#7a72a3;font-size:10px}
.pie{margin:.12in .5in 0;color:#7a72a3;font-size:9.5px}
@media print{body{background:#fff}.hoja{margin:0}}
`

function origen() {
  return typeof window !== 'undefined' && window.location?.origin && window.location.origin !== 'null' ? window.location.origin : ''
}

const fila = (k, v) => `<div><small>${k}</small><b>${v == null || v === '' ? vacio : esc(v)}</b></div>`

function hojaCiclo(d, h, extra) {
  const nivelOk = d.nivel?.definido && d.nivel.confirmada
  const ev = h.info && Number(h.info.escala_evaluada) > 0
  const s100 = ev ? Number(h.info.puntos) : null
  const parcial = !ev || h.info.parcial || h.mods.some((m) => m.parcial || m.sin_plantilla)
  const completo = s100 != null && !parcial
  const nivel = extra.desempeno || (completo ? nivelDesempeno(s100) : '')
  const resultado = extra.estado || (completo ? (s100 >= APRUEBA_CICLO ? 'PASSED' : 'NOT PASSED') : 'IN PROGRESS')

  const a = Object.fromEntries(['programadas', 'presentes', 'tardanzas', 'ausencias', 'justificadas'].map((k) => [k, num(extra[k])]))
  const sinConteo = a.presentes == null && a.tardanzas == null && a.ausencias == null
  const contadas = sinConteo ? null : (a.presentes ?? 0) + (a.tardanzas ?? 0) + (a.ausencias ?? 0)
  const tasa = contadas ? (((a.presentes ?? 0) + (a.tardanzas ?? 0)) / contadas) * 100 : num(extra.asistencia)
  const estadoAsis = tasa == null ? '' : tasa >= 90 ? 'EXCELLENT' : tasa >= 80 ? 'GOOD' : tasa >= 70 ? 'REGULAR' : 'AT RISK'
  const cnt = (v) => (v == null ? vacio : esc(v))


  const remed = h.mods
    .filter((m) => m.remedial)
    .map((m) => `<p class="aviso">${esc(m.nombre)}: resultado obtenido mediante examen remedial (nota ${fmtNota(m.remedial_nota)}). Resultado anterior: ${m.nota_original == null ? 'sin nota' : fmtNota(m.nota_original)}.</p>`)
    .join('')
  const titulo = h.ciclo != null ? `CYCLE ${String(h.ciclo).padStart(2, '0')}` : 'GRADES'
  const comentarios = [extra.comentario, extra.siguiente ? `Next step: ${extra.siguiente}` : ''].filter(Boolean).map(esc).join('\n')
  const nota100 = `${s100 == null ? '—' : fmtNota(s100)} <i>/ 100</i>`
  const pie100 = `Passing score: ${APRUEBA_CICLO}${parcial && s100 != null ? ' · Partial: only published grades' : ''}${nivelOk ? ` · Level grade: ${fmtNota(d.nivel.nota)}` : ''}`

  return `<div class="hoja">
<div class="band"><img src="${origen()}/landing/logo.png" alt="Universa"><b>Report Card · ${titulo}</b></div>
<div class="sub1">${esc(d.salon)}${d.codigo ? ` · ${esc(d.codigo)}` : ''}${extra.nivelCefr ? ` · ${esc(extra.nivelCefr)}` : ''}</div>
<div class="in">
<h1>${esc(d.estudiante)}</h1>
<div class="datos">
${fila('Student ID', extra.idEstudiante)}${fila('Level / CEFR', extra.nivelCefr)}
${fila('Teacher', d.docente)}${fila('Group ID', d.codigo)}
${fila('Schedule', extra.horario)}${fila('Cycle period', extra.periodo)}
${fila('Cycle', h.ciclo != null ? `Cycle ${String(h.ciclo).padStart(2, '0')}` : '')}${fila('Issue date', fecha(d.generado))}
</div>
<h2>Grades (out of 100)</h2>
${matriz(h.mods)}${remed}
<div class="final">
<div class="score"><small>Final cycle score (/100)</small><b>${nota100}</b><em>${pie100}</em></div>
<dl><div><dt>Performance level</dt><dd>${nivel ? esc(nivel) : '—'}</dd></div><div><dt>Result</dt><dd>${esc(resultado)}</dd></div><div><dt>Class rank</dt><dd>${extra.ranking ? esc(extra.ranking) : '—'}</dd></div></dl>
</div>
<h2>Attendance</h2>
<div class="dos">
<table><tbody><tr><td>Scheduled classes</td><td class="n">${cnt(a.programadas)}</td></tr><tr><td>Counted classes</td><td class="n">${cnt(contadas)}</td></tr><tr><td>Present</td><td class="n">${cnt(a.presentes)}</td></tr><tr><td>Late</td><td class="n">${cnt(a.tardanzas)}</td></tr></tbody></table>
<table><tbody><tr><td>Unjustified absences</td><td class="n">${cnt(a.ausencias)}</td></tr><tr><td>Justified absences (not counted)</td><td class="n">${cnt(a.justificadas)}</td></tr><tr class="sub"><td>Attendance rate</td><td class="n">${tasa == null ? vacio : `${fmtNota(tasa)}%`}</td></tr><tr><td>Status</td><td class="n"><strong>${estadoAsis || '—'}</strong></td></tr></tbody></table>
</div>
<h2>Teacher's comments and recommendations</h2>
<div class="texto">${comentarios}</div>
<div class="escala">Scale (/100): 0–59 Beginning · 60–69 Developing · 70–85 Achieved · 86–100 Outstanding</div>
</div>
<div class="firmas"><div>${d.docente ? esc(d.docente) : 'Teacher'}<span>Teacher's signature</span></div><div>Academic Coordination<span>Signature and stamp</span></div></div>
<p class="pie">Solo incluye notas publicadas. Un componente sin nota publicada no se cuenta como cero.</p>
</div>`
}

const fechaCorta = (f) => (f ? fecha(f) : '')

// Datos del salón que vienen en el informe (horario, periodo, nivel, asistencia); lo que se escriba a mano manda sobre ellos.
export function datosAuto(d) {
  const ciclo = cicloPorDefecto(d)
  const as = d.asistencia ?? {}
  const periodo = d.periodo?.desde ? `${fechaCorta(d.periodo.desde)}${d.periodo.hasta ? ` to ${fechaCorta(d.periodo.hasta)}` : ''}` : ''
  const nivel = [d.nivel_en || d.nivel_nombre, d.mcer].filter(Boolean).join(' · ')
  return {
    nivelCefr: nivel,
    horario: d.horario ?? '',
    periodo,
    programadas: as.programadas ?? '',
    presentes: as.presentes ?? '',
    tardanzas: as.tardanzas ?? '',
    ausencias: as.ausencias ?? '',
    justificadas: as.justificadas ?? '',
    ciclo: ciclo ?? '',
    siguiente: d.siguiente_nivel ? `Continue with ${d.siguiente_nivel}` : '',
  }
}
const conAuto = (d, manual) => {
  const r = { ...datosAuto(d) }
  for (const [k, v] of Object.entries(manual ?? {})) if (v !== '' && v != null && !(typeof v === 'object' && !Object.keys(v).length)) r[k] = v
  return r
}

// HTML autocontenido del informe: una hoja Letter por ciclo (Report Card), solo lo publicado.
// `extra` (opcional, lo completa quien emite): idEstudiante, nivelCefr, horario, periodo, programadas, presentes, tardanzas,
// ausencias, justificadas, asistencia (%), skills{uso,listening,writing,speaking,reading}, ranking, desempeno, estado, comentario, siguiente.
export function htmlInforme(d, manual = {}) {
  const extra = conAuto(d, manual)
  const h = ciclosDelInforme(d).find((x) => String(x.ciclo) === String(extra.ciclo)) ?? ciclosDelInforme(d)[0]
  const hojas = hojaCiclo(d, h, extra)
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${esc(nombreInforme(d))}</title><style>${CSS}</style></head><body>${hojas}</body></html>`
}

// Abre el informe en otra pestaña listo para «Guardar como PDF». Si el navegador bloquea la ventana, descarga el archivo HTML.
export function descargarInforme(d, extra = {}) {
  const html = htmlInforme(d, extra)
  const w = typeof window !== 'undefined' ? window.open('', '_blank') : null
  if (w) {
    w.document.open()
    w.document.write(html)
    w.document.close()
    w.focus()
    setTimeout(() => w.print(), 400)
    return 'ventana'
  }
  const url = URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = `${nombreInforme(d)}.html`
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  return 'archivo'
}
