// Medición de tiempos de las consultas a Supabase, para optimizar con datos reales y no a ciegas.
// Solo guarda el NOMBRE de la consulta (tabla, vista o función), la duración y si falló: nunca filtros, parámetros ni datos de personas.
// Todo queda en memoria de la pestaña (se pierde al recargar). En la consola del navegador: `universaTiempos()` muestra el resumen
// por consulta (veces, promedio, p95 y máximo) y `universaTiempos(true)` lo vacía.
const MAXIMO = 500
const LENTA_MS = 1500
const registros = []

// «https://x.supabase.co/rest/v1/rpc/eval_matriz_salon?…» → «rpc/eval_matriz_salon»; «…/rest/v1/alumnos?select=…» → «alumnos».
export function nombreDePeticion(url) {
  try {
    const { pathname } = new URL(String(url))
    const resto = pathname.replace(/^\/(rest\/v1\/)?/, '')
    if (pathname.startsWith('/auth/v1/')) return `auth/${pathname.split('/')[3] ?? ''}`
    if (pathname.startsWith('/storage/v1/')) return 'storage'
    if (pathname.startsWith('/rest/v1/')) return resto.startsWith('rpc/') ? resto.split('/').slice(0, 2).join('/') : resto.split('/')[0]
    return resto.split('/')[0] || 'otra'
  } catch {
    return 'otra'
  }
}

export function registrarTiempo(nombre, ms, fallo = false) {
  registros.push({ nombre, ms: Math.round(ms), fallo, cuando: Date.now() })
  if (registros.length > MAXIMO) registros.shift()
  if (ms >= LENTA_MS) console.warn(`[lenta] ${nombre}: ${Math.round(ms)} ms`)
}

const percentil = (ordenados, p) => ordenados[Math.min(ordenados.length - 1, Math.floor(ordenados.length * p))]

// Agrupa por consulta y ordena de la que más tiempo acumula a la que menos (lo que más pesa en total).
export function resumir(lista = registros) {
  const por = new Map()
  for (const r of lista) por.set(r.nombre, [...(por.get(r.nombre) ?? []), r])
  return [...por.entries()]
    .map(([nombre, rs]) => {
      const ms = rs.map((r) => r.ms).sort((a, b) => a - b)
      const total = ms.reduce((t, x) => t + x, 0)
      return { consulta: nombre, veces: rs.length, promedio: Math.round(total / rs.length), p95: percentil(ms, 0.95), maximo: ms[ms.length - 1], total, fallos: rs.filter((r) => r.fallo).length }
    })
    .sort((a, b) => b.total - a.total)
}

export function instalarConsolaTiempos() {
  if (typeof window === 'undefined') return
  window.universaTiempos = (vaciar = false) => {
    const tabla = resumir()
    if (vaciar) registros.length = 0
    console.table(tabla)
    return tabla
  }
}
