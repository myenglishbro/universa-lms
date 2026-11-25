import { useCallback, useMemo, useState } from 'react'
import VisorDocumento from '../../components/portal/VisorDocumento'
import Icon from '../../components/ui/Icon'
import useCarga from '../../hooks/useCarga'
import { inputClass } from '../../components/ui/Field'
import * as servicioReal from '../../services/zonas'

const ZONAS = {
  docentes: { titulo: 'Teacher Zone', icono: 'teacher', intro: 'Regulations, guidelines and materials for the teaching team.', vacio: 'Administration has not published any documents yet. Check back soon.' },
  estudiantes: { titulo: 'Student Zone', icono: 'users', intro: 'Guidelines, guides and important documents for your learning.', vacio: 'Administration has not published any documents yet. Check back soon.' },
}

// Zona de documentos del portal (Teacher Zone o Student Zone): lo que administración publica, con búsqueda y filtro por categoría.
export default function ZonaDocumentos({ zona, servicio = servicioReal }) {
  const info = ZONAS[zona]
  const cargar = useCallback(() => servicio.listarZona(zona), [servicio, zona])
  const { datos, cargando, error, recargar } = useCarga(cargar, [])
  const [busqueda, setBusqueda] = useState('')
  const [categoria, setCategoria] = useState('')
  const [abierto, setAbierto] = useState(null)
  const categorias = useMemo(() => [...new Set(datos.map((d) => d.categoria))], [datos])

  const grupos = useMemo(() => {
    const t = busqueda.trim().toLowerCase()
    const m = new Map()
    for (const d of datos) {
      if (categoria && d.categoria !== categoria) continue
      if (t && !`${d.titulo} ${d.descripcion ?? ''} ${d.categoria}`.toLowerCase().includes(t)) continue
      m.set(d.categoria, [...(m.get(d.categoria) ?? []), d])
    }
    return [...m]
  }, [datos, busqueda, categoria])

  return (
    <>
      <div className="relative mb-6 overflow-hidden rounded-3xl bg-gradient-to-br from-brand-600 via-brand-700 to-brand-900 p-6 text-white shadow-md sm:p-8">
        <span className="pointer-events-none absolute -right-12 -top-16 h-56 w-56 rounded-full bg-peach-500/20" />
        <span className="pointer-events-none absolute -bottom-20 right-40 h-40 w-40 rounded-full bg-white/5" />
        <div className="relative flex flex-wrap items-center justify-between gap-5">
          <div className="flex items-center gap-4">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/15 backdrop-blur">
              <Icon name={info.icono} className="h-7 w-7 text-peach-200" />
            </span>
            <div>
              <h1 className="text-2xl font-bold sm:text-3xl">{info.titulo}</h1>
              <p className="mt-1 text-sm text-brand-100">{info.intro}</p>
            </div>
          </div>
          {!cargando && datos.length > 0 && (
            <div className="flex gap-3 text-center">
              <div className="rounded-2xl bg-white/10 px-4 py-2 backdrop-blur">
                <p className="text-2xl font-bold leading-none">{datos.length}</p>
                <p className="mt-1 text-xs text-brand-100">{datos.length === 1 ? 'document' : 'documents'}</p>
              </div>
              <div className="rounded-2xl bg-white/10 px-4 py-2 backdrop-blur">
                <p className="text-2xl font-bold leading-none">{categorias.length}</p>
                <p className="mt-1 text-xs text-brand-100">{categorias.length === 1 ? 'category' : 'categories'}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {error && (
        <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          Could not load the documents: {error}{' '}
          <button className="font-medium underline" onClick={recargar}>
            Retry
          </button>
        </p>
      )}

      {cargando ? (
        <p className="py-10 text-center text-sm text-slate-500">Loading documents…</p>
      ) : datos.length === 0 ? (
        !error && (
          <div className="rounded-2xl border border-dashed border-brand-200 bg-white px-4 py-14 text-center">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-brand-50 text-brand-500">
              <Icon name="doc" className="h-7 w-7" />
            </span>
            <p className="mx-auto mt-4 max-w-sm text-sm text-slate-500">{info.vacio}</p>
          </div>
        )
      ) : (
        <>
          <div className="mb-6 flex flex-wrap items-center gap-3">
            <div className="relative w-full sm:max-w-xs">
              <Icon name="search" className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Search for a document" className={`${inputClass} pl-9`} />
            </div>
            {categorias.length > 1 && (
              <div className="flex flex-wrap gap-1.5">
                {['', ...categorias].map((c) => (
                  <button
                    key={c || 'todas'}
                    type="button"
                    onClick={() => setCategoria(c)}
                    aria-pressed={categoria === c}
                    className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${categoria === c ? 'bg-brand-600 text-white' : 'bg-white text-slate-600 ring-1 ring-inset ring-brand-100 hover:bg-brand-50'}`}
                  >
                    {c || 'All'}
                  </button>
                ))}
              </div>
            )}
          </div>
          {grupos.length === 0 && <p className="py-6 text-center text-sm text-slate-500">No document matches your search.</p>}
          <div className="space-y-8">
            {grupos.map(([cat, docs]) => (
              <section key={cat}>
                <h2 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                  {cat} <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] normal-case tracking-normal text-slate-500">{docs.length}</span>
                </h2>
                <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {docs.map((d) => (
                    <li key={d.id}>
                      <button
                        type="button"
                        onClick={() => setAbierto(d)}
                        className="group flex h-full w-full flex-col rounded-2xl border border-brand-100 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-brand-400 hover:shadow-md"
                      >
                        <span className="flex items-start gap-3">
                          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 transition group-hover:bg-brand-600 group-hover:text-white">
                            <Icon name="doc" className="h-5 w-5" />
                          </span>
                          <span className="min-w-0">
                            <span className="block font-semibold leading-snug text-slate-900">{d.titulo}</span>
                            {d.descripcion && <span className="mt-1 line-clamp-2 block text-sm text-slate-500">{d.descripcion}</span>}
                          </span>
                        </span>
                        <span className="mt-auto flex items-center justify-between pt-4 text-xs">
                          <span className="rounded-full bg-brand-50 px-2.5 py-0.5 font-medium text-brand-700">{d.categoria}</span>
                          <span className="inline-flex items-center gap-1 font-semibold text-brand-700 transition group-hover:gap-2">
                            Read <Icon name="back" className="h-3.5 w-3.5 rotate-180" />
                          </span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </>
      )}

      {abierto && <VisorDocumento doc={abierto} onClose={() => setAbierto(null)} />}
    </>
  )
}
