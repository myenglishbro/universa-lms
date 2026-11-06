import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL?.trim()
const key = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim()

// El cliente añade por sí mismo /auth/v1 y /rest/v1: la URL debe ser solo el dominio del proyecto.
// Si se pegó con una ruta (p. ej. .../rest/v1/), se descarta para no construir endpoints inválidos.
const origen = url ? new URL(url).origin : null

// null si faltan las variables de entorno; App lo detecta y muestra instrucciones.
export const supabase = origen && key ? createClient(origen, key) : null
