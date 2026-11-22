import { useEffect, useState } from 'react'
import Button from '../ui/Button'
import Modal from '../ui/Modal'
import Field from '../ui/Field'
import Icon from '../ui/Icon'
import { ESCALA, PREGUNTAS } from '../../lib/encuestas'
import { formatFecha } from '../../lib/salones'
import * as servicioReal from '../../services/encuestas'

const omitida = (id) => `universa:encuesta-omitida:${id}`
const yaOmitida = (id) => {
  try {
    return sessionStorage.getItem(omitida(id)) === '1'
  } catch {
    return false
  }
}

function Likert({ pregunta, valor, onChange }) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-medium text-slate-800">{pregunta.label}</legend>
      <div role="radiogroup" aria-label={pregunta.label} className="grid grid-cols-5 gap-1.5">
        {ESCALA.map((e) => {
          const on = valor === e.valor
          return (
            <button
              key={e.valor}
              type="button"
              role="radio"
              aria-checked={on}
              aria-label={`${e.valor} · ${e.texto}`}
              onClick={() => onChange(e.valor)}
              className={`flex min-h-12 flex-col items-center justify-center rounded-xl border text-sm font-semibold transition ${
                on ? 'border-brand-600 bg-brand-600 text-white shadow-sm' : 'border-slate-200 bg-white text-slate-600 hover:border-brand-300 hover:bg-brand-50'
              }`}
            >
              {e.valor}
            </button>
          )
        })}
      </div>
      <div className="mt-1 flex justify-between text-[11px] text-slate-400">
        <span>{ESCALA[0].texto}</span>
        <span>{ESCALA[4].texto}</span>
      </div>
    </fieldset>
  )
}

// Pop-up de «¿cómo estuvo tu clase?»: aparece al entrar al portal si hay una clase reciente a la que asistió y no ha calificado.
// «Not now» la oculta solo en esta sesión del navegador; la clase sigue disponible 7 días.
export default function EncuestaClase({ servicio = servicioReal }) {
  const [pendiente, setPendiente] = useState(null)
  const [resp, setResp] = useState({})
  const [comentario, setComentario] = useState('')
  const [estado, setEstado] = useState('pregunta') // pregunta | enviando | gracias
  const [error, setError] = useState('')

  // Se revisa al entrar, al volver a la pestaña y cada 5 minutos: así aparece también si el estudiante ya tenía el portal abierto
  // cuando empezó la clase (el docente puede pedirle que responda durante ella).
  useEffect(() => {
    let vivo = true
    const revisar = () => {
      if (document.visibilityState === 'hidden') return
      servicio
        .encuestaPendiente()
        .then((p) => vivo && p && !yaOmitida(p.sesion_id) && setPendiente((actual) => actual ?? p))
        .catch(() => {}) // la encuesta es un extra: si falla, el portal sigue igual
    }
    revisar()
    const cada = setInterval(revisar, 5 * 60 * 1000)
    document.addEventListener('visibilitychange', revisar)
    return () => {
      vivo = false
      clearInterval(cada)
      document.removeEventListener('visibilitychange', revisar)
    }
  }, [servicio])

  if (!pendiente) return null

  const completa = PREGUNTAS.every((p) => resp[p.id])
  const cerrar = () => {
    if (estado === 'pregunta')
      try {
        sessionStorage.setItem(omitida(pendiente.sesion_id), '1')
      } catch {
        /* sin almacenamiento: reaparece al recargar */
      }
    setPendiente(null)
  }
  const enviar = async (e) => {
    e.preventDefault()
    setEstado('enviando')
    setError('')
    try {
      await servicio.guardarEncuesta(pendiente.sesion_id, resp, comentario.trim())
      setEstado('gracias')
    } catch (err) {
      setError(err.message)
      setEstado('pregunta')
    }
  }

  return (
    <Modal title={estado === 'gracias' ? 'Thank you!' : 'How was your class?'} onClose={cerrar} wide>
      {estado === 'gracias' ? (
        <div className="py-4 text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-brand-100 text-brand-600">
            <Icon name="check" className="h-7 w-7" />
          </span>
          <p className="mt-3 text-base font-semibold text-slate-900">Your feedback helps us improve every class.</p>
          <p className="mt-1 text-sm text-slate-500">Only the academy’s administration sees your answers. Your teacher does not.</p>
          <Button className="mt-5" onClick={cerrar}>
            Close
          </Button>
        </div>
      ) : (
        <form onSubmit={enviar} className="space-y-5">
          <p className="text-sm text-slate-600">
            {pendiente.salon}
            {pendiente.docente ? ` · ${pendiente.docente}` : ''} · {formatFecha(pendiente.fecha)}
            {pendiente.tema ? ` · ${pendiente.tema}` : ''}
          </p>
          {PREGUNTAS.map((p) => (
            <Likert key={p.id} pregunta={p} valor={resp[p.id]} onChange={(v) => setResp((r) => ({ ...r, [p.id]: v }))} />
          ))}
          <Field label="Anything you would like to add? (optional)" as="textarea" rows="3" maxLength={1000} value={comentario} onChange={(e) => setComentario(e.target.value)} placeholder="What went well? What could be better?" />
          <p className="flex items-center gap-1.5 text-xs text-slate-400">
            <Icon name="lock" className="h-3.5 w-3.5" /> Only administration sees your answers, not your teacher.
          </p>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="secondary" onClick={cerrar}>
              Not now
            </Button>
            <Button type="submit" disabled={!completa || estado === 'enviando'}>
              {estado === 'enviando' ? 'Sending…' : 'Send feedback'}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  )
}
