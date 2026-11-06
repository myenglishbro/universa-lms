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
      setMsg((x) => ({ ...x, disp: 'Disponibilidad guardada.' }))
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
          <h1 className="text-3xl font-bold tracking-tight text-brand-700">{nombreCompleto || 'Mi perfil'}</h1>
          <p className="mt-1 text-sm text-slate-500">{estado === 'postulante' ? 'Tu registro está en revisión' : 'Tus datos y tu disponibilidad'}</p>
        </div>
      </div>

      {estado === 'postulante' && (
        <Card className="mb-6 p-5">
          <h2 className="mb-4 text-base font-semibold text-slate-900">Qué sigue</h2>
          <ol className="grid gap-4 sm:grid-cols-3">
            <Paso n={1} hecho={tieneRegistro} titulo="Tus datos" nota="Ya los recibimos" />
            <Paso n={2} hecho={disp.datos.size > 0} titulo="Tu disponibilidad" nota="Marca las horas en que puedes dar clases" />
            <Paso n={3} hecho={false} titulo="Activación" nota="Administración te activará como docente" />
          </ol>
          <p className="mt-4 text-sm text-slate-600">
            ¿Ya te activaron?{' '}
            <button type="button" onClick={onRecargar} className="font-semibold text-brand-700 hover:underline">
              Actualizar mi acceso
            </button>
          </p>
        </Card>
      )}

      {registro.error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">No se pudo cargar tu perfil: {registro.error}</p>}

      <div className="grid gap-6 xl:grid-cols-[22rem_minmax(0,1fr)]">
        <Card className="h-fit p-5">
          <h2 className="mb-4 flex items-center gap-2 text-base font-semibold text-slate-900">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-100 text-brand-600">
              <Icon name="user" className="h-4 w-4" />
            </span>
            Mis datos
          </h2>
          {!tieneRegistro && !registro.cargando && <p className="mb-4 rounded-lg bg-peach-50 px-3 py-2 text-sm text-peach-700">Completa tus datos para activar tu perfil.</p>}
          <form onSubmit={guardarDatos} className="space-y-4">
            <CampoIcono icono="user" etiqueta="Nombres" name="nombres" value={v.nombres} onChange={cambiar} required />
            <CampoIcono icono="user" etiqueta="Apellidos" name="apellidos" value={v.apellidos} onChange={cambiar} required />
            <CampoIcono icono="phone" etiqueta="Celular" name="celular" type="tel" inputMode="tel" value={v.celular} onChange={cambiar} required />
            <CampoIcono icono="pin" etiqueta="Dirección" name="direccion" value={v.direccion} onChange={cambiar} required />
            <div>
              <CampoIcono
                icono="camera"
                etiqueta="Foto de perfil (enlace de Google Drive)"
                name="fotoUrl"
                type="url"
                inputMode="url"
                value={v.fotoUrl}
                onChange={cambiar}
                placeholder="https://drive.google.com/file/d/…"
                ayuda="Sube tu foto a tu Drive, compártela con «Cualquier persona con el enlace» y pega aquí el enlace."
              />
              {errorFoto && <p className="mt-1 text-xs text-red-600">{errorFoto}</p>}
            </div>
            {err.datos && <p className="text-sm text-red-600">{err.datos}</p>}
            {msg.datos && <p className="rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-800">{msg.datos}</p>}
            <Button type="submit" disabled={guardando === 'datos' || form === null}>
              {guardando === 'datos' ? 'Guardando…' : 'Guardar mis datos'}
            </Button>
          </form>
        </Card>

        <Card className="p-5">
          <h2 className="mb-1 flex items-center gap-2 text-base font-semibold text-slate-900">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-100 text-brand-600">
              <Icon name="clock" className="h-4 w-4" />
            </span>
            Mi disponibilidad
          </h2>
          <p className="mb-4 text-sm text-slate-500">Marca las horas, de 7 am a 11 pm, en las que puedes dar clases cada semana. Con esto te asignaremos a los salones.</p>
          {disp.cargando ? <p className="text-sm text-slate-400">Cargando…</p> : <GrillaDisponibilidad value={franjas} onChange={setSlots} />}
          {err.disp && <p className="mt-3 text-sm text-red-600">{err.disp}</p>}
          {msg.disp && <p className="mt-3 rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-800">{msg.disp}</p>}
          <Button className="mt-4" onClick={guardarDisp} disabled={guardando === 'disp' || slots === null}>
            {guardando === 'disp' ? 'Guardando…' : 'Guardar disponibilidad'}
          </Button>
        </Card>
      </div>
    </>
  )
}
