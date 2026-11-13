import { useEffect, useMemo, useRef, useState } from 'react'
import Button from '../ui/Button'
import Icon from '../ui/Icon'
import { audioDriveEmbed, fmtPuntaje, palabras } from '../../lib/ejercicios'
import { subirAudio, urlAudio } from '../../services/ejercicios'

const LETRAS = 'ABCDEFGH'
const OK = 'border-emerald-400 bg-emerald-50 text-emerald-900'
const MAL = 'border-rose-300 bg-rose-50 text-rose-800'

// Cuántas respuestas espera un ejercicio autocalificable.
function totalItems(tipo, c) {
  switch (tipo) {
    case 'multiple_choice':
    case 'listening':
      return c.preguntas.length
    case 'reading':
      return c.afirmaciones.length
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

function Marca({ ok, correcta }) {
  return ok ? (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
      <Icon name="check" className="h-3.5 w-3.5" /> Correcto
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-rose-700">
      <Icon name="close" className="h-3.5 w-3.5" /> Correct answer: <strong>{correcta}</strong>
    </span>
  )
}

function Enunciado({ n, children }) {
  return (
    <p className="mb-3 flex gap-3 text-base font-medium text-slate-900">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700">{n}</span>
      <span className="pt-0.5">{children}</span>
    </p>
  )
}

// Opciones tipo botón: A, B, C, D. Sirve para multiple choice, listening y verdadero/falso.
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
            className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm transition disabled:cursor-default ${clase}`}
          >
            <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${elegida || esCorrecta ? 'bg-white/80' : 'bg-slate-100 text-slate-500'}`}>{LETRAS[i]}</span>
            {o}
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
        ['true', 'Verdadero'],
        ['false', 'Falso'],
      ].map(([v, t]) => {
        const elegida = valor === v
        const esCorrecta = detalle && v === detalle.correcta
        const clase = detalle ? (esCorrecta ? OK : elegida ? MAL : 'border-slate-200 bg-white text-slate-500') : elegida ? 'border-brand-500 bg-brand-50 text-brand-800 ring-2 ring-brand-500/20' : 'border-slate-200 bg-white text-slate-700 hover:border-brand-300 hover:bg-brand-50/50'
        return (
          <button key={v} type="button" disabled={bloqueado} aria-pressed={elegida} onClick={() => onElegir(v)} className={`min-w-28 rounded-full border px-5 py-2 text-sm font-medium transition disabled:cursor-default ${clase}`}>
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
    return (
      <div className={`rounded-xl border px-4 py-3 text-sm ${detalle ? (detalle.ok ? OK : MAL) : 'border-slate-200 bg-slate-50'}`}>
        {respuesta || '—'}
      </div>
    )
  }
  const libres = piezas.map((w, i) => ({ w, i })).filter((x) => !elegidas.includes(x.i))
  return (
    <div>
      <div className="flex min-h-12 flex-wrap items-center gap-2 rounded-xl border-2 border-dashed border-brand-200 bg-brand-50/40 p-2">
        {elegidas.length === 0 && <span className="px-2 text-sm text-slate-400">Tap the words in order…</span>}
        {elegidas.map((i, pos) => (
          <button key={i} type="button" onClick={() => onCambiar(elegidas.filter((_, p) => p !== pos))} className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-brand-700">
            {piezas[i]}
          </button>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        {libres.map(({ w, i }) => (
          <button key={i} type="button" onClick={() => onCambiar([...elegidas, i])} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-800 shadow-sm transition hover:-translate-y-px hover:border-brand-400">
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
  const [resp, setResp] = useState(() => (Array.isArray(inicial) ? inicial.map(String) : Array(n).fill('')))
  const [picks, setPicks] = useState(() => c.oraciones && tipo === 'order_sentences' ? c.oraciones.map(() => []) : [])
  const [texto, setTexto] = useState(entrega?.respuestas?.texto ?? '')
  const [audio, setAudio] = useState(null)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')
  const [local, setLocal] = useState(null) // entrega recién enviada en esta sesión

  const hecho = entrega ?? local
  const bloqueado = Boolean(hecho)
  const detalle = hecho?.detalle

  const poner = (i, v) => setResp((r) => r.map((x, j) => (j === i ? v : x)))
  const ponerPicks = (i, p) => {
    setPicks((ps) => ps.map((x, j) => (j === i ? p : x)))
    poner(i, p.map((k) => c.oraciones[i].palabras[k]).join(' '))
  }

  const respondidas = tipo === 'writing' ? (texto.trim() ? 1 : 0) : tipo === 'speaking' ? (audio ? 1 : 0) : resp.filter((x) => x !== '').length
  const meta = tipo === 'writing' || tipo === 'speaking' ? 1 : n
  const completo = respondidas === meta
  const enPalabras = tipo === 'writing' ? palabras(texto) : 0

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
    } catch (e) {
      setError(e.message)
    } finally {
      setEnviando(false)
    }
  }

  const d = (i) => detalle?.[i]
  const pendiente = hecho?.estado === 'pendiente'
  let gap = 0

  return (
    <div className="space-y-6">
      {c.instrucciones && <p className="rounded-xl bg-brand-50 px-4 py-3 text-sm text-brand-800">{c.instrucciones}</p>}

      {hecho && (
        <div className={`rounded-2xl border p-5 ${pendiente ? 'border-peach-200 bg-peach-50' : hecho.estado === 'revisada' ? 'border-brand-200 bg-brand-50' : 'border-brand-200 bg-white shadow-sm'}`}>
          {pendiente ? (
            <p className="flex items-center gap-2 text-sm font-medium text-peach-700">
              <Icon name="clock" className="h-5 w-5" /> Submitted. Your teacher will review it and you will see the grade and comments here.
            </p>
          ) : (
            <div className="flex flex-wrap items-center gap-5">
              <div className="flex h-20 w-20 shrink-0 flex-col items-center justify-center rounded-full bg-brand-600 text-white">
                <span className="text-2xl font-bold leading-none">{fmtPuntaje(hecho.puntaje)}</span>
                <span className="text-[10px] uppercase tracking-wide text-white/80">/ 100</span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-lg font-semibold text-slate-900">
                  {hecho.estado === 'revisada' ? 'Reviewed by your teacher' : hecho.puntaje >= 70 ? 'Well done!' : hecho.puntaje >= 40 ? 'Good try!' : 'Keep practicing'}
                </p>
                {hecho.total != null && (
                  <p className="text-sm text-slate-600">
                    {hecho.correctas} de {hecho.total} correctas
                  </p>
                )}
              </div>
            </div>
          )}
          {hecho.feedback && (
            <div className="mt-4 rounded-xl bg-white p-4 text-sm text-slate-700 shadow-sm">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-brand-700">Comments from your teacher</p>
              <p className="whitespace-pre-wrap">{hecho.feedback}</p>
            </div>
          )}
        </div>
      )}

      {(tipo === 'multiple_choice' || tipo === 'listening') && (
        <>
          {tipo === 'listening' && audioDriveEmbed(c.audio_url) && (
            <div className="overflow-hidden rounded-2xl border border-brand-100 bg-white p-3 shadow-sm">
              <p className="mb-2 flex items-center gap-2 text-sm font-medium text-brand-700">
                <Icon name="headphones" className="h-4 w-4" /> Listen to the audio as many times as you need
              </p>
              <iframe title="Exercise audio" src={audioDriveEmbed(c.audio_url)} allow="autoplay" className="h-28 w-full rounded-lg border-0 bg-slate-50" />
            </div>
          )}
          {c.preguntas.map((p, i) => (
            <div key={i}>
              <Enunciado n={i + 1}>{p.enunciado}</Enunciado>
              <Opciones opciones={p.opciones} valor={resp[i]} onElegir={(v) => poner(i, v)} bloqueado={bloqueado} detalle={d(i)} />
              {d(i) && !d(i).ok && <div className="mt-2"><Marca ok={false} correcta={p.opciones[Number(d(i).correcta)]} /></div>}
            </div>
          ))}
        </>
      )}

      {tipo === 'reading' && (
        <>
          <article className="rounded-2xl border border-brand-100 bg-white p-6 text-[15px] leading-7 text-slate-800 shadow-sm">
            {c.texto.split(/\n+/).map((par, i) => (
              <p key={i} className="mb-3 last:mb-0">
                {par}
              </p>
            ))}
          </article>
          {c.afirmaciones.map((a, i) => (
            <div key={i}>
              <Enunciado n={i + 1}>{a.enunciado}</Enunciado>
              <VerdaderoFalso valor={resp[i]} onElegir={(v) => poner(i, v)} bloqueado={bloqueado} detalle={d(i)} />
              {d(i) && !d(i).ok && <div className="mt-2"><Marca ok={false} correcta={d(i).correcta === 'true' ? 'Verdadero' : 'Falso'} /></div>}
            </div>
          ))}
        </>
      )}

      {tipo === 'fill_gap' &&
        c.oraciones.map((o, i) => (
          <div key={i} className="flex gap-3">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700">{i + 1}</span>
            <p className="flex-1 text-base leading-10 text-slate-900">
              {o.partes.map((parte, k) => {
                const idx = k < o.partes.length - 1 ? gap++ : -1
                return (
                  <span key={k}>
                    {parte}
                    {idx >= 0 && (
                      <span className="mx-1 inline-block align-middle">
                        <input
                          value={resp[idx] ?? ''}
                          disabled={bloqueado}
                          onChange={(e) => poner(idx, e.target.value)}
                          aria-label={`Espacio ${idx + 1}`}
                          autoComplete="off"
                          className={`w-32 rounded-lg border-0 border-b-2 bg-brand-50/60 px-2 py-1 text-center text-sm font-medium focus:outline-none focus:ring-0 ${
                            d(idx) ? (d(idx).ok ? 'border-emerald-400 text-emerald-800' : 'border-rose-400 text-rose-800') : 'border-brand-300 text-brand-800 focus:border-brand-600'
                          }`}
                        />
                        {d(idx) && !d(idx).ok && <span className="ml-1 text-xs font-medium text-rose-700">→ {d(idx).correcta}</span>}
                      </span>
                    )}
                  </span>
                )
              })}
            </p>
          </div>
        ))}

      {tipo === 'matching' && (
        <div className="space-y-3">
          {c.izquierda.map((izq, i) => (
            <div key={i} className="grid items-center gap-2 sm:grid-cols-2">
              <p className="flex items-center gap-3 rounded-xl border border-brand-100 bg-white px-4 py-3 text-sm font-medium text-slate-900 shadow-sm">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-700">{i + 1}</span>
                {izq}
              </p>
              <div>
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
                {d(i) && !d(i).ok && <div className="mt-1"><Marca ok={false} correcta={d(i).correcta} /></div>}
              </div>
            </div>
          ))}
        </div>
      )}

      {tipo === 'order_sentences' &&
        c.oraciones.map((o, i) => (
          <div key={i}>
            <Enunciado n={i + 1}>Form the sentence</Enunciado>
            <OrdenPalabras palabras={o.palabras} elegidas={picks[i] ?? []} onCambiar={(p) => ponerPicks(i, p)} bloqueado={bloqueado} detalle={d(i)} respuesta={resp[i]} />
            {d(i) && !d(i).ok && <div className="mt-2"><Marca ok={false} correcta={d(i).correcta} /></div>}
          </div>
        ))}

      {tipo === 'writing' && (
        <div>
          <p className="mb-3 rounded-2xl border border-brand-100 bg-white p-5 text-base text-slate-900 shadow-sm">{c.consigna}</p>
          <textarea
            value={texto}
            disabled={bloqueado}
            onChange={(e) => setTexto(e.target.value)}
            rows={10}
            placeholder="Write your answer here…"
            className="w-full rounded-2xl border border-slate-300 bg-white p-4 text-[15px] leading-7 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200 disabled:bg-slate-50"
          />
          {!bloqueado && (
            <p className={`mt-1 text-right text-xs ${c.min_palabras && enPalabras < c.min_palabras ? 'text-slate-500' : 'text-emerald-700'}`}>
              {enPalabras} words{c.min_palabras ? ` · suggested minimum ${c.min_palabras}` : ''}
            </p>
          )}
        </div>
      )}

      {tipo === 'speaking' && (
        <div className="space-y-3">
          <p className="rounded-2xl border border-brand-100 bg-white p-5 text-base text-slate-900 shadow-sm">{c.consigna}</p>
          {hecho ? hecho.audio_path && <AudioGuardado ruta={hecho.audio_path} /> : <Grabadora segundosMax={c.segundos_max || 90} onAudio={setAudio} bloqueado={bloqueado} />}
        </div>
      )}

      {!bloqueado && (
        <div className="sticky bottom-3 z-10 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-brand-100 bg-white/95 p-3 shadow-lg backdrop-blur">
          <p className="text-sm text-slate-600">
            {tipo === 'writing' || tipo === 'speaking' ? (completo ? 'Ready to submit' : tipo === 'writing' ? 'Write your answer' : 'Record your answer') : `${respondidas} of ${meta} answered`}
          </p>
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
      )}
    </div>
  )
}
