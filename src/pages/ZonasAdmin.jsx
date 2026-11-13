import { useCallback, useState } from 'react'
import Ayuda from '../components/ui/Ayuda'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import Field from '../components/ui/Field'
import Icon from '../components/ui/Icon'
import Modal from '../components/ui/Modal'
import PageHeader from '../components/ui/PageHeader'
import Tabs from '../components/ui/Tabs'
import useCarga from '../hooks/useCarga'
import { validarEnlace } from '../lib/recursos'
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
          label="Document link"
          name="url"
          type="url"
          inputMode="url"
          value={v.url}
          onChange={cambiar}
          placeholder="https://drive.google.com/file/d/…"
          hint="In Drive: right-click the PDF → Share → “Anyone with the link” → Copy link."
          required
        />
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

// Administración publica aquí los documentos de la Teacher Zone (docentes) y de la Student Zone (estudiantes).
export default function ZonasAdmin({ servicio = servicioReal }) {
  const [zona, setZona] = useState('docentes')
  const cargar = useCallback(() => servicio.listarZona(zona), [servicio, zona])
  const { datos, cargando, error, recargar } = useCarga(cargar, [])
  const [form, setForm] = useState(null) // { doc } (null = nuevo)
  const [borrando, setBorrando] = useState(null)
  const [fallo, setFallo] = useState('')
  const info = ZONAS.find((z) => z.id === zona)
  const categorias = [...new Set(datos.map((d) => d.categoria))]

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

  const grupos = new Map()
  for (const d of datos) grupos.set(d.categoria, [...(grupos.get(d.categoria) ?? []), d])

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

      <Tabs tabs={ZONAS.map((z) => ({ id: z.id, label: z.label, conteo: z.id === zona ? datos.length : null }))} activa={zona} onCambiar={setZona} etiqueta="Zona" />

      <div className="pt-6">
        {fallo && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{fallo}</p>}
        {cargando ? (
          <p className="py-10 text-center text-sm text-slate-500">Loading…</p>
        ) : error ? (
          <p className="py-10 text-center text-sm text-red-600">Could not load the documents: {error}</p>
        ) : datos.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-brand-200 bg-white px-4 py-12 text-center">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-500">
              <Icon name="doc" className="h-6 w-6" />
            </span>
            <p className="mt-3 font-medium text-slate-900">There are no documents for {info.para} yet</p>
            <p className="mt-1 text-sm text-slate-500">Add the first one with “Add document”.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {[...grupos].map(([categoria, docs]) => (
              <Card key={categoria} className="overflow-hidden">
                <h2 className="border-b border-brand-100 bg-brand-50 px-4 py-2.5 text-sm font-semibold text-brand-800">{categoria}</h2>
                <ul className="divide-y divide-slate-100">
                  {docs.map((d) => (
                    <li key={d.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-100 text-brand-600">
                        <Icon name="doc" className="h-5 w-5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="flex flex-wrap items-center gap-2 font-medium text-slate-900">
                          {d.titulo} {d.oculto && <Badge color="peach">Oculto</Badge>}
                        </p>
                        {d.descripcion && <p className="truncate text-sm text-slate-500">{d.descripcion}</p>}
                      </div>
                      <div className="flex flex-wrap items-center gap-1">
                        <a href={d.url} target="_blank" rel="noopener noreferrer" className="rounded-full px-3 py-1.5 text-sm font-medium text-brand-700 hover:bg-brand-50">
                          Open
                        </a>
                        <Button variant="ghost" className="px-3 py-1" onClick={() => accion(() => servicio.guardarDocumento(d.id, { ...d, descripcion: d.descripcion ?? '', oculto: !d.oculto }))}>
                          {d.oculto ? 'Show' : 'Hide'}
                        </Button>
                        <Button variant="ghost" className="px-3 py-1" onClick={() => setForm({ doc: d })}>
                          Edit
                        </Button>
                        {borrando === d.id ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-1 text-sm text-rose-700">
                            Delete?
                            <button type="button" className="rounded px-2 font-semibold hover:bg-rose-100" onClick={() => (setBorrando(null), accion(() => servicio.eliminarDocumento(d.id)))}>
                              Sí
                            </button>
                            <button type="button" className="rounded px-2 hover:bg-rose-100" onClick={() => setBorrando(null)}>
                              No
                            </button>
                          </span>
                        ) : (
                          <button type="button" aria-label={`Delete ${d.titulo}`} onClick={() => setBorrando(d.id)} className="rounded-full p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600">
                            <Icon name="trash" className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </Card>
            ))}
          </div>
        )}
      </div>

      {form && <DocumentoForm key={form.doc?.id ?? 'nuevo'} zona={zona} doc={form.doc} categorias={categorias} onSave={guardar} onClose={() => setForm(null)} />}
    </>
  )
}
