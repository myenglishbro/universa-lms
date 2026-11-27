// Teacher Zone / Student Zone como curso: las categorías son módulos y cada documento o video de un módulo es una lección.
// Sin cambios en la base de datos: la categoría decide si algo es parte del curso o un recurso de consulta.
import { esVideoZona } from './recursos.js'

// Un módulo es una categoría que empieza con número («1. Getting started») o con «Module / Módulo / Unit».
export const esNombreDeModulo = (categoria) => /^\s*(\d+\s*[.):-]?|module\b|módulo\b|modulo\b|unit\b)/i.test(categoria ?? '')

const natural = (a, b) => String(a).localeCompare(String(b), 'en', { numeric: true, sensitivity: 'base' })
const porOrden = (a, b) => (Number(a.orden) || 0) - (Number(b.orden) || 0) || String(a.created_at ?? '').localeCompare(String(b.created_at ?? ''))

// Separa lo publicado en módulos (con sus lecciones, en orden) y recursos de consulta.
// Lección = cualquier video, o un documento cuya categoría es un módulo (o ya tiene videos).
export function separarZona(docs) {
  const conVideos = new Set(docs.filter(esVideoZona).map((d) => d.categoria || 'General'))
  const esLeccion = (d) => esVideoZona(d) || esNombreDeModulo(d.categoria) || conVideos.has(d.categoria || 'General')
  const mapa = new Map()
  const mapaRec = new Map()
  for (const d of docs) {
    const nombre = d.categoria || 'General'
    const destino = esLeccion(d) ? mapa : mapaRec
    destino.set(nombre, [...(destino.get(nombre) ?? []), d])
  }
  const armar = (m, recurso) =>
    [...m]
      .sort(([a], [b]) => natural(a, b))
      .map(([nombre, items]) => ({ nombre, items: items.sort(porOrden).map((d) => ({ ...d, categoria: nombre, tipoLeccion: esVideoZona(d) ? 'video' : 'documento', recurso })) }))
  const modulos = armar(mapa, false)
  const gruposRecursos = armar(mapaRec, true)
  return { modulos, lecciones: modulos.flatMap((m) => m.items), gruposRecursos, recursos: gruposRecursos.flatMap((g) => g.items) }
}

// «1. Getting started» → «Getting started» (el número ya lo muestra la tarjeta del módulo).
export const tituloModulo = (nombre) => String(nombre).replace(/^\s*\d+\s*[.):-]?\s*/, '').trim() || nombre
