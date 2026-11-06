import { useMemo, useState } from 'react'
import Button from '../ui/Button'
import Field from '../ui/Field'
import Icon from '../ui/Icon'
import Modal from '../ui/Modal'
import EditorEjercicio from './EditorEjercicio'
import EjercicioJugador from './EjercicioJugador'
import { NIVELES, TIPOS, TONOS, compilar, construirPrompt, datosVacios, leerRespuestaIA, tipoDe, validar } from '../../lib/ejercicios'

function Pasos({ paso }) {
  const pasos = ['Tipo', 'Prompt con IA', 'Editar y guardar']
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
  const [params, setParams] = useState({ tema: '', nivel: 'A2', cantidad: 5, extra: '', texto: '', transcripcion: '' })
  const [pegado, setPegado] = useState('')
  const [errorIA, setErrorIA] = useState('')
  const [copiado, setCopiado] = useState(false)
  const [datos, setDatos] = useState(ejercicio?.datos ?? null)
  const [meta, setMeta] = useState({ titulo: ejercicio?.titulo ?? '', nivel: ejercicio?.nivel ?? '', tema: ejercicio?.tema ?? '' })
  const [vista, setVista] = useState('editar')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  const t = tipoDe(tipo)
  const prompt = useMemo(() => (tipo ? construirPrompt(tipo, { ...params, cantidad: Number(params.cantidad) || 5 }) : ''), [tipo, params])
  const setP = (k) => (e) => setParams((p) => ({ ...p, [k]: e.target.value }))
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
      setErrorIA('No se pudo copiar automáticamente: selecciona el texto del prompt y cópialo a mano.')
    }
  }
  const leer = () => {
    setErrorIA('')
    try {
      const r = leerRespuestaIA(tipo, pegado)
      setDatos(tipo === 'listening' ? { ...r.datos, audio_url: params.audio_url ?? '' } : r.datos)
      setMeta((m) => ({ ...m, titulo: m.titulo || r.titulo, nivel: m.nivel || params.nivel, tema: m.tema || params.tema }))
      setPaso(2)
    } catch (e) {
      setErrorIA(e.message)
    }
  }
  const manual = () => {
    setDatos(datosVacios(tipo))
    setMeta((m) => ({ ...m, nivel: m.nivel || params.nivel, tema: m.tema || params.tema }))
    setPaso(2)
  }

  const guardar = async () => {
    setError('')
    if (!meta.titulo.trim()) return setError('Ponle un título al ejercicio')
    if (errorValidacion) return setError(errorValidacion)
    setGuardando(true)
    try {
      await onGuardar(ejercicio?.id ?? null, { ...meta, tipo, datos })
    } catch (e) {
      setError(e.message)
      setGuardando(false)
    }
  }

  return (
    <Modal title={ejercicio?.id ? 'Editar ejercicio' : ejercicio ? 'Nuevo ejercicio a partir de otro' : 'Nuevo ejercicio'} onClose={onClose} wide="xl">
      <Pasos paso={paso} />

      {paso === 0 && (
        <div>
          <p className="mb-4 text-sm text-slate-600">¿Qué tipo de ejercicio quieres crear?</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {TIPOS.map((x) => (
              <button key={x.id} type="button" onClick={() => elegirTipo(x.id)} className="group flex items-start gap-4 rounded-2xl border border-brand-100 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-brand-400 hover:shadow-md">
                <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${TONOS[x.tono]}`}>
                  <Icon name={x.icono} className="h-6 w-6" />
                </span>
                <span>
                  <span className="block text-base font-semibold text-slate-900 group-hover:text-brand-700">{x.label}</span>
                  <span className="block text-sm text-slate-500">{x.desc}</span>
                  <span className={`mt-1.5 inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${x.auto ? 'bg-emerald-50 text-emerald-700' : 'bg-peach-100 text-peach-700'}`}>{x.auto ? 'Se califica solo' : 'Lo revisa el docente'}</span>
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
                Cambiar tipo
              </button>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <Field className="sm:col-span-2" label="Tema" value={params.tema} onChange={setP('tema')} placeholder="Ej. Daily routines, travel, past simple…" />
            <Field label="Nivel" options={NIVELES} value={params.nivel} onChange={setP('nivel')} />
            {t.auto && tipo !== 'matching' && (
              <Field label={tipo === 'fill_gap' || tipo === 'order_sentences' ? 'Cantidad de oraciones' : tipo === 'reading' ? 'Afirmaciones' : 'Cantidad de preguntas'} type="number" min="1" max="20" value={params.cantidad} onChange={setP('cantidad')} />
            )}
            {tipo === 'matching' && <Field label="Cantidad de pares" type="number" min="2" max="12" value={params.cantidad} onChange={setP('cantidad')} />}
          </div>
          {tipo === 'reading' && <Field as="textarea" rows={4} label="Texto propio (opcional)" value={params.texto} onChange={setP('texto')} hint="Si lo dejas vacío, la IA escribirá un texto original." />}
          {tipo === 'listening' && (
            <>
              <Field as="textarea" rows={4} label="Transcripción del audio" value={params.transcripcion} onChange={setP('transcripcion')} hint="La IA no puede oír el audio: pega aquí lo que se dice para que las preguntas coincidan." />
              <Field label="Enlace del audio en Google Drive" value={params.audio_url ?? ''} onChange={setP('audio_url')} placeholder="https://drive.google.com/file/d/…/view" hint="Lo usaremos en el siguiente paso. También puedes agregarlo después." />
            </>
          )}
          <Field label="Indicaciones adicionales (opcional)" value={params.extra} onChange={setP('extra')} placeholder="Ej. Usa vocabulario de restaurantes; que sea un poco difícil." />

          <div className="rounded-2xl border border-brand-200 bg-brand-50/60 p-4">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <p className="flex items-center gap-2 text-sm font-semibold text-brand-800">
                <Icon name="sparkle" className="h-4 w-4" /> Tu prompt está listo
              </p>
              <Button type="button" onClick={copiar}>
                <Icon name={copiado ? 'check' : 'copy'} className="h-4 w-4" /> {copiado ? '¡Copiado!' : 'Copiar prompt'}
              </Button>
            </div>
            <pre className="max-h-56 overflow-auto whitespace-pre-wrap rounded-xl bg-white p-3 text-xs leading-5 text-slate-700">{prompt}</pre>
            <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-slate-600">
              <li>Copia el prompt y pégalo en tu IA favorita (ChatGPT, Claude, Gemini…).</li>
              <li>Copia la respuesta completa que te dé.</li>
              <li>Pégala aquí abajo y revisa el resultado antes de guardarlo.</li>
            </ol>
          </div>

          <Field as="textarea" rows={7} label="Respuesta de la IA" value={pegado} onChange={(e) => setPegado(e.target.value)} placeholder='Pega aquí el JSON que te devolvió la IA: { "titulo": …' />
          {errorIA && (
            <p role="alert" className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {errorIA}
            </p>
          )}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Button type="button" variant="ghost" onClick={manual}>
              Prefiero escribirlo yo
            </Button>
            <Button type="button" onClick={leer} disabled={!pegado.trim()}>
              Usar esta respuesta
            </Button>
          </div>
        </div>
      )}

      {paso === 2 && t && datos && (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <Field className="sm:col-span-2" label="Título del ejercicio" value={meta.titulo} onChange={(e) => setMeta((m) => ({ ...m, titulo: e.target.value }))} placeholder={`Ej. ${t.label}: daily routines`} autoFocus />
            <Field label="Nivel" options={[{ value: '', label: 'Sin nivel' }, ...NIVELES.map((n) => ({ value: n, label: n }))]} value={meta.nivel} onChange={(e) => setMeta((m) => ({ ...m, nivel: e.target.value }))} />
          </div>
          <Field label="Tema (opcional)" value={meta.tema} onChange={(e) => setMeta((m) => ({ ...m, tema: e.target.value }))} placeholder="Para encontrarlo más fácil en el banco" />

          <div role="group" aria-label="Modo" className="inline-flex gap-0.5 rounded-xl bg-slate-100 p-0.5">
            {[
              ['editar', 'Editar'],
              ['previa', 'Vista previa'],
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
              <h3 className="mb-4 text-xl font-bold text-brand-800">{meta.titulo || 'Sin título'}</h3>
              <EjercicioJugador ejercicio={previa} vistaPrevia />
            </div>
          ) : (
            <p className="rounded-xl bg-peach-50 px-4 py-3 text-sm text-peach-700">Corrige esto para ver la vista previa: {errorValidacion}</p>
          )}

          {vista === 'editar' && errorValidacion && <p className="text-sm text-peach-700">Pendiente: {errorValidacion}</p>}
          {error && (
            <p role="alert" className="text-sm text-rose-700">
              {error}
            </p>
          )}
          <div className="flex justify-between gap-2 border-t border-slate-100 pt-4">
            {!ejercicio ? (
              <Button type="button" variant="ghost" onClick={() => setPaso(1)}>
                Volver al prompt
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button type="button" variant="ghost" onClick={onClose}>
                Cancelar
              </Button>
              <Button type="button" onClick={guardar} disabled={guardando}>
                {guardando ? 'Guardando…' : ejercicio?.id ? 'Guardar cambios' : 'Guardar ejercicio'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  )
}
