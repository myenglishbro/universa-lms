import { useCallback, useState } from 'react'
import Badge from '../ui/Badge'
import Card from '../ui/Card'
import Icon from '../ui/Icon'
import EjercicioJugador from './EjercicioJugador'
import MiFormative from './MiFormative'
import useCarga from '../../hooks/useCarga'
import { TONOS, fmtPuntaje, tipoDe } from '../../lib/ejercicios'
import { etiquetaFormative } from '../../lib/formativeBanco'
import { formatFecha } from '../../lib/salones'
import * as servicioReal from '../../services/ejercicios'

function Estado({ a }) {
  const e = a.entrega
  if (!e) return <Badge color="peach">Por hacer</Badge>
  if (e.estado === 'pendiente') return <Badge color="slate">Enviado · en revisión</Badge>
  // En una actividad oficial este es el resultado del ejercicio; la nota de la unidad se calcula sola con los 5 elementos.
  return <Badge color="brand">{a.formative ? 'Resultado' : 'Nota'} {fmtPuntaje(e.puntaje)}</Badge>
}

// Pestaña «Ejercicios» del estudiante: lo asignado, para resolver y ver su resultado.
export default function EjerciciosEstudiante({ salonId, servicio = servicioReal }) {
  const cargar = useCallback(() => servicio.misEjercicios(salonId), [servicio, salonId])
  const { datos: lista, cargando, error, recargar } = useCarga(cargar, [])
  const [abierto, setAbierto] = useState(null)

  const actual = lista.find((a) => a.id === abierto)
  if (actual) {
    const t = tipoDe(actual.tipo)
    return (
      <>
        <button
          onClick={() => {
            setAbierto(null)
            recargar()
          }}
          className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-brand-700"
        >
          <Icon name="back" className="h-4 w-4" /> Mis ejercicios
        </button>
        <div className="mb-5 flex items-center gap-3">
          <span className={`flex h-12 w-12 items-center justify-center rounded-xl ${TONOS[t.tono]}`}>
            <Icon name={t.icono} className="h-6 w-6" />
          </span>
          <div>
            <h2 className="text-2xl font-bold text-brand-800">{actual.titulo}</h2>
            <p className="text-sm text-slate-500">
              {t.label}
              {actual.fecha_limite && ` · entrega hasta el ${formatFecha(actual.fecha_limite)}`}
            </p>
            <p className={`text-sm font-medium ${actual.formative ? 'text-brand-700' : 'text-slate-400'}`}>{etiquetaFormative(actual.formative)}</p>
            {actual.formative && <p className="text-xs text-slate-500">Cuenta para tu Formative: se suma sola a tu avance. Cuando completes los 5 elementos de la unidad, la nota aparece en «Mis calificaciones».</p>}
          </div>
        </div>
        <EjercicioJugador
          key={actual.id}
          ejercicio={actual}
          entrega={actual.entrega}
          onEnviado={(respuestas, audio) =>
            servicio.entregarEjercicio(actual.id, respuestas, audio)
          }
        />
      </>
    )
  }

  if (cargando) return <p className="py-10 text-center text-sm text-slate-500">Cargando tus ejercicios…</p>
  if (error) return <p className="text-sm text-red-600">No se pudieron cargar tus ejercicios: {error}</p>
  if (lista.length === 0)
    return (
      <div className="rounded-2xl border border-dashed border-brand-200 bg-white px-6 py-12 text-center">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-100 text-brand-600">
          <Icon name="pen" className="h-7 w-7" />
        </span>
        <p className="mt-4 text-base font-semibold text-slate-900">Aún no tienes ejercicios</p>
        <p className="mt-1 text-sm text-slate-500">Cuando tu docente te asigne uno, aparecerá aquí.</p>
      </div>
    )

  const porHacer = lista.filter((a) => !a.entrega).length
  return (
    <>
      <MiFormative salonId={salonId} servicio={servicio} />
      <p className="mb-4 text-sm text-slate-600">
        {porHacer > 0 ? (
          <>
            Tienes <strong>{porHacer}</strong> {porHacer === 1 ? 'ejercicio por hacer' : 'ejercicios por hacer'}.
          </>
        ) : (
          '¡Estás al día con tus ejercicios!'
        )}
      </p>
      <div className="grid gap-3 lg:grid-cols-2">
        {lista.map((a) => {
          const t = tipoDe(a.tipo)
          return (
            <button key={a.id} type="button" onClick={() => setAbierto(a.id)} className="text-left">
              <Card className="flex items-center gap-4 p-4 transition hover:-translate-y-0.5 hover:shadow-md">
                <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${TONOS[t.tono]}`}>
                  <Icon name={t.icono} className="h-6 w-6" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-base font-semibold text-slate-900">{a.titulo}</span>
                  <span className="block text-xs text-slate-500">
                    {t.label}
                    {a.fecha_limite && ` · hasta ${formatFecha(a.fecha_limite)}`}
                  </span>
                  <span className={`block text-xs font-medium ${a.formative ? 'text-brand-700' : 'text-slate-400'}`}>{etiquetaFormative(a.formative)}</span>
                </span>
                <Estado a={a} />
              </Card>
            </button>
          )
        })}
      </div>
    </>
  )
}
