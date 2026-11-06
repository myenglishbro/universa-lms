// UNIVERSA · Lógica de la Edge Function `gestionar-acceso` (sin dependencias de Deno, para poder probarla).
//
// Principios:
//  * Solo un ADMINISTRADOR puede usarla: se verifica con es_admin() ejecutado con la sesión de quien llama.
//  * La llave de servicio (cliente `servidor`) solo se usa para la API administrativa de Auth y para funciones de servidor.
//  * El vínculo se hace con vincular_cuenta() usando el cliente de quien llama: Postgres vuelve a exigir que sea admin.
//  * Las contraseñas NO se guardan, NO se registran en logs y NO se devuelven.
//  * La contraseña de una cuenta la cambia SOLO un administrador (acción «cambiar_clave»). Las personas no pueden cambiarla.

type Cliente = {
  rpc: (nombre: string, args?: Record<string, unknown>) => PromiseLike<{ data: any; error: { message: string } | null }>
  auth?: { admin: Record<string, (...a: any[]) => Promise<{ data: any; error: any }>> }
}
export interface Deps {
  usuario: Cliente // con el JWT de quien llama
  servidor: Cliente // con la llave de servicio (solo en el servidor)
  siteUrl?: string // origen permitido para los enlaces de restablecimiento
}
export interface Respuesta {
  status: number
  cuerpo: Record<string, unknown>
}

const CORREO = /^[^@\s]+@[^@\s]+\.[^@\s]+$/
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const ROLES = ['estudiante', 'docente']
export const CLAVE_MIN = 8

const error = (status: number, mensaje: string): Respuesta => ({ status, cuerpo: { error: mensaje } })
const ok = (cuerpo: Record<string, unknown>): Respuesta => ({ status: 200, cuerpo })

export function validarClave(clave: unknown, correo: string): string {
  if (typeof clave !== 'string' || clave.length < CLAVE_MIN) return `La contraseña inicial debe tener al menos ${CLAVE_MIN} caracteres`
  if (clave.length > 72) return 'La contraseña inicial es demasiado larga (máximo 72 caracteres)'
  if (clave.toLowerCase() === correo.toLowerCase()) return 'La contraseña no puede ser igual al correo'
  if (!/[A-Za-z]/.test(clave) || !/[0-9]/.test(clave)) return 'La contraseña inicial debe combinar letras y números'
  return ''
}

// Solo se aceptan redirecciones al sitio de Universa (SITE_URL) o a localhost durante el desarrollo.
export function redireccionValida(redirectTo: unknown, siteUrl?: string): string | undefined {
  if (typeof redirectTo !== 'string' || !redirectTo) return undefined
  try {
    const u = new URL(redirectTo)
    if (siteUrl) return u.origin === new URL(siteUrl).origin ? u.origin : undefined
    return u.protocol === 'https:' || u.hostname === 'localhost' ? u.origin : undefined
  } catch {
    return undefined
  }
}

const yaExiste = (e: any) => e && (e.code === 'email_exists' || e.status === 422 || /already|registered|exists/i.test(e.message ?? ''))

export async function manejar({ usuario, servidor, siteUrl }: Deps, body: any): Promise<Respuesta> {
  const accion = body?.accion
  if (accion !== 'crear' && accion !== 'restablecer' && accion !== 'cambiar_clave') return error(400, 'Acción no válida')

  const { data: esAdmin, error: errAdmin } = await usuario.rpc('es_admin')
  if (errAdmin || esAdmin !== true) return error(403, 'Solo administración puede gestionar accesos')

  if (accion === 'cambiar_clave') return cambiarClave({ usuario, servidor }, body)

  const rol = body.rol
  const persona = body.persona
  if (!ROLES.includes(rol)) return error(400, 'Rol no válido')
  if (typeof persona !== 'string' || !UUID.test(persona)) return error(400, 'Persona no válida')

  if (accion === 'crear') return crear({ usuario, servidor }, body, rol, persona)
  return restablecer({ usuario, servidor, siteUrl }, body, rol, persona)
}

async function crear({ usuario, servidor }: Deps, body: any, rol: string, persona: string): Promise<Respuesta> {
  const correo = typeof body.correo === 'string' ? body.correo.trim().toLowerCase() : ''
  if (!CORREO.test(correo)) return error(400, 'Escribe un correo válido')
  const fallaClave = validarClave(body.password, correo)
  if (fallaClave) return error(400, fallaClave)

  // La persona debe existir y no tener ya una cuenta (se comprueba ANTES de crear nada en Auth).
  const { data: disponible, error: errDisp } = await usuario.rpc('acceso_disponible', { p_rol: rol, p_persona: persona })
  if (errDisp) return error(400, errDisp.message)
  if (disponible !== 'libre') return error(409, 'Esta persona ya tiene una cuenta vinculada. Desvincúlala primero si quieres crear otra')

  const { data: creado, error: errCrear } = await servidor.auth!.admin.createUser({ email: correo, password: body.password, email_confirm: true })
  if (yaExiste(errCrear)) {
    // No se crea otra cuenta ni se toca la contraseña de la existente: el administrador decide si vincula el rol.
    return ok({ estado: 'existe', mensaje: 'Ese correo ya pertenece a una cuenta. Puedes vincularla a esta persona sin cambiar su contraseña.' })
  }
  if (errCrear || !creado?.user?.id) return error(400, 'No se pudo crear la cuenta: ' + String(errCrear?.message ?? 'respuesta vacía').split(body.password).join('***'))
  const nuevo: string = creado.user.id

  const deshacer = async (mensaje: string, status = 400) => {
    await servidor.auth!.admin.deleteUser(nuevo) // revierte: la cuenta recién creada se elimina (borra en cascada su vínculo)
    return error(status, mensaje)
  }
  const { error: errVinc } = await usuario.rpc('vincular_cuenta', { p_correo: correo, p_rol: rol, p_persona: persona })
  if (errVinc) return deshacer(errVinc.message, 409)
  // La contraseña inicial es la definitiva: solo administración la cambia, así que no se obliga a la persona a cambiarla.

  return ok({ estado: 'creada', correo })
}

async function restablecer({ usuario, servidor, siteUrl }: Deps, body: any, rol: string, persona: string): Promise<Respuesta> {
  const { data: cuentas, error: errCuentas } = await usuario.rpc('cuentas_de_persona', { p_rol: rol, p_persona: persona })
  if (errCuentas) return error(400, errCuentas.message)
  const cuenta = (cuentas ?? []).find((c: any) => c.estado === 'vinculada')
  if (!cuenta) return error(404, 'Esta persona no tiene una cuenta vinculada')

  const { data: userId } = await servidor.rpc('cuenta_de_persona', { p_rol: rol, p_persona: persona })
  if (!userId) return error(404, 'Esta persona no tiene una cuenta vinculada')
  const { data: esPersonal } = await servidor.rpc('usuario_es_personal', { p_user: userId })
  if (esPersonal) return error(403, 'Esta cuenta también es de personal de Universa: restablece su contraseña desde Supabase')

  const redirectTo = redireccionValida(body.redirectTo, siteUrl)
  const { data, error: errLink } = await servidor.auth!.admin.generateLink({ type: 'recovery', email: cuenta.correo, options: redirectTo ? { redirectTo } : undefined })
  const enlace = data?.properties?.action_link
  if (errLink || !enlace) return error(400, 'No se pudo generar el enlace: ' + (errLink?.message ?? 'respuesta vacía'))
  // El enlace permite elegir una contraseña nueva (no revela la actual). Se muestra una vez y no se guarda.
  return ok({ estado: 'enlace', enlace, correo: cuenta.correo })
}

// Administración fija una contraseña nueva. Se identifica la cuenta por `user_id` (profesores registrados) o por `rol` + `persona`.
async function cambiarClave({ servidor }: Deps, body: any): Promise<Respuesta> {
  let userId: string = typeof body.user_id === 'string' ? body.user_id : ''
  if (!userId && ROLES.includes(body.rol) && typeof body.persona === 'string' && UUID.test(body.persona)) {
    const { data } = await servidor.rpc('cuenta_de_persona', { p_rol: body.rol, p_persona: body.persona })
    userId = data ?? ''
  }
  if (!UUID.test(userId)) return error(404, 'No se encontró la cuenta')

  const { data: esPersonal } = await servidor.rpc('usuario_es_personal', { p_user: userId })
  if (esPersonal) return error(403, 'Esta cuenta es de personal de Universa: cambia su contraseña desde Supabase')

  const { data: existe } = await servidor.auth!.admin.getUserById(userId)
  const correo: string = existe?.user?.email ?? ''
  if (!correo) return error(404, 'No se encontró la cuenta')
  const falla = validarClave(body.password, correo)
  if (falla) return error(400, falla.replace('inicial ', ''))

  const { error: errClave } = await servidor.auth!.admin.updateUserById(userId, { password: body.password })
  if (errClave) return error(400, 'No se pudo cambiar la contraseña')
  return ok({ estado: 'cambiada', correo })
}
