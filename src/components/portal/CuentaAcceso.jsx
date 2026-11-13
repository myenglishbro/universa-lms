import { useCallback, useRef, useState } from 'react'
import Badge from '../ui/Badge'
import Button from '../ui/Button'
import Card from '../ui/Card'
import Field from '../ui/Field'
import useCarga from '../../hooks/useCarga'
import { generarClave, validarClaveNueva } from '../../lib/clave'
import * as servicioReal from '../../services/accesos'

// Administración: crea el acceso al portal de un estudiante o docente desde Universa (cuenta en Supabase Auth creada por la
// Edge Function «gestionar-acceso») y es la única que puede cambiar su contraseña. La contraseña solo vive en el formulario: no se guarda ni se vuelve a mostrar.
export default function CuentaAcceso({ rol, persona, correoSugerido = '', servicio = servicioReal }) {
  const cargar = useCallback(() => servicio.cuentasDePersona(rol, persona), [servicio, rol, persona])
  const { datos, cargando, error, recargar } = useCarga(cargar, [])
  const [correo, setCorreo] = useState(correoSugerido ?? '')
  const [clave, setClave] = useState('')
  const [verClave, setVerClave] = useState(false)
  const [aviso, setAviso] = useState('')
  const [fallo, setFallo] = useState('')
  const [cambiando, setCambiando] = useState(false) // formulario «Cambiar contraseña» abierto
  const [claveNueva, setClaveNueva] = useState('')
  const [existente, setExistente] = useState('') // correo que ya tiene cuenta y puede vincularse
  const [ocupado, setOcupado] = useState(false)
  const enCurso = useRef(false)
  const nombreRol = rol === 'docente' ? 'teacher' : 'student'
  const cuenta = datos.find((c) => c.estado === 'vinculada') ?? datos[0]

  const ejecutar = async (fn) => {
    if (enCurso.current) return
    enCurso.current = true
    setOcupado(true)
    setFallo('')
    setAviso('')
    setExistente('')
    try {
      await fn()
      await recargar()
    } catch (e) {
      setFallo(e.message)
    } finally {
      enCurso.current = false
      setOcupado(false)
    }
  }

  const crear = (e) => {
    e.preventDefault()
    const c = correo.trim()
    if (!c) return setFallo('Enter the sign-in email')
    const problema = validarClaveNueva(clave, c)
    if (problema) return setFallo(`Initial password: ${problema.charAt(0).toLowerCase()}${problema.slice(1)}`)
    ejecutar(async () => {
      const r = await servicio.crearAcceso({ correo: c, password: clave, rol, personaId: persona })
      setClave('')
      setVerClave(false)
      if (r?.estado === 'existe') {
        setExistente(c)
        setAviso(`An account with ${c} already exists. Another one was not created and its password was not changed. You can link it to this ${nombreRol}.`)
      } else {
        setAviso('Access created. Give the person their email and password through a secure channel. Only administration can change it afterwards.')
      }
    })
  }

  const vincularExistente = () =>
    ejecutar(async () => {
      await servicio.vincularCuenta(correo.trim(), rol, persona)
      setAviso('Existing account linked: it keeps its password and now also has this role.')
    })

  const cambiarClave = (e) => {
    e.preventDefault()
    const problema = validarClaveNueva(claveNueva, cuenta?.correo ?? '')
    if (problema) return setFallo(`Password: ${problema.charAt(0).toLowerCase()}${problema.slice(1)}`)
    ejecutar(async () => {
      await servicio.cambiarClaveAcceso({ rol, personaId: persona, password: claveNueva })
      setClaveNueva('')
      setVerClave(false)
      setCambiando(false)
      setAviso('Password updated. Give it to the person through a secure channel: it is not shown again.')
    })
  }

  return (
    <Card className="mt-6 p-6">
      <h2 className="text-base font-semibold text-slate-900">Portal access</h2>
      {error && <p className="mt-3 text-sm text-red-600">Could not check the access: {error}</p>}
      {cargando ? (
        <p className="mt-3 text-sm text-slate-400">Loading…</p>
      ) : cuenta ? (
        <div className="mt-3 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <span className="flex flex-wrap items-center gap-2 text-slate-900">
              {cuenta.correo}
              <Badge color={cuenta.estado === 'vinculada' ? 'brand' : 'peach'}>{cuenta.estado === 'vinculada' ? 'Access active' : 'Invitation pending'}</Badge>
            </span>
            <span className="flex gap-1">
              {cuenta.estado === 'vinculada' && (
                <Button variant="secondary" className="px-3 py-1" disabled={ocupado} onClick={() => setCambiando((x) => !x)}>
                  Change password
                </Button>
              )}
              <Button variant="ghost" className="px-2 py-1" disabled={ocupado} onClick={() => ejecutar(async () => { await servicio.desvincularCuenta(rol, persona); setAviso('Acceso desvinculado.') })}>
                Desvincular
              </Button>
            </span>
          </div>
          {cambiando && (
            <form onSubmit={cambiarClave} className="flex flex-wrap items-end gap-2 rounded-xl bg-brand-50/60 p-3">
              <div className="min-w-56 flex-1">
                <Field label="New password" type={verClave ? 'text' : 'password'} autoComplete="new-password" value={claveNueva} onChange={(e) => setClaveNueva(e.target.value)} hint="At least 8 characters, with letters and numbers. The current one cannot be seen." />
              </div>
              <Button type="button" variant="secondary" onClick={() => { setClaveNueva(generarClave()); setVerClave(true) }}>
                Generar
              </Button>
              <Button type="submit" disabled={ocupado || !claveNueva}>
                Save
              </Button>
            </form>
          )}
        </div>
      ) : (
        <form onSubmit={crear} className="mt-3 space-y-3">
          <p className="text-xs text-slate-500">
            This {nombreRol} has no access yet. Set the email and an initial password: Universa creates the account and links it automatically.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Sign-in email" type="email" autoComplete="off" value={correo} onChange={(e) => setCorreo(e.target.value)} required />
            <div>
              <Field label="Initial password" type={verClave ? 'text' : 'password'} autoComplete="new-password" value={clave} onChange={(e) => setClave(e.target.value)} hint="At least 8 characters, with letters and numbers" required />
              <div className="mt-1 flex gap-1">
                <Button type="button" variant="ghost" className="px-2 py-1 text-xs" onClick={() => { setClave(generarClave()); setVerClave(true) }}>
                  Generar
                </Button>
                <Button type="button" variant="ghost" className="px-2 py-1 text-xs" onClick={() => setVerClave((v) => !v)}>
                  {verClave ? 'Hide' : 'Show'}
                </Button>
              </div>
            </div>
          </div>
          <Button type="submit" disabled={ocupado}>
            {ocupado ? 'Creating…' : 'Create access'}
          </Button>
        </form>
      )}
      {existente && !cuenta && (
        <Button className="mt-3" disabled={ocupado} onClick={vincularExistente}>
          Link existing account
        </Button>
      )}
      {aviso && <p className="mt-3 rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-800">{aviso}</p>}
      {fallo && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{fallo}</p>}
    </Card>
  )
}
