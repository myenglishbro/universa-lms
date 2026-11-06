// Gráficos del compendio Excel. ExcelJS no genera gráficos nativos, así que se dibujan en un canvas y se insertan como imagen PNG.
const COLORES = { morado: '#410099', durazno: '#FFB97E', gris: '#64748B', linea: '#E2D9F3', texto: '#1B0042', rojo: '#C2415A' }
const ESCALA = 2 // resolución interna: 2x para que no se vea borroso al ampliar en Excel

const recorta = (t, n) => (String(t).length > n ? `${String(t).slice(0, n - 1)}…` : String(t))

function aBuffer(canvas) {
  return new Promise((resolve) => {
    canvas.toBlob(async (b) => resolve(b ? await b.arrayBuffer() : null), 'image/png')
  })
}

// Gráfico de barras verticales (agrupadas si hay más de una serie).
// opts: { titulo, etiquetas, series: [{ nombre, valores, color }], max = 100, linea?: { valor, etiqueta }, ancho, alto }
// Devuelve { buffer, ancho, alto } o null si no hay dónde dibujar.
export async function graficoBarras({ titulo, etiquetas, series, max = 100, linea = null, ancho = 620, alto = 320 }) {
  if (typeof document === 'undefined' || !etiquetas.length) return null
  const canvas = document.createElement('canvas')
  canvas.width = ancho * ESCALA
  canvas.height = alto * ESCALA
  const g = canvas.getContext('2d')
  if (!g) return null
  g.scale(ESCALA, ESCALA)
  g.fillStyle = '#FFFFFF'
  g.fillRect(0, 0, ancho, alto)

  const rotar = etiquetas.length > 7
  const izq = 38
  const der = 14
  const arriba = 44
  const abajo = rotar ? 78 : 44
  const w = ancho - izq - der
  const h = alto - arriba - abajo

  g.fillStyle = COLORES.texto
  g.font = 'bold 14px Calibri, Arial, sans-serif'
  g.textAlign = 'left'
  g.fillText(titulo, 12, 22)

  // Leyenda (solo con varias series)
  if (series.length > 1) {
    let x = ancho - der
    g.font = '11px Calibri, Arial, sans-serif'
    g.textAlign = 'right'
    for (const s of [...series].reverse()) {
      g.fillStyle = COLORES.gris
      g.fillText(s.nombre, x, 22)
      x -= g.measureText(s.nombre).width + 6
      g.fillStyle = s.color
      g.fillRect(x - 10, 14, 10, 10)
      x -= 22
    }
  }

  // Cuadrícula y eje Y
  g.font = '10px Calibri, Arial, sans-serif'
  g.textAlign = 'right'
  for (let v = 0; v <= max; v += max / 5) {
    const y = arriba + h - (v / max) * h
    g.strokeStyle = COLORES.linea
    g.lineWidth = 1
    g.beginPath()
    g.moveTo(izq, y)
    g.lineTo(izq + w, y)
    g.stroke()
    g.fillStyle = COLORES.gris
    g.fillText(String(Math.round(v)), izq - 5, y + 3)
  }

  // Barras
  const grupo = w / etiquetas.length
  const gap = Math.min(grupo * 0.2, 14)
  const anchoBarra = Math.min((grupo - gap * 2) / series.length, 44)
  etiquetas.forEach((et, i) => {
    const inicio = izq + i * grupo + (grupo - anchoBarra * series.length) / 2
    series.forEach((s, k) => {
      const v = s.valores[i]
      if (v == null) return
      const bh = (Math.min(v, max) / max) * h
      const x = inicio + k * anchoBarra
      g.fillStyle = s.color
      g.fillRect(x, arriba + h - bh, anchoBarra - 1, bh)
      g.fillStyle = COLORES.texto
      g.font = 'bold 10px Calibri, Arial, sans-serif'
      g.textAlign = 'center'
      g.fillText(Number.isInteger(v) ? String(v) : v.toFixed(1), x + anchoBarra / 2, arriba + h - bh - 4)
    })
    g.fillStyle = COLORES.gris
    g.font = '10px Calibri, Arial, sans-serif'
    const cx = izq + i * grupo + grupo / 2
    if (rotar) {
      g.save()
      g.translate(cx, arriba + h + 8)
      g.rotate(-Math.PI / 4)
      g.textAlign = 'right'
      g.fillText(recorta(et, 18), 0, 0)
      g.restore()
    } else {
      g.textAlign = 'center'
      g.fillText(recorta(et, Math.max(8, Math.floor(grupo / 6))), cx, arriba + h + 16)
    }
  })

  // Línea de referencia
  if (linea) {
    const y = arriba + h - (linea.valor / max) * h
    g.strokeStyle = COLORES.rojo
    g.lineWidth = 1.5
    g.setLineDash([6, 4])
    g.beginPath()
    g.moveTo(izq, y)
    g.lineTo(izq + w, y)
    g.stroke()
    g.setLineDash([])
    g.fillStyle = COLORES.rojo
    g.font = 'bold 10px Calibri, Arial, sans-serif'
    g.textAlign = 'right'
    g.fillText(linea.etiqueta, izq + w, y - 4)
  }

  const buffer = await aBuffer(canvas)
  return buffer ? { buffer, ancho, alto } : null
}

export const PALETA = COLORES
