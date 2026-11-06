import { useCallback, useMemo, useState } from 'react'
import GrillaDisponibilidad from '../components/disponibilidad/GrillaDisponibilidad'
import Avatar from '../components/ui/Avatar'
import Ayuda from '../components/ui/Ayuda'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import { inputClass } from '../components/ui/Field'
import Icon from '../components/ui/Icon'
import Modal from '../components/ui/Modal'
import PageHeader from '../components/ui/PageHeader'
import Tile from '../components/ui/Tile'
import useCarga from '../hooks/useCarga'
import { generarClave, validarClaveNueva } from '../lib/clave'
import { aConjunto, resumenDisponibilidad } from '../lib/disponibilidad'
import { hoyLima } from '../lib/salones'
import * as servicioReal from '../services/registros'

const nombreDe = (r) => `${r.nombres} ${r.apellidos}`.trim()
const horas = (r) => (r.disponibilidad ?? []).length
const whatsapp = (cel) => {
  const d = (cel ?? '').replace(/\D/g, '')
  return d ? `https://wa.me/${d.length === 9 ? `51${d}` : d}` : null
}
const hace = (iso) => {
  const dias = Math.round((new Date(`${hoyLima()}T00:00:00`) - new Date(`${iso.slice(0, 10)}T00:00:00`)) / 86400000)
  return dias <= 0 ? 'hoy' : dias === 1 ? 'ayer' : `hace ${dias} días`
}

// Ficha completa de un registro: datos, disponibilidad, contraseña (solo la cambia administración) y activación como docente.
function Ficha({ r, servicio, onCambio, onClose }) {
  const [clave, setClave] = useState('')
  const [verClave, setVerClave] = useState(false)
  const [aviso, setAviso] = useState('')
  const [fallo, setFallo] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const esDocente = Boolean(r.docente_id)
  const wa = whatsapp(r.celular)

  const ejecutar = async (fn, ok) => {
    if (ocupado) return
    setOcupado(true)
    setFallo('')
    setAviso('')
    try {
      await fn()
      await onCambio()
      setAviso(ok)
    } catch (e) {
      setFallo(e.message)
    } finally {
      setOcupado(false)
    }
  }

  const cambiarClave = (e) => {
    e.preventDefault()
    const problema = validarClaveNueva(clave, r.correo)
    if (problema) return setFallo(`Contraseña: ${problema.charAt(0).toLowerCase()}${problema.slice(1)}`)
    ejecutar(async () => {
      await servicio.cambiarClaveAcceso({ userId: r.user_id, password: clave })
      setClave('')
      setVerClave(false)
    }, 'Contraseña actualizada. Entrégasela a la persona por un medio seguro: no se vuelve a mostrar.')
  }

  return (
    <Modal wide="xl" title="Ficha del profesor" onClose={onClose}>
      <div className="flex flex-wrap items-center gap-4">
        <Avatar nombre={nombreDe(r)} fotoUrl={r.foto_url} tamano="xl" />
        <div className="min-w-0">
          <h3 className="text-xl font-bold text-slate-900">{nombreDe(r)}</h3>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-500">
            {esDocente ? <Badge color="brand">Docente activo</Badge> : <Badge color="peach">Pendiente de activar</Badge>}
            <span>Se registró {hace(r.created_at)}</span>
          </p>
        </div>
      </div>

      <dl className="mt-5 grid gap-3 sm:grid-cols-2">
        {[
          ['mail', 'Correo', r.correo],
          ['phone', 'Celular', r.celular],
          ['pin', 'Dirección', r.direccion],
        ].map(([icono, etiqueta, valor]) => (
          <div key={etiqueta} className="flex items-start gap-3 rounded-xl bg-brand-50/60 p-3">
            <Icon name={icono} className="mt-0.5 h-4 w-4 text-brand-500" />
            <div className="min-w-0">
              <dt className="text-xs text-slate-500">{etiqueta}</dt>
              <dd className="break-words text-sm font-medium text-slate-900">{valor}</dd>
            </div>
          </div>
        ))}
        {wa && (
          <a href={wa} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 rounded-xl border border-brand-200 p-3 text-sm font-semibold text-brand-700 hover:bg-brand-50">
            <Icon name="external" className="h-4 w-4" /> Escribir por WhatsApp
          </a>
        )}
      </dl>

      <section className="mt-6">
        <h4 className="mb-2 text-sm font-semibold text-slate-900">Disponibilidad</h4>
        {horas(r) === 0 ? (
          <p className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-500">Todavía no marcó su disponibilidad.</p>
        ) : (
          <>
            <p className="mb-3 text-sm text-slate-600">{resumenDisponibilidad(aConjunto(r.disponibilidad))}</p>
            <GrillaDisponibilidad value={aConjunto(r.disponibilidad)} />
          </>
        )}
      </section>

      <section className="mt-6 rounded-2xl border border-brand-100 p-4">
        <h4 className="mb-1 flex items-center gap-2 text-sm font-semibold text-slate-900">
          <Icon name="lock" className="h-4 w-4 text-brand-500" /> Contraseña
        </h4>
        <p className="mb-3 text-xs text-slate-500">Solo administración puede cambiarla. La actual no se puede ver.</p>
        <form onSubmit={cambiarClave} className="flex flex-wrap items-end gap-2">
          <label className="min-w-56 flex-1">
            <span className="mb-1 block text-xs font-medium text-slate-600">Contraseña nueva</span>
            <input type={verClave ? 'text' : 'password'} autoComplete="new-password" value={clave} onChange={(e) => setClave(e.target.value)} className={inputClass} placeholder="Mínimo 8, con letras y números" />
          </label>
          <Button type="button" variant="secondary" onClick={() => { setClave(generarClave()); setVerClave(true) }}>
            Generar
          </Button>
          <Button type="submit" disabled={ocupado || !clave}>
            Guardar contraseña
          </Button>
        </form>
      </section>

      {aviso && <p className="mt-4 rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-800">{aviso}</p>}
      {fallo && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{fallo}</p>}

      <div className="mt-6 flex flex-wrap justify-end gap-2 border-t border-brand-100 pt-4">
        {esDocente ? (
          <Button variant="secondary" disabled={ocupado} onClick={() => ejecutar(() => servicio.quitarDocente(r.user_id), 'Se quitó el acceso docente. Sigue registrado y puedes activarlo de nuevo.')}>
            Quitar acceso docente
          </Button>
        ) : (
          <Button disabled={ocupado} onClick={() => ejecutar(() => servicio.convertirEnDocente(r.user_id), 'Listo: ya es docente y puede ingresar a su portal. Si tenía la sesión abierta, que presione «Actualizar mi acceso».')}>
            <Icon name="check" className="h-4 w-4" /> Activar como docente
          </Button>
        )}
      </div>
    </Modal>
  )
}

// Profesores que se registraron solos: administración los revisa y los convierte en docentes.
export default function Registros({ onCambio, servicio = servicioReal }) {
  const cargar = useCallback(() => servicio.listarRegistros(), [servicio])
  const { datos, cargando, error, recargar } = useCarga(cargar, [])
  const [filtro, setFiltro] = useState('pendientes')
  const [busqueda, setBusqueda] = useState('')
  const [abiertoId, setAbiertoId] = useState(null)
  const [fallo, setFallo] = useState('')
  const [activando, setActivando] = useState(null)

  const pendientes = datos.filter((r) => !r.docente_id).length
  const docentes = datos.length - pendientes
  const visibles = useMemo(() => {
    const t = busqueda.trim().toLowerCase()
    return datos.filter((r) => (filtro === 'todos' || (filtro === 'pendientes' ? !r.docente_id : Boolean(r.docente_id))) && (!t || `${nombreDe(r)} ${r.correo} ${r.celular}`.toLowerCase().includes(t)))
  }, [datos, filtro, busqueda])
  const abierto = datos.find((r) => r.user_id === abiertoId)

  const cambio = async () => {
    await recargar()
    await onCambio?.()
  }
  const activar = async (r) => {
    setActivando(r.user_id)
    setFallo('')
    try {
      await servicio.convertirEnDocente(r.user_id)
      await cambio()
    } catch (e) {
      setFallo(e.message)
    } finally {
      setActivando(null)
    }
  }

  return (
    <>
      <PageHeader title="Profesores registrados" description="Quienes se registran solos aparecen aquí para que los actives como docentes" />

      <Ayuda id="registros" titulo="¿Cómo funciona?">
        <p>
          Cada profesor se registra desde la pantalla de ingreso («Soy profesor: registrarme») con sus datos y su contraseña. Su cuenta <strong>no tiene acceso a nada</strong> hasta que tú la actives.
        </p>
        <p>
          Revisa sus datos y su <strong>disponibilidad</strong> y toca <strong>«Activar como docente»</strong>: se crea el docente y ya puede entrar a su portal. Desde su ficha también puedes <strong>cambiarle la contraseña</strong>.
        </p>
        <p className="text-slate-600">
          Para invitarlos, envíales el enlace de la plataforma terminado en <code className="rounded bg-white px-1.5 py-0.5 text-xs">#registro-profesor</code>.
        </p>
      </Ayuda>

      {!cargando && !error && (
        <div className="mb-4 grid grid-cols-3 gap-3">
          <Tile icono="userplus" tono={pendientes > 0 ? 'peach' : 'slate'} valor={pendientes} etiqueta="Por activar" onClick={() => setFiltro('pendientes')} activo={filtro === 'pendientes'} />
          <Tile icono="teacher" tono="brand" valor={docentes} etiqueta="Ya son docentes" onClick={() => setFiltro('docentes')} activo={filtro === 'docentes'} />
          <Tile icono="users" tono="slate" valor={datos.length} etiqueta="Registrados en total" onClick={() => setFiltro('todos')} activo={filtro === 'todos'} />
        </div>
      )}

      <Card>
        <div className="flex flex-wrap items-center gap-3 border-b border-brand-100 p-4">
          <div className="relative min-w-56 flex-1 sm:max-w-xs">
            <Icon name="search" className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar por nombre, correo o celular" className={`${inputClass} pl-9`} />
          </div>
        </div>
        {fallo && <p className="border-b border-red-100 bg-red-50 px-4 py-2 text-sm text-red-700">{fallo}</p>}

        {cargando ? (
          <p className="px-4 py-10 text-center text-sm text-slate-500">Cargando…</p>
        ) : error ? (
          <div className="px-4 py-10 text-center text-sm">
            <p className="text-red-600">No se pudieron cargar los registros: {error}</p>
            <Button variant="secondary" className="mt-3" onClick={recargar}>
              Reintentar
            </Button>
          </div>
        ) : visibles.length === 0 ? (
          <p className="px-4 py-12 text-center text-sm text-slate-500">{datos.length === 0 ? 'Aún no se registró ningún profesor.' : 'No hay registros en esta vista.'}</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {visibles.map((r) => (
              <li key={r.user_id} className="flex flex-wrap items-center gap-4 px-4 py-4 hover:bg-brand-50/40">
                <Avatar nombre={nombreDe(r)} fotoUrl={r.foto_url} tamano="lg" />
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 font-semibold text-slate-900">
                    {nombreDe(r)} {r.docente_id ? <Badge color="brand">Docente</Badge> : <Badge color="peach">Por activar</Badge>}
                  </p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-4 gap-y-0.5 text-sm text-slate-500">
                    <span className="inline-flex items-center gap-1">
                      <Icon name="mail" className="h-3.5 w-3.5" /> {r.correo}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Icon name="phone" className="h-3.5 w-3.5" /> {r.celular}
                    </span>
                  </p>
                  <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <span>Se registró {hace(r.created_at)}</span>
                    {horas(r) > 0 ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 font-medium text-brand-700">
                        <Icon name="clock" className="h-3 w-3" /> {horas(r)} h libres por semana
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-slate-500">Sin disponibilidad</span>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="secondary" className="px-4 py-1.5" onClick={() => setAbiertoId(r.user_id)}>
                    Ver ficha
                  </Button>
                  {!r.docente_id && (
                    <Button className="px-4 py-1.5" disabled={activando === r.user_id} onClick={() => activar(r)}>
                      {activando === r.user_id ? 'Activando…' : 'Activar'}
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {abierto && <Ficha r={abierto} servicio={servicio} onCambio={cambio} onClose={() => setAbiertoId(null)} />}
    </>
  )
}
