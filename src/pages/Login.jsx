import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import CampoIcono from '../components/auth/CampoIcono'
import PanelMarca from '../components/ui/PanelMarca'
import { registrarProfesor } from '../services/registros'

const boton =
  'inline-flex h-12 w-full items-center justify-center rounded-full bg-brand-600 text-base font-semibold text-white transition duration-200 hover:-translate-y-px hover:bg-brand-700 active:translate-y-0 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0'

function Aviso({ children }) {
  return (
    <p role="alert" className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
      {children}
    </p>
  )
}

function FormIngresar({ onSignIn }) {
  const [correo, setCorreo] = useState('')
  const [clave, setClave] = useState('')
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)

  const enviar = async (e) => {
    e.preventDefault()
    setEnviando(true)
    setError('')
    try {
      await onSignIn(correo.trim(), clave)
    } catch (err) {
      setError(err.message)
      setEnviando(false)
    }
  }
  return (
    <form onSubmit={enviar} className="space-y-5">
      <CampoIcono icono="mail" etiqueta="Email" type="email" autoComplete="email" autoCapitalize="none" spellCheck={false} enterKeyHint="next" value={correo} onChange={(e) => setCorreo(e.target.value)} placeholder="you@example.com" required />
      <CampoIcono icono="lock" etiqueta="Password" secreto autoComplete="current-password" value={clave} onChange={(e) => setClave(e.target.value)} required />
      {error && <Aviso>{error}</Aviso>}
      <button type="submit" disabled={enviando} className={boton}>
        {enviando ? 'Signing in…' : 'Sign in'}
      </button>
      <p className="text-center text-sm text-slate-500">Forgot your password? Ask administration for it.</p>
    </form>
  )
}

// Registro simple de profesores: sin correo de confirmación. La cuenta queda en espera hasta que administración la active como docente.
function FormRegistro({ onSignIn }) {
  const [v, setV] = useState({ nombres: '', apellidos: '', celular: '', direccion: '', correo: '', password: '', web: '' })
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)
  const cambiar = (e) => setV({ ...v, [e.target.name]: e.target.value })

  const enviar = async (e) => {
    e.preventDefault()
    setEnviando(true)
    setError('')
    try {
      await registrarProfesor({ ...v, correo: v.correo.trim() })
      await onSignIn(v.correo.trim(), v.password) // entra directo: no hay correo que confirmar
    } catch (err) {
      setError(err.message)
      setEnviando(false)
    }
  }
  return (
    <form onSubmit={enviar} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <CampoIcono icono="user" etiqueta="First name" name="nombres" autoComplete="given-name" value={v.nombres} onChange={cambiar} required />
        <CampoIcono icono="user" etiqueta="Last name" name="apellidos" autoComplete="family-name" value={v.apellidos} onChange={cambiar} required />
      </div>
      <CampoIcono icono="phone" etiqueta="Mobile" name="celular" type="tel" inputMode="tel" autoComplete="tel" value={v.celular} onChange={cambiar} placeholder="999 999 999" required />
      <CampoIcono icono="pin" etiqueta="Address" name="direccion" autoComplete="street-address" value={v.direccion} onChange={cambiar} required />
      <CampoIcono icono="mail" etiqueta="Email" name="correo" type="email" autoComplete="email" autoCapitalize="none" spellCheck={false} value={v.correo} onChange={cambiar} ayuda="You will sign in to the platform with this email." required />
      <CampoIcono icono="lock" etiqueta="Password" name="password" secreto autoComplete="new-password" value={v.password} onChange={cambiar} ayuda="At least 8 characters." minLength={8} required />
      {/* Campo trampa para robots: las personas no lo ven. */}
      <input name="web" value={v.web} onChange={cambiar} tabIndex={-1} autoComplete="off" aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 opacity-0" />
      {error && <Aviso>{error}</Aviso>}
      <button type="submit" disabled={enviando} className={boton}>
        {enviando ? 'Creating your account…' : 'Create my account'}
      </button>
      <p className="text-center text-xs text-slate-500">Afterwards you can mark your availability and upload your photo. Administration will activate your account as a teacher.</p>
    </form>
  )
}

// El modo sale de la URL: /ingresar o /registro-profesor (el enlace que se envía a los profesores).
const RUTA_MODO = { ingresar: '/ingresar', registro: '/registro-profesor' }

// Enlace opcional de vuelta al sitio principal (dominio público de Universa), definido en VITE_SITIO_URL.
const SITIO_URL = import.meta.env.VITE_SITIO_URL

export default function Login({ onSignIn }) {
  const navigate = useNavigate()
  const modo = useLocation().pathname.startsWith(RUTA_MODO.registro) ? 'registro' : 'ingresar'
  const registro = modo === 'registro'

  // La página de registro de profesores no debe aparecer en buscadores.
  useEffect(() => {
    if (!registro) return undefined
    const meta = document.createElement('meta')
    meta.name = 'robots'
    meta.content = 'noindex, nofollow'
    document.head.appendChild(meta)
    return () => meta.remove()
  }, [registro])

  return (
    <PanelMarca>
      <div className="w-full max-w-md">
        <img src="/landing/logo-morado.png" alt="Universa" width="800" height="172" className="mb-8 h-9 w-auto sm:h-10 lg:mb-10" />
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">{registro ? 'Sign up as a teacher' : 'Welcome back'}</h1>
        <p className="mb-7 mt-2 text-[15px] text-slate-500">
          {registro ? 'Leave us your details. It is quick and you do not need to confirm anything by email.' : 'Sign in with your email and password.'}
        </p>

        {/* El registro de profesores no se anuncia en el ingreso: se entra solo con el enlace /registro-profesor que administración envía. */}
        {registro && (
          <button type="button" onClick={() => navigate(RUTA_MODO.ingresar, { replace: true })} className="-mt-3 mb-6 text-sm font-medium text-slate-500 transition hover:text-brand-600">
            ← I already have an account, sign in
          </button>
        )}

        {registro ? <FormRegistro onSignIn={onSignIn} /> : <FormIngresar onSignIn={onSignIn} />}

        {SITIO_URL && (
          <a href={SITIO_URL} className="mt-8 inline-block text-sm font-medium text-slate-500 transition hover:text-brand-600">
            ← Go to the Universa site
          </a>
        )}
      </div>
    </PanelMarca>
  )
}
