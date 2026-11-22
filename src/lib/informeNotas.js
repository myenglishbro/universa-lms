import { clasificarNota, fmtNota } from './evaluaciones.js'
import { nivelDePct, promedioAnterior, seguimientoDetalle, seguimientoFormative, unidadesDelModulo } from './seguimiento.js'
import { HABILIDADES_INFORME, radarCapas } from './progresoHabilidades.js'

export { HABILIDADES_INFORME }

const esc = (t) =>
  String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])

const fecha = (f) => {
  if (!f) return ''
  const [a, m, d] = String(f).slice(0, 10).split('-')
  return `${d}/${m}/${a}`
}

// Nombre de archivo seguro: «Informe de notas - Ana Pérez - Salón Uno».
export const nombreInforme = (d) =>
  `Grade report - ${d.estudiante ?? 'Student'} - ${d.salon ?? 'Classroom'}`.replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim()

const vacio = '<span class="mut">—</span>'
const num = (v) => (v === '' || v == null || Number.isNaN(Number(v)) ? null : Number(v))

// Escala del ciclo sobre 100 (la del modelo de Coordinación sobre 50, duplicada): aprueba con 70.
// Política oficial: se redondea UNA vez (0,5 o más sube) y se clasifica 0–59 / 60–69 / 70–84 / 85–100 (mismo cálculo que eval_clasificar en SQL).
export const APRUEBA_CICLO = 70
export function nivelDesempeno(nota) {
  const c = clasificarNota(nota)
  if (!c) return null
  return { excelencia: 'Outstanding', aprobo: 'Achieved', reforzamiento: 'Developing', desaprobo: 'Beginning' }[c.resultado]
}

// Nota de un componente en un módulo: promedio de sus notas publicadas (null si no hay).
// El Formative combina unidades y participación con un porcentaje: su nota viene calculada del módulo y solo existe cuando está completo.
const notaComponente = (e, m) => {
  if (e?.tipo === 'formative') return m?.componentes?.find((c) => c.nombre === e.nombre)?.nota ?? null
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

// Ciclos del informe y el que se imprime por defecto: el más reciente con notas publicadas (el informe es de un solo ciclo, de 2 módulos).
export const ciclosDelInforme = (d) => hojasPorCiclo(d)
export function cicloPorDefecto(d) {
  const hs = hojasPorCiclo(d)
  return ([...hs].reverse().find((h) => h.info && Number(h.info.escala_evaluada) > 0) ?? hs[0])?.ciclo ?? null
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
.nota-f{margin:.1in 0 0;color:#6b5fa0;font-size:10px}
.form td.n,.form th.n{width:78px}
.form .tot td{background:#f5f2fc;font-weight:700}
.form .part td{background:#fff8f1}
.hoja .resumen-f{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:.1in}
.hoja .resumen-f div{border:1px solid #e1daf3;border-radius:10px;padding:6px 10px}
.hoja .resumen-f small{display:block;font-size:9px;letter-spacing:.1em;text-transform:uppercase;color:#6b5fa0}
.hoja .resumen-f b{font-size:18px;color:#410099}

.est{margin-top:.18in}.est small{font-size:9.5px;letter-spacing:.16em;text-transform:uppercase;color:#6b5fa0}
.est h1{margin:.04in 0 2px;font-size:30px}.est p{margin:0;color:#6b5fa0;font-size:11px}
.datos4,.datos3{display:grid;gap:0;margin-top:.14in;border:1px solid #e1daf3;border-radius:14px;overflow:hidden;background:#faf8fe}
.datos4{grid-template-columns:repeat(4,1fr)}.datos3{grid-template-columns:repeat(3,1fr)}
.dp{padding:9px 14px;border-right:1px solid #e1daf3}.dp:last-child{border-right:0}
.dp small{display:block;font-size:8.5px;letter-spacing:.14em;text-transform:uppercase;color:#6b5fa0;margin-bottom:2px}.dp b{font-size:13px;color:#1b1340}
.h2s{margin:.2in 0 .08in;padding:0;background:none;color:#410099;border-radius:0;font-size:10px;letter-spacing:.18em;border-bottom:2px solid #ffb97e;padding-bottom:4px}
.prog{display:flex;flex-direction:column;gap:9px;border:1px solid #e1daf3;border-radius:14px;padding:14px 16px}
.pg-t{display:flex;justify-content:space-between;align-items:baseline;font-size:11px;color:#1b1340;margin-bottom:4px}.pg-t b{font-size:16px;color:#410099}.pg-t i{font-style:normal;font-size:11px;color:#7a72a3;font-weight:400}
.pg-b{height:12px;border-radius:99px;background:#ece8f7;overflow:hidden}.pg-b i{display:block;height:100%;border-radius:99px;background:#5b1fb8}
.pg-c .pg-t{font-weight:700;font-size:12px}.pg-c .pg-t b{font-size:22px}.pg-c .pg-b{height:16px}.pg-c .pg-b i{background:linear-gradient(90deg,#410099,#ffb97e)}
.prog-n{margin:2px 0 0;font-size:10.5px;color:#6b5fa0}
.dos2{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:.14in}
.tarj{border:1px solid #e1daf3;border-radius:14px;padding:10px 14px}.tarj small{display:block;font-size:8.5px;letter-spacing:.14em;text-transform:uppercase;color:#6b5fa0}.tarj b{font-size:15px;color:#410099}
.texto.sola{border-radius:14px;min-height:1.6in;line-height:1.55}
.gc{margin-top:.14in;border-radius:12px;overflow:hidden}.gc td:first-child{width:52%}
.lv{display:inline-block;min-width:20px;text-align:center;border-radius:99px;background:#efe8fb;color:#410099;font-weight:700;padding:0 6px}
.hab{margin-top:.16in}.hab h2{border-radius:10px 10px 0 0;margin:0}
.hf{display:grid;grid-template-columns:1.3in 1fr;gap:12px;border:1px solid #e1daf3;border-top:0;padding:8px 12px}.hf:last-child{border-radius:0 0 12px 12px}
.hf small{font-size:8.5px;letter-spacing:.12em;text-transform:uppercase;color:#6b5fa0;padding-top:2px}.hf p{margin:0;white-space:pre-wrap}
.sube{color:#17803d;font-weight:700}.baja{color:#b42318;font-weight:700}
.seg{margin-top:.14in}.seg h2{margin:0;border-radius:10px 10px 0 0}
.seg-c{display:grid;grid-template-columns:280px 1fr;gap:14px;align-items:center;border:1px solid #e1daf3;border-top:0;border-radius:0 0 12px 12px;padding:8px 12px}
.seg-r svg,.cr svg{display:block;width:100%;height:auto;margin:0 auto}
.leyenda{display:flex;flex-wrap:wrap;gap:4px 10px;justify-content:center;font-size:9.5px;color:#475569}.lg{display:inline-flex;align-items:center;gap:4px}.lg i{width:9px;height:9px;border-radius:50%;display:inline-block}.lg i.pu{border-top:2px dashed #94a3b8;border-radius:0;height:0;width:12px}
.seg-t .gc{margin-top:0}.un{white-space:nowrap}
.ch{display:inline-block;border-radius:99px;padding:0 8px;font-size:9px;font-weight:700}.ch-ok{background:#dcf2e3;color:#17803d}.ch-br{background:#efe8fb;color:#410099}.ch-av{background:#ffe9d6;color:#a85a14}.ch-gr{background:#f1f5f9;color:#475569}
.cj{border-radius:10px;padding:5px 10px}.cj small{display:block;font-size:8.5px;letter-spacing:.1em;text-transform:uppercase;font-weight:700}.cj p{margin:0;display:flex;justify-content:space-between;font-size:10.5px}
.cj-f{background:#dcf2e3;color:#17803d}.cj-t{background:#ffe9d6;color:#a85a14}
.seg-t .dos2{margin-top:6px;gap:8px}
.cr2{display:grid;grid-template-columns:1fr 1fr;gap:14px;border:1px solid #e1daf3;border-top:0;border-radius:0 0 12px 12px;padding:8px 12px}
.cr h3{margin:0 0 2px;font-size:11px;color:#410099}.cr .gc{margin-top:4px}

/* ---- Tema «reporte académico»: tarjetas gris claro con borde fino, esquinas muy redondeadas y sombra suave (como el PDF de referencia) ---- */
body{font-family:'IBM Plex Sans',Inter,Arial,Helvetica,sans-serif;background:#e9ebf5;font-size:11.5px}
.hoja{background:#fbfaff;padding:.38in 0 .32in}
.band{margin:0 .45in;border-radius:22px;padding:.19in .3in;background:linear-gradient(115deg,#410099 0%,#5b1fb8 100%);box-shadow:0 10px 24px rgba(65,0,153,.25)}
.band b{font-size:10px;letter-spacing:.22em;background:rgba(255,255,255,.14);padding:5px 12px;border-radius:99px}
.in{padding:0 .45in}
.est{margin-top:.2in}.est small{color:#7a6fae}.est h1{font-size:31px;letter-spacing:-.025em;margin:.03in 0 3px}
h1{color:#2a0066}
h2{background:none;color:#410099;border-radius:0;margin:.2in 0 .09in;padding:0 0 5px;font-size:9.5px;letter-spacing:.2em;border-bottom:2px solid #ffb97e}
.datos,.datos3,.datos4,.prog,.tarj,.texto,.final,.escala,.resumen-p,.seg,.hab,.cj,.dos table,.gc,table{background:#f6f5fa;border:1px solid #e7e5ef;border-radius:20px;box-shadow:0 6px 16px rgba(65,0,153,.07)}
.datos4,.datos3{margin-top:.16in;overflow:hidden}.dp{border-right:1px solid #e7e5ef;padding:11px 16px}.dp b{font-size:14px;color:#2a0066}.dp small{color:#7a6fae}
table{border-collapse:separate;border-spacing:0;overflow:hidden}
th{background:#ece6f8;color:#410099;padding:8px 12px;font-size:8.5px;letter-spacing:.14em}
td{border-bottom:1px solid #e7e5ef;padding:5px 12px}tr:last-child td{border-bottom:0}
.sub td{background:#efe8fb;color:#2a0066}
.n{font-variant-numeric:tabular-nums}
.prog{padding:16px 20px;gap:12px}.pg-t b{font-size:17px;color:#2a0066}
.pg-b{height:12px;background:#e4def2;box-shadow:inset 0 1px 2px rgba(65,0,153,.12)}.pg-b i{background:#5b1fb8}
.pg-c{margin-top:4px;padding-top:12px;border-top:1px dashed #d8d0ec}.pg-c .pg-t b{font-size:26px;color:#410099}.pg-c .pg-b{height:18px}.pg-c .pg-b i{background:linear-gradient(90deg,#410099,#6a2cc8 60%,#ffb97e)}
.dos2{gap:12px}.tarj{padding:12px 18px}.tarj b{font-size:17px;color:#410099}.tarj small{color:#7a6fae}
.texto{padding:14px 18px;border-radius:20px}.texto.sola{min-height:1.5in}
.final{overflow:hidden;border-radius:20px}.final dl div{border-bottom:1px solid #e7e5ef}
.final .score{background:linear-gradient(135deg,#410099,#5b1fb8)}.final .score b{font-size:42px}
.escala{border-radius:16px;padding:8px 14px;box-shadow:none;background:#f1eff8}
.firmas div{border-top:1.5px solid #2a0066}
.pie{color:#8a82b0}
.seg{margin-top:.17in;padding:12px 16px 14px}.seg h2{margin:0 0 8px;border-bottom:0;padding:0;font-size:10px}
.seg-c{border:0;padding:0;border-radius:0}.seg .gc,.cr .gc,.hab .gc{background:#fff;box-shadow:none;border-radius:14px}
.cj{box-shadow:none;border:0;border-radius:14px;padding:6px 12px}
.cr svg{max-width:250px}.cr td:first-child{white-space:nowrap}.cr td{padding:3px 10px}.cr h3{margin:0}.cr .gc{margin-top:2px}.seg-r svg{max-width:300px}.seg-t th,.seg-t td{padding-left:8px;padding-right:8px}
.cr2{border:0;padding:0;border-radius:0}.cr{background:#fff;border:1px solid #e7e5ef;border-radius:16px;padding:10px 12px}.cr h3{color:#410099;letter-spacing:.04em}
.hab{margin-top:.17in;padding:12px 16px 6px}.hab h2{margin:0 0 6px;border-bottom:0;padding:0}
.hf{border:0;border-top:1px solid #e7e5ef;border-radius:0!important;padding:9px 0}.hf:first-of-type{border-top:0}
.hf small{color:#7a6fae}
.lv{background:#e4daf8}.ch{box-shadow:0 1px 2px rgba(65,0,153,.12)}
@media print{body{background:#fff}.hoja{margin:0}}
`

function origen() {
  return typeof window !== 'undefined' && window.location?.origin && window.location.origin !== 'null' ? window.location.origin : ''
}

// ---- Reporte del ciclo: portada (resumen), tabla de notas y, si el docente la escribió, hoja de informe por habilidad ----
export const SECCIONES_HABILIDAD = [['fortalezas', 'Strengths'], ['mejora', 'Areas for improvement'], ['recomendaciones', 'Recommendations']]

// «Module 1» / «Módulo 1», … → «1–2»; si los nombres no siguen ese patrón se listan tal cual.
export function modulosTexto(mods) {
  const n = mods.map((m) => /^M(?:odule|[óo]dulo)\s+(\d+)$/i.exec(m.nombre ?? '')?.[1])
  if (n.length && n.every(Boolean)) return n.length > 1 ? `${n[0]}–${n[n.length - 1]}` : n[0]
  return mods.map((m) => m.nombre).join(' · ')
}
const pesoTotal = (m) => (m.evaluaciones ?? []).reduce((s, e) => s + (Number(e.peso) || 0), 0)
// Puntos del módulo sobre la suma de sus pesos (25): nota 0–100 × pesos ÷ 100. null si el módulo aún no tiene nada evaluado.
export const puntosModulo = (m) => (m.sin_plantilla || !(Number(m.peso_evaluado) > 0) ? null : (Number(m.nota) / 100) * pesoTotal(m))
const redondeo1 = (v) => Math.round(v * 10) / 10

function barraProgreso(etiqueta, valor, max, destacado = false) {
  const pct = valor == null || !(max > 0) ? 0 : Math.max(0, Math.min(100, (valor / max) * 100))
  return `<div class="pg${destacado ? ' pg-c' : ''}"><div class="pg-t"><span>${esc(etiqueta)}</span><b>${valor == null ? vacio : fmtNota(redondeo1(valor))}<i> / ${fmtNota(max)}</i></b></div><div class="pg-b"><i style="width:${pct}%"></i></div></div>`
}

function cabeceraHoja(titulo) {
  return `<div class="band"><img src="${origen()}/landing/logo.png" alt="Universa"><b>${titulo}</b></div>`
}
const datoPortada = (k, v) => `<div class="dp"><small>${k}</small><b>${v == null || v === '' ? vacio : esc(v)}</b></div>`

// Cálculos comunes de las hojas de un ciclo.
function estadoCiclo(d, h, extra) {
  const ev = h.info && Number(h.info.escala_evaluada) > 0
  const s100 = ev ? Number(h.info.puntos) : null
  const parcial = !ev || h.info.parcial || h.mods.some((m) => m.parcial || m.sin_plantilla)
  const completo = s100 != null && !parcial
  const nivel = extra.desempeno || (completo ? nivelDesempeno(s100) : '')
  const aprueba = completo ? clasificarNota(s100).oficial >= APRUEBA_CICLO : null
  const estado = extra.estado || (completo ? (aprueba ? 'Cycle completed' : 'Needs reinforcement') : 'In progress')
  const a = Object.fromEntries(['programadas', 'presentes', 'tardanzas', 'ausencias', 'justificadas'].map((k) => [k, num(extra[k])]))
  const sinConteo = a.presentes == null && a.tardanzas == null && a.ausencias == null
  const contadas = sinConteo ? null : (a.presentes ?? 0) + (a.tardanzas ?? 0) + (a.ausencias ?? 0)
  const tasa = contadas ? (((a.presentes ?? 0) + (a.tardanzas ?? 0)) / contadas) * 100 : num(extra.asistencia)
  const estadoAsis = tasa == null ? '' : tasa >= 90 ? 'Excellent' : tasa >= 80 ? 'Good' : tasa >= 70 ? 'Regular' : 'At risk'
  const maxCiclo = h.mods.reduce((s, m) => s + pesoTotal(m), 0)
  return { s100, parcial, completo, nivel, estado, a, contadas, tasa, estadoAsis, maxCiclo, pts50: s100 == null ? null : (s100 / 100) * maxCiclo }
}

function hojaPortada(d, h, extra, c) {
  const tituloCiclo = h.ciclo != null ? `Cycle ${h.ciclo}` : 'Grades'
  const nivelCiclo = [extra.nivelCefr, h.ciclo != null ? tituloCiclo : ''].filter(Boolean).join(' · ')
  const barras = h.mods.map((m) => barraProgreso(m.nombre, puntosModulo(m), pesoTotal(m))).join('')
  const comentario = esc(extra.comentario ?? '').trim()
  return `<div class="hoja">
${cabeceraHoja('Report Card')}
<div class="in">
<div class="est"><small>Student</small><h1>${esc(d.estudiante)}</h1><p>${esc(d.salon)}${d.codigo ? ` · ${esc(d.codigo)}` : ''}</p></div>
<div class="datos4">
${datoPortada('Level · Cycle', nivelCiclo)}${datoPortada('Modules', modulosTexto(h.mods))}${datoPortada('Teacher', d.docente)}${datoPortada('Attendance', c.estadoAsis)}
</div>
<h2 class="h2s">Academic progress</h2>
<div class="prog">
${barras}
${barraProgreso(`${tituloCiclo} result`, c.pts50, c.maxCiclo, true)}
<p class="prog-n">${c.s100 == null ? 'No published grades yet.' : `${fmtNota(c.s100)} / 100${c.nivel ? ` · ${esc(c.nivel)}` : ''}${c.parcial ? ' · Partial: only published grades' : ''}`}</p>
</div>
<div class="dos2">
<div class="tarj"><small>Status</small><b>${esc(c.estado)}</b></div>
<div class="tarj"><small>Next step</small><b>${extra.siguiente ? esc(String(extra.siguiente).replace(/^Continue with /, '')) : vacio}</b></div>
</div>
<h2 class="h2s">Teacher's comment</h2>
<div class="texto sola">${comentario || vacio}</div>
</div>
<div class="firmas"><div>${d.docente ? esc(d.docente) : 'Teacher'}<span>Teacher</span></div><div>Academic Department<span>Signature and stamp</span></div></div>
<p class="pie">Universa English Program${extra.programa ? ` · ${esc(extra.programa)}` : ''} · Issued ${fecha(d.generado)} · Only published grades are included.</p>
</div>`
}

function tablaModulo(m) {
  const evs = m.evaluaciones ?? []
  const filas = evs
    .map((e) => {
      const v = notaComponente(e, m)
      return `<tr><td>${esc(e.nombre)}</td><td class="n">${fmtNota(e.peso)}%</td><td class="n">${v == null ? vacio : `<strong>${fmtNota(v)}</strong><span class="mut">/100</span>`}</td><td class="n">${v == null ? vacio : `<span class="lv">${nivelDePct(v)}</span>`}</td></tr>`
    })
    .join('')
  const pts = puntosModulo(m)
  const vacioMsg = `<tr><td colspan="4" class="mut">This module has no assessments yet.</td></tr>`
  return `<table class="gc"><thead><tr><th>${esc(m.nombre)} · Component</th><th class="n">Weight</th><th class="n">Score</th><th class="n">Level (0–5)</th></tr></thead><tbody>${filas || vacioMsg}<tr class="sub"><td colspan="2">${esc(m.nombre)} subtotal${m.parcial ? ' <small>Partial</small>' : ''}</td><td class="n" colspan="2">${pts == null ? vacio : `${fmtNota(redondeo1(pts))} / ${fmtNota(pesoTotal(m))}`}</td></tr></tbody></table>`
}

function hojaNotas(d, h, extra, c) {
  const tituloCiclo = h.ciclo != null ? `Cycle ${h.ciclo}` : 'Grades'
  const a = c.a
  const cnt = (v) => (v == null ? vacio : esc(v))
  const remed = h.mods
    .filter((m) => m.remedial)
    .map((m) => `<p class="aviso">${esc(m.nombre)}: result obtained through a remedial exam (grade ${fmtNota(m.remedial_nota)}). Previous result: ${m.nota_original == null ? 'no grade' : fmtNota(m.nota_original)}.</p>`)
    .join('')
  return `<div class="hoja">
${cabeceraHoja('Grades chart')}
<div class="in">
<div class="est"><small>Student's grades</small><h1>${esc(d.estudiante)}</h1></div>
<div class="datos3">${datoPortada('Level', extra.nivelCefr)}${datoPortada('Cycle', h.ciclo != null ? h.ciclo : '')}${datoPortada('Modules', modulosTexto(h.mods))}</div>
${h.mods.map(tablaModulo).join('')}${remed}
<div class="final">
<div class="score"><small>${esc(tituloCiclo)} result</small><b>${c.pts50 == null ? '—' : fmtNota(redondeo1(c.pts50))} <i>/ ${fmtNota(c.maxCiclo)}</i></b><em>Passing score: ${fmtNota((APRUEBA_CICLO / 100) * c.maxCiclo)} (${APRUEBA_CICLO} / 100)${c.parcial && c.s100 != null ? ' · Partial: only published grades' : ''}</em></div>
<dl><div><dt>Performance level</dt><dd>${c.nivel ? esc(c.nivel) : '—'}</dd></div><div><dt>Next step</dt><dd>${extra.siguiente ? esc(String(extra.siguiente).replace(/^Continue with /, '')) : '—'}</dd></div><div><dt>Class rank</dt><dd>${extra.ranking ? esc(extra.ranking) : '—'}</dd></div></dl>
</div>
<h2>Attendance</h2>
<div class="dos">
<table><tbody><tr><td>Scheduled classes</td><td class="n">${cnt(a.programadas)}</td></tr><tr><td>Counted classes</td><td class="n">${cnt(c.contadas)}</td></tr><tr><td>Present</td><td class="n">${cnt(a.presentes)}</td></tr><tr><td>Late</td><td class="n">${cnt(a.tardanzas)}</td></tr></tbody></table>
<table><tbody><tr><td>Unjustified absences</td><td class="n">${cnt(a.ausencias)}</td></tr><tr><td>Justified absences (not counted)</td><td class="n">${cnt(a.justificadas)}</td></tr><tr class="sub"><td>Attendance rate</td><td class="n">${c.tasa == null ? vacio : `${fmtNota(Math.round(c.tasa * 10) / 10)}%`}</td></tr><tr class="sub"><td>Attendance</td><td class="n">${c.estadoAsis ? esc(c.estadoAsis) : vacio}</td></tr></tbody></table>
</div>
<div class="escala">Scale (/100): 0–59 Beginning · 60–69 Developing · 70–84 Achieved · 85–100 Outstanding (rounded once, 0.5 rounds up). Level (0–5) = score ÷ 100 × 5, rounded.</div>
</div>
<p class="pie">Only published grades are included. A component without a published grade is not counted as zero.</p>
</div>`
}

// Hoja de informe por habilidad (solo las habilidades que el docente escribió). Sin textos no se imprime.
function hojaHabilidades(d, h, extra) {
  const hab = extra.habilidades ?? {}
  const bloques = HABILIDADES_INFORME.filter((k) => SECCIONES_HABILIDAD.some(([s]) => String(hab[k]?.[s] ?? '').trim()))
  if (!bloques.length) return ''
  const hojas = []
  for (let i = 0; i < bloques.length; i += 3) hojas.push(bloques.slice(i, i + 3))
  return hojas
    .map(
      (grupo, n) => `<div class="hoja">
${cabeceraHoja('Academic report')}
<div class="in">
${n === 0 ? `<div class="est"><small>Student progress by skill</small><h1>${esc(d.estudiante)}</h1><p>${esc(extra.nivelCefr ?? '')}${h.ciclo != null ? ` · Cycle ${esc(h.ciclo)}` : ''} · ${esc(d.docente ?? '')}</p></div>` : ''}
${grupo
  .map(
    (k) => `<section class="hab"><h2>${k} report</h2>${SECCIONES_HABILIDAD.map(([s, t]) => (String(hab[k]?.[s] ?? '').trim() ? `<div class="hf"><small>${t}</small><p>${esc(hab[k][s])}</p></div>` : '')).join('')}</section>`,
  )
  .join('')}
</div>
<p class="pie">Universa English Program · Confidential student document</p>
</div>`,
    )
    .join('')
}

// ---- Seguimiento del alumno (el mismo de «My skills»): Formative por habilidad y unidad, y detalle de Writing y Oral Project ----
const COLOR_UNIDAD = ['#cbb5ee', '#6a2cc8', '#2a0066', '#1b0042']
const COLOR_ANTERIOR = '#94a3b8'
const ESTADOS = { mejora: ['Improving', 'ok'], estable: ['Steady', 'br'], baja: ['Dropping', 'av'], atencion: ['Needs attention', 'av'], primera: ['First grade', 'gr'], sin_nota: ['Not graded yet', 'gr'] }
const chipEstado = (e) => `<span class="ch ch-${(ESTADOS[e] ?? ESTADOS.sin_nota)[1]}">${(ESTADOS[e] ?? ESTADOS.sin_nota)[0]}</span>`
const flecha = (v) => (v == null ? '' : v === 0 ? '<span class="mut">● 0</span>' : v > 0 ? `<span class="sube">▲ +${v}</span>` : `<span class="baja">▼ ${v}</span>`)
const pctTxt = (v) => (v == null ? '—' : `${Math.round(v)}%`)
const enGrupos = (arr, n) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n))

function bloqueFormative(m, anterior, nombreAnterior) {
  const hs = m.habilidades
  const hayAnterior = Object.keys(anterior).length > 0
  const visibles = m.unidades.map((_, k) => hs.some((x) => x.valores[k] != null))
  const ultima = visibles.lastIndexOf(true)
  const capas = [
    ...(hayAnterior ? [{ valores: hs.map((x) => anterior[x.clave] ?? null), color: COLOR_ANTERIOR, punteada: true }] : []),
    ...m.unidades.map((_, k) => ({ valores: hs.map((x) => x.valores[k]), color: COLOR_UNIDAD[k] ?? COLOR_UNIDAD[3], destacada: k === ultima })).filter((_, k) => visibles[k]),
  ]
  const leyenda = [
    ...m.unidades.map((u, k) => (visibles[k] ? `<span class="lg"><i style="background:${COLOR_UNIDAD[k] ?? COLOR_UNIDAD[3]}"></i>${esc(u)}</span>` : '')),
    hayAnterior ? `<span class="lg"><i class="pu"></i>${esc(nombreAnterior)} average</span>` : '',
  ].join('')
  const filas = hs
    .map((x) => `<tr><td><strong>${esc(x.nombre)}</strong></td><td class="un">${m.unidades.map((u, k) => (x.valores[k] == null ? '<span class="mut">—</span>' : `${Math.round(x.valores[k])}%`)).join(' <span class="mut">→</span> ')}</td><td>${chipEstado(x.estado)}</td><td class="n"><strong>${pctTxt(x.ultimo)}</strong> ${x.delta != null ? flecha(x.delta) : ''}</td></tr>`)
    .join('')
  const orden = hs.filter((x) => x.ultimo != null).sort((a, b) => b.ultimo - a.ultimo)
  const fuertes = orden.slice(0, 2)
  const trabajar = orden.length > 2 ? orden.slice(-2).reverse() : []
  const caja = (t, cls, l) => (l.length ? `<div class="cj cj-${cls}"><small>${t}</small>${l.map((x) => `<p><span>${esc(x.nombre)}</span><b>${pctTxt(x.ultimo)}</b></p>`).join('')}</div>` : '')
  return `<section class="seg">
<h2>${esc(m.nombre)} · Formative by skill</h2>
<div class="seg-c">
<div class="seg-r">${hs.length >= 3 ? radarCapas(hs.map((x) => x.nombre.split('/')[0].trim()), capas, 260) : '<p class="mut">The radar appears when at least three skills have a published grade.</p>'}<div class="leyenda">${leyenda}</div></div>
<div class="seg-t"><table class="gc"><thead><tr><th>Skill</th><th>Units</th><th>Status</th><th class="n">Latest</th></tr></thead><tbody>${filas}</tbody></table><div class="dos2">${caja('Strongest', 'f', fuertes)}${caja('To work on', 't', trabajar)}</div></div>
</div></section>`
}

function hojaSeguimiento(d, h) {
  const todos = seguimientoFormative(d.modulos ?? [])
  const ids = new Set(h.mods.map((m) => m.modulo_id))
  const bloques = todos.map((m, i) => ({ m, anterior: promedioAnterior(todos, i), nombreAnterior: todos[i - 1]?.nombre ?? '' })).filter((x) => ids.has(x.m.id))
  return enGrupos(bloques, 2)
    .map(
      (g, n) => `<div class="hoja">
${cabeceraHoja('Student progress')}
<div class="in">
${n === 0 ? `<div class="est"><small>Progress by skill${h.ciclo != null ? ` · Cycle ${esc(h.ciclo)}` : ''}</small><h1>${esc(d.estudiante)}</h1></div>` : ''}
${g.map((x) => bloqueFormative(x.m, x.anterior, x.nombreAnterior)).join('')}
<div class="escala">Each percentage is the published grade for that skill in each unit. A unit that is not published yet stays empty; it never counts as zero. The dashed line is the average of the previous module.</div>
</div>
<p class="pie">Only published grades are included.</p>
</div>`,
    )
    .join('')
}

function bloqueCriterios(titulo, actual, anterior) {
  if (!actual.length) return ''
  const prev = Object.fromEntries(anterior.map((c) => [c.clave, c.pct]))
  const capas = [...(anterior.length ? [{ valores: actual.map((c) => prev[c.clave] ?? null), color: COLOR_ANTERIOR, punteada: true }] : []), { valores: actual.map((c) => c.pct), color: '#410099', destacada: true }]
  const filas = actual
    .map((c) => {
      const dl = prev[c.clave] != null ? Math.round(c.pct - prev[c.clave]) : null
      return `<tr><td><strong>${esc(c.nombre)}</strong> <span class="mut">· Level ${nivelDePct(c.pct)}</span></td><td class="n"><strong>${Math.round(c.pct)}%</strong>${dl != null ? ` ${flecha(dl)}` : ''}</td></tr>`
    })
    .join('')
  return `<div class="cr"><h3>${titulo}</h3>${actual.length >= 3 ? radarCapas(actual.map((c) => c.nombre.split(' & ')[0]), capas, 220) : '<p class="mut">The radar appears when at least three criteria have a published grade.</p>'}<table class="gc"><tbody>${filas}</tbody></table></div>`
}

function hojaDetalle(d, h) {
  const todos = seguimientoDetalle(d.modulos ?? [])
  const ids = new Set(h.mods.map((m) => m.modulo_id))
  const bloques = todos.map((m, i) => ({ m, p: todos[i - 1] })).filter((x) => ids.has(x.m.id))
  return enGrupos(bloques, 2)
    .map(
      (g, n) => `<div class="hoja">
${cabeceraHoja('Student progress')}
<div class="in">
${n === 0 ? `<div class="est"><small>Writing &amp; Oral Project detail${h.ciclo != null ? ` · Cycle ${esc(h.ciclo)}` : ''}</small><h1>${esc(d.estudiante)}</h1></div>` : ''}
${g.map((x) => `<section class="seg"><h2>${esc(x.m.nombre)}</h2><div class="cr2">${bloqueCriterios('Writing Assessment', x.m.writing, x.p?.writing ?? [])}${bloqueCriterios('Oral Project', x.m.project, x.p?.project ?? [])}</div></section>`).join('')}
<div class="escala">Each percentage is the points earned in that criterion out of its maximum. Criteria that are not published yet are not shown. Level = percentage ÷ 100 × 5, rounded. The dashed line is the previous module.</div>
</div>
<p class="pie">Only published grades are included.</p>
</div>`,
    )
    .join('')
}

function hojaCiclo(d, h, extra) {
  const c = estadoCiclo(d, h, extra)
  return hojaPortada(d, h, extra, c) + hojaNotas(d, h, extra, c) + hojaSeguimiento(d, h) + hojaDetalle(d, h) + hojaHabilidades(d, h, extra)
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

// Puntos de un criterio: «16/20».
const pts = (c) => (c ? `${fmtNota(c.puntaje)}<span class="mut">/${fmtNota(c.max)}</span>` : vacio)
const promedioDe = (vs) => {
  const ok = vs.filter((v) => v != null && !Number.isNaN(v))
  return ok.length ? ok.reduce((a, b) => a + b, 0) / ok.length : null
}

// Segunda hoja del ciclo: el Formative Assessment unidad por unidad, con sus 5 habilidades, la participación y la nota resultante.
// Solo existe si algún módulo del ciclo usa el Formative de unidades y tiene alguna nota publicada.
function hojaFormative(d, h) {
  const mods = h.mods
    .map((m) => ({ m, e: (m.evaluaciones ?? []).find((x) => x.tipo === 'formative') }))
    .filter(({ e }) => e && (e.notas ?? []).length > 0)
  if (!mods.length) return ''

  const unidadesDe = (e) => unidadesDelModulo(e, e.notas.filter((n) => n.unidad))
  const habilidades = []
  for (const { e } of mods) for (const n of e.notas) for (const c of n.criterios ?? []) if (!habilidades.includes(c.criterio)) habilidades.push(c.criterio)
  const porHabilidad = Object.fromEntries(habilidades.map((k) => [k, []]))

  const bloques = mods
    .map(({ m, e }) => {
      const unidades = unidadesDe(e)
      const nota = (u) => e.notas.find((n) => n.unidad === u)
      const part = e.notas.find((n) => n.unidad === '')
      const pp = Number(e.peso_participacion) || 0
      const cab = unidades.map((u) => `<th class="n">${esc(u)}</th>`).join('')
      const filas = habilidades
        .map((k) => {
          const vals = unidades.map((u) => (nota(u)?.criterios ?? []).find((c) => c.criterio === k))
          for (const v of vals) if (v) porHabilidad[k].push((Number(v.puntaje) / Number(v.max)) * 100)
          const prom = promedioDe(vals.map((v) => (v ? Number(v.puntaje) : null)))
          return `<tr><td>${esc(k)}</td>${vals.map((v) => `<td class="n">${pts(v)}</td>`).join('')}<td class="n">${prom == null ? vacio : `<strong>${fmtNota(prom)}</strong>`}</td></tr>`
        })
        .join('')
      const totales = unidades.map((u) => {
        const cs = nota(u)?.criterios ?? []
        return cs.length ? { suma: cs.reduce((s, c) => s + Number(c.puntaje), 0), max: cs.reduce((s, c) => s + Number(c.max), 0) } : null
      })
      const promU = promedioDe(unidades.map((u) => (nota(u) ? Number(nota(u).puntaje) : null)))
      const filaTotal = `<tr class="tot"><td>Unit total</td>${totales.map((t) => `<td class="n">${t ? `${fmtNota(t.suma)}<span class="mut">/${fmtNota(t.max)}</span>` : vacio}</td>`).join('')}<td class="n">${promU == null ? vacio : `${fmtNota(promU)}<span class="mut"> /100</span>`}</td></tr>`
      const cp = part?.participacion
      const filaPart =
        pp > 0
          ? `<tr class="part"><td colspan="${unidades.length + 1}">Class participation (${fmtNota(pp)}%): ${cp ? `${cp.cumplidas} of ${cp.total} classes` : '<span class="mut">pending</span>'}</td><td class="n">${part ? `<strong>${fmtNota(part.puntaje)}</strong>` : vacio}</td></tr>`
          : ''
      const final = notaComponente(e, m)
      const filaFinal = `<tr class="tot"><td colspan="${unidades.length + 1}">Formative score (/100)${final == null ? ' — in progress' : ''}</td><td class="n">${final == null ? vacio : fmtNota(final)}</td></tr>`
      return `<h2>${esc(m.nombre)} · Formative Assessment</h2><table class="form"><thead><tr><th>Skill (points)</th>${cab}<th class="n">Average</th></tr></thead><tbody>${filas}${filaTotal}${filaPart}${filaFinal}</tbody></table>`
    })
    .join('')

  const perfil = habilidades
    .map((k) => {
      const p = promedioDe(porHabilidad[k])
      return `<tr><td>${esc(k)}</td><td class="n">${p == null ? vacio : `<strong>${fmtNota(p)}</strong>`}</td><td><div class="barra"><i style="width:${p == null ? 0 : Math.max(0, Math.min(100, p))}%"></i></div></td></tr>`
    })
    .join('')
  const pps = mods.map(({ e }) => Number(e.peso_participacion) || 0)
  const formula = pps.some((p) => p > 0)
    ? `Formative score = ${100 - Math.max(...pps)}% average of the three units + ${Math.max(...pps)}% class participation.`
    : 'Formative score = average of the three units.'
  const titulo = h.ciclo != null ? `CYCLE ${String(h.ciclo).padStart(2, '0')}` : 'GRADES'

  return `<div class="hoja">
<div class="band"><img src="${origen()}/landing/logo.png" alt="Universa"><b>Formative Assessment · ${titulo}</b></div>
<div class="sub1">${esc(d.salon)}${d.codigo ? ` · ${esc(d.codigo)}` : ''}</div>
<div class="in">
<h1>${esc(d.estudiante)}</h1>
${bloques}
<h2>Skills profile (average, % of maximum)</h2>
<table><tbody>${perfil}</tbody></table>
<p class="nota-f">${formula} Each unit is the sum of its five skills (20 points each). Only published grades are shown; a part that has not been graded is never counted as zero.</p>
</div>
</div>`
}

// HTML autocontenido del informe: una hoja Letter por ciclo (Report Card), solo lo publicado.
// `extra` (opcional, lo completa quien emite): idEstudiante, nivelCefr, horario, periodo, programadas, presentes, tardanzas,
// ausencias, justificadas, asistencia (%), skills{uso,listening,writing,speaking,reading}, ranking, desempeno, estado, comentario, siguiente.
export function htmlInforme(d, manual = {}) {
  const extra = conAuto(d, manual)
  const h = ciclosDelInforme(d).find((x) => String(x.ciclo) === String(extra.ciclo)) ?? ciclosDelInforme(d)[0]
  const hojas = hojaCiclo(d, h, extra) + hojaFormative(d, h)
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${esc(nombreInforme(d))}</title><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&display=swap"><style>${CSS}</style></head><body>${hojas}</body></html>`
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
