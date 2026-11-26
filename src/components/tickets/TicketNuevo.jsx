import { useState } from 'react'
import Button from '../ui/Button'
import Field from '../ui/Field'
import Icon from '../ui/Icon'
import Modal from '../ui/Modal'
import { AREAS, GUIA_PRIORIDAD, GUIA_TIPO, PLANTILLAS, PRIORIDADES, TIPOS, hoyLima } from '../../lib/tickets'
import { crearTicket } from '../../services/tickets'
import ResponsablesPicker from './ResponsablesPicker'

const sumarDias = (fecha, n) => {
  const d = new Date(`${fecha}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

function Seccion({ numero, titulo, children }) {
  return (
    <section>
      <h3 className="mb-1.5 flex items-center gap-2 text-[13px] font-semibold text-slate-900">
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-100 text-[11px] font-bold text-brand-700">{numero}</span>
        {titulo}
      </h3>
      {children}
    </section>
  )
}

// Opción como tarjeta: icono, nombre y explicación siempre visibles; la elegida se resalta.
function Opcion({ activo, onClick, icono, colorIcono = 'bg-brand-100 text-brand-700', titulo, texto }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={activo}
      onClick={onClick}
      className={`relative flex h-full items-center gap-2.5 rounded-xl border px-2.5 py-2 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
        activo ? 'border-brand-500 bg-brand-50/60 ring-1 ring-brand-500' : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
      }`}
    >
      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${colorIcono}`}>
        <Icon name={icono} className="h-5 w-5" />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-slate-900">{titulo}</span>
        <span className="block text-[11px] leading-snug text-slate-500">{texto}</span>
      </span>
      {activo && (
        <span aria-hidden className="absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-brand-600 text-white">
          <Icon name="check" className="h-3 w-3" />
        </span>
      )}
    </button>
  )
}

// `personal`: usuarios administrativos activos para elegir responsable (opcional).
export default function TicketNuevo({ personal, miId, onCerrar, onCreado }) {
  const [f, setF] = useState({ titulo: '', descripcion: PLANTILLAS.tarea, tipo: 'tarea', area: '', prioridad: 'media', responsables: [], fecha_limite: '' })
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)
  const hoy = hoyLima()
  const poner = (k, v) => setF((p) => ({ ...p, [k]: v }))
  const cambiar = (k) => (e) => poner(k, e.target.value)
  // Al cambiar el tipo se propone la plantilla del nuevo tipo, salvo que la descripción ya tenga texto propio.
  const cambiarTipo = (tipo) => {
    setF((p) => ({ ...p, tipo, descripcion: !p.descripcion.trim() || p.descripcion === PLANTILLAS[p.tipo] ? PLANTILLAS[tipo] ?? '' : p.descripcion }))
  }

  const guardar = async (e) => {
    e.preventDefault()
    if (guardando) return
    setGuardando(true)
    setError('')
    try {
      // Una plantilla sin completar no se guarda como descripción.
      const t = await crearTicket({ ...f, descripcion: f.descripcion.trim() === (PLANTILLAS[f.tipo] ?? '').trim() ? '' : f.descripcion })
      onCreado(t)
    } catch (err) {
      setError(err.message)
      setGuardando(false)
    }
  }

  return (
    <Modal title="New ticket" wide="xl" onClose={onCerrar}>
      <form onSubmit={guardar} className="space-y-4">
        <Seccion numero="1" titulo="What needs to be done?">
          <Field label="Title" value={f.titulo} onChange={cambiar('titulo')} maxLength={200} required autoFocus placeholder="E.g.: Schedule placement exam" />
        </Seccion>

        <Seccion numero="2" titulo="Which area is it for?">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="radiogroup" aria-label="Area">
            {AREAS.map((a) => {
              const on = f.area === a.value
              return (
                <button
                  key={a.value}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => poner('area', a.value)}
                  className={`group relative flex flex-col items-start gap-1 rounded-xl border px-3 py-2.5 text-left transition duration-150 active:scale-[0.97] focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${on ? 'border-brand-500 bg-brand-50/60 ring-1 ring-brand-500' : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'}`}
                >
                  <span className={`inline-flex h-8 w-8 items-center justify-center rounded-lg ring-1 ring-inset transition-transform duration-200 group-hover:scale-110 group-hover:-rotate-6 ${on ? 'scale-110' : ''} ${a.chip}`}>
                    <Icon name={a.icono} className="h-4 w-4" />
                  </span>
                  <span className="text-sm font-semibold leading-tight text-slate-900">{a.label}</span>
                  <span className="text-[11px] leading-snug text-slate-500">{a.cuando}</span>
                  {on && (
                    <span aria-hidden className="absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-brand-600 text-white">
                      <Icon name="check" className="h-3 w-3" />
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </Seccion>

        <div className="grid gap-4 lg:grid-cols-2">
        <Seccion numero="3" titulo="Type of ticket">
          <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Type of ticket">
            {TIPOS.map((t) => (
              <Opcion key={t.value} activo={f.tipo === t.value} onClick={() => cambiarTipo(t.value)} icono={GUIA_TIPO[t.value].icono} titulo={t.label} texto={GUIA_TIPO[t.value].cuando} />
            ))}
          </div>
        </Seccion>

        <Seccion numero="4" titulo="How urgent is it?">
          <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Priority">
            {PRIORIDADES.slice()
              .reverse()
              .map((p) => (
                <Opcion key={p.value} activo={f.prioridad === p.value} onClick={() => poner('prioridad', p.value)} icono={GUIA_PRIORIDAD[p.value].icono} colorIcono={GUIA_PRIORIDAD[p.value].color} titulo={p.label} texto={GUIA_PRIORIDAD[p.value].cuando} />
              ))}
          </div>
        </Seccion>
        </div>

        <Seccion numero="5" titulo="Details">
          <Field as="textarea" rows={5} label="Description" value={f.descripcion} onChange={cambiar('descripcion')} maxLength={5000} hint="A template is suggested: fill it in or edit it." />
        </Seccion>

        <Seccion numero="6" titulo="Who and when">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Field type="date" label="Due date (optional)" value={f.fecha_limite} onChange={cambiar('fecha_limite')} />
              <div className="mt-2 flex flex-wrap gap-1.5">
                {[['Today', hoy], ['Tomorrow', sumarDias(hoy, 1)], ['In a week', sumarDias(hoy, 7)]].map(([label, fecha]) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => poner('fecha_limite', fecha)}
                    className={`rounded-full px-3 py-1 text-xs font-medium ${f.fecha_limite === fecha ? 'bg-brand-600 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-100'}`}
                  >
                    {label}
                  </button>
                ))}
                {f.fecha_limite && (
                  <button type="button" onClick={() => poner('fecha_limite', '')} className="rounded-full px-3 py-1 text-xs font-medium text-slate-500 hover:text-slate-800">
                    Clear
                  </button>
                )}
              </div>
            </div>
            <ResponsablesPicker personal={personal} valor={f.responsables} miId={miId} onChange={(responsables) => poner('responsables', responsables)} />
          </div>
        </Seccion>

        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-4">
          {!f.area && <span className="mr-auto text-xs text-peach-700">Choose the area this ticket is for.</span>}
          <Button type="button" variant="ghost" onClick={onCerrar}>
            Cancel
          </Button>
          <Button type="submit" disabled={guardando || !f.titulo.trim() || !f.area}>
            {guardando ? 'Creating…' : 'Create ticket'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
