import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL?.trim()
const key = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim()

// El cliente añade por sí mismo /auth/v1 y /rest/v1: la URL debe ser solo el dominio del proyecto.
// Si se pegó con una ruta (p. ej. .../rest/v1/), se descarta para no construir endpoints inválidos.
const origen = url ? new URL(url).origin : null

// Cuando el gateway de Supabase se satura o corta por tiempo, responde 5xx SIN cabeceras CORS: el navegador lo muestra como
// «blocked by CORS» / «Failed to fetch». Es transitorio, así que las LECTURAS (GET/HEAD) se reintentan con espera creciente.
// Las escrituras nunca se reintentan: podrían duplicarse.
const REINTENTOS = 2
const espera = (ms) => new Promise((r) => setTimeout(r, ms))
async function fetchConReintento(entrada, init) {
  const metodo = (init?.method ?? (entrada instanceof Request ? entrada.method : 'GET')).toUpperCase()
  const esLectura = metodo === 'GET' || metodo === 'HEAD'
  for (let intento = 0; ; intento++) {
    try {
      const r = await fetch(entrada, init)
      if (!esLectura || r.status < 500 || intento >= REINTENTOS) return r
    } catch (e) {
      if (!esLectura || init?.signal?.aborted || intento >= REINTENTOS) throw e
    }
    await espera(400 * 2 ** intento)
  }
}

// null si faltan las variables de entorno; App lo detecta y muestra instrucciones.
export const supabase = origen && key ? createClient(origen, key, { global: { fetch: fetchConReintento } }) : null
