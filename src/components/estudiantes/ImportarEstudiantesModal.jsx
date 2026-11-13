import { useMemo, useRef, useState } from 'react'
import Badge from '../ui/Badge'
import Button from '../ui/Button'
import Modal from '../ui/Modal'
import { MAX_BYTES, MAX_FILAS, analizarLote, ejecutarImportacion, leerJson, plantillaEstudiantes, resumenLote } from '../../lib/importarEstudiantes'
import { hoyLima } from '../../lib/salones'
import * as servicioReal from '../../services/personas'

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
const colorResultado = { creado: 'brand', actualizado: 'brand', omitido: 'slate', error: 'rose', no_procesado: 'peach' }
const textoResultado = { creado: 'Created', actualizado: 'Updated', omitido: 'Skipped', error: 'Error', no_procesado: 'Not processed' }

const CAMPOS_AYUDA = [
  ['nombres *', 'First names', 'JUAN SEBASTIAN'],
  ['apellidos *', 'Last names', 'MONTENEGRO ARIAS'],
  ['tipo_documento', 'dni · ce · pasaporte · licencia · otro (ID · foreign ID · passport · license · other)', 'dni'],
  ['numero_documento', 'DNI = 8 digits; others 5 to 20 letters or numbers', '72266090'],
  ['fecha_nacimiento', 'YYYY-MM-DD (or DD/MM/YYYY)', '1997-10-15'],
  ['pais_nacionalidad', 'Country', 'Perú'],
  ['genero', 'M · F · O (or Masculino / Femenino)', 'M'],
  ['correo', 'Email', 'juan@correo.com'],
  ['celular', 'Mobile (“telefono” also works)', '+51 949531737'],
  ['maskpark_usuario', 'MaskPark user', 'JUANSEBASTIAN…'],
  ['maskpark_clave', 'MaskPark password', '72266090Jsma_'],
  ['notas', 'Notes', ''],
  ['salon', 'Code of the classroom to enroll them in', 'SAL-0001'],
]

// Carga masiva de estudiantes desde un JSON: 1) elegir archivo, 2) revisar (nada se guarda aún), 3) importar fila por fila, 4) resultado.
// La base de datos vuelve a validar cada estudiante; una fila con problemas no detiene a las demás.
export default function ImportarEstudiantesModal({ estudiantes, salones, onTerminar, onClose, servicio = servicioReal }) {
  const [paso, setPaso] = useState('archivo') // archivo | revision | procesando | resultado
  const [crudas, setCrudas] = useState([])
  const [nombreArchivo, setNombreArchivo] = useState('')
  const [errorArchivo, setErrorArchivo] = useState('')
  const [modo, setModo] = useState('omitir')
  const [soloProblemas, setSoloProblemas] = useState(false)
  const [avance, setAvance] = useState({ hechas: 0, total: 0 })
  const [resultados, setResultados] = useState([])
  const cancelado = useRef(false)

  const analisis = useMemo(() => (crudas.length ? analizarLote(crudas, { estudiantes, salones, hoy: hoyLima() }) : []), [crudas, estudiantes, salones])
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
      modo,
      onProgreso: (hechas, total) => setAvance({ hechas, total }),
      cancelado: () => cancelado.current,
    })
    setResultados(res)
    setPaso('resultado')
    await onTerminar?.()
  }

  const cuenta = (r) => resultados.filter((x) => x.resultado === r).length
  const conProblema = resultados.filter((x) => x.resultado === 'error' || x.resultado === 'no_procesado')
  const matriculados = resultados.filter((x) => x.matricula.startsWith('Enrolled')).length

  const descargarErrores = () =>
    descargarJson(
      'estudiantes-con-errores.json',
      conProblema.map((x) => ({ ...crudas[x.n - 1], _error: x.mensaje })),
    )

  return (
    <Modal wide="xl" title="Import students from JSON" onClose={paso === 'procesando' ? () => {} : onClose}>
      {paso === 'archivo' && (
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Upload a <strong>.json</strong> file with your students (up to {MAX_FILAS} per file). Before anything is saved you will see a review of what will be created and what
            has problems.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <label className="inline-flex cursor-pointer items-center rounded-full bg-brand-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-700">
              Choose JSON file
              <input type="file" accept=".json,application/json" className="sr-only" onChange={elegirArchivo} />
            </label>
            <Button variant="secondary" onClick={() => descargarJson('plantilla-estudiantes.json', plantillaEstudiantes)}>
              Download example template
            </Button>
          </div>
          {errorArchivo && <p className="text-sm text-red-600">{errorArchivo}</p>}

          <details className="rounded-xl border border-slate-200 p-4 text-sm" open>
            <summary className="cursor-pointer font-medium text-slate-900">File format</summary>
            <p className="mt-2 text-slate-600">
              A list of students, or an object <code>{'{ "estudiantes": [ … ] }'}</code>. Fields with <strong>*</strong> are required; the rest can be omitted.
              La edad no se carga: se calcula con la fecha de nacimiento.
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
                      <td className="py-1 text-slate-500">{e}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-xs text-slate-500">
              If the student is already registered (same document or same name) it is detected and, depending on your choice, skipped or updated. If you set <code>salon</code>, they are enrolled in that
              classroom (subject to its capacity).
            </p>
          </details>
          <p className="rounded-lg bg-peach-50 px-3 py-2 text-xs text-peach-700">
            The file may include MaskPark passwords: keep it in a safe place and delete it when you finish the upload.
          </p>
        </div>
      )}

      {paso === 'revision' && (
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            File <strong>{nombreArchivo}</strong>: {resumen.total} {resumen.total === 1 ? 'student' : 'students'}. Nothing has been saved yet.
          </p>
          <div className="flex flex-wrap gap-2 text-sm">
            <Badge color="brand">{resumen.nuevos} new</Badge>
            <Badge color="slate">{resumen.existentes} already exist</Badge>
            <Badge color={resumen.errores ? 'rose' : 'slate'}>{resumen.errores} with errors (will not be imported)</Badge>
          </div>

          {resumen.existentes > 0 && (
            <fieldset className="rounded-xl border border-slate-200 p-3 text-sm">
              <legend className="px-1 text-xs font-medium text-slate-500">Students that already exist</legend>
              <label className="flex items-start gap-2">
                <input type="radio" name="modo" checked={modo === 'omitir'} onChange={() => setModo('omitir')} className="mt-1 accent-brand-600" />
                <span>
                  <strong>Skip them</strong> — they are not modified (if they include <code>salon</code>, they are still enrolled).
                </span>
              </label>
              <label className="mt-2 flex items-start gap-2">
                <input type="radio" name="modo" checked={modo === 'actualizar'} onChange={() => setModo('actualizar')} className="mt-1 accent-brand-600" />
                <span>
                  <strong>Update them from the file</strong> — whatever the file does not include is kept.
                </span>
              </label>
            </fieldset>
          )}

          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={soloProblemas} onChange={(e) => setSoloProblemas(e.target.checked)} className="h-4 w-4 accent-brand-600" />
            Show only rows with problems
          </label>

          <div className="max-h-96 overflow-auto rounded-xl border border-slate-200">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-2">Row</th>
                  <th className="px-3 py-2">Student</th>
                  <th className="px-3 py-2">Document</th>
                  <th className="px-3 py-2">Classroom</th>
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
                      <td className="px-3 py-2 text-slate-600">{r.fila?.numeroDocumento || '—'}</td>
                      <td className="px-3 py-2 text-slate-600">{r.salon || '—'}</td>
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
            <Button onClick={importar} disabled={resumen.nuevos + resumen.existentes === 0}>
              Import {resumen.nuevos + (modo === 'actualizar' ? resumen.existentes : 0)}{' '}
              {resumen.nuevos + (modo === 'actualizar' ? resumen.existentes : 0) === 1 ? 'student' : 'students'}
            </Button>
          </div>
        </div>
      )}

      {paso === 'procesando' && (
        <div className="space-y-4 py-4" role="status">
          <p className="text-sm text-slate-700">
            Importing… {avance.hechas} of {avance.total}
          </p>
          <div className="h-2 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full bg-brand-600 transition-all" style={{ width: `${avance.total ? (avance.hechas / avance.total) * 100 : 0}%` }} />
          </div>
          <p className="text-xs text-slate-500">Do not close this window. If you cancel, what was already saved is kept.</p>
          <Button variant="secondary" onClick={() => { cancelado.current = true }}>
            Cancel import
          </Button>
        </div>
      )}

      {paso === 'resultado' && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2 text-sm">
            <Badge color="brand">{cuenta('creado')} created</Badge>
            {cuenta('actualizado') > 0 && <Badge color="brand">{cuenta('actualizado')} updated</Badge>}
            {cuenta('omitido') > 0 && <Badge color="slate">{cuenta('omitido')} skipped</Badge>}
            {matriculados > 0 && <Badge color="brand">{matriculados} enrolled</Badge>}
            <Badge color={cuenta('error') ? 'rose' : 'slate'}>{cuenta('error')} with errors</Badge>
            {cuenta('no_procesado') > 0 && <Badge color="peach">{cuenta('no_procesado')} unprocessed</Badge>}
          </div>

          {resultados.some((r) => r.resultado === 'error' || r.resultado === 'no_procesado' || r.matricula.startsWith('Could not')) && (
            <div className="max-h-72 overflow-auto rounded-xl border border-slate-200">
              <table className="w-full text-left text-sm">
                <tbody className="divide-y divide-slate-100">
                  {resultados
                    .filter((r) => r.resultado === 'error' || r.resultado === 'no_procesado' || r.matricula.startsWith('Could not'))
                    .map((r) => (
                      <tr key={r.n}>
                        <td className="px-3 py-2 text-slate-500">Row {r.n}</td>
                        <td className="px-3 py-2 font-medium text-slate-900">{r.nombre || '—'}</td>
                        <td className="px-3 py-2">
                          <Badge color={colorResultado[r.resultado]}>{textoResultado[r.resultado]}</Badge>
                        </td>
                        <td className="px-3 py-2 text-xs text-red-600">{[r.mensaje, r.matricula.startsWith('Could not') ? r.matricula : ''].filter(Boolean).join(' · ')}</td>
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
