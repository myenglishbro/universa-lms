import { supabase } from '../lib/supabase'

// La persona cambia su propia contraseña: primero se comprueba la actual (iniciando sesión de nuevo con ella) y luego se guarda la nueva.
// No pasa por administración. La contraseña no se guarda ni se muestra: solo viaja a Supabase Auth por HTTPS.
export async function cambiarMiClave(correo, actual, nueva) {
  const { error: e1 } = await supabase.auth.signInWithPassword({ email: correo, password: actual })
  if (e1) throw new Error(e1.code === 'invalid_credentials' ? 'Your current password is not correct' : 'Could not verify your current password. Try again.')
  const { error: e2 } = await supabase.auth.updateUser({ password: nueva })
  if (e2) throw new Error(e2.code === 'same_password' ? 'The new password must be different from the current one' : e2.code === 'weak_password' ? 'That password is too weak. Use a longer one.' : 'Could not change your password. Try again.')
}
