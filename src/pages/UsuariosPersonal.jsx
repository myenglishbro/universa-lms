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
  { value: 'rrhh', label: 'Recursos Humanos' },
  { value: 'comercial', label: 'Comercial' },
]
const DESCRIPCION = {
  admin: 'Ve y edita todo.',
  rrhh: 'Dashboard, salones grupales, estudiantes, profesores registrados y feriados (solo lectura).',
  comercial: 'Solo el dashboard.',
}
const etiqueta = (rol) => ROLES.find((r) => r.value === rol)?.label ?? rol
const fecha = (iso) => (iso ? new Date(iso).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Nunca')

function NuevoUsuario({ servicio, onClose, onCreado }) {
  const [f, setF] = useState({ correo: '', rol: 'comercial', password: generarClave() })
  const [ver, setVer] = useState(true)
  const [error, setError] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [creado, setCreado] = useState(null)

  const enviar = async (e) => {
    e.preventDefault()
    const falla = validarClaveNueva(f.password, f.correo)
    if (falla) return setError(`Contraseña: ${falla}`)
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
      <Modal title="Usuario creado" onClose={onClose}>
        <p className="text-sm text-slate-600">
          <strong>{creado.correo}</strong> ya puede ingresar como <strong>{etiqueta(creado.rol)}</strong>. Entrégale estos datos: la contraseña no se vuelve a mostrar.
        </p>
        <dl className="mt-4 space-y-2 rounded-xl bg-brand-50 p-4 text-sm">
          <div>
            <dt className="text-xs text-slate-500">Correo</dt>
            <dd className="font-semibold">{creado.correo}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Contraseña</dt>
            <dd className="font-mono font-semibold">{creado.password}</dd>
          </div>
        </dl>
        <div className="mt-5 flex justify-end">
          <Button onClick={onClose}>Listo</Button>
        </div>
      </Modal>
    )

  return (
    <Modal title="Nuevo usuario del personal" onClose={onClose}>
      <form onSubmit={enviar} className="space-y-4">
        <Field label="Correo" type="email" required autoComplete="off" value={f.correo} onChange={(e) => setF({ ...f, correo: e.target.value })} />
        <Field label="Rol" options={ROLES} value={f.rol} onChange={(e) => setF({ ...f, rol: e.target.value })} hint={DESCRIPCION[f.rol]} />
        <div>
          <Field
            label="Contraseña inicial"
            type={ver ? 'text' : 'password'}
            autoComplete="new-password"
            value={f.password}
            onChange={(e) => setF({ ...f, password: e.target.value })}
            hint="Mínimo 8, con letras y números. Anótala para entregarla."
          />
          <div className="mt-2 flex gap-2">
            <Button type="button" variant="secondary" onClick={() => setF({ ...f, password: generarClave() })}>
              Generar otra
            </Button>
            <Button type="button" variant="ghost" onClick={() => setVer(!ver)}>
              {ver ? 'Ocultar' : 'Mostrar'}
            </Button>
          </div>
        </div>
        <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">Una cuenta solo puede tener un rol: no se puede usar el correo de un docente o estudiante.</p>
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={ocupado}>
            {ocupado ? 'Creando…' : 'Crear usuario'}
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
        title="Usuarios del personal"
        description="Quién puede entrar al panel y con qué rol. Cada cuenta tiene un solo rol."
        action={
          <Button onClick={() => setNuevo(true)}>
            <Icon name="plus" className="h-4 w-4" /> Nuevo usuario
          </Button>
        }
      />
      {aviso && <p className="mb-3 rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-800">{aviso}</p>}
      {(fallo || error) && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{fallo || error}</p>}
      <Card className="p-0">
        {cargando ? (
          <p className="p-6 text-sm text-slate-500">Cargando…</p>
        ) : datos.length === 0 ? (
          <p className="p-6 text-sm text-slate-500">Todavía no hay usuarios del personal.</p>
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
                      Último ingreso: {fecha(u.ultimo_acceso)} · Creado: {fecha(u.created_at)}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge color={u.activo ? 'brand' : 'rose'}>{u.activo ? 'Activo' : 'Sin acceso'}</Badge>
                    <select
                      aria-label={`Rol de ${u.correo}`}
                      value={u.rol}
                      disabled={yo || ocupado === u.user_id}
                      onChange={(e) => ejecutar(u.user_id, () => servicio.cambiarRolPersonal(u.user_id, e.target.value), `Ahora ${u.correo} es ${etiqueta(e.target.value)}.`)}
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
                            u.activo ? `Se quitó el acceso a ${u.correo}. Puedes devolvérselo cuando quieras.` : `${u.correo} volvió a tener acceso.`,
                          )
                        }
                      >
                        {u.activo ? 'Quitar acceso' : 'Activar'}
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
