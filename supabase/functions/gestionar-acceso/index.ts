// UNIVERSA · Edge Function `gestionar-acceso`: crea accesos al portal desde Universa y genera enlaces de restablecimiento.
//
// Despliegue:   supabase functions deploy gestionar-acceso
// Variables:    SUPABASE_URL, SUPABASE_ANON_KEY y SUPABASE_SERVICE_ROLE_KEY las inyecta Supabase en el servidor.
//               Opcional: supabase secrets set SITE_URL=https://tu-dominio.vercel.app   (origen permitido para los enlaces)
// La llave de servicio vive SOLO aquí; React nunca la recibe. No se registra ningún dato del cuerpo de la petición.
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { manejar } from './logica.ts'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const responder = (status: number, cuerpo: unknown) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return responder(405, { error: 'Método no permitido' })
  const auth = req.headers.get('Authorization')
  if (!auth) return responder(401, { error: 'Falta la sesión' })

  const body = await req.json().catch(() => null)
  const url = Deno.env.get('SUPABASE_URL')!
  const usuario = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: auth } } })
  const servidor = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false, autoRefreshToken: false } })

  try {
    const { status, cuerpo } = await manejar({ usuario, servidor, siteUrl: Deno.env.get('SITE_URL') ?? undefined }, body)
    return responder(status, cuerpo)
  } catch {
    return responder(500, { error: 'Error inesperado en el servidor' }) // sin detalles: el cuerpo puede contener contraseñas
  }
})
