import { useEffect, useMemo, useRef, useState } from 'react'
import { PAGINAS, PROGRAMAS_MENU, RUTAS_LEGALES, wa } from '../data/paginas'
import { cargarLanding } from '../services/cms'

const boton = {
  primario: 'bg-peach-500 text-brand-900 hover:bg-peach-200',
  claro: 'border border-white/40 text-white hover:bg-white/10',
  morado: 'bg-brand-600 text-white hover:bg-brand-700',
  indigo: 'bg-brand-600 text-white uppercase tracking-wide hover:bg-brand-700',
  contorno: 'border border-brand-200 bg-white text-brand-700 hover:border-brand-500 hover:bg-brand-50',
}
const base = 'inline-flex h-12 items-center justify-center rounded-full px-6 text-[15px] font-semibold transition duration-200 hover:-translate-y-px active:translate-y-0 active:scale-[0.98]'
const tarjeta = 'rounded-2xl border border-slate-200 bg-white p-7 transition duration-200 hover:-translate-y-0.5 hover:border-brand-500/40 hover:shadow-md'
const soles = (n) => `S/. ${Number.isInteger(n) ? n : n.toFixed(2)}`

// ——— Rutas por hash (#/nosotros). El hash «#ingresar» lo atiende App (login). ———
const rutaDeHash = (hash) => (hash.startsWith('#/') ? hash.slice(1).replace(/\/+$/, '') || '/' : '/')
function useRuta() {
  const [ruta, setRuta] = useState(() => rutaDeHash(window.location.hash))
  useEffect(() => {
    const alCambiar = () => setRuta(rutaDeHash(window.location.hash))
    window.addEventListener('hashchange', alCambiar)
    return () => window.removeEventListener('hashchange', alCambiar)
  }, [])
  return ruta
}

// Enlace interno (#/ruta) o externo (se abre en otra pestaña).
function A({ href, className, children, ...props }) {
  const nueva = /^https?:/.test(href)
  return (
    <a href={href} className={className} {...(nueva ? { target: '_blank', rel: 'noreferrer' } : {})} {...props}>
      {children}
    </a>
  )
}

function Marca() {
  return (
    <img src="/landing/logo.png" alt="Universa" width="800" height="172" className="h-9 w-auto" />
  )
}

function Cabecera({ eyebrow, titulo, subtitulo, claro, izq }) {
  if (!titulo && !subtitulo) return null
  return (
    <div className={`mb-10 max-w-2xl ${izq ? '' : 'mx-auto text-center'}`}>
      {eyebrow && <p className={`mb-2 text-xs font-bold uppercase tracking-[0.25em] ${claro ? 'text-peach-200' : 'text-brand-600'}`}>{eyebrow}</p>}
      {titulo && <h2 className={`text-3xl font-extrabold leading-[1.1] tracking-tight sm:text-5xl ${claro ? 'text-white' : 'text-slate-900'}`}>{titulo}</h2>}
      {subtitulo && <p className={`mt-3 text-base ${claro ? 'text-brand-100' : 'text-slate-600'}`}>{subtitulo}</p>}
    </div>
  )
}

const contenedor = 'mx-auto max-w-6xl px-4 sm:px-6'
const columnas = (n) => (n % 3 === 0 ? 'lg:grid-cols-3' : n === 2 ? 'sm:grid-cols-2' : n === 4 ? 'sm:grid-cols-2 lg:grid-cols-4' : 'sm:grid-cols-2 lg:grid-cols-3')

// ——— Secciones ———
// Carrusel de portada: diapositivas de imagen (escritorio y móvil). Avance automático que se detiene al pasar el cursor,
// con botón de pausa y sin movimiento si la persona pidió menos animación.
function Carrusel({ s }) {
  const [i, setI] = useState(0)
  const [pausa, setPausa] = useState(() => {
    try {
      return window.matchMedia('(prefers-reduced-motion: reduce)').matches
    } catch {
      return false
    }
  })
  const [encima, setEncima] = useState(false)
  const n = s.slides.length
  useEffect(() => {
    if (pausa || encima || n < 2) return undefined
    const t = setInterval(() => setI((x) => (x + 1) % n), 6000)
    return () => clearInterval(t)
  }, [pausa, encima, n])
  const sl = s.slides[i]
  const flecha = 'absolute top-1/2 z-10 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-brand-600 text-xl text-white ring-2 ring-white/80 transition hover:bg-brand-700'
  return (
    <section aria-roledescription="carrusel" aria-label="Destacados" className="relative bg-peach-500" onMouseEnter={() => setEncima(true)} onMouseLeave={() => setEncima(false)}>
      <h1 className="sr-only">{s.titulo}</h1>
      <A href={sl.href} className="block overflow-hidden">
        <picture key={i} className="block animate-[fadein_0.5s_ease]">
          <source media="(max-width: 767px)" srcSet={sl.mobile} />
          <img src={sl.desktop} alt={sl.alt} className="mx-auto block aspect-[800/1116] w-full object-cover md:aspect-[1950/830] md:max-h-[34rem]" />
        </picture>
      </A>
      {n > 1 && (
        <>
          <button type="button" aria-label="Anterior" onClick={() => setI((i - 1 + n) % n)} className={`${flecha} left-3`}>‹</button>
          <button type="button" aria-label="Siguiente" onClick={() => setI((i + 1) % n)} className={`${flecha} right-3`}>›</button>
          <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full bg-white/90 px-3 py-1.5 shadow">
            {s.slides.map((x, k) => (
              <button key={x.desktop} type="button" aria-label={`Ir a la diapositiva ${k + 1}`} aria-current={k === i} onClick={() => setI(k)} className={`h-2.5 rounded-full transition-all ${k === i ? 'w-8 bg-brand-600' : 'w-2.5 bg-brand-600/40 hover:bg-brand-600/70'}`} />
            ))}
            <button type="button" aria-label={pausa ? 'Reanudar carrusel' : 'Pausar carrusel'} onClick={() => setPausa(!pausa)} className="ml-2 grid h-6 w-6 place-items-center rounded-full bg-brand-600 text-[10px] text-white">{pausa ? '▶' : '❚❚'}</button>
          </div>
        </>
      )}
    </section>
  )
}

function Hero({ s }) {
  return (
    <section className="relative overflow-hidden bg-peach-500 text-slate-900">
      <div className={`relative ${contenedor} grid items-center gap-10 py-16 sm:py-24 lg:py-20 ${s.imagen ? 'lg:grid-cols-[1.2fr_1fr]' : ''}`}>
        <div>
          <h1 className="text-4xl font-extrabold uppercase leading-[1.05] tracking-tight text-brand-600 sm:text-5xl lg:text-6xl">{s.titulo}</h1>
          <span className="mt-5 block h-0.5 w-4/5 bg-brand-600" aria-hidden="true" />
          {s.subtitulo && <p className="mt-5 max-w-xl text-lg">{s.subtitulo}</p>}
          <div className="mt-8 flex flex-wrap gap-3">
            {s.cta && <A href={s.cta.href} className={`${base} ${boton.indigo}`}>{s.cta.label}</A>}
            {s.cta2 && <A href={s.cta2.href} className={`${base} border-2 border-brand-600 text-brand-600 hover:bg-brand-600 hover:text-white`}>{s.cta2.label}</A>}
          </div>
        </div>
        {s.imagen && (
          <div className="relative">
            <span className="absolute -right-6 -top-6 h-3/4 w-3/4 rounded-full bg-brand-600" aria-hidden="true" />
            <img src={s.imagen} alt="Clase de inglés en vivo por videollamada" className="relative aspect-square w-full rounded-3xl object-cover shadow-xl" />
          </div>
        )}
      </div>
    </section>
  )
}

// Encabezado de las páginas interiores: más compacto que el hero de la portada.
function Encabezado({ s }) {
  return (
    <section className="relative overflow-hidden bg-peach-500 text-slate-900">
      <div className={`relative ${contenedor} grid items-center gap-10 py-12 lg:py-16 ${s.imagen ? 'lg:grid-cols-[1.2fr_1fr]' : ''}`}>
        <div className="max-w-3xl">
          {s.eyebrow && <p className="mb-3 text-xs font-bold uppercase tracking-[0.25em] text-brand-700">{s.eyebrow}</p>}
          <h1 className="text-3xl font-extrabold uppercase leading-tight tracking-tight text-brand-600 sm:text-4xl lg:text-5xl">{s.titulo}</h1>
          <span className="mt-4 block h-0.5 w-2/3 bg-brand-600" aria-hidden="true" />
          {s.subtitulo && <p className="mt-5 text-lg">{s.subtitulo}</p>}
          {s.chips && (
            <ul className="mt-5 flex flex-wrap gap-2">
              {s.chips.map((c) => <li key={c} className="rounded-full bg-brand-600/10 px-3 py-1 text-sm font-medium text-brand-700">{c}</li>)}
            </ul>
          )}
          {s.cta && <A href={s.cta.href} className={`${base} ${boton.indigo} mt-8`}>{s.cta.label}</A>}
        </div>
        {s.imagen && (
          <div className="relative">
            <img src={s.imagen} alt="" className="aspect-[4/3] w-full rounded-2xl object-cover shadow-xl" />
          </div>
        )}
      </div>
    </section>
  )
}

function TextoImagen({ s }) {
  const cta = s.cta && <A href={s.cta.href} className="link mt-6 inline-block text-sm font-semibold text-brand-700 hover:text-brand-900">{s.cta.label} →</A>
  const parrafos = <div className="space-y-4 text-lg text-slate-700">{s.parrafos?.map((p) => <p key={p}>{p}</p>)}</div>
  if (!s.imagen)
    return (
      <section className={`${contenedor} grid gap-8 py-16 sm:py-24 lg:grid-cols-[1fr_1.3fr] lg:gap-16`}>
        <Cabecera izq eyebrow={s.eyebrow} titulo={s.titulo} />
        <div className="lg:pt-8">
          {parrafos}
          {cta}
        </div>
      </section>
    )
  return (
    <section className={`${contenedor} py-16 sm:py-24`}>
      <div className="grid items-center gap-10 lg:grid-cols-2">
        <div className={s.izquierda ? 'lg:order-2' : ''}>
          <Cabecera izq eyebrow={s.eyebrow} titulo={s.titulo} />
          {parrafos}
          {cta}
        </div>
        <div className="overflow-hidden rounded-2xl shadow-md">
          <img src={s.imagen} alt="" loading="lazy" className="aspect-square w-full object-cover transition duration-700 hover:scale-[1.03]" />
        </div>
      </div>
    </section>
  )
}

function Programas({ s }) {
  return (
    <section className="bg-mist py-16 sm:py-24">
      <div className={contenedor}>
        <Cabecera eyebrow={s.eyebrow} titulo={s.titulo} subtitulo={s.subtitulo} />
        <div className={`grid gap-5 ${columnas(s.items.length)}`}>
          {s.items.map((p) => p.imagen ? (
            <a key={p.titulo} href={p.href ?? '#/programas'} aria-label={p.titulo} className="group relative isolate flex min-h-[28rem] overflow-hidden rounded-2xl shadow-md transition hover:-translate-y-0.5 hover:shadow-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500">
              <img src={p.imagen} alt="" loading="lazy" className="absolute inset-0 -z-10 h-full w-full object-cover transition duration-700 group-hover:scale-[1.03]" />
              <div className="mt-auto w-full translate-y-[calc(100%-9.5rem)] bg-brand-600 px-6 pb-6 pt-6 transition-transform duration-500 ease-in-out group-hover:translate-y-0 group-focus-visible:translate-y-0">
                <h3 className="flex min-h-[4.5rem] items-end text-2xl font-extrabold leading-tight text-peach-500">{p.titulo}</h3>
                <p className="mt-2 text-sm font-semibold leading-snug text-white">{p.resumen ?? p.descripcion}</p>
                <p className="mt-4 text-sm leading-relaxed text-white/85">{p.descripcion}</p>
                <span className="mt-4 inline-block text-sm font-bold text-peach-500">{p.cta || 'Ver programa'} →</span>
              </div>
            </a>
          ) : (
            <article key={p.titulo} className="flex flex-col rounded-3xl bg-brand-600 p-7 text-white shadow-md transition hover:-translate-y-0.5 hover:shadow-xl">
              <h3 className="text-2xl font-extrabold leading-tight text-peach-500">{p.titulo}</h3>
              <p className="mt-3 flex-1 font-medium text-white/90">{p.descripcion}</p>
              {p.detalle && <p className="mt-4 text-xs font-semibold text-peach-200">{p.detalle}</p>}
              <A href={p.href ?? '#/programas'} className={`${base} mt-5 bg-peach-500 text-brand-900 hover:bg-peach-200`}>{p.cta || 'Ver programa'}</A>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}

function Caracteristicas({ s }) {
  return (
    <section className={`${contenedor} py-16 sm:py-24`}>
      <Cabecera eyebrow={s.eyebrow} titulo={s.titulo} subtitulo={s.subtitulo} />
      <div className={`grid gap-5 ${columnas(s.items.length)}`}>
        {s.items.map((i, n) => (
          <div key={i.titulo} className={tarjeta}>
            <span className="mb-4 block text-sm font-bold tabular-nums text-peach-700" aria-hidden="true">{String(n + 1).padStart(2, '0')}</span>
            <h3 className="text-lg font-bold text-slate-900">{i.titulo}</h3>
            <p className="mt-1 text-sm text-slate-600">{i.descripcion}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

function Ecosistema({ s }) {
  return (
    <section className="bg-gradient-to-br from-brand-800 to-brand-900 py-16 sm:py-24 text-white">
      <div className={contenedor}>
        <Cabecera claro eyebrow={s.eyebrow} titulo={s.titulo} subtitulo={s.subtitulo} />
        <div className="grid gap-5 md:grid-cols-3">
          {s.items.map((i) => (
            <div key={i.fase} className="rounded-xl border border-white/15 bg-white/5 p-6 transition hover:-translate-y-0.5 hover:bg-white/10">
              <p className="text-sm font-semibold text-peach-200">{i.fase}</p>
              <h3 className="mt-1 text-lg font-semibold">{i.titulo}</h3>
              <p className="mt-2 text-sm text-brand-100">{i.descripcion}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function Logos({ s }) {
  return (
    <section className="bg-white py-10">
      <ul className={`${contenedor} flex flex-wrap items-center justify-center gap-x-16 gap-y-4 text-xl font-bold text-slate-400`}>
        {s.items.map((x) => (typeof x === 'string' ? <li key={x}>{x}</li> : <li key={x.alt}><img src={x.src} alt={x.alt} loading="lazy" className="h-10 w-auto opacity-70 grayscale transition hover:opacity-100 hover:grayscale-0" /></li>))}
      </ul>
    </section>
  )
}

function Pasos({ s }) {
  return (
    <section className={`${contenedor} py-16 sm:py-24`}>
      <Cabecera eyebrow={s.eyebrow} titulo={s.titulo} subtitulo={s.subtitulo} />
      <ol className={`grid gap-5 ${columnas(s.items.length)}`}>
        {s.items.map((i) => (
          <li key={i.numero ?? i.titulo} className="border-t-2 border-brand-200 pt-4">
            <span className="text-sm font-semibold text-peach-700">{i.numero}</span>
            <h3 className="mt-1 font-semibold text-brand-900">{i.titulo}</h3>
            <p className="mt-1 text-sm text-slate-600">{i.descripcion}</p>
          </li>
        ))}
      </ol>
    </section>
  )
}

function Testimonios({ s }) {
  return (
    <section className="bg-peach-50 py-16 sm:py-24">
      <div className={contenedor}>
        <Cabecera eyebrow={s.eyebrow} titulo={s.titulo} subtitulo={s.subtitulo} />
        <div className="grid gap-5 md:grid-cols-2">
          {s.items.map((t) => (
            <figure key={t.nombre} className={tarjeta}>
              <blockquote className="text-lg text-brand-900">“{t.cita}”</blockquote>
              <figcaption className="mt-4 text-sm text-slate-600">
                <span className="font-semibold text-brand-900">{t.nombre}</span>
                {t.rol && <span> · {t.rol}</span>}
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  )
}

function Cita({ s }) {
  return (
    <section className="bg-peach-50 py-16 sm:py-24">
      <figure className="mx-auto max-w-3xl px-4 sm:px-6">
        {s.eyebrow && <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-peach-700">{s.eyebrow}</p>}
        <blockquote className="border-l-4 border-peach-500 pl-5 text-xl text-brand-900">{s.texto}</blockquote>
        {s.autor && <figcaption className="mt-4 pl-5 text-sm font-semibold text-slate-600">{s.autor}</figcaption>}
      </figure>
    </section>
  )
}

function Faq({ s }) {
  const [abierta, setAbierta] = useState(s.abiertoInicial ? 0 : null)
  return (
    <section className="mx-auto max-w-3xl px-4 py-16 sm:py-24 sm:px-6">
      <Cabecera eyebrow={s.eyebrow} titulo={s.titulo} subtitulo={s.subtitulo} />
      <div className="divide-y divide-brand-100 rounded-xl border border-brand-100 bg-white">
        {s.items.map((f, i) => (
          <div key={f.pregunta}>
            <button
              type="button"
              aria-expanded={abierta === i}
              onClick={() => setAbierta(abierta === i ? null : i)}
              className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left font-medium text-brand-900 hover:bg-brand-50"
            >
              {f.pregunta}
              <span className="text-brand-600" aria-hidden="true">{abierta === i ? '−' : '+'}</span>
            </button>
            {abierta === i && <p className="whitespace-pre-line px-5 pb-4 text-slate-600">{f.respuesta}</p>}
          </div>
        ))}
      </div>
    </section>
  )
}

function Cta({ s }) {
  return (
    <section className={`${contenedor} py-10`}>
      <div className="rounded-3xl bg-brand-600 p-8 text-white sm:p-12">
        <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">{s.titulo}</h2>
        {s.subtitulo && <p className="mt-3 max-w-2xl text-brand-100">{s.subtitulo}</p>}
        {s.cta && <A href={s.cta.href} className={`${base} ${boton.primario} mt-6`}>{s.cta.label}</A>}
      </div>
    </section>
  )
}

function TablaEnlace({ s }) {
  return (
    <div className={`${contenedor} pb-14`}>
      <A href={s.href} className="text-sm font-semibold text-brand-700 underline underline-offset-4 hover:text-brand-900">{s.texto} →</A>
    </div>
  )
}

function Niveles({ s }) {
  return (
    <section className={`${contenedor} py-16 sm:py-24`}>
      <Cabecera eyebrow={s.eyebrow} titulo={s.titulo} subtitulo={s.subtitulo} />
      <ol className="flex flex-wrap gap-2" aria-label="Ciclos del 0 al 12">
        {Array.from({ length: 13 }, (_, n) => (
          <li key={n} className="grid h-12 w-20 place-items-center rounded-lg border border-brand-200 bg-brand-50 text-sm font-semibold text-brand-800">Ciclo {n}</li>
        ))}
      </ol>
    </section>
  )
}

function Tabla({ s }) {
  return (
    <section className="bg-mist py-16 sm:py-24">
      <div className={contenedor}>
        <Cabecera eyebrow={s.eyebrow} titulo={s.titulo} subtitulo={s.subtitulo} />
        <div className="overflow-x-auto rounded-xl border border-brand-100 bg-white">
          <table className="w-full min-w-[56rem] text-left text-sm">
            <thead className="bg-brand-800 text-white">
              <tr>
                {['Programa', 'Modalidad', 'Tamaño', 'Horario', 'Ideal para'].map((h) => <th key={h} scope="col" className="px-4 py-3 font-semibold">{h}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-100">
              {s.filas.map((f) => (
                <tr key={f.titulo} className="align-top hover:bg-brand-50">
                  <th scope="row" className="px-4 py-3 font-semibold text-brand-900"><A href={f.href} className="underline-offset-4 hover:underline">{f.titulo}</A></th>
                  <td className="px-4 py-3">{f.modalidad}</td>
                  <td className="px-4 py-3">{f.grupo}</td>
                  <td className="px-4 py-3">{f.horario}</td>
                  <td className="px-4 py-3">{f.ideal}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}

function Precios({ s }) {
  return (
    <section className="bg-brand-50 py-16 sm:py-24">
      <div className={contenedor}>
        <Cabecera eyebrow={s.eyebrow} titulo={s.titulo} subtitulo={s.subtitulo} />
        <div className="space-y-10">
          {s.grupos.map((g) => (
            <div key={g.nombre}>
              <h3 className="mb-4 text-lg font-semibold text-brand-900">{g.nombre}</h3>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                {g.items.map((p) => (
                  <div key={p.titulo} className={`${tarjeta} flex flex-col !p-5`}>
                    <p className="text-sm font-semibold text-brand-700">{p.titulo}</p>
                    <p className="mt-2 text-2xl font-semibold text-brand-900">{soles(p.precio)}</p>
                    <p className="text-xs font-medium text-peach-700">{soles(p.porHora)} / hora</p>
                    <p className="mt-3 text-sm text-slate-600">{p.descripcion}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        {s.nota && <p className="mt-8 max-w-2xl text-slate-700">{s.nota}</p>}
        {s.cta && <A href={s.cta.href} className={`${base} ${boton.morado} mt-4`}>{s.cta.label}</A>}
      </div>
    </section>
  )
}

function Catalogo({ s }) {
  const areas = useMemo(() => [...new Set(s.items.map((i) => i.area))], [s.items])
  const [filtro, setFiltro] = useState('')
  const [q, setQ] = useState('')
  const visibles = s.items.filter((i) => (!filtro || i.area === filtro) && i.titulo.toLowerCase().includes(q.trim().toLowerCase()))
  return (
    <section className={`${contenedor} py-16 sm:py-24`}>
      <Cabecera eyebrow={s.eyebrow} titulo={s.titulo} subtitulo={s.subtitulo} />
      <input
        type="search"
        aria-label="Buscar actividad"
        placeholder="Buscar actividad…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        className="mb-4 w-full max-w-sm rounded border border-slate-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
      />
      <div className="mb-6 flex flex-wrap gap-2" role="group" aria-label="Filtrar por área">
        {['', ...areas].map((a) => (
          <button
            key={a || 'todas'}
            type="button"
            aria-pressed={filtro === a}
            onClick={() => setFiltro(a)}
            className={`rounded-full border px-3 py-1 text-sm transition ${filtro === a ? 'border-brand-600 bg-brand-600 text-white' : 'border-brand-200 bg-white text-brand-700 hover:bg-brand-50'}`}
          >
            {a || 'Todas'}
          </button>
        ))}
      </div>
      <p className="mb-3 text-sm text-slate-500">{visibles.length} actividades</p>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {visibles.map((i) => (
          <li key={i.titulo} className={`${tarjeta} !p-4`}>
            <p className="font-semibold text-brand-900">{i.titulo}</p>
            <p className="mt-1 text-xs text-peach-700">{i.area}</p>
            <p className="mt-2 text-xs text-slate-600">{i.publico} · {i.niveles}</p>
          </li>
        ))}
      </ul>
    </section>
  )
}

function Talleres({ s }) {
  const [abierto, setAbierto] = useState(null)
  const lista = (items) => <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">{items.map((x) => <li key={x}>{x}</li>)}</ul>
  return (
    <section className={`${contenedor} py-16 sm:py-24`}>
      <Cabecera eyebrow={s.eyebrow} titulo={s.titulo} subtitulo={s.subtitulo} />
      <div className="space-y-5">
        {s.items.map((t, i) => (
          <article key={t.nombre} className={tarjeta}>
            <h3 className="text-xl font-semibold text-brand-900">{t.nombre}</h3>
            <p className="mt-2 text-slate-600">{t.resumen}</p>
            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
              {[['Individual', t.precio, t.precioDesc], ['Grupal', t.grupal, t.grupalDesc]].map(([nombre, precio, desc]) => (
                <div key={nombre} className="rounded-lg bg-brand-50 p-3">
                  <dt className="font-medium text-brand-700">{nombre}</dt>
                  <dd className="mt-1">
                    {desc ? (
                      <>
                        <span className="text-xl font-semibold text-brand-900">{soles(desc)}</span> <span className="text-slate-500 line-through">{soles(precio)}</span>
                      </>
                    ) : (
                      <span className="text-xl font-semibold text-brand-900">{soles(precio)}</span>
                    )}
                  </dd>
                </div>
              ))}
            </dl>
            <button type="button" aria-expanded={abierto === i} onClick={() => setAbierto(abierto === i ? null : i)} className="mt-4 text-sm font-semibold text-brand-700 underline underline-offset-4">
              {abierto === i ? 'Ocultar detalle' : 'Ver syllabus y detalle'}
            </button>
            {abierto === i && (
              <div className="mt-4 space-y-4 border-t border-brand-100 pt-4">
                <p className="text-slate-700">{t.descripcion}</p>
                <div><h4 className="font-semibold text-brand-900">Syllabus</h4>{lista(t.syllabus)}</div>
                <div><h4 className="font-semibold text-brand-900">Al terminar podrás</h4>{lista(t.aprenderas)}</div>
              </div>
            )}
            <A href={wa(`Hola, quiero inscribirme en el ${t.nombre}.`)} className={`${base} ${boton.morado} mt-5`}>Inscribirme por WhatsApp</A>
          </article>
        ))}
      </div>
    </section>
  )
}

// Sin servicio de correo: el formulario arma el mensaje y lo abre en WhatsApp.
function Formulario({ s, sitio }) {
  const [v, setV] = useState({ nombre: '', asunto: s.asuntos[0], mensaje: '' })
  const campo = (k) => ({ value: v[k], onChange: (e) => setV({ ...v, [k]: e.target.value }) })
  const clase = 'w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200'
  const enviar = (e) => {
    e.preventDefault()
    window.open(wa(`Hola, soy ${v.nombre.trim()}. Asunto: ${v.asunto}. ${v.mensaje.trim()}`, sitio.whatsapp), '_blank', 'noopener')
  }
  return (
    <section className="mx-auto max-w-2xl px-4 py-16 sm:py-24 sm:px-6">
      <form onSubmit={enviar} className={`${tarjeta} space-y-4 !p-6 hover:!translate-y-0`}>
        <label className="block text-sm font-medium text-slate-700">Nombre
          <input required className={`${clase} mt-1`} {...campo('nombre')} />
        </label>
        <label className="block text-sm font-medium text-slate-700">Asunto
          <select className={`${clase} mt-1`} {...campo('asunto')}>{s.asuntos.map((a) => <option key={a}>{a}</option>)}</select>
        </label>
        <label className="block text-sm font-medium text-slate-700">Mensaje
          <textarea required rows={4} className={`${clase} mt-1`} {...campo('mensaje')} />
        </label>
        <button type="submit" className={`${base} ${boton.morado}`}>Enviar por WhatsApp</button>
        <p className="text-xs text-slate-500">Se abrirá WhatsApp con tu mensaje listo para enviar.</p>
      </form>
    </section>
  )
}

function Contacto({ s, sitio }) {
  const enlace = wa('Hola, quiero información sobre los programas de Universa.', sitio.whatsapp)
  return (
    <section className="bg-brand-50 py-16 sm:py-24">
      <div className={contenedor}>
        <Cabecera eyebrow={s.eyebrow} titulo={s.titulo} subtitulo={s.subtitulo} />
        <div className="flex flex-wrap gap-3">
          <A href={enlace} className={`${base} ${boton.morado}`}>Escríbenos por WhatsApp</A>
          <A href={`mailto:${sitio.correo}`} className={`${base} ${boton.contorno}`}>{sitio.correo}</A>
        </div>
        <p className="mt-4 text-sm text-slate-600">{[sitio.telefono, sitio.direccion].filter(Boolean).join(' · ')}</p>
      </div>
    </section>
  )
}

// Texto legal largo: cada línea es un párrafo; las líneas en mayúsculas (cláusulas) son títulos.
function Legal({ titulo, texto }) {
  const lineas = texto.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  const esTitulo = (l) => /^(\d+\.\s+)?[A-ZÁÉÍÓÚÑ0-9][A-ZÁÉÍÓÚÑ0-9 ,.()\-–/]{7,}$/.test(l) && l === l.toUpperCase()
  return (
    <article className="mx-auto max-w-3xl px-4 py-16 sm:py-24 sm:px-6">
      <h1 className="mb-8 text-3xl font-semibold tracking-tight text-brand-900">{titulo}</h1>
      <div className="space-y-3 text-sm leading-relaxed text-slate-700">
        {lineas.map((l, i) => (esTitulo(l) ? <h2 key={i} className="pt-4 text-base font-semibold text-brand-900">{l}</h2> : <p key={i}>{l}</p>))}
      </div>
    </article>
  )
}

const RENDER = { textoImagen: TextoImagen, programas: Programas, caracteristicas: Caracteristicas, ecosistema: Ecosistema, pasos: Pasos, testimonios: Testimonios, cita: Cita, logos: Logos, faq: Faq, cta: Cta, niveles: Niveles, tabla: Tabla, precios: Precios, catalogo: Catalogo, talleres: Talleres, 'tabla-enlace': TablaEnlace }
const ANIO = new Date().getFullYear()

const FOTOS_MENU = [
  ['Continuo Privado', '/landing/continuo-privado.webp', '/programa-continuo-privado'],
  ['Continuo Grupal', '/landing/continuo-grupal.webp', '/programa-continuo-grupal'],
  ['Dynamic', '/landing/dynamic.webp', '/programa-dynamic'],
  ['Flex Signature', '/landing/flex-signature.webp', '/programa-flex-privado'],
]
// Cuatro a seis palabras sueltas; «Programas» abre un panel a todo el ancho.
const NAV = [['Metodología', '/metodologia'], ['Servicios', '/servicios'], ['Nosotros', '/nosotros'], ['Comunidad', '/comunidad-universa'], ['Contacto', '/contacto']]
const enProgramas = (ruta) => ruta === '/programas' || PROGRAMAS_MENU.some(([, r]) => r === ruta)

function Nav({ onIngresar, ruta }) {
  const [hoja, setHoja] = useState(false)
  const [mega, setMega] = useState(false)
  const temporizador = useRef(null)
  const [rutaPrev, setRutaPrev] = useState(ruta)
  if (rutaPrev !== ruta) {
    setRutaPrev(ruta)
    setHoja(false)
    setMega(false)
  }
  const abrir = () => {
    clearTimeout(temporizador.current)
    temporizador.current = setTimeout(() => setMega(true), 150)
  }
  const cerrar = () => {
    clearTimeout(temporizador.current)
    setMega(false)
  }
  useEffect(() => {
    const tecla = (e) => e.key === 'Escape' && (setMega(false), setHoja(false))
    window.addEventListener('keydown', tecla)
    return () => {
      window.removeEventListener('keydown', tecla)
      clearTimeout(temporizador.current)
    }
  }, [])
  const palabra = (activa) => `relative flex h-[4.5rem] items-center text-[15px] font-medium text-white/90 transition hover:text-white after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-peach-500 after:transition-transform after:duration-200 ${activa ? 'text-white after:scale-x-100' : 'after:scale-x-0 hover:after:scale-x-100'}`
  return (
    <header className="sticky top-0 z-30 border-b border-white/15 bg-brand-700" onMouseLeave={cerrar}>
      <div className={`${contenedor} flex h-[4.5rem] items-center justify-between gap-6`}>
        <a href="#/" aria-label="Universa, inicio" className="shrink-0"><Marca /></a>
        <nav aria-label="Principal" className="hidden items-center gap-8 lg:flex">
          <button
            type="button"
            aria-expanded={mega}
            aria-haspopup="true"
            aria-current={enProgramas(ruta) ? 'page' : undefined}
            onMouseEnter={abrir}
            onFocus={abrir}
            onClick={() => setMega(!mega)}
            className={palabra(enProgramas(ruta) || mega)}
          >
            Programas
          </button>
          {NAV.map(([t, r]) => (
            <a key={r} href={`#${r}`} aria-current={ruta === r ? 'page' : undefined} onMouseEnter={cerrar} className={palabra(ruta === r)}>{t}</a>
          ))}
        </nav>
        <div className="flex items-center gap-3">
          <button type="button" onClick={onIngresar} className="hidden text-[15px] font-medium text-white/90 transition hover:text-white sm:block">Ingresar</button>
          <a href="#/contacto" className={`${base} ${boton.primario} hidden sm:inline-flex`}>Reserva tu asesoría</a>
          <button type="button" aria-label="Menú" aria-expanded={hoja} onClick={() => setHoja(!hoja)} className="grid h-11 w-11 place-items-center rounded-full border border-white/40 text-white transition hover:bg-white/10 lg:hidden">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">{hoja ? <path d="M6 6l12 12M18 6 6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}</svg>
          </button>
        </div>
      </div>
      {mega && (
        <div role="region" aria-label="Programas" className="absolute inset-x-0 top-full hidden border-b border-slate-200 bg-white text-slate-900 lg:block">
          <div className={`${contenedor} grid grid-cols-[14rem_1fr] gap-10 py-8`}>
            <ul className="space-y-1 border-r border-slate-200 pr-6">
              {PROGRAMAS_MENU.map(([t, r]) => <li key={r}><a href={`#${r}`} className="block rounded-lg px-3 py-2 text-[15px] font-medium text-slate-700 transition hover:bg-brand-50 hover:text-brand-600">{t}</a></li>)}
              <li><a href="#/servicios" className="link mt-2 inline-block px-3 text-sm font-semibold text-brand-600">Comparar los siete</a></li>
            </ul>
            <div className="grid grid-cols-4 gap-5">
              {FOTOS_MENU.map(([t, src, r]) => (
                <a key={r} href={`#${r}`} aria-label={t} className="group block">
                  <span className="block overflow-hidden rounded-xl"><img src={src} alt="" loading="lazy" className="aspect-[4/3] w-full object-cover transition duration-500 group-hover:scale-[1.03]" /></span>
                  <span className="mt-3 block font-semibold text-slate-900 transition group-hover:text-brand-600">{t}</span>
                </a>
              ))}
            </div>
          </div>
        </div>
      )}
      {hoja && (
        <nav aria-label="Menú móvil" className="fixed inset-x-0 bottom-0 top-[4.5rem] z-30 flex flex-col overflow-y-auto bg-brand-700 px-4 pb-8 lg:hidden">
          <p className="pt-4 text-xs font-bold uppercase tracking-[0.2em] text-peach-200">Programas</p>
          {PROGRAMAS_MENU.map(([t, r]) => <a key={r} href={`#${r}`} className="flex min-h-14 items-center border-b border-white/10 text-lg font-medium text-white">{t}</a>)}
          <p className="pt-6 text-xs font-bold uppercase tracking-[0.2em] text-peach-200">Universa</p>
          {[['Inicio', '/'], ...NAV, ['Preguntas frecuentes', '/faqs']].map(([t, r]) => <a key={r} href={`#${r}`} className="flex min-h-14 items-center border-b border-white/10 text-lg font-medium text-white">{t}</a>)}
          <div className="mt-6 flex flex-col gap-3">
            <a href="#/contacto" className={`${base} ${boton.primario} w-full`}>Reserva tu asesoría</a>
            <button type="button" onClick={onIngresar} className={`${base} ${boton.claro} w-full`}>Ingresar</button>
          </div>
        </nav>
      )}
    </header>
  )
}

function Pie({ sitio, onIngresar, ruta }) {
  const sinBanda = ['/contacto', '/privacidad', '/terminos'].includes(ruta)
  const col = 'text-xs font-bold uppercase tracking-[0.2em] text-peach-200'
  const li = 'transition hover:text-white'
  return (
    <footer>
      {!sinBanda && (
        <section className="bg-peach-500">
          <div className={`${contenedor} flex flex-col items-start justify-between gap-6 py-14 md:flex-row md:items-center`}>
            <h2 className="max-w-xl text-3xl font-extrabold leading-tight tracking-tight text-brand-600 sm:text-4xl">Empieza a hablar inglés con confianza</h2>
            <a href="#/contacto" className={`${base} ${boton.indigo}`}>Reserva tu asesoría</a>
          </div>
        </section>
      )}
      <div className="bg-brand-700 py-16 text-brand-100">
        <div className={`${contenedor} grid gap-10 md:grid-cols-[1.5fr_1fr_1fr_1.2fr]`}>
          <div className="max-w-xs">
            <Marca />
            <p className="mt-4 text-sm leading-relaxed">{sitio.lema}</p>
          </div>
          <div>
            <p className={col}>Programas</p>
            <ul className="mt-4 space-y-2 text-sm">{PROGRAMAS_MENU.map(([t, r]) => <li key={r}><a href={`#${r}`} className={li}>{t}</a></li>)}</ul>
          </div>
          <div>
            <p className={col}>Universa</p>
            <ul className="mt-4 space-y-2 text-sm">
              {[['Nosotros', '/nosotros'], ['Metodología', '/metodologia'], ['Servicios', '/servicios'], ['Café Virtual', '/virtual-coffee'], ['Impacto', '/impacto-universa'], ['Preguntas frecuentes', '/faqs'], ['Trabaja con nosotros', '/trabaja-con-nosotros']].map(([t, r]) => <li key={r}><a href={`#${r}`} className={li}>{t}</a></li>)}
            </ul>
          </div>
          <div className="text-sm">
            <p className={col}>Hablemos</p>
            <a href={`mailto:${sitio.correo}`} className={`${li} mt-4 block`}>{sitio.correo}</a>
            <p className="mt-2">{[sitio.telefono, sitio.direccion].filter(Boolean).join(' · ')}</p>
            <a href={wa('Hola, quiero información sobre los programas de Universa.', sitio.whatsapp)} target="_blank" rel="noreferrer" className={`${li} mt-2 block font-semibold text-white`}>Escribir por WhatsApp</a>
          </div>
        </div>
        <div className={`${contenedor} mt-12 flex flex-wrap items-center justify-between gap-4 border-t border-white/15 pt-6 text-xs text-brand-200`}>
          <p>© {ANIO} {sitio.nombre}. Todos los derechos reservados.</p>
          <p className="flex flex-wrap gap-x-5 gap-y-2">
            {RUTAS_LEGALES.map(([t, r]) => <a key={r} href={`#${r}`} className={li}>{t}</a>)}
            <button type="button" onClick={onIngresar} className={li}>Acceso al sistema</button>
          </p>
        </div>
      </div>
    </footer>
  )
}

function NoEncontrada() {
  return (
    <div className="mx-auto max-w-xl px-4 py-24 text-center">
      <h1 className="text-3xl font-semibold text-brand-900">No encontramos esa página</h1>
      <a href="#/" className={`${base} ${boton.morado} mt-6`}>Volver al inicio</a>
    </div>
  )
}

function Seccion({ s, sitio }) {
  if (s.tipo === 'carrusel') return <Carrusel s={s} />
  if (s.tipo === 'hero') return <Hero s={s} />
  if (s.tipo === 'encabezado') return <Encabezado s={s} />
  if (s.tipo === 'contacto') return <Contacto s={s} sitio={sitio} />
  if (s.tipo === 'formulario') return <Formulario s={s} sitio={sitio} />
  const Comp = RENDER[s.tipo]
  return Comp ? <Comp s={s} /> : null
}

// `cargar` es inyectable para pruebas; por defecto lee Strapi (o el contenido incluido) para la portada.
export default function Landing({ onIngresar, cargar = cargarLanding }) {
  const ruta = useRuta()
  const [c, setC] = useState(null)
  useEffect(() => {
    let vivo = true
    cargar().then((x) => vivo && setC(x))
    return () => {
      vivo = false
    }
  }, [cargar])

  const pagina = ruta === '/' ? null : PAGINAS[ruta]
  useEffect(() => {
    document.title = ruta === '/' ? 'Universa | Aprende inglés. Transforma tu futuro.' : pagina ? `${pagina.titulo} | Universa` : 'Universa'
    try {
      window.scrollTo(0, 0)
    } catch {
      /* sin scroll en este entorno */
    }
  }, [ruta, pagina])

  if (!c) return <div className="grid min-h-screen place-items-center text-brand-700">Cargando…</div>
  const { sitio } = c
  const contenido = ruta === '/' ? c.secciones : pagina?.secciones

  return (
    <div className="min-h-screen bg-white">
      <Nav onIngresar={onIngresar} ruta={ruta} />
      <main>
        {pagina?.legal ? (
          <Legal titulo={pagina.titulo} texto={pagina.legal} />
        ) : contenido ? (
          contenido.map((s, i) => <Seccion key={`${ruta}-${i}`} s={s} sitio={sitio} />)
        ) : (
          <NoEncontrada />
        )}
      </main>
      <Pie sitio={sitio} onIngresar={onIngresar} ruta={ruta} />
      <a
        href={wa('Hola, quiero información sobre los programas de Universa.', sitio.whatsapp)}
        target="_blank"
        rel="noreferrer"
        aria-label="Escribir por WhatsApp"
        className="fixed bottom-5 right-5 z-30 grid h-14 w-14 place-items-center rounded-full bg-[#25d366] text-white shadow-lg transition hover:scale-105"
      >
        <svg viewBox="0 0 24 24" className="h-7 w-7" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm5.2 14c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .2-3.3-.7-2.8-1.2-4.6-4-4.7-4.2-.1-.2-1.1-1.5-1.1-2.8s.7-2 1-2.3c.2-.3.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.8 1.9c.1.2.1.4 0 .5l-.4.6c-.1.2-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.2 1 2.2 1.3 2.5 1.5.3.1.5.1.6-.1l.9-1.1c.2-.3.4-.2.6-.1l1.8.9c.3.1.5.2.5.3.1.2.1.8-.1 1.4Z" /></svg>
      </a>
    </div>
  )
}
