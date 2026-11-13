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
const textoEstado = { nuevo: 'New', existente: 'Already exists', error: 'With error' }
const colorResultado = { creado: 'brand', omitido: 'slate', error: 'rose', no_procesado: 'peach' }
const textoResultado = { creado: 'Created', omitido: 'Skipped', error: 'Error', no_procesado: 'Not processed' }

const CAMPOS_AYUDA = [
  ['nombre *', 'Classroom name', 'Basic evening A'],
  ['nivel *', 'Code or name of the level', 'basico'],
  ['fecha_inicio *', 'YYYY-MM-DD (or DD/MM/YYYY)', '2026-12-01'],
  ['capacidad', 'Maximum students (whole number). If missing, 8 is used (1 for private) to adjust later', '8'],
  ['docente', 'Full name or email', 'Ana Ruiz Paz'],
  ['estado', 'pendiente · en_curso · finalizado (pending · ongoing · finished)', 'pendiente'],
  ['plan', '{ modalidad, minutos, sesiones_semana, tipo_alumno, ciclo_desde, ciclo_hasta }: only what is needed to identify a plan of the level', '{ "modalidad": "estandar", "minutos": 60 }'],
  ['frecuencia', 'Code or name of a group frequency', 'grupal-lv-60'],
  ['total_sesiones', 'Total classes (with a plan, the plan sets it)', '40'],
  ['horarios', 'List of { dia, hora_inicio, hora_fin }; dia = 1 to 7 or lun…dom (mon…sun)', '{ "dia": "lun", "hora_inicio": "19:00", "hora_fin": "20:00" }'],
  ['observaciones', 'Free text', ''],
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
    if (archivo.size > MAX_BYTES) return setErrorArchivo(`The file weighs ${(archivo.size / 1048576).toFixed(1)} MB; the maximum is ${MAX_BYTES / 1048576} MB.`)
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
    <Modal wide="xl" title="Import classrooms from JSON" onClose={paso === 'procesando' ? () => {} : onClose}>
      {paso === 'archivo' && (
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Upload a <strong>.json</strong> file with your classrooms (up to {MAX_FILAS} per file). Before anything is saved you will see a review of what will be created and what has
            problems; schedules and teachers are checked against the database. The code (SAL-0001…) is assigned automatically.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <label className="inline-flex cursor-pointer items-center rounded-full bg-brand-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-700">
              Choose JSON file
              <input type="file" accept=".json,application/json" className="sr-only" onChange={elegirArchivo} />
            </label>
            <Button variant="secondary" onClick={() => descargarJson('plantilla-salones.json', plantillaSalones)}>
              Download example template
            </Button>
          </div>
          {errorArchivo && <p className="text-sm text-red-600">{errorArchivo}</p>}

          <details className="rounded-xl border border-slate-200 p-4 text-sm" open>
            <summary className="cursor-pointer font-medium text-slate-900">File format</summary>
            <p className="mt-2 text-slate-600">
              A list of classrooms, or an object <code>{'{ "salones": [ … ] }'}</code>. Fields with <strong>*</strong> are required; the rest can be omitted.
            </p>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="text-slate-500">
                  <tr>
                    <th className="py-1 pr-4 font-medium">Field</th>
                    <th className="py-1 pr-4 font-medium">What it holds</th>
                    <th className="py-1 font-medium">Example</th>
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
              Available levels: {niveles.map((n) => n.codigo).join(', ') || '—'}. If a classroom with the same name and start date already exists, it is skipped (not duplicated or modified).
            </p>
          </details>
        </div>
      )}

      {paso === 'revision' && (
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            File <strong>{nombreArchivo}</strong>: {resumen.total} {resumen.total === 1 ? 'classroom' : 'classrooms'}. Nothing has been saved yet.
          </p>
          {revisando && (
            <p role="status" className="text-sm text-slate-500">
              Checking schedules and teachers in the database…
            </p>
          )}
          <div className="flex flex-wrap gap-2 text-sm">
            <Badge color="brand">{resumen.nuevos} new</Badge>
            <Badge color="slate">{resumen.existentes} already exist</Badge>
            <Badge color={resumen.errores ? 'rose' : 'slate'}>{resumen.errores} with errors (will not be imported)</Badge>
          </div>

          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={soloProblemas} onChange={(e) => setSoloProblemas(e.target.checked)} className="h-4 w-4 accent-brand-600" />
            Show only rows with problems
          </label>

          <div className="max-h-96 overflow-auto rounded-xl border border-slate-200">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-2">Row</th>
                  <th className="px-3 py-2">Classroom</th>
                  <th className="px-3 py-2">Level</th>
                  <th className="px-3 py-2">Teacher</th>
                  <th className="px-3 py-2">Start</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Details</th>
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
                      <td className="px-3 py-2 text-slate-600">{r.docente?.nombre ?? 'Unassigned'}</td>
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
              Choose another file
            </Button>
            <Button onClick={importar} disabled={revisando || resumen.nuevos === 0}>
              Create {resumen.nuevos} {resumen.nuevos === 1 ? 'classroom' : 'classrooms'}
            </Button>
          </div>
        </div>
      )}

      {paso === 'procesando' && (
        <div className="space-y-4 py-4" role="status">
          <p className="text-sm text-slate-700">
            Creating classrooms… {avance.hechas} of {avance.total}
          </p>
          <div className="h-2 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full bg-brand-600 transition-all" style={{ width: `${avance.total ? (avance.hechas / avance.total) * 100 : 0}%` }} />
          </div>
          <p className="text-xs text-slate-500">Do not close this window. If you cancel, what was already created is kept.</p>
          <Button variant="secondary" onClick={() => { cancelado.current = true }}>
            Cancel import
          </Button>
        </div>
      )}

      {paso === 'resultado' && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2 text-sm">
            <Badge color="brand">{cuenta('creado')} created</Badge>
            {cuenta('omitido') > 0 && <Badge color="slate">{cuenta('omitido')} skipped</Badge>}
            <Badge color={cuenta('error') ? 'rose' : 'slate'}>{cuenta('error')} with errors</Badge>
            {cuenta('no_procesado') > 0 && <Badge color="peach">{cuenta('no_procesado')} unprocessed</Badge>}
          </div>

          {conProblema.length > 0 && (
            <div className="max-h-72 overflow-auto rounded-xl border border-slate-200">
              <table className="w-full text-left text-sm">
                <tbody className="divide-y divide-slate-100">
                  {conProblema.map((r) => (
                    <tr key={r.n}>
                      <td className="px-3 py-2 text-slate-500">Row {r.n}</td>
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
                Download rows with errors (JSON)
              </Button>
            )}
            <Button onClick={onClose}>Close</Button>
          </div>
          {conProblema.length > 0 && <p className="text-xs text-slate-500">The downloaded file has each row with an “_error” field; fix them and upload them again (the extra field is ignored).</p>}
        </div>
      )}
    </Modal>
  )
}
