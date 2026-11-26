import { useEffect, useMemo, useRef, useState } from 'react'
import Button from '../ui/Button'
import Icon from '../ui/Icon'
import TextoFormateado from './TextoFormateado'
import useSinCopiar from '../../hooks/useSinCopiar'
import { audioDriveEmbed, fmtPuntaje, palabras } from '../../lib/ejercicios'
import { subirAudio, urlAudio } from '../../services/ejercicios'

const LETRAS = 'ABCDEFGH'
const OK = 'border-emerald-400 bg-emerald-50 text-emerald-900'
const MAL = 'border-rose-300 bg-rose-50 text-rose-800'

// Cuántas respuestas espera un ejercicio autocalificable.
function totalItems(tipo, c) {
  switch (tipo) {
    case 'multiple_choice':
      return c.preguntas.length
    case 'listening':
      return c.preguntas.reduce((n, a) => n + (a.forma === 'gap' ? a.partes.length - 1 : 1), 0)
    case 'reading':
      return c.afirmaciones.reduce((n, a) => n + (a.forma === 'gap' ? a.partes.length - 1 : 1), 0)
    case 'fill_gap':
      return c.oraciones.reduce((n, o) => n + o.partes.length - 1, 0)
    case 'matching':
      return c.izquierda.length
    case 'order_sentences':
      return c.oraciones.length
    default:
      return 0
  }
}

function Marca({ correcta }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1 text-xs font-medium text-rose-700">
      <Icon name="close" className="h-3.5 w-3.5" /> Correct answer: <strong>{correcta}</strong>
    </span>
  )
}

// Tarjeta de una pregunta. `ok`: undefined mientras responde; true/false al ver el resultado.
function Pregunta({ id, n, titulo, respondida, ok, children }) {
  const borde = ok === true ? 'border-emerald-200' : ok === false ? 'border-rose-200' : respondida ? 'border-brand-200' : 'border-slate-200'
  const insignia = ok === true ? 'bg-emerald-500 text-white' : ok === false ? 'bg-rose-500 text-white' : respondida ? 'bg-brand-600 text-white' : 'bg-brand-100 text-brand-700'
  return (
    <section id={id} className={`scroll-mt-24 rounded-2xl border bg-white p-4 shadow-sm transition-colors sm:p-5 ${borde}`}>
      <div className={`flex gap-3 ${titulo ? 'mb-3' : ''}`}>
        <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-semibold transition-colors ${insignia}`}>
          {ok === true ? <Icon name="check" className="h-4 w-4" /> : ok === false ? <Icon name="close" className="h-4 w-4" /> : n}
        </span>
        {titulo && <p className="pt-0.5 text-base font-medium leading-6 text-slate-900">{titulo}</p>}
      </div>
      {children}
    </section>
  )
}

// Anillo con la nota: verde desde 70, durazno entre 40 y 70, rojo debajo.
function Anillo({ valor }) {
  const v = Math.max(0, Math.min(100, Number(valor) || 0))
  const r = 42
  const c = 2 * Math.PI * r
  const color = v >= 70 ? 'text-emerald-500' : v >= 40 ? 'text-peach-500' : 'text-rose-500'
  return (
    <div className="relative h-24 w-24 shrink-0" role="img" aria-label={`Score ${fmtPuntaje(valor)} out of 100`}>
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
        <circle cx="50" cy="50" r={r} fill="none" strokeWidth="9" className="stroke-slate-100" />
        <circle cx="50" cy="50" r={r} fill="none" strokeWidth="9" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - v / 100)} className={`stroke-current transition-all duration-700 ${color}`} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold leading-none text-slate-900">{fmtPuntaje(valor)}</span>
        <span className="text-[10px] uppercase tracking-wide text-slate-400">/ 100</span>
      </div>
    </div>
  )
}

// Opciones tipo botón: A, B, C, D. Sirve para multiple choice y listening.
function Opciones({ opciones, valor, onElegir, bloqueado, detalle }) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {opciones.map((o, i) => {
        const elegida = valor === String(i)
        const esCorrecta = detalle && String(i) === detalle.correcta
        const clase = detalle ? (esCorrecta ? OK : elegida ? MAL : 'border-slate-200 bg-white text-slate-500') : elegida ? 'border-brand-500 bg-brand-50 text-brand-800 ring-2 ring-brand-500/20' : 'border-slate-200 bg-white text-slate-800 hover:border-brand-300 hover:bg-brand-50/50'
        return (
          <button
            key={i}
            type="button"
            disabled={bloqueado}
            aria-pressed={elegida}
            onClick={() => onElegir(String(i))}
            className={`flex min-h-12 items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm transition active:scale-[0.99] disabled:cursor-default ${clase}`}
          >
            <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${elegida || esCorrecta ? 'bg-white/80' : 'bg-slate-100 text-slate-500'}`}>{LETRAS[i]}</span>
            <span className="min-w-0 flex-1">{o}</span>
            {detalle && esCorrecta && <Icon name="check" className="h-4 w-4 shrink-0 text-emerald-600" />}
            {detalle && elegida && !esCorrecta && <Icon name="close" className="h-4 w-4 shrink-0 text-rose-600" />}
          </button>
        )
      })}
    </div>
  )
}

function VerdaderoFalso({ valor, onElegir, bloqueado, detalle }) {
  return (
    <div className="flex gap-2">
      {[
        ['true', 'True'],
        ['false', 'False'],
      ].map(([v, t]) => {
        const elegida = valor === v
        const esCorrecta = detalle && v === detalle.correcta
        const clase = detalle ? (esCorrecta ? OK : elegida ? MAL : 'border-slate-200 bg-white text-slate-500') : elegida ? 'border-brand-500 bg-brand-50 text-brand-800 ring-2 ring-brand-500/20' : 'border-slate-200 bg-white text-slate-700 hover:border-brand-300 hover:bg-brand-50/50'
        return (
          <button key={v} type="button" disabled={bloqueado} aria-pressed={elegida} onClick={() => onElegir(v)} className={`min-w-28 flex-1 rounded-xl border px-5 py-3 text-sm font-medium transition active:scale-[0.99] disabled:cursor-default sm:flex-none ${clase}`}>
            {t}
          </button>
        )
      })}
    </div>
  )
}

// Ordenar palabras tocándolas: las elegidas suben a la línea de la oración; tocar una elegida la devuelve.
function OrdenPalabras({ palabras: piezas, elegidas, onCambiar, bloqueado, detalle, respuesta }) {
  if (bloqueado) {
    return <div className={`rounded-xl border px-4 py-3 text-sm ${detalle ? (detalle.ok ? OK : MAL) : 'border-slate-200 bg-slate-50'}`}>{respuesta || '—'}</div>
  }
  const libres = piezas.map((w, i) => ({ w, i })).filter((x) => !elegidas.includes(x.i))
  return (
    <div>
      <div className="flex min-h-12 flex-wrap items-center gap-2 rounded-xl border-2 border-dashed border-brand-200 bg-brand-50/40 p-2">
        {elegidas.length === 0 && <span className="px-2 text-sm text-slate-400">Tap the words in order…</span>}
        {elegidas.map((i, pos) => (
          <button key={i} type="button" onClick={() => onCambiar(elegidas.filter((_, p) => p !== pos))} className="rounded-lg bg-brand-600 px-3.5 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-700 active:scale-95">
            {piezas[i]}
          </button>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        {libres.map(({ w, i }) => (
          <button key={i} type="button" onClick={() => onCambiar([...elegidas, i])} className="rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-800 shadow-sm transition hover:-translate-y-px hover:border-brand-400 active:scale-95">
            {w}
          </button>
        ))}
      </div>
      {elegidas.length > 0 && (
        <button type="button" onClick={() => onCambiar([])} className="mt-2 text-xs text-slate-500 underline-offset-2 hover:text-brand-700 hover:underline">
          Start over
        </button>
      )}
    </div>
  )
}

// Grabadora de voz con vista previa. Entrega el audio al padre como Blob.
function Grabadora({ segundosMax, onAudio, bloqueado }) {
  const [estado, setEstado] = useState('inicio') // inicio | grabando | listo
  const [seg, setSeg] = useState(0)
  const [url, setUrl] = useState('')
  const [error, setError] = useState('')
  const rec = useRef(null)
  const timer = useRef(null)
  const trozos = useRef([])

  useEffect(
    () => () => {
      clearInterval(timer.current)
      rec.current?.stream?.getTracks().forEach((t) => t.stop())
    },
    [],
  )
  useEffect(() => () => url && URL.revokeObjectURL(url), [url])

  const detener = () => {
    clearInterval(timer.current)
    if (rec.current?.state === 'recording') rec.current.stop()
  }

  const empezar = async () => {
    setError('')
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') return setError('Your browser does not allow audio recording. Try an up-to-date Chrome, Edge or Safari.')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mime = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'].find((m) => MediaRecorder.isTypeSupported?.(m))
      const r = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined)
      trozos.current = []
      r.ondataavailable = (e) => e.data.size && trozos.current.push(e.data)
      r.onstop = () => {
        stream.getTracks().forEach((t) => t.stop())
        const blob = new Blob(trozos.current, { type: r.mimeType || mime || 'audio/webm' })
        setUrl(URL.createObjectURL(blob))
        setEstado('listo')
        onAudio(blob)
      }
      rec.current = r
      r.start()
      setSeg(0)
      setEstado('grabando')
      timer.current = setInterval(() => setSeg((s) => s + 1), 1000)
    } catch {
      setError('We could not use your microphone. Check that the browser has permission to use it and try again.')
    }
  }

  useEffect(() => {
    if (estado === 'grabando' && seg >= segundosMax) detener()
  }, [seg, estado, segundosMax])

  const mm = (n) => `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`

  return (
    <div className="rounded-2xl border border-brand-100 bg-brand-50/50 p-5 text-center">
      {estado === 'inicio' && (
        <>
          <button type="button" disabled={bloqueado} onClick={empezar} className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-brand-600 text-white shadow-lg transition hover:scale-105 hover:bg-brand-700 disabled:opacity-50" aria-label="Start recording">
            <Icon name="mic" className="h-9 w-9" />
          </button>
          <p className="mt-3 text-sm text-slate-600">Tap the microphone and speak. You can record up to {segundosMax} seconds.</p>
        </>
      )}
      {estado === 'grabando' && (
        <>
          <button type="button" onClick={detener} className="mx-auto flex h-20 w-20 animate-pulse items-center justify-center rounded-full bg-rose-500 text-white shadow-lg" aria-label="Stop recording">
            <Icon name="stop" className="h-8 w-8" />
          </button>
          <p className="mt-3 text-lg font-semibold tabular-nums text-rose-600">
            {mm(seg)} <span className="text-sm font-normal text-slate-500">/ {mm(segundosMax)}</span>
          </p>
          <p className="text-sm text-slate-600">Recording… tap the square to finish.</p>
        </>
      )}
      {estado === 'listo' && (
        <>
          <audio controls src={url} className="mx-auto w-full max-w-sm" />
          {!bloqueado && (
            <Button
              type="button"
              variant="secondary"
              className="mt-3"
              onClick={() => {
                setEstado('inicio')
                setUrl('')
                onAudio(null)
              }}
            >
              Record again
            </Button>
          )}
        </>
      )}
      {error && (
        <p role="alert" className="mt-3 text-sm text-rose-700">
          {error}
        </p>
      )}
    </div>
  )
}

// Reproduce un audio guardado (URL firmada de Storage).
export function AudioGuardado({ ruta }) {
  const [url, setUrl] = useState('')
  const [error, setError] = useState('')
  useEffect(() => {
    let vivo = true
    urlAudio(ruta)
      .then((u) => vivo && setUrl(u))
      .catch((e) => vivo && setError(e.message))
    return () => {
      vivo = false
    }
  }, [ruta])
  if (error) return <p className="text-sm text-rose-700">Could not load the audio: {error}</p>
  if (!url) return <p className="text-sm text-slate-500">Loading audio…</p>
  return <audio controls src={url} className="w-full max-w-sm" />
}

// Resuelve un ejercicio. `entrega` = lo ya enviado (se muestra bloqueado con su resultado).
// `vistaPrevia`: se ve igual pero no envía nada.
export default function EjercicioJugador({ ejercicio, entrega = null, vistaPrevia = false, onEnviado }) {
  const { tipo, contenido: c } = ejercicio
  const n = useMemo(() => totalItems(tipo, c), [tipo, c])
  const inicial = entrega?.respuestas
  const claveBorrador = !vistaPrevia && !entrega && ejercicio.id ? `universa-borrador-${ejercicio.id}` : null
  const [resp, setResp] = useState(() => (Array.isArray(inicial) ? inicial.map(String) : Array(n).fill('')))
  const [picks, setPicks] = useState(() => (c.oraciones && tipo === 'order_sentences' ? c.oraciones.map(() => []) : []))
  const [texto, setTexto] = useState(() => {
    if (entrega?.respuestas?.texto) return entrega.respuestas.texto
    try {
      return (claveBorrador && tipo === 'writing' && localStorage.getItem(claveBorrador)) || ''
    } catch {
      return ''
    }
  })
  const [audio, setAudio] = useState(null)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')
  const [local, setLocal] = useState(null) // entrega recién enviada en esta sesión
  const resultadoRef = useRef(null)
  const sinCopiar = useSinCopiar()

  const hecho = entrega ?? local
  const bloqueado = Boolean(hecho)
  const detalle = hecho?.detalle

  // Borrador del Writing: se guarda en este dispositivo para no perder lo escrito si se cierra la página.
  useEffect(() => {
    if (!claveBorrador || tipo !== 'writing' || local) return
    try {
      if (texto) localStorage.setItem(claveBorrador, texto)
      else localStorage.removeItem(claveBorrador)
    } catch {
      /* sin almacenamiento: no pasa nada */
    }
  }, [texto, claveBorrador, tipo, local])
  // Al enviar, se sube a ver el resultado.
  useEffect(() => {
    if (local) resultadoRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [local])

  const poner = (i, v) => setResp((r) => r.map((x, j) => (j === i ? v : x)))
  // La oración solo cuenta como respondida cuando ya se usaron todas las palabras.
  const ponerPicks = (i, p) => {
    setPicks((ps) => ps.map((x, j) => (j === i ? p : x)))
    const piezas = c.oraciones[i].palabras
    poner(i, p.length === piezas.length ? p.map((k) => piezas[k]).join(' ') : '')
  }

  const respondidas = tipo === 'writing' ? (texto.trim() ? 1 : 0) : tipo === 'speaking' ? (audio ? 1 : 0) : resp.filter((x) => x !== '').length
  const meta = tipo === 'writing' || tipo === 'speaking' ? 1 : n
  const completo = respondidas === meta
  const enPalabras = tipo === 'writing' ? palabras(texto) : 0
  const pct = meta ? Math.round((respondidas / meta) * 100) : 0

  const enviar = async () => {
    setError('')
    if (vistaPrevia) return
    setEnviando(true)
    try {
      let r
      if (tipo === 'writing') r = await onEnviado({ texto })
      else if (tipo === 'speaking') {
        const ruta = await subirAudio(ejercicio.id, audio)
        r = await onEnviado({}, ruta)
      } else r = await onEnviado(resp)
      setLocal(r)
      try {
        if (claveBorrador) localStorage.removeItem(claveBorrador)
      } catch {
        /* nada */
      }
    } catch (e) {
      setError(e.message)
    } finally {
      setEnviando(false)
    }
  }

  const d = (i) => detalle?.[i]
  const pendiente = hecho?.estado === 'pendiente'
  let gap = 0

  const irAlPendiente = () => {
    const i = resp.findIndex((x) => x === '')
    if (i < 0) return
    const el = (tipo === 'fill_gap' || tipo === 'reading' || tipo === 'listening') && document.getElementById(`hueco-${i}`) ? document.getElementById(`hueco-${i}`) : document.getElementById(tipo === 'fill_gap' ? `hueco-${i}` : `pregunta-${i}`)
    if (!el) return
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    if (el.tagName === 'INPUT') el.focus({ preventScroll: true })
  }
  // Enter en un espacio pasa al siguiente.
  const alEnter = (idx) => (e) => {
    if (e.key !== 'Enter') return
    e.preventDefault()
    document.getElementById(`hueco-${idx + 1}`)?.focus()
  }

  // Ítems mixtos (True / False, pregunta con opciones, completar). Reading y Listening los comparten.
  const renderMixtos = (lista, def) => {
  let k = 0
  return lista.map((a, i) => {
                const forma = a.forma ?? def
                const ini = k
                k += forma === 'gap' ? a.partes.length - 1 : 1
                if (forma === 'gap') {
                  const idxs = Array.from({ length: a.partes.length - 1 }, (_, g) => ini + g)
                  const okItem = d(idxs[0]) ? idxs.every((x) => d(x)?.ok) : undefined
                  return (
                    <Pregunta key={i} id={`pregunta-${ini}`} n={i + 1} respondida={idxs.every((x) => (resp[x] ?? '') !== '')} ok={okItem}>
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Complete the sentence</p>
                      <p className="text-base leading-[2.6rem] text-slate-900">
                        {a.partes.map((parte, g) => {
                          const idx = g < a.partes.length - 1 ? ini + g : -1
                          return (
                            <span key={g}>
                              {parte}
                              {idx >= 0 && (
                                <span className="mx-1 inline-block align-middle">
                                  <input
                                    id={`hueco-${idx}`}
                                    value={resp[idx] ?? ''}
                                    disabled={bloqueado}
                                    onChange={(e) => poner(idx, e.target.value)}
                                    onKeyDown={alEnter(idx)}
                                    aria-label={`Gap ${idx + 1}`}
                                    autoComplete="off"
                                    autoCapitalize="off"
                                    spellCheck={false}
                                    className={`w-36 rounded-lg border-0 border-b-2 bg-brand-50/60 px-2 py-1 text-center text-sm font-medium focus:outline-none focus:ring-0 ${
                                      d(idx) ? (d(idx).ok ? 'border-emerald-400 text-emerald-800' : 'border-rose-400 text-rose-800') : 'border-brand-300 text-brand-800 focus:border-brand-600 focus:bg-brand-50'
                                    }`}
                                  />
                                  {d(idx) && !d(idx).ok && <span className="ml-1 text-xs font-medium text-rose-700">→ {d(idx).correcta}</span>}
                                </span>
                              )}
                            </span>
                          )
                        })}
                      </p>
                    </Pregunta>
                  )
                }
                if (forma === 'choice') {
                  return (
                    <Pregunta key={i} id={`pregunta-${ini}`} n={i + 1} titulo={a.enunciado} respondida={resp[ini] !== ''} ok={d(ini)?.ok}>
                      <Opciones opciones={a.opciones} valor={resp[ini]} onElegir={(v) => poner(ini, v)} bloqueado={bloqueado} detalle={d(ini)} />
                      {d(ini) && !d(ini).ok && (
                        <div className="mt-2">
                          <Marca correcta={a.opciones[Number(d(ini).correcta)]} />
                        </div>
                      )}
                    </Pregunta>
                  )
                }
                return (
                  <Pregunta key={i} id={`pregunta-${ini}`} n={i + 1} titulo={a.enunciado} respondida={resp[ini] !== ''} ok={d(ini)?.ok}>
                    <VerdaderoFalso valor={resp[ini]} onElegir={(v) => poner(ini, v)} bloqueado={bloqueado} detalle={d(ini)} />
                    {d(ini) && !d(ini).ok && (
                      <div className="mt-2">
                        <Marca correcta={d(ini).correcta === 'true' ? 'True' : 'False'} />
                      </div>
                    )}
                  </Pregunta>
                )
              })
  }

  return (
    <div className="space-y-5">
      {c.instrucciones && (
        <p className="flex items-start gap-2 rounded-xl bg-brand-50 px-4 py-3 text-sm font-medium text-brand-800">
          <Icon name="sparkle" className="mt-0.5 h-4 w-4 shrink-0" /> {c.instrucciones}
        </p>
      )}

      {hecho && (
        <div ref={resultadoRef} className={`scroll-mt-24 rounded-2xl border p-5 ${pendiente ? 'border-peach-200 bg-peach-50' : 'border-brand-200 bg-white shadow-sm'}`}>
          {pendiente ? (
            <p className="flex items-start gap-3 text-sm font-medium text-peach-700">
              <Icon name="clock" className="h-5 w-5 shrink-0" /> Submitted. Your teacher will review it and you will see the grade and comments here.
            </p>
          ) : (
            <div className="flex flex-wrap items-center gap-5">
              <Anillo valor={hecho.puntaje} />
              <div className="min-w-0 flex-1">
                <p className="text-lg font-semibold text-slate-900">{hecho.estado === 'revisada' ? 'Reviewed by your teacher' : hecho.puntaje >= 70 ? 'Well done!' : hecho.puntaje >= 40 ? 'Good try!' : 'Keep practicing'}</p>
                {hecho.total != null && (
                  <p className="text-sm text-slate-600">
                    {hecho.correctas} of {hecho.total} correct
                  </p>
                )}
                {detalle && <p className="mt-1 text-xs text-slate-500">Review your answers below: the wrong ones show the correct answer.</p>}
              </div>
            </div>
          )}
          {hecho.feedback && (
            <div className="mt-4 rounded-xl bg-brand-50/60 p-4 text-sm text-slate-700">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-brand-700">Comments from your teacher</p>
              <p className="whitespace-pre-wrap">{hecho.feedback}</p>
            </div>
          )}
        </div>
      )}

      {(tipo === 'multiple_choice' || tipo === 'listening') && (
        <>
          {tipo === 'listening' && audioDriveEmbed(c.audio_url) && (
            <div className="sticky top-2 z-10 overflow-hidden rounded-2xl border border-brand-100 bg-white p-3 shadow-md">
              <p className="mb-2 flex items-center gap-2 text-sm font-medium text-brand-700">
                <Icon name="headphones" className="h-4 w-4" /> Listen to the audio as many times as you need
              </p>
              <iframe title="Exercise audio" src={audioDriveEmbed(c.audio_url)} allow="autoplay" className="h-28 w-full rounded-lg border-0 bg-slate-50" />
            </div>
          )}
          {tipo === 'listening' ? renderMixtos(c.preguntas, 'choice') : c.preguntas.map((p, i) => (
            <Pregunta key={i} id={`pregunta-${i}`} n={i + 1} titulo={p.enunciado} respondida={resp[i] !== ''} ok={d(i)?.ok}>
              <Opciones opciones={p.opciones} valor={resp[i]} onElegir={(v) => poner(i, v)} bloqueado={bloqueado} detalle={d(i)} />
              {d(i) && !d(i).ok && (
                <div className="mt-2">
                  <Marca correcta={p.opciones[Number(d(i).correcta)]} />
                </div>
              )}
            </Pregunta>
          ))}
        </>
      )}

      {tipo === 'reading' && (
        <div className="grid items-start gap-5 lg:grid-cols-2">
          <article className="rounded-2xl border border-brand-100 bg-white p-5 text-[15px] leading-7 text-slate-800 shadow-sm sm:p-7 lg:sticky lg:top-2 lg:max-h-[80vh] lg:overflow-auto">
            <p className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-brand-700">
              <Icon name="book" className="h-4 w-4" /> Read the text
            </p>
            <TextoFormateado texto={c.texto} />
          </article>
          <div className="space-y-4">
            {renderMixtos(c.afirmaciones, 'tf')}
          </div>
        </div>
      )}

      {tipo === 'fill_gap' &&
        c.oraciones.map((o, i) => {
          const idxs = Array.from({ length: o.partes.length - 1 }, (_, k) => gap + k)
          const okOracion = idxs.length && d(idxs[0]) ? idxs.every((x) => d(x)?.ok) : undefined
          return (
            <Pregunta key={i} id={`oracion-${i}`} n={i + 1} respondida={idxs.every((x) => (resp[x] ?? '') !== '')} ok={okOracion}>
              <p className="text-base leading-[2.6rem] text-slate-900">
                {o.partes.map((parte, k) => {
                  const idx = k < o.partes.length - 1 ? gap++ : -1
                  return (
                    <span key={k}>
                      {parte}
                      {idx >= 0 && (
                        <span className="mx-1 inline-block align-middle">
                          <input
                            id={`hueco-${idx}`}
                            value={resp[idx] ?? ''}
                            disabled={bloqueado}
                            onChange={(e) => poner(idx, e.target.value)}
                            onKeyDown={alEnter(idx)}
                            aria-label={`Gap ${idx + 1}`}
                            autoComplete="off"
                            autoCapitalize="off"
                            spellCheck={false}
                            className={`w-36 rounded-lg border-0 border-b-2 bg-brand-50/60 px-2 py-1 text-center text-sm font-medium focus:outline-none focus:ring-0 ${
                              d(idx) ? (d(idx).ok ? 'border-emerald-400 text-emerald-800' : 'border-rose-400 text-rose-800') : 'border-brand-300 text-brand-800 focus:border-brand-600 focus:bg-brand-50'
                            }`}
                          />
                          {d(idx) && !d(idx).ok && <span className="ml-1 text-xs font-medium text-rose-700">→ {d(idx).correcta}</span>}
                        </span>
                      )}
                    </span>
                  )
                })}
              </p>
            </Pregunta>
          )
        })}

      {tipo === 'matching' &&
        c.izquierda.map((izq, i) => (
          <Pregunta key={i} id={`pregunta-${i}`} n={i + 1} titulo={izq} respondida={resp[i] !== ''} ok={d(i)?.ok}>
            <select
              value={resp[i]}
              disabled={bloqueado}
              onChange={(e) => poner(i, e.target.value)}
              aria-label={`Pair of ${izq}`}
              className={`w-full rounded-xl border px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-200 ${d(i) ? (d(i).ok ? OK : MAL) : 'border-slate-300 bg-white'}`}
            >
              <option value="">Choose the pair…</option>
              {c.opciones.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
            {d(i) && !d(i).ok && (
              <div className="mt-2">
                <Marca correcta={d(i).correcta} />
              </div>
            )}
          </Pregunta>
        ))}

      {tipo === 'order_sentences' &&
        c.oraciones.map((o, i) => (
          <Pregunta key={i} id={`pregunta-${i}`} n={i + 1} titulo="Form the sentence" respondida={resp[i] !== ''} ok={d(i)?.ok}>
            <OrdenPalabras palabras={o.palabras} elegidas={picks[i] ?? []} onCambiar={(p) => ponerPicks(i, p)} bloqueado={bloqueado} detalle={d(i)} respuesta={resp[i]} />
            {d(i) && !d(i).ok && (
              <div className="mt-2">
                <Marca correcta={d(i).correcta} />
              </div>
            )}
          </Pregunta>
        ))}

      {tipo === 'writing' && Array.isArray(c.tareas) && (
        <div className="space-y-4">
          <p className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-peach-100 px-3 py-1 text-xs font-semibold text-peach-700">
              <Icon name="clock" className="h-3.5 w-3.5" /> {c.minutos || 60} minutes
            </span>
            <span>Two tasks, one attempt. The timer starts when the student begins.</span>
          </p>
          {c.tareas.map((t, i) => (
            <Pregunta key={i} id={`tarea-${i}`} n={i + 1} titulo={`Task ${i + 1}${t.genero ? ` · ${t.genero}` : ''}`}>
              <TextoFormateado texto={t.consigna} className="rounded-xl bg-brand-50/50 p-4 text-[15px] leading-7 text-slate-900" />
              {t.min_palabras ? <p className="mt-2 text-xs text-slate-500">Suggested minimum: {t.min_palabras} words</p> : null}
              <textarea disabled rows={5} placeholder="The student writes here…" className="mt-3 w-full rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm" />
            </Pregunta>
          ))}
        </div>
      )}

      {tipo === 'writing' && !c.tareas && (
        <div className="space-y-3">
          <div {...(vistaPrevia ? {} : sinCopiar.props)} className={`rounded-2xl border border-brand-100 bg-white p-5 text-base leading-7 text-slate-900 shadow-sm sm:p-6 ${vistaPrevia ? '' : 'select-none'}`}>
            <TextoFormateado texto={c.consigna} />
          </div>
          <textarea
            {...(vistaPrevia ? {} : sinCopiar.props)}
            value={texto}
            disabled={bloqueado}
            onChange={(e) => setTexto(e.target.value)}
            rows={12}
            placeholder="Write your answer here…"
            className="w-full rounded-2xl border border-slate-300 bg-white p-4 text-[15px] leading-7 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200 disabled:bg-slate-50"
          />
          {!bloqueado && (
            <div>
              {c.min_palabras ? (
                <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                  <div className={`h-full rounded-full transition-all ${enPalabras >= c.min_palabras ? 'bg-emerald-500' : 'bg-brand-400'}`} style={{ width: `${Math.min(100, Math.round((enPalabras / c.min_palabras) * 100))}%` }} />
                </div>
              ) : null}
              {sinCopiar.aviso && (
                <p role="alert" className="mt-2 rounded-lg bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">
                  Copy and paste are not allowed. Please type your answer.
                </p>
              )}
              <p className="mt-1 flex flex-wrap justify-between gap-2 text-xs">
                <span className="text-slate-400">{claveBorrador && texto ? 'Draft saved on this device' : 'Copy and paste are disabled: type your answer.'}</span>
                <span className={c.min_palabras && enPalabras < c.min_palabras ? 'text-slate-500' : 'text-emerald-700'}>
                  {enPalabras} words{c.min_palabras ? ` · suggested minimum ${c.min_palabras}` : ''}
                </span>
              </p>
            </div>
          )}
        </div>
      )}

      {tipo === 'speaking' && (
        <div className="space-y-3">
          <div className="rounded-2xl border border-brand-100 bg-white p-5 text-base leading-7 text-slate-900 shadow-sm sm:p-6">
            <TextoFormateado texto={c.consigna} />
          </div>
          {hecho ? hecho.audio_path && <AudioGuardado ruta={hecho.audio_path} /> : <Grabadora segundosMax={c.segundos_max || 90} onAudio={setAudio} bloqueado={bloqueado} />}
        </div>
      )}

      {!bloqueado && (
        <div className="sticky bottom-3 z-20 overflow-hidden rounded-2xl border border-brand-100 bg-white/95 shadow-lg backdrop-blur">
          <div className="h-1.5 bg-slate-100">
            <div className="h-full bg-brand-500 transition-all duration-300" style={{ width: `${pct}%` }} />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 p-3">
            <div className="text-sm text-slate-600">
              {tipo === 'writing' || tipo === 'speaking' ? (
                completo ? 'Ready to submit' : tipo === 'writing' ? 'Write your answer' : 'Record your answer'
              ) : (
                <>
                  <span className="font-semibold text-slate-900">
                    {respondidas} of {meta}
                  </span>{' '}
                  answered
                  {!completo && respondidas > 0 && !vistaPrevia && (
                    <button type="button" onClick={irAlPendiente} className="ml-3 font-medium text-brand-700 hover:underline">
                      Go to the next one
                    </button>
                  )}
                </>
              )}
            </div>
            <div className="flex items-center gap-3">
              {error && (
                <span role="alert" className="text-sm text-rose-700">
                  {error}
                </span>
              )}
              {vistaPrevia ? (
                <span className="text-xs font-medium text-slate-500">Preview: this is how the student will see it</span>
              ) : (
                <Button type="button" onClick={enviar} disabled={!completo || enviando}>
                  {enviando ? 'Submitting…' : 'Submit answers'}
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
