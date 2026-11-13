import { useCallback, useMemo, useState } from 'react'
import CampoIcono from '../../components/auth/CampoIcono'
import GrillaDisponibilidad from '../../components/disponibilidad/GrillaDisponibilidad'
import Avatar from '../../components/ui/Avatar'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import Icon from '../../components/ui/Icon'
import useCarga from '../../hooks/useCarga'
import { aConjunto, aLista } from '../../lib/disponibilidad'
import { validarFoto } from '../../lib/fotos'
import * as servicioReal from '../../services/registros'

function Paso({ n, hecho, titulo, nota }) {
  return (
    <li className="flex items-center gap-3">
      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${hecho ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
        {hecho ? <Icon name="check" className="h-4 w-4" /> : n}
      </span>
      <span className="min-w-0">
        <span className={`block text-sm font-semibold ${hecho ? 'text-slate-900' : 'text-slate-700'}`}>{titulo}</span>
        <span className="block text-xs text-slate-500">{nota}</span>
      </span>
    </li>
  )
}

const vacio = { nombres: '', apellidos: '', celular: '', direccion: '', fotoUrl: '' }

// «Mi perfil» del profesor: datos de contacto, foto (enlace de Drive) y disponibilidad semanal.
// Lo usan quienes acaban de registrarse (estado = 'postulante') y los docentes ya activados.
export default function MiPerfil({ estado = 'docente', onRecargar, servicio = servicioReal }) {
  const cargarRegistro = useCallback(() => servicio.miRegistro(), [servicio])
  const cargarDisp = useCallback(() => servicio.miDisponibilidad().then(aConjunto), [servicio])
  const registro = useCarga(cargarRegistro, null)
  const disp = useCarga(cargarDisp, new Set())

  const [form, setForm] = useState(null) // null = aún sin editar: se muestra lo guardado
  const [slots, setSlots] = useState(null)
  const [msg, setMsg] = useState({ datos: '', disp: '' })
  const [err, setErr] = useState({ datos: '', disp: '' })
  const [guardando, setGuardando] = useState('')

  const base = useMemo(
    () => (registro.datos ? { nombres: registro.datos.nombres, apellidos: registro.datos.apellidos, celular: registro.datos.celular, direccion: registro.datos.direccion, fotoUrl: registro.datos.foto_url ?? '' } : vacio),
    [registro.datos],
  )
  const v = form ?? base
  const franjas = slots ?? disp.datos
  const errorFoto = validarFoto(v.fotoUrl)
  const tieneRegistro = Boolean(registro.datos)

  const cambiar = (e) => setForm({ ...v, [e.target.name]: e.target.value })

  const guardarDatos = async (e) => {
    e.preventDefault()
    if (errorFoto) return setErr((x) => ({ ...x, datos: errorFoto }))
    setGuardando('datos')
    setErr((x) => ({ ...x, datos: '' }))
    setMsg((x) => ({ ...x, datos: '' }))
    try {
      await servicio.guardarMiRegistro({ ...v, fotoUrl: v.fotoUrl.trim() })
      await registro.recargar()
      setForm(null)
      setMsg((x) => ({ ...x, datos: 'Datos guardados.' }))
    } catch (er) {
      setErr((x) => ({ ...x, datos: er.message }))
    } finally {
      setGuardando('')
    }
  }

  const guardarDisp = async () => {
    setGuardando('disp')
    setErr((x) => ({ ...x, disp: '' }))
    setMsg((x) => ({ ...x, disp: '' }))
    try {
      await servicio.guardarMiDisponibilidad(aLista(franjas))
      await disp.recargar()
      setSlots(null)
      setMsg((x) => ({ ...x, disp: 'Availability saved.' }))
    } catch (er) {
      setErr((x) => ({ ...x, disp: er.message }))
    } finally {
      setGuardando('')
    }
  }

  const nombreCompleto = `${base.nombres} ${base.apellidos}`.trim()

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center gap-4">
        <Avatar nombre={nombreCompleto} fotoUrl={base.fotoUrl} tamano="xl" />
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-brand-700">{nombreCompleto || 'My profile'}</h1>
          <p className="mt-1 text-sm text-slate-500">{estado === 'postulante' ? 'Your registration is under review' : 'Your details and your availability'}</p>
        </div>
      </div>

      {estado === 'postulante' && (
        <Card className="mb-6 p-5">
          <h2 className="mb-4 text-base font-semibold text-slate-900">What happens next</h2>
          <ol className="grid gap-4 sm:grid-cols-3">
            <Paso n={1} hecho={tieneRegistro} titulo="Your details" nota="We already received them" />
            <Paso n={2} hecho={disp.datos.size > 0} titulo="Your availability" nota="Mark the hours when you can teach" />
            <Paso n={3} hecho={false} titulo="Activation" nota="Administration will activate you as a teacher" />
          </ol>
          <p className="mt-4 text-sm text-slate-600">
            Already activated?{' '}
            <button type="button" onClick={onRecargar} className="font-semibold text-brand-700 hover:underline">
              Refresh my access
            </button>
          </p>
        </Card>
      )}

      {registro.error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">Could not load your profile: {registro.error}</p>}

      <div className="grid gap-6 xl:grid-cols-[22rem_minmax(0,1fr)]">
        <Card className="h-fit p-5">
          <h2 className="mb-4 flex items-center gap-2 text-base font-semibold text-slate-900">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-100 text-brand-600">
              <Icon name="user" className="h-4 w-4" />
            </span>
            My details
          </h2>
          {!tieneRegistro && !registro.cargando && <p className="mb-4 rounded-lg bg-peach-50 px-3 py-2 text-sm text-peach-700">Complete your details to activate your profile.</p>}
          <form onSubmit={guardarDatos} className="space-y-4">
            <CampoIcono icono="user" etiqueta="First name" name="nombres" value={v.nombres} onChange={cambiar} required />
            <CampoIcono icono="user" etiqueta="Last name" name="apellidos" value={v.apellidos} onChange={cambiar} required />
            <CampoIcono icono="phone" etiqueta="Mobile" name="celular" type="tel" inputMode="tel" value={v.celular} onChange={cambiar} required />
            <CampoIcono icono="pin" etiqueta="Address" name="direccion" value={v.direccion} onChange={cambiar} required />
            <div>
              <CampoIcono
                icono="camera"
                etiqueta="Profile photo (Google Drive link)"
                name="fotoUrl"
                type="url"
                inputMode="url"
                value={v.fotoUrl}
                onChange={cambiar}
                placeholder="https://drive.google.com/file/d/…"
                ayuda="Upload your photo to your Drive, share it with “Anyone with the link” and paste the link here."
              />
              {errorFoto && <p className="mt-1 text-xs text-red-600">{errorFoto}</p>}
            </div>
            {err.datos && <p className="text-sm text-red-600">{err.datos}</p>}
            {msg.datos && <p className="rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-800">{msg.datos}</p>}
            <Button type="submit" disabled={guardando === 'datos' || form === null}>
              {guardando === 'datos' ? 'Saving…' : 'Save my details'}
            </Button>
          </form>
        </Card>

        <Card className="p-5">
          <h2 className="mb-1 flex items-center gap-2 text-base font-semibold text-slate-900">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-100 text-brand-600">
              <Icon name="clock" className="h-4 w-4" />
            </span>
            My availability
          </h2>
          <p className="mb-4 text-sm text-slate-500">Mark the hours, from 7 am to 11 pm, when you can teach each week. We will use this to assign you to classrooms.</p>
          {disp.cargando ? <p className="text-sm text-slate-400">Cargando…</p> : <GrillaDisponibilidad value={franjas} onChange={setSlots} />}
          {err.disp && <p className="mt-3 text-sm text-red-600">{err.disp}</p>}
          {msg.disp && <p className="mt-3 rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-800">{msg.disp}</p>}
          <Button className="mt-4" onClick={guardarDisp} disabled={guardando === 'disp' || slots === null}>
            {guardando === 'disp' ? 'Saving…' : 'Save availability'}
          </Button>
        </Card>
      </div>
    </>
  )
}
