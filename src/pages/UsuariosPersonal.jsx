import { useCallback, useState } from 'react'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import Field from '../components/ui/Field'
import Icon from '../components/ui/Icon'
import Modal from '../components/ui/Modal'
import PageHeader from '../components/ui/PageHeader'
import useCarga from '../hooks/useCarga'
import { generarClave, validarClaveNueva } from '../lib/clave'
import * as servicioReal from '../services/personal'

const ROLES = [
  { value: 'admin', label: 'Administrador' },
  { value: 'rrhh', label: 'Human Resources' },
  { value: 'comercial', label: 'Comercial' },
]
const DESCRIPCION = {
  admin: 'Sees and edits everything.',
  rrhh: 'Dashboard, group classrooms, students, registered teachers and holidays (read-only).',
  comercial: 'Dashboard only.',
}
const etiqueta = (rol) => ROLES.find((r) => r.value === rol)?.label ?? rol
const fecha = (iso) => (iso ? new Date(iso).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Nunca')

function NuevoUsuario({ servicio, onClose, onCreado }) {
  const [f, setF] = useState({ correo: '', rol: 'comercial', password: generarClave() })
  const [ver, setVer] = useState(true)
  const [error, setError] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [creado, setCreado] = useState(null)

  const enviar = async (e) => {
    e.preventDefault()
    const falla = validarClaveNueva(f.password, f.correo)
    if (falla) return setError(`Password: ${falla}`)
    setOcupado(true)
    setError('')
    try {
      await servicio.crearPersonal(f)
      setCreado({ correo: f.correo.trim().toLowerCase(), password: f.password, rol: f.rol })
      onCreado()
    } catch (err) {
      setError(err.message)
    } finally {
      setOcupado(false)
    }
  }

  if (creado)
    return (
      <Modal title="User created" onClose={onClose}>
        <p className="text-sm text-slate-600">
          <strong>{creado.correo}</strong> can now sign in as <strong>{etiqueta(creado.rol)}</strong>. Give them these details: the password is not shown again.
        </p>
        <dl className="mt-4 space-y-2 rounded-xl bg-brand-50 p-4 text-sm">
          <div>
            <dt className="text-xs text-slate-500">Email</dt>
            <dd className="font-semibold">{creado.correo}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Password</dt>
            <dd className="font-mono font-semibold">{creado.password}</dd>
          </div>
        </dl>
        <div className="mt-5 flex justify-end">
          <Button onClick={onClose}>Listo</Button>
        </div>
      </Modal>
    )

  return (
    <Modal title="New staff user" onClose={onClose}>
      <form onSubmit={enviar} className="space-y-4">
        <Field label="Email" type="email" required autoComplete="off" value={f.correo} onChange={(e) => setF({ ...f, correo: e.target.value })} />
        <Field label="Rol" options={ROLES} value={f.rol} onChange={(e) => setF({ ...f, rol: e.target.value })} hint={DESCRIPCION[f.rol]} />
        <div>
          <Field
            label="Initial password"
            type={ver ? 'text' : 'password'}
            autoComplete="new-password"
            value={f.password}
            onChange={(e) => setF({ ...f, password: e.target.value })}
            hint="At least 8, with letters and numbers. Write it down to hand it over."
          />
          <div className="mt-2 flex gap-2">
            <Button type="button" variant="secondary" onClick={() => setF({ ...f, password: generarClave() })}>
              Generate another
            </Button>
            <Button type="button" variant="ghost" onClick={() => setVer(!ver)}>
              {ver ? 'Hide' : 'Show'}
            </Button>
          </div>
        </div>
        <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">An account can only have one role: you cannot use the email of a teacher or student.</p>
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={ocupado}>
            {ocupado ? 'Creating…' : 'Create user'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

// Usuarios con acceso al panel de gestión: crear cuentas, cambiar su rol y quitar/devolver el acceso. Solo administración.
export default function UsuariosPersonal({ miCorreo, servicio = servicioReal }) {
  const cargar = useCallback(() => servicio.listarPersonal(), [servicio])
  const { datos, cargando, error, recargar } = useCarga(cargar, [])
  const [nuevo, setNuevo] = useState(false)
  const [ocupado, setOcupado] = useState(null)
  const [aviso, setAviso] = useState('')
  const [fallo, setFallo] = useState('')

  const ejecutar = async (id, fn, mensaje) => {
    setOcupado(id)
    setAviso('')
    setFallo('')
    try {
      await fn()
      await recargar()
      setAviso(mensaje)
    } catch (e) {
      setFallo(e.message)
    } finally {
      setOcupado(null)
    }
  }

  return (
    <div>
      <PageHeader
        title="Staff users"
        description="Who can enter the panel and with which role. Each account has a single role."
        action={
          <Button onClick={() => setNuevo(true)}>
            <Icon name="plus" className="h-4 w-4" /> New user
          </Button>
        }
      />
      {aviso && <p className="mb-3 rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-800">{aviso}</p>}
      {(fallo || error) && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{fallo || error}</p>}
      <Card className="p-0">
        {cargando ? (
          <p className="p-6 text-sm text-slate-500">Loading…</p>
        ) : datos.length === 0 ? (
          <p className="p-6 text-sm text-slate-500">There are no staff users yet.</p>
        ) : (
          <ul className="divide-y divide-brand-100">
            {datos.map((u) => {
              const yo = miCorreo && u.correo?.toLowerCase() === miCorreo.toLowerCase()
              return (
                <li key={u.user_id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-slate-900">
                      {u.correo} {yo && <span className="text-xs font-normal text-slate-500">(tú)</span>}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Last sign-in: {fecha(u.ultimo_acceso)} · Created: {fecha(u.created_at)}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge color={u.activo ? 'brand' : 'rose'}>{u.activo ? 'Active' : 'No access'}</Badge>
                    <select
                      aria-label={`Role of ${u.correo}`}
                      value={u.rol}
                      disabled={yo || ocupado === u.user_id}
                      onChange={(e) => ejecutar(u.user_id, () => servicio.cambiarRolPersonal(u.user_id, e.target.value), `${u.correo} is now ${etiqueta(e.target.value)}.`)}
                      className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-sm disabled:bg-slate-50"
                    >
                      {ROLES.map((r) => (
                        <option key={r.value} value={r.value}>
                          {r.label}
                        </option>
                      ))}
                    </select>
                    {!yo && (
                      <Button
                        variant="secondary"
                        className="px-4 py-1.5"
                        disabled={ocupado === u.user_id}
                        onClick={() =>
                          ejecutar(
                            u.user_id,
                            () => servicio.cambiarEstadoPersonal(u.user_id, !u.activo),
                            u.activo ? `Access removed for ${u.correo}. You can restore it whenever you want.` : `${u.correo} has access again.`,
                          )
                        }
                      >
                        {u.activo ? 'Remove access' : 'Activate'}
                      </Button>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </Card>
      {nuevo && <NuevoUsuario servicio={servicio} onClose={() => setNuevo(false)} onCreado={recargar} />}
    </div>
  )
}
