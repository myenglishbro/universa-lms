import { useMemo, useState } from 'react'
import Button from '../ui/Button'
import Field from '../ui/Field'
import Icon from '../ui/Icon'
import Modal from '../ui/Modal'
import EditorEjercicio from './EditorEjercicio'
import EjercicioJugador from './EjercicioJugador'
import { FORMAS_LECTURA, TIPOS, USOS, TONOS, compilar, construirPrompt, datosVacios, faltaClasificacion, leerRespuestaIA, tipoDe, validar } from '../../lib/ejercicios'
import { MODULOS_POR_NIVEL, PROGRAMA, cicloTexto, nivelDeCiclo, nivelPrograma, ubicar, unidadesDeModulo } from '../../lib/curriculo'

// Nivel + unidad + uso: obligatorios, se eligen al empezar (con IA o a mano) y se pueden cambiar al final.
// Del nivel y la unidad se deducen solos el ciclo, el módulo, el MCER y el libro (lib/curriculo.js).
function Clasificacion({ meta, setMeta }) {
  const nivel = nivelPrograma(meta.programa)
  const ubic = ubicar(meta.programa, meta.unidad)
  const modulos = Array.from({ length: MODULOS_POR_NIVEL }, (_, i) => i + 1)
  return (
    <div className="space-y-4 rounded-2xl border border-brand-100 bg-white p-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Level"
          options={[{ value: '', label: 'Choose the level…' }, ...PROGRAMA.map((n) => ({ value: n.id, label: `${n.nombre} · ${cicloTexto(n)}` }))]}
          value={meta.programa ?? ''}
          onChange={(e) => setMeta((m) => ({ ...m, programa: e.target.value }))}
         
        />
        <div>
          <span className="mb-1 block text-sm font-medium text-slate-700">Use</span>
          <div role="radiogroup" aria-label="Use" className="inline-flex gap-0.5 rounded-xl bg-slate-100 p-0.5">
            {USOS.map((u) => (
              <button key={u.id} type="button" role="radio" aria-checked={meta.uso === u.id} onClick={() => setMeta((m) => ({ ...m, uso: u.id }))} className={`rounded-lg px-4 py-2 text-sm transition-colors ${meta.uso === u.id ? 'bg-white font-semibold text-brand-700 shadow-sm' : 'text-slate-600'}`}>
                {u.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div>
        <span className="mb-1.5 block text-sm font-medium text-slate-700">Unit</span>
        <div className="grid gap-2 sm:grid-cols-4">
          {modulos.map((m) => (
            <div key={m} className="rounded-xl bg-slate-50 p-2">
              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Module {m}</p>
              <div className="flex gap-1.5">
                {unidadesDeModulo(m).map((u) => {
                  const on = String(meta.unidad) === String(u)
                  return (
                    <button key={u} type="button" aria-pressed={on} onClick={() => setMeta((x) => ({ ...x, unidad: String(u) }))} className={`h-9 flex-1 rounded-lg text-sm font-medium transition ${on ? 'bg-brand-600 text-white shadow-sm' : 'bg-white text-slate-700 ring-1 ring-slate-200 hover:ring-brand-300'}`}>
                      {u}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {ubic ? (
        <p className="rounded-xl bg-brand-50 px-3 py-2 text-sm text-brand-800">
          <strong>
            {ubic.nivel.nombre} · Cycle {ubic.ciclo} · Module {ubic.modulo} · Unit {ubic.unidad}
          </strong>
          <span className="text-brand-700"> · CEFR {ubic.mcer}</span>
        </p>
      ) : (
        <p className="text-xs text-slate-500">Choose a level and a unit: the cycle, module and CEFR level are filled in automatically.</p>
      )}

      {/* El libro del nivel y la ubicación dentro de él: juntos dicen de dónde sale el ejercicio. */}
      <div className="rounded-xl border border-peach-200 bg-peach-50/60 p-3">
        <p className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          <Icon name="book" className="h-4 w-4 text-peach-700" />
          Source book
          <span className="font-normal text-slate-700">
            {nivel ? (nivel.libro ?? 'not defined yet for this level') : '· choose the level above to see it'}
          </span>
        </p>
        <div className="mt-2">
          <Field label="Where in the book?" value={meta.fuente ?? ''} onChange={(e) => setMeta((m) => ({ ...m, fuente: e.target.value }))} placeholder="E.g. Student book p. 52, exercise 3 · Workbook p. 18" hint="Optional. Page and exercise, so anyone can find it in the book." />
        </div>
      </div>
    </div>
  )
}

function Pasos({ paso }) {
  const pasos = ['Type', 'AI prompt', 'Edit and save']
  return (
    <ol className="mb-6 flex items-center gap-2 text-sm" aria-label="Pasos">
      {pasos.map((t, i) => (
        <li key={t} className="flex items-center gap-2" aria-current={i === paso ? 'step' : undefined}>
          <span className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${i < paso ? 'bg-brand-600 text-white' : i === paso ? 'bg-peach-500 text-brand-900' : 'bg-slate-100 text-slate-400'}`}>
            {i < paso ? <Icon name="check" className="h-4 w-4" /> : i + 1}
          </span>
          <span className={`hidden sm:inline ${i === paso ? 'font-semibold text-slate-900' : 'text-slate-400'}`}>{t}</span>
          {i < pasos.length - 1 && <span className="mx-1 h-px w-6 bg-slate-200" />}
        </li>
      ))}
    </ol>
  )
}

// Asistente para crear un ejercicio: 1) elegir el tipo, 2) generar el prompt y pegar lo que responda la IA, 3) revisar, previsualizar y guardar.
// `ejercicio`: al editar (o al usar uno del banco como base: sin id) arranca directo en el paso 3.
export default function CrearEjercicio({ ejercicio = null, onGuardar, onClose }) {
  const [paso, setPaso] = useState(ejercicio ? 2 : 0)
  const [tipo, setTipo] = useState(ejercicio?.tipo ?? '')
  const [params, setParams] = useState({ imagen: true, modo: 'adaptar', tema: '', cantidad: '', extra: '', texto: '', transcripcion: '', formas: ['tf', 'choice', 'gap'], formasAuto: true })
  const [pegado, setPegado] = useState('')
  const [errorIA, setErrorIA] = useState('')
  const [copiado, setCopiado] = useState(false)
  const [datos, setDatos] = useState(ejercicio?.datos ?? null)
  const [meta, setMeta] = useState({ titulo: ejercicio?.titulo ?? '', tema: ejercicio?.tema ?? '', programa: nivelDeCiclo(ejercicio?.ciclo)?.id ?? '', unidad: ejercicio?.unidad ?? '', uso: ejercicio?.uso ?? '', fuente: ejercicio?.fuente ?? '' })
  const [vista, setVista] = useState('editar')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  const t = tipoDe(tipo)
  const ubic = ubicar(meta.programa, meta.unidad)
  const prompt = useMemo(() => {
    if (!tipo) return ''
    const u = ubicar(meta.programa, meta.unidad)
    return construirPrompt(tipo, { ...params, nivel: u?.mcer ?? 'A2', nivelNombre: u?.nivel.nombre, ciclo: u?.ciclo, modulo: u?.modulo, unidad: u?.unidad, libro: u?.libro, cantidad: Number(params.cantidad) || (params.imagen ? null : 5) })
  }, [tipo, params, meta.programa, meta.unidad])
  const setP = (k) => (e) => setParams((p) => ({ ...p, [k]: e.target.value }))
  const faltaClas = faltaClasificacion(meta)
  const errorValidacion = datos ? validar(tipo, datos) : ''
  const previa = useMemo(() => {
    if (!datos || validar(tipo, datos)) return null
    return { id: 'previa', tipo, titulo: meta.titulo, contenido: compilar(tipo, datos).contenido }
  }, [tipo, datos, meta.titulo])

  const elegirTipo = (id) => {
    setTipo(id)
    setPaso(1)
  }
  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(prompt)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2500)
    } catch {
      setErrorIA('Could not copy automatically: select the prompt text and copy it by hand.')
    }
  }
  const leer = () => {
    setErrorIA('')
    try {
      const r = leerRespuestaIA(tipo, pegado)
      setDatos(tipo === 'listening' ? { ...r.datos, audio_url: params.audio_url ?? '' } : r.datos)
      setMeta((m) => ({ ...m, titulo: m.titulo || r.titulo, tema: m.tema || params.tema }))
      setPaso(2)
    } catch (e) {
      setErrorIA(e.message)
    }
  }
  const manual = () => {
    setDatos(datosVacios(tipo))
    setMeta((m) => ({ ...m, tema: m.tema || params.tema }))
    setPaso(2)
  }

  const guardar = async () => {
    setError('')
    if (!meta.titulo.trim()) return setError('Give the exercise a title')
    if (faltaClasificacion(meta)) return setError(faltaClasificacion(meta))
    if (errorValidacion) return setError(errorValidacion)
    setGuardando(true)
    try {
      await onGuardar(ejercicio?.id ?? null, { ...meta, ciclo: ubic.ciclo, modulo: ubic.modulo, unidad: ubic.unidad, nivel: ubic.mcer, tipo, datos })
    } catch (e) {
      setError(e.message)
      setGuardando(false)
    }
  }

  return (
    <Modal title={ejercicio?.id ? 'Edit exercise' : ejercicio ? 'New exercise based on another' : 'New exercise'} onClose={onClose} wide="xl">
      <Pasos paso={paso} />

      {paso === 0 && (
        <div>
          <p className="mb-4 text-sm text-slate-600">What type of exercise do you want to create?</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {TIPOS.map((x) => (
              <button key={x.id} type="button" onClick={() => elegirTipo(x.id)} className="group flex items-start gap-4 rounded-2xl border border-brand-100 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-brand-400 hover:shadow-md">
                <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${TONOS[x.tono]}`}>
                  <Icon name={x.icono} className="h-6 w-6" />
                </span>
                <span>
                  <span className="block text-base font-semibold text-slate-900 group-hover:text-brand-700">{x.label}</span>
                  <span className="block text-sm text-slate-500">{x.desc}</span>
                  <span className={`mt-1.5 inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${x.auto ? 'bg-emerald-50 text-emerald-700' : 'bg-peach-100 text-peach-700'}`}>{x.auto ? 'Graded automatically' : 'Reviewed by the teacher'}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {paso === 1 && t && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${TONOS[t.tono]}`}>
              <Icon name={t.icono} className="h-5 w-5" />
            </span>
            <div>
              <h3 className="font-semibold text-slate-900">{t.label}</h3>
              <button type="button" onClick={() => setPaso(0)} className="text-xs text-brand-700 hover:underline">
                Change type
              </button>
            </div>
          </div>

          <div>
            <p className="mb-2 text-sm font-semibold text-slate-900">Where does it belong?</p>
            <Clasificacion meta={meta} setMeta={setMeta} />
          </div>

          <div className="rounded-2xl border border-brand-100 bg-white p-4">
            <label className="flex cursor-pointer items-start gap-3">
              <input type="checkbox" checked={params.imagen} onChange={(e) => setParams((p) => ({ ...p, imagen: e.target.checked }))} className="mt-1 h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500" />
              <span>
                <span className="block text-sm font-semibold text-slate-900">I will attach a screenshot from the book</span>
                <span className="block text-xs text-slate-500">The prompt will tell the AI to use your image as the reference. Attach it in the AI chat together with the prompt.</span>
              </span>
            </label>
            {params.imagen && (
              <div role="group" aria-label="What should the AI do with the image" className="mt-3 grid gap-2 sm:grid-cols-2">
                {[
                  ['adaptar', 'Adapt it', 'Same format and difficulty, new content (not a copy of the book).'],
                  ['fiel', 'Copy it faithfully', 'Same items, options and order as in the screenshot.'],
                ].map(([v, t, d]) => (
                  <button key={v} type="button" aria-pressed={params.modo === v} onClick={() => setParams((p) => ({ ...p, modo: v }))} className={`rounded-xl border px-3 py-2 text-left transition ${params.modo === v ? 'border-brand-500 bg-brand-50 ring-2 ring-brand-500/20' : 'border-slate-200 hover:border-brand-300'}`}>
                    <span className="block text-sm font-semibold text-slate-900">{t}</span>
                    <span className="block text-xs text-slate-500">{d}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <Field className="sm:col-span-2" label={params.imagen ? 'Topic (optional)' : 'Topic'} value={params.tema} onChange={setP('tema')} placeholder={params.imagen ? 'Leave empty to use the topic of the screenshot' : 'E.g. Daily routines, travel, past simple…'} />
            {t.auto && tipo !== 'matching' && (
              <Field label={tipo === 'fill_gap' || tipo === 'order_sentences' ? 'Number of sentences' : tipo === 'reading' || tipo === 'listening' ? 'Items (statements, questions, gaps)' : 'Number of questions'} type="number" min="1" max="20" value={params.cantidad} onChange={setP('cantidad')} placeholder={params.imagen ? 'As in the image' : '5'} />
            )}
            {tipo === 'matching' && <Field label="Number of pairs" type="number" min="2" max="12" value={params.cantidad} onChange={setP('cantidad')} placeholder={params.imagen ? 'As in the image' : '5'} />}
          </div>
          {(tipo === 'reading' || tipo === 'listening') && (
            <fieldset>
              <legend className="mb-1 text-sm font-medium text-slate-700">What kind of items should the AI create?</legend>
              <div className="flex flex-wrap gap-2">
                {params.imagen && (
                  <button
                    type="button"
                    aria-pressed={params.formasAuto}
                    onClick={() => setParams((p) => ({ ...p, formasAuto: !p.formasAuto }))}
                    className={`rounded-full border px-4 py-1.5 text-sm font-medium transition ${params.formasAuto ? 'border-brand-500 bg-brand-600 text-white' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}
                  >
                    {params.formasAuto ? '✓ ' : ''}As in the screenshot
                  </button>
                )}
                {FORMAS_LECTURA.map((f) => {
                  const auto = params.imagen && params.formasAuto
                  const on = !auto && params.formas.includes(f.id)
                  return (
                    <button
                      key={f.id}
                      type="button"
                      aria-pressed={on}
                      onClick={() => setParams((p) => ({ ...p, formasAuto: false, formas: p.formasAuto ? [f.id] : p.formas.includes(f.id) ? (p.formas.length > 1 ? p.formas.filter((x) => x !== f.id) : p.formas) : [...p.formas, f.id] }))}
                      className={`rounded-full border px-4 py-1.5 text-sm font-medium transition ${on ? 'border-brand-500 bg-brand-50 text-brand-800 ring-2 ring-brand-500/20' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}
                    >
                      {on ? '✓ ' : ''}
                      {f.label}
                    </button>
                  )
                })}
              </div>
              <p className="mt-1 text-xs text-slate-500">
                {params.imagen && params.formasAuto ? 'The AI will use the kinds of items that the screenshot shows (true / false, questions, gaps).' : 'Pick one or more. The AI mixes them in similar amounts.'}
              </p>
            </fieldset>
          )}
          {tipo === 'reading' && <Field as="textarea" rows={4} label="Your own text (optional)" value={params.texto} onChange={setP('texto')} hint={params.imagen ? 'If you leave it empty, the AI will take the text from the screenshot.' : 'If you leave it empty, the AI will write an original text.'} />}
          {tipo === 'listening' && (
            <>
              <Field as="textarea" rows={4} label="Audio transcript" value={params.transcripcion} onChange={setP('transcripcion')} hint="The AI cannot hear the audio: paste here what is said so the questions match." />
              <Field label="Audio link on Google Drive" value={params.audio_url ?? ''} onChange={setP('audio_url')} placeholder="https://drive.google.com/file/d/…/view" hint="We will use it in the next step. You can also add it later." />
            </>
          )}
          <Field label={params.imagen ? 'What should the AI change? (optional)' : 'Additional instructions (optional)'} value={params.extra} onChange={setP('extra')} placeholder={params.imagen ? 'E.g. Change the names and places; make it one level easier; only use the first 5 items.' : 'E.g. Use restaurant vocabulary; make it a bit difficult.'} />

          <div className="rounded-2xl border border-brand-200 bg-brand-50/60 p-4">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <p className="flex items-center gap-2 text-sm font-semibold text-brand-800">
                <Icon name="sparkle" className="h-4 w-4" /> Your prompt is ready
              </p>
              <Button type="button" onClick={copiar} disabled={!!faltaClas}>
                <Icon name={copiado ? 'check' : 'copy'} className="h-4 w-4" /> {copiado ? 'Copied!' : 'Copy prompt'}
              </Button>
            </div>
            {faltaClas && <p className="mb-2 text-sm font-medium text-peach-700">{faltaClas}: the prompt uses them to fit the exercise to that point of the course.</p>}
            <pre className="max-h-56 overflow-auto whitespace-pre-wrap rounded-xl bg-white p-3 text-xs leading-5 text-slate-700">{prompt}</pre>
            <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-slate-600">
              <li>Copy the prompt and paste it in your favorite AI (ChatGPT, Claude, Gemini…).{params.imagen && ' Attach your screenshot of the book in the same message.'}</li>
              <li>Copy the complete answer it gives you.</li>
              <li>Paste it below and review the result before saving it.</li>
            </ol>
          </div>

          <Field as="textarea" rows={7} label="AI answer" value={pegado} onChange={(e) => setPegado(e.target.value)} placeholder='Paste here the JSON the AI returned: { "titulo": …' />
          {errorIA && (
            <p role="alert" className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {errorIA}
            </p>
          )}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Button type="button" variant="ghost" onClick={manual}>
              I would rather write it myself
            </Button>
            <Button type="button" onClick={leer} disabled={!pegado.trim() || !!faltaClas}>
              Use this answer
            </Button>
          </div>
        </div>
      )}

      {paso === 2 && t && datos && (
        <div className="space-y-4">
          <div>
            <Field label="Exercise title" value={meta.titulo} onChange={(e) => setMeta((m) => ({ ...m, titulo: e.target.value }))} placeholder={`E.g. ${t.label}: daily routines`} autoFocus />
          </div>
          <Clasificacion meta={meta} setMeta={setMeta} />
          <Field label="Topic (optional)" value={meta.tema} onChange={(e) => setMeta((m) => ({ ...m, tema: e.target.value }))} placeholder="To find it more easily in the bank" />

          <div role="group" aria-label="Modo" className="inline-flex gap-0.5 rounded-xl bg-slate-100 p-0.5">
            {[
              ['editar', 'Edit'],
              ['previa', 'Preview'],
            ].map(([v, x]) => (
              <button key={v} type="button" aria-pressed={vista === v} onClick={() => setVista(v)} className={`rounded-lg px-4 py-1.5 text-sm transition-colors ${vista === v ? 'bg-white font-semibold text-brand-700 shadow-sm' : 'text-slate-600'}`}>
                {x}
              </button>
            ))}
          </div>

          {vista === 'editar' ? (
            <EditorEjercicio tipo={tipo} datos={datos} onChange={setDatos} />
          ) : previa ? (
            <div className="rounded-2xl bg-canvas p-4 sm:p-6">
              <h3 className="mb-4 text-xl font-bold text-brand-800">{meta.titulo || 'Untitled'}</h3>
              <EjercicioJugador ejercicio={previa} vistaPrevia />
            </div>
          ) : (
            <p className="rounded-xl bg-peach-50 px-4 py-3 text-sm text-peach-700">Fix this to see the preview: {errorValidacion}</p>
          )}

          {vista === 'editar' && errorValidacion && <p className="text-sm text-peach-700">To do: {errorValidacion}</p>}
          {error && (
            <p role="alert" className="text-sm text-rose-700">
              {error}
            </p>
          )}
          <div className="flex justify-between gap-2 border-t border-slate-100 pt-4">
            {!ejercicio ? (
              <Button type="button" variant="ghost" onClick={() => setPaso(1)}>
                Back to the prompt
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button type="button" variant="ghost" onClick={onClose}>
                Cancel
              </Button>
              <Button type="button" onClick={guardar} disabled={guardando}>
                {guardando ? 'Saving…' : ejercicio?.id ? 'Save changes' : 'Save exercise'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  )
}
