import { useMemo, useState } from 'react'
import Card from '../ui/Card'
import Icon from '../ui/Icon'
import VisorLeccion from './VisorLeccion'
import { tipoLabel, totalLecciones } from '../../lib/recursos'

const iconoDe = (tipo) => (tipo === 'documento' ? 'doc' : tipo === 'enlace' ? 'link' : 'play')

// Casilla redonda «visto». Es un botón aparte para poder marcar sin abrir la lección.
function Casilla({ vista, onClick, titulo }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      aria-pressed={vista}
      aria-label={vista ? `Quitar «visto» de ${titulo}` : `Marcar «${titulo}» como visto`}
      className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition ${
        vista ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-300 bg-white text-transparent hover:border-brand-500 hover:text-brand-300'
      }`}
    >
      <Icon name="check" className="h-3.5 w-3.5" />
    </button>
  )
}

// Pestaña «Contenido» estilo plataforma de aprendizaje: visor grande y temario por secciones con casillas de «visto».
export default function ContenidoCurso({ secciones, cargando, elegida, onElegir, vistas, onMarcar, errorMarca }) {
  const lecciones = useMemo(() => secciones.flatMap((s) => s.lecciones), [secciones])
  const indice = Math.max(0, lecciones.findIndex((l) => l.id === elegida))
  const actual = lecciones[indice] ?? null
  const [cerradas, setCerradas] = useState(() => new Set())
  const [ampliado, setAmpliado] = useState(false)

  const total = totalLecciones(secciones)
  const nVistas = lecciones.filter((l) => vistas.has(l.id)).length
  const pct = total ? Math.round((nVistas / total) * 100) : 0
  const actualVista = actual ? vistas.has(actual.id) : false

  const alternar = (id) =>
    setCerradas((c) => {
      const n = new Set(c)
      if (!n.delete(id)) n.add(id)
      return n
    })

  // Al elegir una lección se abre su sección para que no quede escondida.
  const elegir = (l) => {
    const sec = secciones.find((s) => s.lecciones.some((x) => x.id === l.id))
    if (sec) setCerradas((c) => (c.has(sec.id) ? new Set([...c].filter((x) => x !== sec.id)) : c))
    onElegir(l.id)
  }
  const siguiente = lecciones[indice + 1]
  const marcarYSeguir = () => {
    onMarcar(actual.id, true)
    if (siguiente) elegir(siguiente)
  }

  if (cargando) return <p className="py-10 text-center text-sm text-slate-500">Cargando contenido…</p>

  const temario = (
    <Card className="overflow-hidden lg:sticky lg:top-4">
      <div className="border-b border-brand-100 bg-brand-50 px-5 py-4">
        <h2 className="text-lg font-semibold text-slate-900">Contenido del curso</h2>
        <p className="mt-0.5 text-sm text-slate-600">
          {secciones.length} {secciones.length === 1 ? 'sección' : 'secciones'} · {total} lecciones
        </p>
        <div className="mt-3">
          <div className="mb-1 flex justify-between text-sm">
            <span className="text-slate-600">
              <strong className="text-slate-900">{nVistas}</strong> de {total} vistas
            </span>
            <strong className="text-brand-700">{pct}%</strong>
          </div>
          <div role="progressbar" aria-label="Lecciones vistas" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} className="h-2.5 overflow-hidden rounded-full bg-white">
            <div className="h-full rounded-full bg-gradient-to-r from-brand-500 to-peach-500 transition-all duration-500" style={{ width: `${pct}%` }} />
          </div>
        </div>
      </div>
      {secciones.length === 0 ? (
        <p className="px-5 py-6 text-sm text-slate-400">Sin contenido todavía.</p>
      ) : (
        <div className="max-h-[calc(100vh-14rem)] min-h-[16rem] divide-y divide-brand-100 overflow-y-auto">
          {secciones.map((s, n) => {
            const abierta = !cerradas.has(s.id)
            const hechas = s.lecciones.filter((l) => vistas.has(l.id)).length
            return (
              <section key={s.id}>
                <button type="button" aria-expanded={abierta} onClick={() => alternar(s.id)} className="flex w-full items-center justify-between gap-3 bg-white px-5 py-4 text-left hover:bg-brand-50">
                  <span className="min-w-0">
                    <span className="block text-base font-semibold text-slate-900">
                      {n + 1}. {s.titulo}
                    </span>
                    <span className="mt-0.5 block text-sm text-slate-500">
                      {hechas} / {s.lecciones.length} {hechas === s.lecciones.length && s.lecciones.length > 0 ? '· ¡completa!' : 'vistas'}
                    </span>
                  </span>
                  <Icon name="down" className={`h-5 w-5 shrink-0 text-slate-400 transition ${abierta ? 'rotate-180' : ''}`} />
                </button>
                {abierta &&
                  (s.lecciones.length === 0 ? (
                    <p className="px-5 pb-4 text-sm text-slate-400">Sin lecciones aún.</p>
                  ) : (
                    <ul>
                      {s.lecciones.map((l) => {
                        const on = actual?.id === l.id
                        const vista = vistas.has(l.id)
                        return (
                          <li key={l.id}>
                            <div
                              role="button"
                              tabIndex={0}
                              onClick={() => elegir(l)}
                              onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), elegir(l))}
                              aria-current={on ? 'true' : undefined}
                              className={`flex w-full cursor-pointer items-start gap-3 border-l-4 px-5 py-3.5 text-left transition ${
                                on ? 'border-brand-600 bg-brand-50' : 'border-transparent hover:bg-slate-50'
                              }`}
                            >
                              <Casilla vista={vista} titulo={l.titulo} onClick={() => onMarcar(l.id, !vista)} />
                              <span className="min-w-0 flex-1">
                                <span className={`block text-[15px] leading-snug ${on ? 'font-semibold text-brand-800' : 'text-slate-800'} ${vista && !on ? 'text-slate-500' : ''}`}>{l.titulo}</span>
                                <span className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
                                  <Icon name={on ? 'play' : iconoDe(l.tipo)} className={`h-3.5 w-3.5 ${on ? 'text-brand-600' : 'text-slate-400'}`} /> {tipoLabel(l.tipo)}
                                </span>
                              </span>
                            </div>
                          </li>
                        )
                      })}
                    </ul>
                  ))}
              </section>
            )
          })}
        </div>
      )}
    </Card>
  )

  return (
    <div className={`grid gap-6 ${ampliado ? '' : 'lg:grid-cols-[minmax(0,1fr)_26rem]'}`}>
      <div className="min-w-0 space-y-4">
        {actual ? (
          <>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setAmpliado((x) => !x)}
                className="hidden items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium text-brand-700 hover:bg-brand-50 lg:inline-flex"
              >
                <Icon name="menu" className="h-3.5 w-3.5" /> {ampliado ? 'Temario al lado' : 'Visor a todo el ancho'}
              </button>
            </div>
            <Card className="p-3 sm:p-5">
              <VisorLeccion leccion={actual} />
            </Card>

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-brand-100 bg-white p-3 shadow-sm">
              <button
                type="button"
                disabled={indice === 0}
                onClick={() => elegir(lecciones[indice - 1])}
                className="inline-flex items-center gap-1 rounded-full border border-brand-200 px-4 py-2 text-sm font-medium text-brand-700 hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Icon name="back" className="h-4 w-4" /> Anterior
              </button>

              <div className="flex flex-wrap items-center gap-2">
                {actualVista ? (
                  <>
                    <button
                      type="button"
                      onClick={() => onMarcar(actual.id, false)}
                      className="inline-flex items-center gap-2 rounded-full bg-brand-100 px-4 py-2 text-sm font-semibold text-brand-700 hover:bg-brand-200"
                      title="Quitar la marca de visto"
                    >
                      <Icon name="check" className="h-4 w-4" /> Visto
                    </button>
                    {siguiente && (
                      <button type="button" onClick={() => elegir(siguiente)} className="inline-flex items-center gap-1 rounded-full bg-brand-600 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-700">
                        Siguiente <Icon name="back" className="h-4 w-4 rotate-180" />
                      </button>
                    )}
                  </>
                ) : (
                  <>
                    <button type="button" onClick={() => onMarcar(actual.id, true)} className="inline-flex items-center gap-2 rounded-full border border-brand-200 px-4 py-2 text-sm font-semibold text-brand-700 hover:bg-brand-50">
                      <Icon name="check" className="h-4 w-4" /> Marcar como visto
                    </button>
                    <button type="button" onClick={marcarYSeguir} className="inline-flex items-center gap-1 rounded-full bg-brand-600 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-700">
                      {siguiente ? 'Visto y siguiente' : 'Marcar como visto'} {siguiente && <Icon name="back" className="h-4 w-4 rotate-180" />}
                    </button>
                  </>
                )}
              </div>
            </div>
            <p className="text-center text-xs text-slate-400">
              Lección {indice + 1} de {lecciones.length}
            </p>
            {errorMarca && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{errorMarca}</p>}
          </>
        ) : (
          <Card className="p-10 text-center">
            <Icon name="play" className="mx-auto h-12 w-12 text-brand-200" />
            <p className="mt-3 text-sm text-slate-500">Tu docente aún no ha publicado contenido en este curso. Vuelve pronto.</p>
          </Card>
        )}
      </div>

      {temario}
    </div>
  )
}
