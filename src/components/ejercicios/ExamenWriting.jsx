import { useCallback, useEffect, useRef, useState } from 'react'
import Button from '../ui/Button'
import useSinCopiar from '../../hooks/useSinCopiar'
import { palabras } from '../../lib/ejercicios'

const clave = (id) => `universa:examen:${id}`
const mmss = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`

// Examen de Writing (Task 1 y Task 2): un solo intento con tiempo límite. El reloj lo manda el servidor; las consignas llegan al iniciar.
// Salir de la página (otra pestaña, otra ventana) NO se puede impedir desde el navegador: se registra cada salida, se avisa al estudiante
// y el docente la ve al revisar. Lo escrito se guarda en este navegador por si se recarga; al terminar el tiempo se envía solo.
export default function ExamenWriting({ ejercicio, entrega, servicio, onEnviado }) {
  const id = ejercicio.id
  const examen = ejercicio.examen
  const [estado, setEstado] = useState(() => (entrega ? 'enviado' : examen?.iniciado_at ? 'pendiente_reanudar' : 'inicio'))
  const [datos, setDatos] = useState(null) // { tareas, limiteMs, desfase }
  const [textos, setTextos] = useState(() => {
    try {
      const g = JSON.parse(localStorage.getItem(clave(id)) ?? 'null')
      return Array.isArray(g) && g.length === 2 ? g : ['', '']
    } catch {
      return ['', '']
    }
  })
  const [tarea, setTarea] = useState(0)
  const sinCopiar = useSinCopiar()
  const [resta, setResta] = useState(null)
  const [salidas, setSalidas] = useState(examen?.salidas ?? 0)
  const [aviso, setAviso] = useState(false)
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)
  const textosRef = useRef(textos)
  const enCurso = useRef(false)
  const autoEnviado = useRef(false)
  const enviarRespuestas = useRef(onEnviado)
  textosRef.current = textos
  enviarRespuestas.current = onEnviado

  const iniciar = useCallback(async () => {
    setError('')
    try {
      const r = await servicio.examenIniciar(id)
      // El reloj del servidor es la referencia: se corrige la diferencia con el reloj de este equipo.
      setDatos({ tareas: r.tareas ?? [], limiteMs: new Date(r.limite_at).getTime(), desfase: new Date(r.ahora).getTime() - Date.now() })
      setSalidas(r.salidas ?? 0)
      setEstado('en_curso')
    } catch (e) {
      setError(e.message)
    }
  }, [servicio, id])

  // Reanudar tras recargar: el límite sigue siendo el mismo.
  useEffect(() => {
    if (estado === 'pendiente_reanudar') iniciar()
  }, [estado, iniciar])

  const enviar = useCallback(
    async (porTiempo = false) => {
      if (enCurso.current) return
      enCurso.current = true
      setEnviando(true)
      setError('')
      try {
        const t = textosRef.current
        await enviarRespuestas.current({ tareas: t.map((texto) => ({ texto })) })
        try {
          localStorage.removeItem(clave(id))
        } catch {
          /* sin almacenamiento */
        }
        setEstado(porTiempo ? 'enviado_tiempo' : 'enviado')
      } catch (e) {
        setError(e.message)
        enCurso.current = false
      } finally {
        setEnviando(false)
      }
    },
    [id],
  )

  // Reloj y envío automático al terminar el tiempo.
  useEffect(() => {
    if (estado !== 'en_curso' || !datos) return
    const tic = () => {
      const s = Math.max(0, Math.ceil((datos.limiteMs - (Date.now() + datos.desfase)) / 1000))
      setResta(s)
      // El envío automático se intenta una sola vez; si falla, queda el botón «Submit exam».
      if (s === 0 && !autoEnviado.current) {
        autoEnviado.current = true
        enviar(true)
      }
    }
    tic()
    const t = setInterval(tic, 1000)
    return () => clearInterval(t)
  }, [estado, datos, enviar])

  // Guardado local de lo escrito.
  useEffect(() => {
    if (estado !== 'en_curso') return
    try {
      localStorage.setItem(clave(id), JSON.stringify(textos))
    } catch {
      /* sin almacenamiento */
    }
  }, [textos, estado, id])

  // Salidas de la página: se cuentan al irse y se avisa al volver. Pestaña oculta y ventana sin foco cuentan como una sola salida.
  useEffect(() => {
    if (estado !== 'en_curso') return
    let fuera = false
    const salir = () => {
      if (fuera) return
      fuera = true
      servicio.examenRegistrarSalida(id).then((n) => n != null && setSalidas(n)).catch(() => setSalidas((n) => n + 1))
    }
    const volver = () => {
      if (!fuera) return
      fuera = false
      setAviso(true)
    }
    const visibilidad = () => (document.visibilityState === 'hidden' ? salir() : volver())
    const antesDeCerrar = (e) => {
      e.preventDefault()
      e.returnValue = ''
    }
    document.addEventListener('visibilitychange', visibilidad)
    window.addEventListener('blur', salir)
    window.addEventListener('focus', volver)
    window.addEventListener('beforeunload', antesDeCerrar)
    return () => {
      document.removeEventListener('visibilitychange', visibilidad)
      window.removeEventListener('blur', salir)
      window.removeEventListener('focus', volver)
      window.removeEventListener('beforeunload', antesDeCerrar)
    }
  }, [estado, servicio, id])

  if (estado === 'enviado' || estado === 'enviado_tiempo')
    return (
      <div role="status" className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center">
        <p className="text-lg font-semibold text-emerald-900">{estado === 'enviado_tiempo' ? 'Time is up: your answers were submitted' : 'Your exam was submitted'}</p>
        <p className="mt-1 text-sm text-emerald-800">Your teacher will review each task and publish your grade. You will see it in “My grades”.</p>
      </div>
    )

  if (estado === 'inicio' || estado === 'pendiente_reanudar') {
    return (
      <div className="space-y-4">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-950">
          <p className="mb-2 text-base font-semibold">Before you start</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              You have <strong>{examen?.minutos ?? ejercicio.contenido?.minutos} minutes</strong>. The clock starts when you press “Start” and cannot be paused or restarted.
            </li>
            <li>
              You have <strong>one attempt</strong>. You will write Task 1 and Task 2 and submit once.
            </li>
            <li>
              <strong>Do not leave this page.</strong> Switching tabs or windows is recorded and your teacher will see it.
            </li>
            <li>
              <strong>Copy and paste are disabled</strong> in this exam: you must type your answers yourself.
            </li>
            <li>When the time ends, what you wrote is submitted automatically.</li>
          </ul>
        </div>
        {ejercicio.contenido?.instrucciones && <p className="rounded-xl bg-white p-4 text-sm text-slate-700 shadow-sm">{ejercicio.contenido.instrucciones}</p>}
        {error && (
          <p role="alert" className="text-sm text-rose-700">
            {error}
          </p>
        )}
        {estado === 'inicio' ? (
          <Button type="button" onClick={() => window.confirm('Start the exam now? The clock cannot be stopped.') && iniciar()}>
            Start exam
          </Button>
        ) : (
          <p className="text-sm text-slate-500">Resuming your exam…</p>
        )}
      </div>
    )
  }

  const t = datos?.tareas?.[tarea]
  const peso = tarea === 0 ? 35 : 65
  const pocoTiempo = resta != null && resta <= 300
  return (
    <div className="space-y-4">
      <div className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-brand-100 bg-white/95 px-4 py-3 shadow-sm backdrop-blur">
        <div role="tablist" aria-label="Tasks" className="flex gap-1.5">
          {[0, 1].map((i) => (
            <button
              key={i}
              role="tab"
              aria-selected={tarea === i}
              onClick={() => setTarea(i)}
              className={`rounded-full px-3 py-1 text-sm font-medium ${tarea === i ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            >
              Task {i + 1} {textos[i].trim() && <span aria-label="written">✓</span>}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3 text-sm">
          {salidas > 0 && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900">Left the page {salidas}×</span>}
          <span role="timer" aria-live="off" className={`rounded-lg px-3 py-1 text-lg font-bold tabular-nums ${pocoTiempo ? 'bg-rose-100 text-rose-800' : 'bg-brand-50 text-brand-800'}`}>
            {resta == null ? '--:--' : mmss(resta)}
          </span>
        </div>
      </div>

      {!t ? (
        <p className="text-sm text-slate-500">Loading the tasks…</p>
      ) : (
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Task {tarea + 1} · {peso} points{t.genero ? ` · ${t.genero}` : ''}
          </p>
          <p {...sinCopiar.props} className="mb-3 select-none whitespace-pre-line rounded-2xl border border-brand-100 bg-white p-5 text-base text-slate-900 shadow-sm">
            {t.consigna}
          </p>
          <textarea
            value={textos[tarea]}
            onChange={(e) => setTextos((x) => x.map((v, i) => (i === tarea ? e.target.value : v)))}
            rows={14}
            {...sinCopiar.props}
            autoComplete="off"
            aria-label={`Your answer for Task ${tarea + 1}`}
            placeholder="Write your answer here…"
            className="w-full rounded-2xl border border-slate-300 bg-white p-4 text-[15px] leading-7 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
          />
          <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-400">
            <span aria-hidden="true">⌨</span> Copy and paste are disabled: type your answer.
          </p>
          {sinCopiar.aviso && (
            <p role="alert" className="mt-1 rounded-lg bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">
              Copy and paste are not allowed in this exam. Please type your answer.
            </p>
          )}
          <p className={`mt-1 text-right text-xs ${t.min_palabras && palabras(textos[tarea]) < t.min_palabras ? 'text-slate-500' : 'text-emerald-700'}`}>
            {palabras(textos[tarea])} words{t.min_palabras ? ` · suggested minimum ${t.min_palabras}` : ''}
          </p>
        </div>
      )}

      <div className="sticky bottom-3 z-10 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-brand-100 bg-white/95 p-3 shadow-lg backdrop-blur">
        <p className="text-sm text-slate-600">
          {textos.filter((x) => x.trim()).length} of 2 tasks written
          {pocoTiempo && <span className="ml-2 font-semibold text-rose-700">Less than 5 minutes left</span>}
        </p>
        <div className="flex items-center gap-3">
          {error && (
            <span role="alert" className="text-sm text-rose-700">
              {error}
            </span>
          )}
          <Button
            type="button"
            disabled={enviando || textos.every((x) => !x.trim())}
            onClick={() => window.confirm('Submit your exam? You cannot change your answers afterwards.') && enviar(false)}
          >
            {enviando ? 'Submitting…' : 'Submit exam'}
          </Button>
        </div>
      </div>

      {aviso && (
        <div role="alertdialog" aria-modal="true" aria-labelledby="aviso-examen" className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <p id="aviso-examen" className="text-lg font-semibold text-rose-800">
              You left the exam page
            </p>
            <p className="mt-2 text-sm text-slate-700">
              This was recorded ({salidas} {salidas === 1 ? 'time' : 'times'}) and your teacher will see it when reviewing. The clock keeps running. Please stay on this page until you submit.
            </p>
            <div className="mt-4 flex justify-end">
              <Button type="button" onClick={() => setAviso(false)}>
                I understand
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
