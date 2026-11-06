import { useState } from 'react'
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
      <CampoIcono icono="mail" etiqueta="Correo" type="email" autoComplete="email" autoFocus value={correo} onChange={(e) => setCorreo(e.target.value)} placeholder="tucorreo@ejemplo.com" required />
      <CampoIcono icono="lock" etiqueta="Contraseña" secreto autoComplete="current-password" value={clave} onChange={(e) => setClave(e.target.value)} required />
      {error && <Aviso>{error}</Aviso>}
      <button type="submit" disabled={enviando} className={boton}>
        {enviando ? 'Ingresando…' : 'Ingresar'}
      </button>
      <p className="text-center text-sm text-slate-500">¿Olvidaste tu contraseña? Pídela a administración.</p>
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
        <CampoIcono icono="user" etiqueta="Nombres" name="nombres" autoComplete="given-name" autoFocus value={v.nombres} onChange={cambiar} required />
        <CampoIcono icono="user" etiqueta="Apellidos" name="apellidos" autoComplete="family-name" value={v.apellidos} onChange={cambiar} required />
      </div>
      <CampoIcono icono="phone" etiqueta="Celular" name="celular" type="tel" inputMode="tel" autoComplete="tel" value={v.celular} onChange={cambiar} placeholder="999 999 999" required />
      <CampoIcono icono="pin" etiqueta="Dirección" name="direccion" autoComplete="street-address" value={v.direccion} onChange={cambiar} required />
      <CampoIcono icono="mail" etiqueta="Correo" name="correo" type="email" autoComplete="email" value={v.correo} onChange={cambiar} ayuda="Con este correo ingresarás a la plataforma." required />
      <CampoIcono icono="lock" etiqueta="Contraseña" name="password" secreto autoComplete="new-password" value={v.password} onChange={cambiar} ayuda="Mínimo 8 caracteres." minLength={8} required />
      {/* Campo trampa para robots: las personas no lo ven. */}
      <input name="web" value={v.web} onChange={cambiar} tabIndex={-1} autoComplete="off" aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 opacity-0" />
      {error && <Aviso>{error}</Aviso>}
      <button type="submit" disabled={enviando} className={boton}>
        {enviando ? 'Creando tu cuenta…' : 'Crear mi cuenta'}
      </button>
      <p className="text-center text-xs text-slate-500">Después podrás marcar tu disponibilidad y subir tu foto. Administración activará tu cuenta como docente.</p>
    </form>
  )
}

export default function Login({ onSignIn, onVolver, modoInicial = 'ingresar' }) {
  const [modo, setModo] = useState(modoInicial)
  const registro = modo === 'registro'

  return (
    <PanelMarca>
      <div className="w-full max-w-md rounded-3xl border border-brand-100 bg-white p-6 shadow-sm sm:p-8">
        {onVolver && (
          <button type="button" onClick={onVolver} className="mb-5 text-sm font-medium text-slate-500 transition hover:text-brand-600">
            ← Volver al inicio
          </button>
        )}

        <div role="tablist" aria-label="Tipo de acceso" className="mb-6 grid grid-cols-2 gap-1 rounded-2xl bg-slate-100 p-1">
          {[
            ['ingresar', 'Ingresar'],
            ['registro', 'Soy profesor: registrarme'],
          ].map(([id, texto]) => (
            <button
              key={id}
              role="tab"
              aria-selected={modo === id}
              type="button"
              onClick={() => setModo(id)}
              className={`rounded-xl px-3 py-2.5 text-sm transition ${modo === id ? 'bg-white font-semibold text-brand-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
            >
              {texto}
            </button>
          ))}
        </div>

        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">{registro ? 'Regístrate como profesor' : 'Bienvenido de nuevo'}</h1>
        <p className="mb-6 mt-1.5 text-sm text-slate-500">
          {registro ? 'Déjanos tus datos. Es rápido y no necesitas confirmar nada por correo.' : 'Ingresa con tu correo y tu contraseña.'}
        </p>

        {registro ? <FormRegistro onSignIn={onSignIn} /> : <FormIngresar onSignIn={onSignIn} />}
      </div>
    </PanelMarca>
  )
}
