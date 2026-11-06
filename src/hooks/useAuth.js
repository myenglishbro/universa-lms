import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

// Sesión de Supabase Auth + roles: `rol` (admin/comercial, tabla perfiles), `portal` (estudiante/docente, tabla cuenta_roles)
// y `registro` (profesor que se registró y espera que administración lo active como docente).
// Una cuenta puede tener varios roles a la vez. Las contraseñas las cambia solo administración: aquí no hay cambio de clave.
// El rol aquí solo adapta la interfaz; la seguridad real la aplican las políticas RLS.
export default function useAuth() {
  const [session, setSession] = useState(null)
  const [sesionLista, setSesionLista] = useState(!supabase)
  const [perfil, setPerfil] = useState({ userId: null, rol: null, portal: [], registro: null })
  const [version, setVersion] = useState(0) // se incrementa para volver a consultar los roles (p. ej. «ya me activaron»)
  const userId = session?.user.id

  useEffect(() => {
    if (!supabase) return
    const { data } = supabase.auth.onAuthStateChange((_evento, nueva) => {
      setSession(nueva)
      setSesionLista(true)
    })
    return () => data.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!userId) return
    let activo = true
    ;(async () => {
      // Convierte en vínculos las invitaciones pendientes del correo confirmado de esta cuenta (si la migración de portales aún no está, se ignora).
      await supabase.rpc('reclamar_invitaciones')
      const [p, r, g] = await Promise.all([
        supabase.from('perfiles').select('rol').eq('user_id', userId).maybeSingle(),
        supabase.from('cuenta_roles').select('rol').eq('user_id', userId), // la política deja ver TODAS las cuentas a administración: sin este filtro un admin recibiría los roles de los demás
        supabase.from('docente_registros').select('*').maybeSingle(), // sin la migración de registros: error ignorado → null
      ])
      if (activo) setPerfil({ userId, rol: p.data?.rol ?? null, portal: (r.data ?? []).map((x) => x.rol), registro: g.data ?? null })
    })().catch(() => activo && setPerfil({ userId, rol: null, portal: [], registro: null }))
    return () => {
      activo = false
    }
  }, [userId, version])

  const vigente = perfil.userId === userId
  const cargando = !sesionLista || (Boolean(userId) && !vigente)

  const signIn = async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw new Error(error.code === 'invalid_credentials' ? 'Correo o contraseña incorrectos' : error.message)
  }

  const signOut = () => supabase.auth.signOut()
  const recargar = () => setVersion((v) => v + 1)

  return { session, rol: vigente ? perfil.rol : null, portal: vigente ? perfil.portal : [], registro: vigente ? perfil.registro : null, cargando, signIn, signOut, recargar }
}
