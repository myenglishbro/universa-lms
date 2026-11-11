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
const textoEstado = { nuevo: 'Nuevo', existente: 'Ya existe', error: 'Con error' }
const colorResultado = { creado: 'brand', actualizado: 'brand', omitido: 'slate', error: 'rose', no_procesado: 'peach' }
const textoResultado = { creado: 'Creado', actualizado: 'Actualizado', omitido: 'Omitido', error: 'Error', no_procesado: 'No procesado' }

const CAMPOS_AYUDA = [
  ['nombres *', 'Nombres', 'JUAN SEBASTIAN'],
  ['apellidos *', 'Apellidos', 'MONTENEGRO ARIAS'],
  ['tipo_documento', 'dni · ce · pasaporte · licencia · otro', 'dni'],
  ['numero_documento', 'DNI = 8 dígitos; otros 5 a 20 letras o números', '72266090'],
  ['fecha_nacimiento', 'AAAA-MM-DD (o DD/MM/AAAA)', '1997-10-15'],
  ['pais_nacionalidad', 'País', 'Perú'],
  ['genero', 'M · F · O (o Masculino / Femenino)', 'M'],
  ['correo', 'Correo', 'juan@correo.com'],
  ['celular', 'Celular (también vale «telefono»)', '+51 949531737'],
  ['maskpark_usuario', 'Usuario de MaskPark', 'JUANSEBASTIAN…'],
  ['maskpark_clave', 'Contraseña de MaskPark', '72266090Jsma_'],
  ['notas', 'Notas', ''],
  ['salon', 'Código del salón donde matricularlo', 'SAL-0001'],
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
  const matriculados = resultados.filter((x) => x.matricula.startsWith('Matriculado')).length

  const descargarErrores = () =>
    descargarJson(
      'estudiantes-con-errores.json',
      conProblema.map((x) => ({ ...crudas[x.n - 1], _error: x.mensaje })),
    )

  return (
    <Modal wide="xl" title="Importar estudiantes desde JSON" onClose={paso === 'procesando' ? () => {} : onClose}>
      {paso === 'archivo' && (
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Sube un archivo <strong>.json</strong> con tus estudiantes (hasta {MAX_FILAS} por archivo). Antes de guardar nada verás una revisión con lo que se creará y lo que
            tiene problemas.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <label className="inline-flex cursor-pointer items-center rounded-full bg-brand-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-700">
              Elegir archivo JSON
              <input type="file" accept=".json,application/json" className="sr-only" onChange={elegirArchivo} />
            </label>
            <Button variant="secondary" onClick={() => descargarJson('plantilla-estudiantes.json', plantillaEstudiantes)}>
              Descargar plantilla de ejemplo
            </Button>
          </div>
          {errorArchivo && <p className="text-sm text-red-600">{errorArchivo}</p>}

          <details className="rounded-xl border border-slate-200 p-4 text-sm" open>
            <summary className="cursor-pointer font-medium text-slate-900">Formato del archivo</summary>
            <p className="mt-2 text-slate-600">
              Una lista de estudiantes, o un objeto <code>{'{ "estudiantes": [ … ] }'}</code>. Los campos con <strong>*</strong> son obligatorios; el resto se puede omitir.
              La edad no se carga: se calcula con la fecha de nacimiento.
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
                      <td className="py-1 text-slate-500">{e}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-xs text-slate-500">
              Si el estudiante ya está registrado (mismo documento o mismo nombre) lo detecta y, según elijas, lo omite o lo actualiza. Si pones <code>salon</code>, lo matricula en ese
              salón (con los cupos del salón).
            </p>
          </details>
          <p className="rounded-lg bg-peach-50 px-3 py-2 text-xs text-peach-700">
            El archivo puede incluir contraseñas de MaskPark: guárdalo en un lugar seguro y bórralo cuando termines la carga.
          </p>
        </div>
      )}

      {paso === 'revision' && (
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Archivo <strong>{nombreArchivo}</strong>: {resumen.total} {resumen.total === 1 ? 'estudiante' : 'estudiantes'}. Todavía no se guardó nada.
          </p>
          <div className="flex flex-wrap gap-2 text-sm">
            <Badge color="brand">{resumen.nuevos} nuevos</Badge>
            <Badge color="slate">{resumen.existentes} ya existen</Badge>
            <Badge color={resumen.errores ? 'rose' : 'slate'}>{resumen.errores} con error (no se importarán)</Badge>
          </div>

          {resumen.existentes > 0 && (
            <fieldset className="rounded-xl border border-slate-200 p-3 text-sm">
              <legend className="px-1 text-xs font-medium text-slate-500">Estudiantes que ya existen</legend>
              <label className="flex items-start gap-2">
                <input type="radio" name="modo" checked={modo === 'omitir'} onChange={() => setModo('omitir')} className="mt-1 accent-brand-600" />
                <span>
                  <strong>Omitirlos</strong> — no se modifican (si traen <code>salon</code>, igual se matriculan).
                </span>
              </label>
              <label className="mt-2 flex items-start gap-2">
                <input type="radio" name="modo" checked={modo === 'actualizar'} onChange={() => setModo('actualizar')} className="mt-1 accent-brand-600" />
                <span>
                  <strong>Actualizarlos con el archivo</strong> — lo que el archivo no trae se conserva.
                </span>
              </label>
            </fieldset>
          )}

          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={soloProblemas} onChange={(e) => setSoloProblemas(e.target.checked)} className="h-4 w-4 accent-brand-600" />
            Mostrar solo las filas con problemas
          </label>

          <div className="max-h-96 overflow-auto rounded-xl border border-slate-200">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-2">Fila</th>
                  <th className="px-3 py-2">Estudiante</th>
                  <th className="px-3 py-2">Documento</th>
                  <th className="px-3 py-2">Salón</th>
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
              Elegir otro archivo
            </Button>
            <Button onClick={importar} disabled={resumen.nuevos + resumen.existentes === 0}>
              Importar {resumen.nuevos + (modo === 'actualizar' ? resumen.existentes : 0)}{' '}
              {resumen.nuevos + (modo === 'actualizar' ? resumen.existentes : 0) === 1 ? 'estudiante' : 'estudiantes'}
            </Button>
          </div>
        </div>
      )}

      {paso === 'procesando' && (
        <div className="space-y-4 py-4" role="status">
          <p className="text-sm text-slate-700">
            Importando… {avance.hechas} de {avance.total}
          </p>
          <div className="h-2 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full bg-brand-600 transition-all" style={{ width: `${avance.total ? (avance.hechas / avance.total) * 100 : 0}%` }} />
          </div>
          <p className="text-xs text-slate-500">No cierres esta ventana. Si cancelas, lo ya guardado se conserva.</p>
          <Button variant="secondary" onClick={() => { cancelado.current = true }}>
            Cancelar importación
          </Button>
        </div>
      )}

      {paso === 'resultado' && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2 text-sm">
            <Badge color="brand">{cuenta('creado')} creados</Badge>
            {cuenta('actualizado') > 0 && <Badge color="brand">{cuenta('actualizado')} actualizados</Badge>}
            {cuenta('omitido') > 0 && <Badge color="slate">{cuenta('omitido')} omitidos</Badge>}
            {matriculados > 0 && <Badge color="brand">{matriculados} matriculados</Badge>}
            <Badge color={cuenta('error') ? 'rose' : 'slate'}>{cuenta('error')} con error</Badge>
            {cuenta('no_procesado') > 0 && <Badge color="peach">{cuenta('no_procesado')} sin procesar</Badge>}
          </div>

          {resultados.some((r) => r.resultado === 'error' || r.resultado === 'no_procesado' || r.matricula.startsWith('No se pudo')) && (
            <div className="max-h-72 overflow-auto rounded-xl border border-slate-200">
              <table className="w-full text-left text-sm">
                <tbody className="divide-y divide-slate-100">
                  {resultados
                    .filter((r) => r.resultado === 'error' || r.resultado === 'no_procesado' || r.matricula.startsWith('No se pudo'))
                    .map((r) => (
                      <tr key={r.n}>
                        <td className="px-3 py-2 text-slate-500">Fila {r.n}</td>
                        <td className="px-3 py-2 font-medium text-slate-900">{r.nombre || '—'}</td>
                        <td className="px-3 py-2">
                          <Badge color={colorResultado[r.resultado]}>{textoResultado[r.resultado]}</Badge>
                        </td>
                        <td className="px-3 py-2 text-xs text-red-600">{[r.mensaje, r.matricula.startsWith('No se pudo') ? r.matricula : ''].filter(Boolean).join(' · ')}</td>
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
