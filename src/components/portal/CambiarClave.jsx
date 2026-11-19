import { useState } from 'react'
import Button from '../ui/Button'
import Field from '../ui/Field'
import { validarClaveNueva } from '../../lib/clave'
import * as servicioReal from '../../services/clavePropia'

// Cambio de contraseña por la propia persona: pide la actual y la nueva dos veces. No requiere autorización de administración.
export default function CambiarClave({ email, servicio = servicioReal }) {
  const [v, setV] = useState({ actual: '', nueva: '', repetir: '' })
  const [ver, setVer] = useState(false)
  const [estado, setEstado] = useState({ ocupado: false, error: '', ok: false })
  const cambiar = (e) => setV((x) => ({ ...x, [e.target.name]: e.target.value }))

  const enviar = async (e) => {
    e.preventDefault()
    const problema = validarClaveNueva(v.nueva, email)
    if (!v.actual) return setEstado({ ocupado: false, error: 'Enter your current password', ok: false })
    if (problema) return setEstado({ ocupado: false, error: `New password: ${problema.charAt(0).toLowerCase()}${problema.slice(1)}`, ok: false })
    if (v.nueva !== v.repetir) return setEstado({ ocupado: false, error: 'The two new passwords do not match', ok: false })
    if (v.nueva === v.actual) return setEstado({ ocupado: false, error: 'The new password must be different from the current one', ok: false })
    setEstado({ ocupado: true, error: '', ok: false })
    try {
      await servicio.cambiarMiClave(email, v.actual, v.nueva)
      setV({ actual: '', nueva: '', repetir: '' })
      setEstado({ ocupado: false, error: '', ok: true })
    } catch (err) {
      setEstado({ ocupado: false, error: err.message, ok: false })
    }
  }

  const tipo = ver ? 'text' : 'password'
  return (
    <form onSubmit={enviar} className="mt-6 space-y-3 border-t border-slate-100 pt-5">
      <h2 className="text-base font-semibold text-slate-900">Change my password</h2>
      <p className="text-sm text-slate-500">Enter your current password and choose a new one. You can do this whenever you want.</p>
      <Field label="Current password" name="actual" type={tipo} autoComplete="current-password" value={v.actual} onChange={cambiar} required />
      <Field label="New password" name="nueva" type={tipo} autoComplete="new-password" value={v.nueva} onChange={cambiar} hint="At least 8 characters, with letters and numbers." required />
      <Field label="Repeat the new password" name="repetir" type={tipo} autoComplete="new-password" value={v.repetir} onChange={cambiar} required />
      <label className="flex items-center gap-2 text-sm text-slate-600">
        <input type="checkbox" checked={ver} onChange={(e) => setVer(e.target.checked)} className="h-4 w-4 accent-brand-600" /> Show passwords
      </label>
      {estado.error && <p role="alert" className="text-sm text-red-600">{estado.error}</p>}
      {estado.ok && <p role="status" className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">Password updated. Use the new one the next time you sign in.</p>}
      <Button type="submit" disabled={estado.ocupado}>
        {estado.ocupado ? 'Saving…' : 'Change password'}
      </Button>
    </form>
  )
}
