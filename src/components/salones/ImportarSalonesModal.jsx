import { useEffect, useMemo, useRef, useState } from 'react'
import Badge from '../ui/Badge'
import Button from '../ui/Button'
import Modal from '../ui/Modal'
import { MAX_BYTES, MAX_FILAS, analizarLote, ejecutarImportacion, leerJson, plantillaSalones, resumenLote, validarContraBase } from '../../lib/importarSalones'
import { hoyLima } from '../../lib/salones'
import { validarHorariosSalon } from '../../services/catalogo'
import * as salonesApi from '../../services/salones'

const servicioReal = {
  guardarSalon: salonesApi.guardarSalon,
  choquesHorarioSalon: salonesApi.choquesHorarioSalon,
  validarHorariosSalon,
}

const descargarJson = (nombre, objeto) => {
  const url = URL.createObjectURL(new Blob([JSON.stringify(objeto, null, 2)], { type: 'application/json' }))
  const a = document.createElement('a')
  a.href = url
  a.download = nombre
  a.click()
  URL.revokeObjectURL(url)
}

const colorEstado = { nuevo: 'brand', existente: 'slate', error: 'rose' }
const textoEstado = { nuevo: 'Nuevo', existente: 'Ya existe', error: 'Con error' }
const colorResultado = { creado: 'brand', omitido: 'slate', error: 'rose', no_procesado: 'peach' }
const textoResultado = { creado: 'Creado', omitido: 'Omitido', error: 'Error', no_procesado: 'No procesado' }

const CAMPOS_AYUDA = [
  ['nombre *', 'Nombre del salón', 'Básico noche A'],
  ['nivel *', 'Código o nombre del nivel', 'basico'],
  ['fecha_inicio *', 'AAAA-MM-DD (o DD/MM/AAAA)', '2026-12-01'],
  ['capacidad', 'Alumnos máximos (entero). Si falta se pone 8 (1 en privados) para ajustar luego', '8'],
  ['docente', 'Nombre completo o correo', 'Ana Ruiz Paz'],
  ['estado', 'pendiente · en_curso · finalizado', 'pendiente'],
  ['plan', '{ modalidad, minutos, sesiones_semana, tipo_alumno, ciclo_desde, ciclo_hasta }: solo lo necesario para identificar un plan del nivel', '{ "modalidad": "estandar", "minutos": 60 }'],
  ['frecuencia', 'Código o nombre de una frecuencia grupal', 'grupal-lv-60'],
  ['total_sesiones', 'Clases en total (con plan lo fija el plan)', '40'],
  ['horarios', 'Lista de { dia, hora_inicio, hora_fin }; dia = 1 a 7 o lun…dom', '{ "dia": "lun", "hora_inicio": "19:00", "hora_fin": "20:00" }'],
  ['observaciones', 'Texto libre', ''],
]

// Carga masiva de salones desde un JSON: 1) elegir archivo, 2) revisar (nada se guarda; se consulta a la base si los horarios y docentes cuadran),
// 3) crear fila por fila, 4) resultado. La base de datos vuelve a validar cada salón; una fila con problemas no detiene a las demás.
export default function ImportarSalonesModal({ salones, niveles, docentes, catalogo, onTerminar, onClose, servicio = servicioReal }) {
  const [paso, setPaso] = useState('archivo') // archivo | revision | procesando | resultado
  const [crudas, setCrudas] = useState([])
  const [nombreArchivo, setNombreArchivo] = useState('')
  const [errorArchivo, setErrorArchivo] = useState('')
  const [soloProblemas, setSoloProblemas] = useState(false)
  const [avance, setAvance] = useState({ hechas: 0, total: 0 })
  const [resultados, setResultados] = useState([])
  const [contrastado, setContrastado] = useState(null) // { fuente, lote }: revisión contra la base de un análisis concreto
  const cancelado = useRef(false)

  const local = useMemo(
    () => (crudas.length ? analizarLote(crudas, { salones, niveles, docentes, catalogo, hoy: hoyLima() }) : []),
    [crudas, salones, niveles, docentes, catalogo],
  )

  // Segunda revisión contra la base de datos cada vez que cambia el archivo.
  useEffect(() => {
    if (!local.length) return undefined
    let vigente = true
    validarContraBase(local, { servicio, cancelado: () => !vigente }).then((lote) => vigente && setContrastado({ fuente: local, lote }))
    return () => {
      vigente = false
    }
  }, [local, servicio])

  const revisado = contrastado?.fuente === local ? contrastado.lote : null
  const revisando = local.length > 0 && !revisado
  const analisis = revisado ?? local
  const resumen = resumenLote(analisis)

  const elegirArchivo = async (e) => {
    const archivo = e.target.files?.[0]
    e.target.value = ''
    if (!archivo) return
    setErrorArchivo('')
    if (archivo.size > MAX_BYTES) return setErrorArchivo(`El archivo pesa ${(archivo.size / 1048576).toFixed(1)} MB; el máximo es ${MAX_BYTES / 1048576} MB.`)
    const { filas, error } = leerJson(await archivo.text())
    if (error) return setErrorArchivo(error)
    setNombreArchivo(archivo.name)
    setCrudas(filas)
    setPaso('revision')
  }

  const importar = async () => {
    cancelado.current = false
    setAvance({ hechas: 0, total: analisis.length })
    setPaso('procesando')
    const res = await ejecutarImportacion(analisis, {
      servicio,
      onProgreso: (hechas, total) => setAvance({ hechas, total }),
      cancelado: () => cancelado.current,
    })
    setResultados(res)
    setPaso('resultado')
    await onTerminar?.()
  }

  const cuenta = (r) => resultados.filter((x) => x.resultado === r).length
  const conProblema = resultados.filter((x) => x.resultado === 'error' || x.resultado === 'no_procesado')

  const descargarErrores = () =>
    descargarJson(
      'salones-con-errores.json',
      conProblema.map((x) => ({ ...crudas[x.n - 1], _error: x.mensaje })),
    )

  return (
    <Modal wide="xl" title="Importar salones desde JSON" onClose={paso === 'procesando' ? () => {} : onClose}>
      {paso === 'archivo' && (
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Sube un archivo <strong>.json</strong> con tus salones (hasta {MAX_FILAS} por archivo). Antes de guardar nada verás una revisión con lo que se creará y lo que tiene
            problemas; los horarios y los docentes se comprueban contra la base de datos. El código (SAL-0001…) se asigna solo.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <label className="inline-flex cursor-pointer items-center rounded-full bg-brand-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-700">
              Elegir archivo JSON
              <input type="file" accept=".json,application/json" className="sr-only" onChange={elegirArchivo} />
            </label>
            <Button variant="secondary" onClick={() => descargarJson('plantilla-salones.json', plantillaSalones)}>
              Descargar plantilla de ejemplo
            </Button>
          </div>
          {errorArchivo && <p className="text-sm text-red-600">{errorArchivo}</p>}

          <details className="rounded-xl border border-slate-200 p-4 text-sm" open>
            <summary className="cursor-pointer font-medium text-slate-900">Formato del archivo</summary>
            <p className="mt-2 text-slate-600">
              Una lista de salones, o un objeto <code>{'{ "salones": [ … ] }'}</code>. Los campos con <strong>*</strong> son obligatorios; el resto se puede omitir.
            </p>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="text-slate-500">
                  <tr>
                    <th className="py-1 pr-4 font-medium">Campo</th>
                    <th className="py-1 pr-4 font-medium">Qué lleva</th>
                    <th className="py-1 font-medium">Ejemplo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {CAMPOS_AYUDA.map(([c, d, e]) => (
                    <tr key={c}>
                      <td className="py-1 pr-4 font-mono text-slate-900">{c}</td>
                      <td className="py-1 pr-4 text-slate-600">{d}</td>
                      <td className="py-1 font-mono text-slate-500">{e}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-xs text-slate-500">
              Niveles disponibles: {niveles.map((n) => n.codigo).join(', ') || '—'}. Si ya existe un salón con el mismo nombre y fecha de inicio, se omite (no se duplica ni se modifica).
            </p>
          </details>
        </div>
      )}

      {paso === 'revision' && (
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Archivo <strong>{nombreArchivo}</strong>: {resumen.total} {resumen.total === 1 ? 'salón' : 'salones'}. Todavía no se guardó nada.
          </p>
          {revisando && (
            <p role="status" className="text-sm text-slate-500">
              Comprobando horarios y docentes en la base de datos…
            </p>
          )}
          <div className="flex flex-wrap gap-2 text-sm">
            <Badge color="brand">{resumen.nuevos} nuevos</Badge>
            <Badge color="slate">{resumen.existentes} ya existen</Badge>
            <Badge color={resumen.errores ? 'rose' : 'slate'}>{resumen.errores} con error (no se importarán)</Badge>
          </div>

          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={soloProblemas} onChange={(e) => setSoloProblemas(e.target.checked)} className="h-4 w-4 accent-brand-600" />
            Mostrar solo las filas con problemas
          </label>

          <div className="max-h-96 overflow-auto rounded-xl border border-slate-200">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-2">Fila</th>
                  <th className="px-3 py-2">Salón</th>
                  <th className="px-3 py-2">Nivel</th>
                  <th className="px-3 py-2">Docente</th>
                  <th className="px-3 py-2">Inicio</th>
                  <th className="px-3 py-2">Estado</th>
                  <th className="px-3 py-2">Detalle</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {analisis
                  .filter((r) => !soloProblemas || r.errores.length > 0 || r.avisos.length > 0)
                  .map((r) => (
                    <tr key={r.n} className={r.estado === 'error' ? 'bg-rose-50/40' : ''}>
                      <td className="px-3 py-2 text-slate-500">{r.n}</td>
                      <td className="px-3 py-2 font-medium text-slate-900">{r.fila?.nombre || '—'}</td>
                      <td className="px-3 py-2 text-slate-600">{r.nivel?.nombre ?? '—'}</td>
                      <td className="px-3 py-2 text-slate-600">{r.docente?.nombre ?? 'Sin asignar'}</td>
                      <td className="px-3 py-2 text-slate-600">{r.fila?.fechaInicio ? r.fila.fechaInicio.split('-').reverse().join('/') : '—'}</td>
                      <td className="px-3 py-2">
                        <Badge color={colorEstado[r.estado]}>{textoEstado[r.estado]}</Badge>
                      </td>
                      <td className="px-3 py-2 text-xs">
                        {r.errores.map((m) => (
                          <p key={m} className="text-red-600">{m}</p>
                        ))}
                        {r.avisos.map((m) => (
                          <p key={m} className="text-peach-700">{m}</p>
                        ))}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="secondary" onClick={() => { setCrudas([]); setPaso('archivo') }}>
              Elegir otro archivo
            </Button>
            <Button onClick={importar} disabled={revisando || resumen.nuevos === 0}>
              Crear {resumen.nuevos} {resumen.nuevos === 1 ? 'salón' : 'salones'}
            </Button>
          </div>
        </div>
      )}

      {paso === 'procesando' && (
        <div className="space-y-4 py-4" role="status">
          <p className="text-sm text-slate-700">
            Creando salones… {avance.hechas} de {avance.total}
          </p>
          <div className="h-2 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full bg-brand-600 transition-all" style={{ width: `${avance.total ? (avance.hechas / avance.total) * 100 : 0}%` }} />
          </div>
          <p className="text-xs text-slate-500">No cierres esta ventana. Si cancelas, lo ya creado se conserva.</p>
          <Button variant="secondary" onClick={() => { cancelado.current = true }}>
            Cancelar importación
          </Button>
        </div>
      )}

      {paso === 'resultado' && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2 text-sm">
            <Badge color="brand">{cuenta('creado')} creados</Badge>
            {cuenta('omitido') > 0 && <Badge color="slate">{cuenta('omitido')} omitidos</Badge>}
            <Badge color={cuenta('error') ? 'rose' : 'slate'}>{cuenta('error')} con error</Badge>
            {cuenta('no_procesado') > 0 && <Badge color="peach">{cuenta('no_procesado')} sin procesar</Badge>}
          </div>

          {conProblema.length > 0 && (
            <div className="max-h-72 overflow-auto rounded-xl border border-slate-200">
              <table className="w-full text-left text-sm">
                <tbody className="divide-y divide-slate-100">
                  {conProblema.map((r) => (
                    <tr key={r.n}>
                      <td className="px-3 py-2 text-slate-500">Fila {r.n}</td>
                      <td className="px-3 py-2 font-medium text-slate-900">{r.nombre || '—'}</td>
                      <td className="px-3 py-2">
                        <Badge color={colorResultado[r.resultado]}>{textoResultado[r.resultado]}</Badge>
                      </td>
                      <td className="px-3 py-2 text-xs text-red-600">{r.mensaje}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex flex-wrap justify-end gap-2">
            {conProblema.length > 0 && (
              <Button variant="secondary" onClick={descargarErrores}>
                Descargar las filas con error (JSON)
              </Button>
            )}
            <Button onClick={onClose}>Cerrar</Button>
          </div>
          {conProblema.length > 0 && <p className="text-xs text-slate-500">El archivo descargado trae cada fila con un campo «_error»; corrígelas y vuelve a subirlas (el campo extra se ignora).</p>}
        </div>
      )}
    </Modal>
  )
}
