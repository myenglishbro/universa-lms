import { useEffect, useState } from 'react'
import Button from '../ui/Button'
import Field from '../ui/Field'
import Modal from '../ui/Modal'
import { calcularEdad, errorDocumento, generos, paises, tiposDocumento } from '../../lib/estudiantes'
import { hoyLima } from '../../lib/salones'
import * as servicioReal from '../../services/personas'

const grid = 'grid gap-4 sm:grid-cols-2 lg:grid-cols-3'

function Seccion({ titulo, subtitulo, children }) {
  return (
    <section>
      <h3 className="text-sm font-semibold text-slate-900">{titulo}</h3>
      {subtitulo && <p className="mb-3 text-xs text-slate-500">{subtitulo}</p>}
      <div className={subtitulo ? '' : 'mt-3'}>{children}</div>
    </section>
  )
}

// Alta y edición de estudiantes: datos personales, contacto y acceso a MaskPark (la contraseña solo la ven los administradores).
// Supabase rechaza nombre, correo, teléfono, documento o usuario de MaskPark repetidos y el mensaje se muestra aquí.
export default function EstudianteForm({ estudiante, onSave, onClose, servicio = servicioReal }) {
  const [v, setV] = useState({
    // Un estudiante registrado antes con un solo nombre completo lo conserva en «Nombres» hasta que se separe.
    nombres: estudiante?.nombres ?? estudiante?.nombre ?? '',
    apellidos: estudiante?.apellidos ?? '',
    tipoDocumento: estudiante?.tipo_documento ?? 'dni',
    numeroDocumento: estudiante?.numero_documento ?? '',
    fechaNacimiento: estudiante?.fecha_nacimiento ?? '',
    paisNacionalidad: estudiante?.pais_nacionalidad ?? (estudiante ? '' : 'Perú'),
    genero: estudiante?.genero ?? '',
    telefono: estudiante?.telefono ?? '',
    correo: estudiante?.correo ?? '',
    maskparkUsuario: '',
    maskparkClave: '',
    notas: estudiante?.notas ?? '',
    activo: estudiante?.activo ?? true,
  })
  // Estado de la carga del acceso de MaskPark: mientras carga no se puede guardar, y si no se pudo leer no se envía (así nunca se borra por error).
  const [plataforma, setPlataforma] = useState(estudiante ? 'cargando' : 'ok') // 'cargando' | 'ok' | 'error'
  const [tieneClave, setTieneClave] = useState(false) // ya hay una contraseña guardada (no se muestra: vacío = conservarla)
  const [verClave, setVerClave] = useState(false)
  const [errores, setErrores] = useState({})
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)
  const cambiar = (e) => setV((x) => ({ ...x, [e.target.name]: e.target.value }))

  // Acceso de MaskPark ya guardado (solo se lee al editar).
  useEffect(() => {
    if (!estudiante) return undefined
    let vigente = true
    servicio
      .plataformaEstudiante(estudiante.id)
      .then((p) => {
        if (!vigente) return
        if (p) {
          setV((x) => ({ ...x, maskparkUsuario: p.usuario ?? '' }))
          setTieneClave(Boolean(p.clave))
        }
        setPlataforma('ok')
      })
      .catch(() => vigente && setPlataforma('error'))
    return () => {
      vigente = false
    }
  }, [estudiante, servicio])

  const edad = calcularEdad(v.fechaNacimiento)

  const validar = () => {
    const e = {}
    if (!v.nombres.trim()) e.nombres = 'Obligatorio'
    if (!estudiante && !v.apellidos.trim()) e.apellidos = 'Obligatorio'
    const doc = errorDocumento(v.tipoDocumento, v.numeroDocumento)
    if (doc) e.numeroDocumento = doc
    if (v.fechaNacimiento && (v.fechaNacimiento > hoyLima() || v.fechaNacimiento < '1900-01-01')) e.fechaNacimiento = 'Fecha no válida'
    if (v.maskparkClave && !v.maskparkUsuario.trim()) e.maskparkUsuario = 'Indica el usuario para guardar la contraseña'
    return e
  }

  const enviar = async (ev) => {
    ev.preventDefault()
    const e = validar()
    setErrores(e)
    if (Object.keys(e).length) return
    setGuardando(true)
    setError('')
    try {
      const { maskparkUsuario, maskparkClave, ...resto } = v
      await onSave({
        ...resto,
        ...(plataforma === 'ok' ? { maskparkUsuario, maskparkClave } : {}),
        nombre: `${v.nombres.trim()} ${v.apellidos.trim()}`.trim(),
      })
    } catch (err) {
      setError(err.message)
      setGuardando(false)
    }
  }

  return (
    <Modal wide="xl" title={estudiante ? 'Editar estudiante' : 'Nuevo estudiante'} onClose={onClose}>
      <form onSubmit={enviar} className="space-y-6" noValidate>
        <Seccion titulo="Datos personales">
          <div className={grid}>
            <Field label="Nombres" name="nombres" value={v.nombres} onChange={cambiar} error={errores.nombres} required />
            <Field label="Apellidos" name="apellidos" value={v.apellidos} onChange={cambiar} error={errores.apellidos} required={!estudiante} />
            <Field label="Género" name="genero" value={v.genero} onChange={cambiar} options={generos} />
            <Field label="Tipo de documento" name="tipoDocumento" value={v.tipoDocumento} onChange={cambiar} options={tiposDocumento} />
            <Field
              label="N.º de documento"
              name="numeroDocumento"
              value={v.numeroDocumento}
              onChange={cambiar}
              error={errores.numeroDocumento}
              inputMode={v.tipoDocumento === 'dni' ? 'numeric' : undefined}
              maxLength={20}
              disabled={!v.tipoDocumento}
            />
            <Field label="Fecha de nacimiento" name="fechaNacimiento" type="date" min="1900-01-01" max={hoyLima()} value={v.fechaNacimiento} onChange={cambiar} error={errores.fechaNacimiento} />
            <div>
              <Field label="País de nacionalidad" name="paisNacionalidad" value={v.paisNacionalidad} onChange={cambiar} list="paises-estudiante" autoComplete="off" />
              <datalist id="paises-estudiante">
                {paises.map((p) => (
                  <option key={p} value={p} />
                ))}
              </datalist>
            </div>
            <Field label="Edad" value={edad === null ? '—' : `${edad} años`} disabled readOnly hint="Se calcula con la fecha de nacimiento." />
          </div>
        </Seccion>

        <Seccion titulo="Contacto">
          <div className={grid}>
            <Field label="Correo (opcional)" name="correo" type="email" value={v.correo} onChange={cambiar} />
            <Field label="Celular (opcional)" name="telefono" type="tel" value={v.telefono} onChange={cambiar} placeholder="+51 999 999 999" />
          </div>
        </Seccion>

        <Seccion titulo="Plataforma MaskPark" subtitulo="Acceso del estudiante a la plataforma. Solo lo ve el administrador.">
          {plataforma === 'error' && <p className="mb-2 text-xs text-peach-700">No se pudo leer el acceso guardado: lo que escribas aquí no se guardará hasta recargar.</p>}
          <div className={grid}>
            <Field label="Usuario" name="maskparkUsuario" value={v.maskparkUsuario} onChange={cambiar} error={errores.maskparkUsuario} autoComplete="off" disabled={plataforma !== 'ok'} />
            <div>
              <Field
                label="Contraseña"
                name="maskparkClave"
                type={verClave ? 'text' : 'password'}
                value={v.maskparkClave}
                onChange={cambiar}
                autoComplete="new-password"
                disabled={plataforma !== 'ok'}
                placeholder={tieneClave ? 'Dejar vacío para conservar la actual' : ''}
              />
              <button type="button" onClick={() => setVerClave((x) => !x)} className="mt-1 text-xs text-brand-700 hover:underline">
                {verClave ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              </button>
            </div>
          </div>
        </Seccion>

        <Field label="Notas (opcional)" name="notas" as="textarea" rows="2" value={v.notas} onChange={cambiar} />
        {estudiante && (
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={v.activo} onChange={(e) => setV({ ...v, activo: e.target.checked })} className="h-4 w-4 accent-brand-600" />
            Estudiante activo
          </label>
        )}
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={guardando || plataforma === 'cargando'}>
            {guardando ? 'Guardando…' : estudiante ? 'Guardar cambios' : 'Registrar estudiante'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
