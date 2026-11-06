// UNIVERSA · Lógica de la Edge Function `registro-docente` (sin dependencias de Deno, para poder probarla).
//
// Registro público de profesores: crea la cuenta en Auth con el correo YA confirmado (no hay correo de verificación ni Google)
// y guarda sus datos en docente_registros. La cuenta nace SIN acceso a datos: hasta que administración la convierta en docente
// solo puede ver y completar su propio perfil.
//  * Las contraseñas no se guardan, no se registran en logs y no se devuelven.
//  * Si falla el guardado de los datos, la cuenta recién creada se elimina (no quedan cuentas a medias).

type Cliente = {
  rpc: (nombre: string, args?: Record<string, unknown>) => PromiseLike<{ data: any; error: { message: string } | null }>
  auth: { admin: Record<string, (...a: any[]) => Promise<{ data: any; error: any }>> }
}
export interface Respuesta {
  status: number
  cuerpo: Record<string, unknown>
}

const CORREO = /^[^@\s]+@[^@\s]+\.[^@\s]+$/
export const CLAVE_MIN = 8

const error = (status: number, mensaje: string): Respuesta => ({ status, cuerpo: { error: mensaje } })
const texto = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().replace(/\s+/g, ' ').slice(0, max) : '')
const yaExiste = (e: any) => e && (e.code === 'email_exists' || e.status === 422 || /already|registered|exists/i.test(e.message ?? ''))

export async function registrar(servidor: Cliente, body: any): Promise<Respuesta> {
  if (body?.web) return { status: 200, cuerpo: { estado: 'creada' } } // campo trampa para robots: se ignora sin crear nada

  const datos = {
    nombres: texto(body?.nombres, 100),
    apellidos: texto(body?.apellidos, 100),
    celular: texto(body?.celular, 30),
    direccion: texto(body?.direccion, 200),
  }
  const correo = texto(body?.correo, 200).toLowerCase()
  const password = typeof body?.password === 'string' ? body.password : ''

  if (!datos.nombres) return error(400, 'Escribe tus nombres')
  if (!datos.apellidos) return error(400, 'Escribe tus apellidos')
  if (!/^[0-9+()\s-]{6,30}$/.test(datos.celular)) return error(400, 'Escribe un número de celular válido')
  if (!datos.direccion) return error(400, 'Escribe tu dirección')
  if (!CORREO.test(correo)) return error(400, 'Escribe un correo válido')
  if (password.length < CLAVE_MIN) return error(400, `La contraseña debe tener al menos ${CLAVE_MIN} caracteres`)
  if (password.length > 72) return error(400, 'La contraseña es demasiado larga (máximo 72 caracteres)')

  const { data: creado, error: errCrear } = await servidor.auth.admin.createUser({ email: correo, password, email_confirm: true })
  if (yaExiste(errCrear)) return error(409, 'Ya existe una cuenta con ese correo. Si es tuya, ingresa; si olvidaste tu contraseña, pídela a administración.')
  if (errCrear || !creado?.user?.id) return error(400, 'No se pudo crear la cuenta. Inténtalo de nuevo.')

  const { error: errDatos } = await servidor.rpc('registrar_postulante', { p_user: creado.user.id, p_datos: datos })
  if (errDatos) {
    await servidor.auth.admin.deleteUser(creado.user.id)
    return error(500, 'No se pudo guardar tu registro. Inténtalo de nuevo.')
  }
  return { status: 200, cuerpo: { estado: 'creada' } }
}
