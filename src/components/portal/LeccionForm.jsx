import { useState } from 'react'
import Button from '../ui/Button'
import Field from '../ui/Field'
import Modal from '../ui/Modal'
import { incrustarDe, proveedorDe, tiposRecurso, validarEnlace } from '../../lib/recursos'
import { formatFecha } from '../../lib/salones'

// Formulario corto de lección: título, tipo, enlace y, opcionalmente, descripción y clase del calendario.
export default function LeccionForm({ leccion, sesiones = [], onSave, onClose }) {
  const [v, setV] = useState({
    titulo: leccion?.titulo ?? '',
    tipo: leccion?.tipo ?? 'grabacion',
    url: leccion?.url ?? '',
    descripcion: leccion?.descripcion ?? '',
    sesionId: leccion?.sesionId ?? '',
  })
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [tocado, setTocado] = useState(false)
  const cambiar = (e) => setV({ ...v, [e.target.name]: e.target.value })
  const errorEnlace = v.url.trim() ? validarEnlace(v.url.trim(), v.tipo) : ''
  const ayuda = tiposRecurso.find((t) => t.value === v.tipo)?.ayuda
  const prov = v.url.trim() ? proveedorDe(v.url.trim()) : null
  const sePuedeVer = prov && !errorEnlace && Boolean(incrustarDe({ url: v.url.trim(), proveedor: prov }))

  const enviar = async (e) => {
    e.preventDefault()
    setTocado(true)
    if (!v.titulo.trim()) return setError('Enter the title')
    const err = validarEnlace(v.url.trim(), v.tipo)
    if (err) return setError(err)
    setGuardando(true)
    setError('')
    try {
      await onSave({ ...v, titulo: v.titulo.trim(), url: v.url.trim(), descripcion: v.descripcion.trim() })
    } catch (er) {
      setError(er.message)
      setGuardando(false)
    }
  }

  return (
    <Modal title={leccion ? 'Edit lesson' : 'New lesson'} onClose={onClose}>
      <form onSubmit={enviar} className="space-y-4">
        <Field label="Title" name="titulo" value={v.titulo} onChange={cambiar} placeholder="E.g.: Class 3 · Present perfect" autoFocus />
        <Field label="Resource type" name="tipo" value={v.tipo} onChange={cambiar} options={tiposRecurso.map((t) => ({ value: t.value, label: t.label }))} />
        <Field
          label="Link"
          name="url"
          type="url"
          inputMode="url"
          value={v.url}
          onChange={cambiar}
          placeholder="https://"
          hint={`${ayuda}. Remember to share the file with your students on that platform.`}
          error={(tocado || v.url.trim()) && errorEnlace ? errorEnlace : ''}
        />
        {v.url.trim() && !errorEnlace && (
          <p className={`rounded-lg px-3 py-2 text-xs ${sePuedeVer ? 'bg-brand-50 text-brand-700' : 'bg-peach-50 text-peach-700'}`}>
            {sePuedeVer
              ? `✓ ${prov === 'drive' ? 'Google Drive' : prov === 'vimeo' ? 'Vimeo' : 'YouTube'} link recognized: the student will see it inside the platform.`
              : 'This link cannot be displayed inside the platform: the student will get a button to open it.'}
          </p>
        )}
        {v.url.trim() === '' && (
          <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
            <strong>Videos and PDFs on Drive:</strong> in Drive right-click the file → <em>Share</em> → “Anyone with the link” → <em>Copy link</em> and paste it here.
          </p>
        )}
        <Field label="Description (optional)" name="descripcion" as="textarea" rows="2" value={v.descripcion} onChange={cambiar} />
        {sesiones.length > 0 && (
          <Field
            label="Calendar class (optional)"
            name="sesionId"
            value={v.sesionId}
            onChange={cambiar}
            options={[
              { value: '', label: 'Sin vincular' },
              ...sesiones.map((s) => ({ value: s.id, label: `${formatFecha(s.fecha)} · ${s.hora_inicio.slice(0, 5)}–${s.hora_fin.slice(0, 5)}` })),
            ]}
          />
        )}
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={guardando}>
            {guardando ? 'Saving…' : leccion ? 'Save changes' : 'Publish lesson'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
