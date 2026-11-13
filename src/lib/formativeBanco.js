// Banco de ejercicios → Formative Assessment (solo presentación y validaciones de pantalla).
// El cálculo oficial vive en SQL (formative_propuesta / confirmar_formative): aquí no se decide ninguna nota.
//
// Formative por unidad = 5 elementos de 0 a 5 con el mismo peso: Listening / Lessons, Writing, Reading y Speaking (promedio de las actividades
// calificadas del banco, 0–100 → 0–5) y SPARK Homework (nota manual 0–5). La participación por clase (20 % del Formative) se calcula aparte.
// Un pendiente o no entregado nunca se convierte en cero: la unidad queda parcial hasta completarse.

export const HABILIDADES = [
  { id: 'listening', label: 'Listening / Lessons' },
  { id: 'writing', label: 'Writing' },
  { id: 'reading', label: 'Reading' },
  { id: 'speaking', label: 'Speaking' },
]
export const ELEMENTOS = [...HABILIDADES, { id: 'spark', label: 'SPARK Homework' }]

// Reparto interno del Formative: 5 elementos × 16 % + participación 20 %.
export const PESO_PARTICIPACION = 20
export const pesoElemento = (pesoParticipacion = PESO_PARTICIPACION) => (100 - pesoParticipacion) / ELEMENTOS.length

export const nombreHabilidad = (id) => ELEMENTOS.find((h) => h.id === id)?.label ?? id

export const etiquetaFormative = (f) =>
  !f ? 'Practice' : `Formative · ${f.modulo} · ${f.unidad} · ${nombreHabilidad(f.habilidad)}`

// Dos decimales solo al mostrar; el valor completo se conserva.
export const nota2 = (n) => (n == null || n === '' || Number.isNaN(Number(n)) ? '—' : Number(n).toFixed(2))

const redondeo2 = (n) => Math.round(Number(n) * 100) / 100

// Estado de una fila de la propuesta (un estudiante en una unidad):
//   parcial    faltan elementos: no se puede publicar y no se cuenta como cero
//   publicada  la nota oficial ya coincide con la que resulta de los 5 elementos
//   cambio     hay nota publicada y el resultado ahora es distinto: se corrige con motivo
//   listo      los 5 elementos están completos y aún no hay nota publicada
export function estadoFila(fila) {
  if (!fila || fila.completos < ELEMENTOS.length || fila.valor == null) return 'parcial'
  const reg = fila.registrada
  if (reg?.estado === 'publicada') return redondeo2(fila.valor) === Number(reg.puntaje) ? 'publicada' : 'cambio'
  return 'listo'
}

export const ESTADOS_FILA = {
  parcial: { texto: 'In progress', color: 'peach' },
  publicada: { texto: 'Published', color: 'brand' },
  cambio: { texto: 'Will be updated', color: 'rose' },
  listo: { texto: 'Publishes automatically', color: 'peach' },
}

export const puedeConfirmar = (fila) => ['listo', 'cambio'].includes(estadoFila(fila))

// La confirmación exige motivo solo si cambia una nota ya publicada.
export const requiereMotivo = (filas) => filas.some((f) => estadoFila(f) === 'cambio')

// Filas agrupadas por unidad, en el orden de las unidades del Formative.
export function agruparPorUnidad(filas, unidades = []) {
  const grupos = new Map()
  for (const f of filas) {
    if (!grupos.has(f.unidad)) grupos.set(f.unidad, [])
    grupos.get(f.unidad).push(f)
  }
  const orden = (u) => (unidades.indexOf(u) === -1 ? Number.MAX_SAFE_INTEGER : unidades.indexOf(u))
  return [...grupos.entries()].sort((a, b) => orden(a[0]) - orden(b[0])).map(([unidad, lista]) => ({ unidad, filas: lista }))
}

// Rúbrica «por defecto»: la que se llama igual que el tipo (Writing / Speaking); si no hay, ninguna (el docente elige). Nunca se inventa una.
export const rubricasDelTipo = (rubricas, tipo) => (rubricas ?? []).filter((r) => r.tipo === tipo)
export const rubricaPorDefecto = (rubricas, tipo) => rubricasDelTipo(rubricas, tipo).find((r) => r.por_defecto)?.id ?? ''

// Habilidad sugerida según el tipo de ejercicio (el docente puede cambiarla).
export const habilidadSugerida = (tipo) => (['listening', 'writing', 'reading', 'speaking'].includes(tipo) ? tipo : '')

// Vista previa de la nota de una rúbrica: suma de criterios / suma de máximos × 100. Incompleta o fuera de rango → null (no es cero).
export function notaRubricaPct(criterios, valores) {
  if (!criterios?.length) return null
  let suma = 0
  let max = 0
  for (const c of criterios) {
    const v = valores?.[c.id]
    if (v === '' || v == null || Number.isNaN(Number(v))) return null
    const n = Number(v)
    if (n < 0 || n > Number(c.max_puntaje)) return null
    suma += n
    max += Number(c.max_puntaje)
  }
  return max > 0 ? (100 * suma) / max : null
}

// Valores iniciales al editar una revisión ya hecha: se leen de la copia de criterios guardada en la entrega.
export function valoresDesdeDetalle(criterios, detalle) {
  const previos = Array.isArray(detalle?.criterios) ? detalle.criterios : []
  const porNombre = new Map(previos.map((p) => [p.criterio, p.puntaje]))
  return Object.fromEntries((criterios ?? []).map((c) => [c.id, porNombre.has(c.nombre) ? String(porNombre.get(c.nombre)) : '']))
}

// Valida la nota manual de SPARK (0 a max). Vacío = pendiente (null). Fuera de rango o no numérico → undefined.
export function leerSpark(texto, max = 5) {
  if (texto === '' || texto == null) return null
  const n = Number(texto)
  if (Number.isNaN(n) || n < 0 || n > Number(max)) return undefined
  return n
}
