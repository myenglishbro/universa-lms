// Progreso por habilidad de un ciclo: % publicado por habilidad (y por módulo) y el radar en SVG para el reporte impreso.
import { seguimientoDetalle, seguimientoFormative } from './seguimiento.js'

export const HABILIDADES_INFORME = ['Speaking', 'Reading', 'Listening', 'Writing', 'Vocabulary', 'Grammar']

// Misma escala oficial del ciclo: 0–59 Beginning · 60–69 Developing · 70–84 Achieved · 85–100 Outstanding.
export const bandaDe = (pct) => (pct == null ? null : pct >= 85 ? 'outstanding' : pct >= 70 ? 'achieved' : pct >= 60 ? 'developing' : 'beginning')
export const ETIQUETA_BANDA = { outstanding: 'Outstanding', achieved: 'Achieved', developing: 'Developing', beginning: 'Beginning' }

const media = (v) => {
  const x = v.filter((n) => n != null && !Number.isNaN(n))
  return x.length ? Math.round((x.reduce((s, n) => s + n, 0) / x.length) * 10) / 10 : null
}
const promedioEv = (mods, tipo) =>
  media(mods.flatMap((m) => (m.evaluaciones ?? []).filter((e) => e.tipo === tipo).map((e) => (e.notas?.length ? e.notas.reduce((s, k) => s + Number(k.puntaje), 0) / e.notas.length : null))))

// % publicado por habilidad (0–100) en los módulos dados, o null. Une el Formative por unidad con Writing y Project:
// Writing suma el examen de Writing, Speaking suma el Oral Project, y Grammar / Vocabulary suman esos criterios de las rúbricas.
export function notasPorHabilidad(mods) {
  const form = seguimientoFormative(mods).flatMap((m) => m.habilidades)
  const det = seguimientoDetalle(mods).flatMap((m) => [...m.writing, ...m.project])
  const writing = promedioEv(mods, 'writing')
  const project = promedioEv(mods, 'project')
  return Object.fromEntries(
    HABILIDADES_INFORME.map((s) => {
      const k = s.toLowerCase()
      const v = [...form.filter((h) => h.clave === k).map((h) => h.promedio), ...det.filter((c) => (k === 'grammar' || k === 'vocabulary') && c.clave.includes(k)).map((c) => c.pct)]
      if (k === 'writing') v.push(writing)
      if (k === 'speaking') v.push(project)
      return [s, media(v)]
    }),
  )
}

const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])

// Radar en SVG con una capa por serie: ejes = etiquetas; capas = [{ valores (0–100 o null), color, destacada, punteada }].
// Lo pendiente (null) queda en el centro y nunca cuenta como cero en el texto. Anillos al 20, 40, 60, 80 y 100 %.
export function radarCapas(etiquetas, capas, tam = 280) {
  const c = tam / 2
  const r = tam / 2 - 40
  const pad = 52 // margen lateral para que las etiquetas largas no se corten
  const n = etiquetas.length
  const punto = (i, f) => {
    const a = (-90 + (i * 360) / n) * (Math.PI / 180)
    return [c + Math.cos(a) * r * f, c + Math.sin(a) * r * f]
  }
  const xy = (p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`
  const acota = (v) => Math.max(0, Math.min(100, v ?? 0)) / 100
  const anillos = [0.2, 0.4, 0.6, 0.8, 1].map((f) => `<polygon points="${etiquetas.map((_, i) => xy(punto(i, f))).join(' ')}" fill="none" stroke="#e1daf3" stroke-width="1"/>`).join('')
  const ejes = etiquetas.map((_, i) => { const p = punto(i, 1); return `<line x1="${c}" y1="${c}" x2="${p[0].toFixed(1)}" y2="${p[1].toFixed(1)}" stroke="#e1daf3" stroke-width="1"/>` }).join('')
  const series = capas
    .map((k) => {
      const poli = `<polygon points="${k.valores.map((v, i) => xy(punto(i, acota(v)))).join(' ')}" fill="${k.color}" fill-opacity="${k.destacada ? 0.2 : 0.07}" stroke="${k.color}" stroke-width="${k.destacada ? 2.5 : 1.6}"${k.punteada ? ' stroke-dasharray="5 4"' : ''} stroke-linejoin="round"/>`
      const marcas = k.destacada ? k.valores.map((v, i) => { if (v == null) return ''; const p = punto(i, acota(v)); return `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="3.8" fill="${k.color}" stroke="#fff" stroke-width="1.5"/>` }).join('') : ''
      return poli + marcas
    })
    .join('')
  const textos = etiquetas
    .map((e, i) => {
      const p = punto(i, 1.2)
      const ancla = p[0] < c - 4 ? 'end' : p[0] > c + 4 ? 'start' : 'middle'
      return `<text x="${p[0].toFixed(1)}" y="${(p[1] + 4).toFixed(1)}" text-anchor="${ancla}" font-size="10.5" font-weight="700" fill="#33007a">${esc(String(e).length > 13 ? `${String(e).slice(0, 12)}…` : e)}</text>`
    })
    .join('')
  return `<svg viewBox="${-pad} 0 ${tam + 2 * pad} ${tam}" width="${tam + 2 * pad}" height="${tam}" role="img" aria-label="Skills radar">${anillos}${ejes}${series}${textos}</svg>`
}
