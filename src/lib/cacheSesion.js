// Caché por pestaña (sessionStorage) con vencimiento, para no repetir consultas que casi nunca cambian. Nunca guarda datos de personas:
// solo el catálogo académico y la marca de «ya se hizo». Todo está protegido: si el almacenamiento falla, simplemente no hay caché.
const PREFIJO = 'universa:'

export function leerCache(clave, vigenciaMs) {
  try {
    const bruto = sessionStorage.getItem(PREFIJO + clave)
    if (!bruto) return null
    const { t, v } = JSON.parse(bruto)
    return Date.now() - t < vigenciaMs ? v : null
  } catch {
    return null
  }
}

export function guardarCache(clave, valor = true) {
  try {
    sessionStorage.setItem(PREFIJO + clave, JSON.stringify({ t: Date.now(), v: valor }))
  } catch {
    /* sin caché */
  }
}

export function borrarCache(clave) {
  try {
    if (clave) sessionStorage.removeItem(PREFIJO + clave)
    else Object.keys(sessionStorage).filter((k) => k.startsWith(PREFIJO)).forEach((k) => sessionStorage.removeItem(k))
  } catch {
    /* sin caché */
  }
}

export const MINUTO = 60 * 1000
