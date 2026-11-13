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
      // Las tres consultas son independientes: salen a la vez. Solo cuenta_roles espera a que las invitaciones pendientes del correo
      // confirmado se conviertan en vínculos (si la migración de portales aún no está, el rpc falla y se ignora).
      const [p, r, g] = await Promise.all([
        supabase
          .from('perfiles')
          .select('rol, activo')
          .eq('user_id', userId)
          .maybeSingle()
          .then((x) => (x.error ? supabase.from('perfiles').select('rol').eq('user_id', userId).maybeSingle() : x)), // sin la migración de gestión del personal aún no existe «activo»
        supabase
          .rpc('reclamar_invitaciones')
          .then(() => supabase.from('cuenta_roles').select('rol').eq('user_id', userId)), // la política deja ver TODAS las cuentas a administración: sin este filtro un admin recibiría los roles de los demás
        supabase.from('docente_registros').select('*').eq('user_id', userId).maybeSingle(), // filtrado por cuenta: sin filtro, a un admin le llegarían todos los registros y maybeSingle fallaría; sin la migración de registros: error ignorado → null
      ])
      if (activo) setPerfil({ userId, rol: p.data?.activo === false ? null : p.data?.rol ?? null, // un perfil desactivado equivale a no tener acceso
         portal: (r.data ?? []).map((x) => x.rol), registro: g.data ?? null })
    })().catch(() => activo && setPerfil({ userId, rol: null, portal: [], registro: null }))
    return () => {
      activo = false
    }
  }, [userId, version])

  const vigente = perfil.userId === userId
  const cargando = !sesionLista || (Boolean(userId) && !vigente)

  const signIn = async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw new Error(error.code === 'invalid_credentials' ? 'Incorrect email or password' : error.message)
  }

  const signOut = () => supabase.auth.signOut()
  const recargar = () => setVersion((v) => v + 1)

  return { session, rol: vigente ? perfil.rol : null, portal: vigente ? perfil.portal : [], registro: vigente ? perfil.registro : null, cargando, signIn, signOut, recargar }
}
