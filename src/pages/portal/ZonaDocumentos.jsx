import { useCallback, useMemo, useState } from 'react'
import VisorDocumento from '../../components/portal/VisorDocumento'
import Icon from '../../components/ui/Icon'
import useCarga from '../../hooks/useCarga'
import { inputClass } from '../../components/ui/Field'
import * as servicioReal from '../../services/zonas'

const ZONAS = {
  docentes: { titulo: 'Teacher Zone', intro: 'Regulations, guidelines and materials for the teaching team.', vacio: 'Administration has not published any documents yet. Check back soon.' },
  estudiantes: { titulo: 'Student Zone', intro: 'Guidelines, guides and important documents for your learning.', vacio: 'Administration has not published any documents yet. Check back soon.' },
}

// Zona de documentos del portal (Teacher Zone o Student Zone): lo que administración publica, ordenado por categoría.
export default function ZonaDocumentos({ zona, servicio = servicioReal }) {
  const info = ZONAS[zona]
  const cargar = useCallback(() => servicio.listarZona(zona), [servicio, zona])
  const { datos, cargando, error, recargar } = useCarga(cargar, [])
  const [busqueda, setBusqueda] = useState('')
  const [abierto, setAbierto] = useState(null)

  const grupos = useMemo(() => {
    const t = busqueda.trim().toLowerCase()
    const m = new Map()
    for (const d of datos) {
      if (t && !`${d.titulo} ${d.descripcion ?? ''} ${d.categoria}`.toLowerCase().includes(t)) continue
      m.set(d.categoria, [...(m.get(d.categoria) ?? []), d])
    }
    return [...m]
  }, [datos, busqueda])

  return (
    <>
      <div className="relative mb-6 overflow-hidden rounded-3xl bg-gradient-to-br from-brand-600 via-brand-700 to-brand-900 p-6 text-white shadow-md sm:p-8">
        <span className="pointer-events-none absolute -right-12 -top-16 h-56 w-56 rounded-full bg-peach-500/20" />
        <div className="relative flex items-center gap-4">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/15">
            <Icon name="book" className="h-7 w-7 text-peach-200" />
          </span>
          <div>
            <h1 className="text-2xl font-bold sm:text-3xl">{info.titulo}</h1>
            <p className="mt-1 text-sm text-brand-100">{info.intro}</p>
          </div>
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
        !error && <p className="rounded-2xl border border-dashed border-brand-200 bg-white px-4 py-12 text-center text-sm text-slate-500">{info.vacio}</p>
      ) : (
        <>
          <div className="relative mb-6 max-w-sm">
            <Icon name="search" className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Search for a document" className={`${inputClass} pl-9`} />
          </div>
          {grupos.length === 0 && <p className="text-sm text-slate-500">No document matches your search.</p>}
          <div className="space-y-8">
            {grupos.map(([categoria, docs]) => (
              <section key={categoria}>
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-brand-700">{categoria}</h2>
                <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {docs.map((d) => (
                    <li key={d.id}>
                      <button
                        type="button"
                        onClick={() => setAbierto(d)}
                        className="flex h-full w-full items-start gap-4 rounded-2xl border border-brand-100 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-brand-500 hover:shadow-md"
                      >
                        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand-100 text-brand-600">
                          <Icon name="doc" className="h-6 w-6" />
                        </span>
                        <span className="min-w-0">
                          <span className="block font-semibold text-slate-900">{d.titulo}</span>
                          {d.descripcion && <span className="mt-0.5 line-clamp-2 block text-sm text-slate-500">{d.descripcion}</span>}
                          <span className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-brand-700">
                            Read document <Icon name="back" className="h-3.5 w-3.5 rotate-180" />
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
