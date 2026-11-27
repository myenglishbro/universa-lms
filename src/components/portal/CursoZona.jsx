import { useEffect, useMemo, useState } from 'react'
import Icon from '../ui/Icon'
import { claseDeEnlace, incrustarDe, proveedorDe } from '../../lib/recursos'
import { tituloModulo } from '../../lib/zonaCurso'

// La zona presentada como un curso virtual: módulos (acordeón) con lecciones que son videos o documentos, y un bloque de recursos de consulta.
// Todo se abre en el mismo visor. El progreso cuenta solo las lecciones y se guarda en este navegador:
// no hay forma fiable de saber cuándo termina un video incrustado, así que lo marca la persona o el botón «Next».
const leerVistos = (clave) => {
  try {
    const v = JSON.parse(localStorage.getItem(clave) ?? '[]')
    return Array.isArray(v) ? v : []
  } catch {
    return []
  }
}

// Marca de estado de una fila: completada, en curso, video o documento.
function Marca({ item, activa, vista }) {
  const video = item.tipoLeccion === 'video'
  const clase = vista ? 'bg-emerald-500 text-white' : activa ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-500 group-hover/fila:bg-brand-100 group-hover/fila:text-brand-700'
  return (
    <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full transition-colors ${clase}`}>
      <Icon name={vista ? 'check' : video ? 'play' : 'doc'} className={`h-3 w-3 ${video && !vista ? 'ml-px' : ''}`} />
    </span>
  )
}

export default function CursoZona({ modulos, gruposRecursos, zona, titulo, subtitulo }) {
  const clave = `universa-vistos-${zona}`
  const lecciones = useMemo(() => modulos.flatMap((m) => m.items), [modulos])
  const todos = useMemo(() => [...lecciones, ...gruposRecursos.flatMap((g) => g.items)], [lecciones, gruposRecursos])
  const [vistos, setVistos] = useState(() => leerVistos(clave))
  const [actualId, setActualId] = useState(() => (lecciones.find((l) => !vistos.includes(l.id)) ?? todos[0])?.id)
  const [cerrados, setCerrados] = useState(() => new Set())
  const [busqueda, setBusqueda] = useState('')
  const [lista, setLista] = useState(true) // mostrar u ocultar la lista lateral

  useEffect(() => {
    try {
      localStorage.setItem(clave, JSON.stringify(vistos))
    } catch {
      /* sin almacenamiento: el progreso solo vive mientras la página está abierta */
    }
  }, [vistos, clave])

  const idx = Math.max(0, todos.findIndex((l) => l.id === actualId))
  const actual = todos[idx]
  const esVisto = (id) => vistos.includes(id)
  const hechos = useMemo(() => lecciones.filter((l) => vistos.includes(l.id)).length, [lecciones, vistos])
  const pct = lecciones.length ? Math.round((hechos / lecciones.length) * 100) : 0

  // Al cambiar de elemento se abre su grupo.
  const grupoActual = actual?.categoria
  useEffect(() => {
    if (!grupoActual) return
    setCerrados((c) => {
      if (!c.has(grupoActual)) return c
      const n = new Set(c)
      n.delete(grupoActual)
      return n
    })
  }, [grupoActual])

  // Búsqueda: deja solo lo que coincide (y abre esos grupos).
  const t = busqueda.trim().toLowerCase()
  const coincide = (l) => !t || `${l.titulo} ${l.descripcion ?? ''} ${l.categoria}`.toLowerCase().includes(t)
  const filtrar = (grupos) => grupos.map((g) => ({ ...g, visibles: g.items.filter(coincide) })).filter((g) => g.visibles.length > 0)
  const modulosVis = filtrar(modulos)
  const recursosVis = filtrar(gruposRecursos)

  if (!actual) return null

  const embed = incrustarDe({ url: actual.url, proveedor: proveedorDe(actual.url) })
  const esVideo = actual.tipoLeccion === 'video'
  const k = claseDeEnlace(actual.url)
  const visto = esVisto(actual.id)
  const numeroLeccion = lecciones.findIndex((l) => l.id === actual.id) + 1

  const alternar = () => setVistos((v) => (v.includes(actual.id) ? v.filter((x) => x !== actual.id) : [...v, actual.id]))
  const ir = (i) => setActualId(todos[i].id)
  const siguiente = () => {
    if (!actual.recurso) setVistos((v) => (v.includes(actual.id) ? v : [...v, actual.id]))
    if (idx < todos.length - 1) ir(idx + 1)
  }
  const alternarGrupo = (nombre) =>
    setCerrados((c) => {
      const n = new Set(c)
      if (n.has(nombre)) n.delete(nombre)
      else n.add(nombre)
      return n
    })

  const renderFila = (l) => {
    const activa = l.id === actual.id
    const hecho = !l.recurso && esVisto(l.id)
    return (
      <li key={l.id}>
        <button
          type="button"
          onClick={() => setActualId(l.id)}
          aria-current={activa ? 'true' : undefined}
          className={`group/fila relative flex w-full items-center gap-2.5 rounded-xl py-1.5 pl-3 pr-2 text-left transition ${activa ? 'bg-brand-50' : 'hover:bg-slate-50'}`}
        >
          {activa && <span aria-hidden="true" className="absolute inset-y-1.5 left-0 w-1 rounded-full bg-brand-600" />}
          <Marca item={l} activa={activa} vista={hecho} />
          <span className={`min-w-0 flex-1 text-[13px] leading-snug ${activa ? 'font-semibold text-brand-800' : hecho ? 'text-slate-500' : 'font-medium text-slate-700'}`}>
            <span className="line-clamp-2">{l.titulo}</span>
          </span>
        </button>
      </li>
    )
  }

  return (
    <section aria-label={titulo} className="mb-10">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900">{titulo}</h2>
          <p className="text-sm text-slate-500">{subtitulo}</p>
        </div>
        <div className="flex items-center gap-3">
          {lecciones.length > 0 && (
            <div className="flex min-w-44 items-center gap-3">
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-brand-100" role="progressbar" aria-label="Course progress" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
                <div className="h-full rounded-full bg-gradient-to-r from-brand-500 to-peach-500 transition-all duration-500" style={{ width: `${pct}%` }} />
              </div>
              <span className="text-sm font-semibold tabular-nums text-brand-700">
                {hechos}/{lecciones.length}
              </span>
            </div>
          )}
          <button
            type="button"
            onClick={() => setLista((v) => !v)}
            aria-pressed={lista}
            className="hidden items-center gap-2 rounded-full border border-brand-100 bg-white px-3.5 py-1.5 text-sm font-medium text-brand-700 shadow-sm transition hover:bg-brand-50 lg:inline-flex"
          >
            <Icon name="list" className="h-4 w-4" /> {lista ? 'Hide content' : 'Show content'}
          </button>
        </div>
      </div>

      {lecciones.length > 0 && hechos === lecciones.length && (
        <p className="mb-4 flex items-center gap-2 rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
          <Icon name="check" className="h-4 w-4" /> You have completed the whole course. You can open any lesson again whenever you need.
        </p>
      )}

      <div className={`grid items-start gap-5 ${lista ? 'lg:grid-cols-[minmax(0,1fr)_19rem]' : ''}`}>
        {/* Visor */}
        <div className="overflow-hidden rounded-3xl border border-brand-100 bg-white shadow-sm">
          <div className={esVideo ? 'aspect-video bg-black' : 'h-[68vh] min-h-[22rem] bg-slate-100'}>
            {embed ? (
              <iframe key={actual.id} src={embed} title={actual.titulo} className="h-full w-full" allow="fullscreen; picture-in-picture; autoplay" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" />
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-3 bg-gradient-to-br from-brand-700 to-brand-900 p-6 text-center text-white">
                <Icon name={esVideo ? 'play' : 'link'} className="h-10 w-10 text-peach-200" />
                <p className="text-sm text-brand-100">{esVideo ? 'This video opens in another tab.' : 'This one opens in another tab.'}</p>
                <a href={actual.url} target="_blank" rel="noopener noreferrer" className="rounded-full bg-white px-5 py-2 text-sm font-semibold text-brand-700 hover:bg-brand-50">
                  {esVideo ? 'Watch video' : 'Open'}
                </a>
              </div>
            )}
          </div>
          <div className="p-5">
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-semibold uppercase tracking-wider text-brand-600">
              <span>{actual.recurso ? 'Resource' : `Lesson ${numeroLeccion} of ${lecciones.length}`}</span>
              <span aria-hidden="true">·</span>
              <span>{tituloModulo(actual.categoria || 'General')}</span>
              <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[10px] normal-case tracking-normal text-brand-700">{esVideo ? 'Video' : (k?.etiqueta ?? 'Document')}</span>
            </p>
            <h3 className="mt-1 text-lg font-bold leading-snug text-slate-900">{actual.titulo}</h3>
            {actual.descripcion && <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-slate-600">{actual.descripcion}</p>}

            <div className="mt-5 flex flex-wrap items-center gap-2">
              {!actual.recurso && (
                <button
                  type="button"
                  onClick={alternar}
                  aria-pressed={visto}
                  className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition ${visto ? 'border-emerald-300 bg-emerald-50 text-emerald-800' : 'border-brand-200 text-brand-700 hover:bg-brand-50'}`}
                >
                  <Icon name="check" className="h-4 w-4" /> {visto ? 'Completed' : 'Mark as completed'}
                </button>
              )}
              {!esVideo && (
                <a href={actual.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-medium text-slate-500 hover:text-brand-700">
                  <Icon name="external" className="h-4 w-4" /> Open in a new tab
                </a>
              )}
              <span className="ml-auto flex items-center gap-2">
                <button type="button" onClick={() => ir(idx - 1)} disabled={idx === 0} className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40">
                  <span aria-hidden="true">←</span> Previous
                </button>
                <button
                  type="button"
                  onClick={siguiente}
                  disabled={idx === todos.length - 1}
                  className="inline-flex items-center gap-1.5 rounded-full bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-brand-600/20 transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
                >
                  Next <span aria-hidden="true">→</span>
                </button>
              </span>
            </div>
          </div>
        </div>

        {/* Lista compacta: módulos, lecciones y recursos */}
        <aside className={`flex-col overflow-hidden rounded-3xl border border-brand-100 bg-white shadow-sm lg:sticky lg:top-4 lg:max-h-[calc(100dvh-2rem)] ${lista ? 'flex' : 'flex lg:hidden'}`}>
          <div className="flex items-center gap-2 border-b border-slate-100 px-3 py-2.5">
            <span className="px-1 text-sm font-bold text-slate-900">Content</span>
            {todos.length > 5 ? (
              <div className="relative ml-auto min-w-0 flex-1">
                <Icon name="search" className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <input
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  placeholder="Search"
                  aria-label="Search lessons and resources"
                  className="h-8 w-full rounded-full border-0 bg-slate-100 pl-8 pr-3 text-[13px] text-slate-800 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-200"
                />
              </div>
            ) : (
              <span className="ml-auto text-xs text-slate-400">
                {lecciones.length > 0 ? `${lecciones.length} lessons` : ''}
                {lecciones.length > 0 && todos.length > lecciones.length ? ' · ' : ''}
                {todos.length > lecciones.length ? `${todos.length - lecciones.length} resources` : ''}
              </span>
            )}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain py-1 [scrollbar-width:thin]">
            {t && modulosVis.length === 0 && recursosVis.length === 0 && <p className="px-5 py-6 text-center text-sm text-slate-500">Nothing matches your search.</p>}

            {modulosVis.map((m) => {
              const hechosM = m.items.filter((l) => esVisto(l.id)).length
              const abierto = Boolean(t) || !cerrados.has(m.nombre)
              const completo = hechosM === m.items.length
              const numero = modulos.findIndex((x) => x.nombre === m.nombre) + 1
              return (
                <div key={m.nombre} className="px-1.5">
                  <button type="button" onClick={() => alternarGrupo(m.nombre)} aria-expanded={abierto} className="flex w-full items-center gap-2.5 rounded-xl px-2 py-2 text-left transition hover:bg-slate-50">
                    <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${completo ? 'bg-emerald-100 text-emerald-700' : 'bg-brand-100 text-brand-700'}`}>
                      {completo ? <Icon name="check" className="h-3.5 w-3.5" /> : numero}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-slate-900">{tituloModulo(m.nombre)}</span>
                    <span className="text-[11px] font-medium tabular-nums text-slate-400">
                      {hechosM}/{m.items.length}
                    </span>
                    <span aria-hidden="true" className={`text-sm leading-none text-slate-300 transition-transform ${abierto ? 'rotate-90' : ''}`}>
                      ›
                    </span>
                  </button>
                  {abierto && <ol className="mb-1 ml-3 space-y-0.5 border-l border-slate-100 pl-1">{m.visibles.map(renderFila)}</ol>}
                </div>
              )
            })}

            {recursosVis.length > 0 && (
              <div className="mt-1 border-t border-slate-100 px-1.5 pt-2">
                <p className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Resources</p>
                {recursosVis.map((g) => {
                  const abierto = Boolean(t) || !cerrados.has(g.nombre)
                  return (
                    <div key={g.nombre}>
                      <button type="button" onClick={() => alternarGrupo(g.nombre)} aria-expanded={abierto} className="flex w-full items-center gap-2.5 rounded-xl px-2 py-2 text-left transition hover:bg-slate-50">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-peach-100 text-peach-700">
                          <Icon name="doc" className="h-3.5 w-3.5" />
                        </span>
                        <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-slate-900">{g.nombre}</span>
                        <span className="text-[11px] font-medium tabular-nums text-slate-400">{g.items.length}</span>
                        <span aria-hidden="true" className={`text-sm leading-none text-slate-300 transition-transform ${abierto ? 'rotate-90' : ''}`}>
                          ›
                        </span>
                      </button>
                      {abierto && <ol className="mb-1 ml-3 space-y-0.5 border-l border-slate-100 pl-1">{g.visibles.map(renderFila)}</ol>}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </aside>
      </div>
    </section>
  )
}
