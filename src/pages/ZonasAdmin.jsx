import { useCallback, useState } from 'react'
import Ayuda from '../components/ui/Ayuda'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import Field, { inputClass } from '../components/ui/Field'
import Icon from '../components/ui/Icon'
import Modal from '../components/ui/Modal'
import PageHeader from '../components/ui/PageHeader'
import useCarga from '../hooks/useCarga'
import { claseDeEnlace, validarEnlace } from '../lib/recursos'
import * as servicioReal from '../services/zonas'

const ZONAS = [
  { id: 'docentes', label: 'Teacher Zone', para: 'teachers' },
  { id: 'estudiantes', label: 'Student Zone', para: 'students' },
]
const CATEGORIAS = ['Reglamentos', 'Lineamientos', 'Formatos', 'Guías', 'Comunicados']

function DocumentoForm({ zona, doc, categorias, onSave, onClose }) {
  const [v, setV] = useState({ titulo: doc?.titulo ?? '', categoria: doc?.categoria ?? '', url: doc?.url ?? '', descripcion: doc?.descripcion ?? '', oculto: doc?.oculto ?? false })
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)
  const cambiar = (e) => setV({ ...v, [e.target.name]: e.target.value })

  const enviar = async (e) => {
    e.preventDefault()
    if (!v.titulo.trim()) return setError('Enter the title')
    const err = validarEnlace(v.url.trim(), 'link')
    if (err) return setError(err)
    setGuardando(true)
    setError('')
    try {
      await onSave({ ...v, zona, titulo: v.titulo.trim(), categoria: v.categoria.trim(), url: v.url.trim(), descripcion: v.descripcion.trim() })
    } catch (er) {
      setError(er.message)
      setGuardando(false)
    }
  }

  return (
    <Modal title={doc ? 'Edit document' : 'Add document'} onClose={onClose}>
      <form onSubmit={enviar} className="space-y-4">
        <Field label="Title" name="titulo" value={v.titulo} onChange={cambiar} placeholder="E.g.: Internal regulations 2027" autoFocus required />
        <div>
          <Field label="Category" name="categoria" value={v.categoria} onChange={cambiar} list="categorias-zona" placeholder="E.g.: Regulations" />
          <datalist id="categorias-zona">
            {[...new Set([...CATEGORIAS, ...categorias])].map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </div>
        <Field
          label="Link"
          name="url"
          type="url"
          inputMode="url"
          value={v.url}
          onChange={cambiar}
          placeholder="Paste the link: a PDF on Drive or any website"
          hint="In Drive: right-click the PDF → Share → “Anyone with the link” → Copy link."
          required
        />
        {claseDeEnlace(v.url) && (
          <p className={`rounded-lg px-3 py-2 text-xs ${claseDeEnlace(v.url).dentro ? 'bg-brand-50 text-brand-700' : 'bg-peach-50 text-peach-700'}`}>
            {claseDeEnlace(v.url).dentro ? `✓ ${claseDeEnlace(v.url).etiqueta}: it will be read inside the platform.` : 'This is a link: it will open in a new tab when someone clicks it.'}
          </p>
        )}
        <Field label="Description (optional)" name="descripcion" as="textarea" rows="2" value={v.descripcion} onChange={cambiar} />
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={v.oculto} onChange={(e) => setV({ ...v, oculto: e.target.checked })} className="h-4 w-4 rounded border-slate-300 accent-brand-600" />
          Hide for now (nobody will see it until you show it)
        </label>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={guardando}>
            {guardando ? 'Saving…' : doc ? 'Save changes' : 'Publish'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

// Botón de icono para las acciones de cada documento (con texto alternativo y sugerencia al pasar el mouse).
function Accion({ titulo, onClick, href, peligro = false, children }) {
  const clase = `inline-flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 transition ${peligro ? 'hover:bg-rose-50 hover:text-rose-600' : 'hover:bg-brand-50 hover:text-brand-700'}`
  return href ? (
    <a href={href} target="_blank" rel="noopener noreferrer" title={titulo} aria-label={titulo} className={clase}>
      {children}
    </a>
  ) : (
    <button type="button" title={titulo} aria-label={titulo} onClick={onClick} className={clase}>
      {children}
    </button>
  )
}

// Administración publica aquí los documentos de la Teacher Zone (docentes) y de la Student Zone (estudiantes).
export default function ZonasAdmin({ servicio = servicioReal }) {
  const [zona, setZona] = useState('docentes')
  const cargar = useCallback(() => servicio.listarZona(zona), [servicio, zona])
  const { datos, cargando, error, recargar } = useCarga(cargar, [])
  const [form, setForm] = useState(null) // { doc } (null = nuevo)
  const [borrando, setBorrando] = useState(null)
  const [fallo, setFallo] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [categoria, setCategoria] = useState('')
  const info = ZONAS.find((z) => z.id === zona)
  const categorias = [...new Set(datos.map((d) => d.categoria))]
  const ocultos = datos.filter((d) => d.oculto).length

  const cambiarZona = (id) => {
    setZona(id)
    setBusqueda('')
    setCategoria('')
  }
  const guardar = async (v) => {
    await servicio.guardarDocumento(form.doc?.id ?? null, v)
    await recargar()
    setForm(null)
  }
  const accion = async (fn) => {
    setFallo('')
    try {
      await fn()
      await recargar()
    } catch (e) {
      setFallo(e.message)
    }
  }

  const t = busqueda.trim().toLowerCase()
  const visibles = datos.filter((d) => (!categoria || d.categoria === categoria) && (!t || `${d.titulo} ${d.descripcion ?? ''} ${d.categoria}`.toLowerCase().includes(t)))
  const grupos = new Map()
  for (const d of visibles) grupos.set(d.categoria, [...(grupos.get(d.categoria) ?? []), d])

  return (
    <>
      <PageHeader
        title="Teacher & Student Zone"
        description="The documents you publish here appear in the teacher and student portals"
        action={
          <Button onClick={() => setForm({ doc: null })}>
            <Icon name="plus" className="h-4 w-4" /> Add document
          </Button>
        }
      />

      <Ayuda id="zonas" titulo="How does it work?">
        <p>
          Upload your PDFs to <strong>Google Drive</strong>, share them with “Anyone with the link” and paste the link here. Each person reads them inside the platform, sorted by category.
        </p>
        <p className="text-slate-600">
          <strong>Teacher Zone</strong> is seen only by teachers; <strong>Student Zone</strong>, only by students. If you do not want a document to be visible yet, mark it as hidden.
        </p>
      </Ayuda>

      {/* Selector de zona: dos tarjetas grandes en lugar de pestañas, con a quién va dirigida cada una. */}
      <div role="tablist" aria-label="Zone" className="mb-5 grid gap-3 sm:grid-cols-2">
        {ZONAS.map((z) => {
          const on = z.id === zona
          return (
            <button
              key={z.id}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => cambiarZona(z.id)}
              className={`flex items-center gap-4 rounded-2xl border p-4 text-left transition ${
                on ? 'border-brand-500 bg-white shadow-md ring-2 ring-brand-500/20' : 'border-brand-100 bg-white/60 hover:border-brand-300 hover:bg-white'
              }`}
            >
              <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${on ? 'bg-brand-600 text-white' : 'bg-brand-50 text-brand-600'}`}>
                <Icon name={z.id === 'docentes' ? 'teacher' : 'users'} className="h-6 w-6" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold text-slate-900">{z.label}</span>
                <span className="block text-xs text-slate-500">Visible only to {z.para}</span>
              </span>
              {on && !cargando && (
                <span className="text-right leading-tight">
                  <span className="block text-2xl font-bold text-brand-700">{datos.length}</span>
                  <span className="block text-xs text-slate-500">{datos.length === 1 ? 'document' : 'documents'}</span>
                </span>
              )}
            </button>
          )
        })}
      </div>

      {fallo && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{fallo}</p>}
      {cargando ? (
        <p className="py-10 text-center text-sm text-slate-500">Loading…</p>
      ) : error ? (
        <p className="py-10 text-center text-sm text-red-600">Could not load the documents: {error}</p>
      ) : datos.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-brand-200 bg-white px-4 py-14 text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-brand-50 text-brand-500">
            <Icon name="doc" className="h-7 w-7" />
          </span>
          <p className="mt-4 font-semibold text-slate-900">There are no documents for {info.para} yet</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">Publish regulations, guides or forms and they will show up in their portal.</p>
          <Button className="mt-5" onClick={() => setForm({ doc: null })}>
            <Icon name="plus" className="h-4 w-4" /> Add the first document
          </Button>
        </div>
      ) : (
        <>
          {/* Búsqueda y filtro por categoría */}
          <div className="mb-5 flex flex-wrap items-center gap-3">
            <div className="relative w-full sm:max-w-xs">
              <Icon name="search" className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Search documents" className={`${inputClass} pl-9`} />
            </div>
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
            {ocultos > 0 && (
              <span className="ml-auto inline-flex items-center gap-1.5 text-xs text-peach-700">
                <Icon name="eyeoff" className="h-4 w-4" /> {ocultos} hidden
              </span>
            )}
          </div>

          {visibles.length === 0 && <p className="py-8 text-center text-sm text-slate-500">No document matches your search.</p>}
          <div className="space-y-5">
            {[...grupos].map(([cat, docs]) => (
              <section key={cat}>
                <h2 className="mb-2 flex items-center gap-2 px-1 text-xs font-semibold uppercase tracking-wider text-slate-400">
                  {cat} <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] normal-case tracking-normal text-slate-500">{docs.length}</span>
                </h2>
                <Card className="overflow-hidden">
                  <ul className="divide-y divide-slate-100">
                    {docs.map((d) => (
                      <li key={d.id} className={`flex flex-wrap items-center gap-3 px-4 py-3 transition hover:bg-brand-50/40 ${d.oculto ? 'bg-slate-50/70' : ''}`}>
                        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${d.oculto ? 'bg-slate-100 text-slate-400' : 'bg-brand-100 text-brand-600'}`}>
                          <Icon name={claseDeEnlace(d.url)?.icono ?? 'link'} className="h-5 w-5" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className={`flex flex-wrap items-center gap-2 font-medium ${d.oculto ? 'text-slate-500' : 'text-slate-900'}`}>
                            {d.titulo}
                            <Badge color="slate">{claseDeEnlace(d.url)?.etiqueta ?? 'Link'}</Badge>
                            {d.oculto && <Badge color="peach">Hidden</Badge>}
                          </p>
                          {d.descripcion && <p className="truncate text-sm text-slate-500">{d.descripcion}</p>}
                        </div>
                        <div className="flex items-center gap-0.5">
                          <Accion titulo="Open document" href={d.url}>
                            <Icon name="external" className="h-4 w-4" />
                          </Accion>
                          <Accion
                            titulo={d.oculto ? 'Show to ' + info.para : 'Hide from ' + info.para}
                            onClick={() => accion(() => servicio.guardarDocumento(d.id, { ...d, descripcion: d.descripcion ?? '', oculto: !d.oculto }))}
                          >
                            <Icon name={d.oculto ? 'eye' : 'eyeoff'} className="h-4 w-4" />
                          </Accion>
                          <Accion titulo="Edit" onClick={() => setForm({ doc: d })}>
                            <Icon name="pencil" className="h-4 w-4" />
                          </Accion>
                          {borrando === d.id ? (
                            <span className="ml-1 inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-1 text-sm text-rose-700">
                              Delete?
                              <button type="button" className="rounded px-2 font-semibold hover:bg-rose-100" onClick={() => (setBorrando(null), accion(() => servicio.eliminarDocumento(d.id)))}>
                                Yes
                              </button>
                              <button type="button" className="rounded px-2 hover:bg-rose-100" onClick={() => setBorrando(null)}>
                                No
                              </button>
                            </span>
                          ) : (
                            <Accion titulo={`Delete ${d.titulo}`} peligro onClick={() => setBorrando(d.id)}>
                              <Icon name="trash" className="h-4 w-4" />
                            </Accion>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                </Card>
              </section>
            ))}
          </div>
        </>
      )}

      {form && <DocumentoForm key={form.doc?.id ?? 'nuevo'} zona={zona} doc={form.doc} categorias={categorias} onSave={guardar} onClose={() => setForm(null)} />}
    </>
  )
}
