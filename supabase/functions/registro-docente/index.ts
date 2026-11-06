// UNIVERSA · Edge Function `registro-docente`: registro público de profesores (sin confirmación por correo).
//
// Despliegue:   supabase functions deploy registro-docente --no-verify-jwt
//               (--no-verify-jwt porque quien se registra aún no tiene sesión)
// Variables:    SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY las inyecta Supabase. La llave de servicio vive SOLO aquí.
// No se registra ningún dato del cuerpo de la petición (contiene contraseñas).
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { registrar } from './logica.ts'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const responder = (status: number, cuerpo: unknown) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return responder(405, { error: 'Método no permitido' })

  const body = await req.json().catch(() => null)
  const servidor = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  try {
    const { status, cuerpo } = await registrar(servidor as any, body)
    return responder(status, cuerpo)
  } catch {
    return responder(500, { error: 'Error inesperado en el servidor' })
  }
})
