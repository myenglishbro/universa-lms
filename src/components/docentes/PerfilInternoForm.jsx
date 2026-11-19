import { useState } from 'react'
import Button from '../ui/Button'
import Modal from '../ui/Modal'
import { guardarPerfil } from '../../services/docentesPerfil'

// Edita la descripción interna y las características de un docente. Se pueden escribir opciones nuevas: se agregan al campo.
export default function PerfilInternoForm({ docente, perfil, campos, onGuardado, onClose }) {
  const [descripcion, setDescripcion] = useState(perfil?.descripcion ?? '')
  const [atributos, setAtributos] = useState(() => Object.fromEntries(campos.map((c) => [c.id, perfil?.atributos?.[c.id] ?? []])))
  const [nuevas, setNuevas] = useState({})
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)

  const alternar = (id, o) => setAtributos((a) => ({ ...a, [id]: a[id].includes(o) ? a[id].filter((x) => x !== o) : [...a[id], o] }))
  const agregar = (c) => {
    const o = (nuevas[c.id] ?? '').trim()
    if (!o) return
    setAtributos((a) => ({ ...a, [c.id]: a[c.id].includes(o) ? a[c.id] : [...a[c.id], o] }))
    setNuevas((n) => ({ ...n, [c.id]: '' }))
  }
  const guardar = async (e) => {
    e.preventDefault()
    setGuardando(true)
    setError('')
    try {
      await guardarPerfil(docente.id, descripcion, atributos)
      await onGuardado()
    } catch (err) {
      setError(err.message)
      setGuardando(false)
    }
  }

  return (
    <Modal title={`Internal profile · ${docente.nombre}`} onClose={onClose} wide>
      <form onSubmit={guardar} className="space-y-4">
        <p className="rounded-lg bg-brand-50 px-3 py-2 text-xs text-brand-800">Only administration sees this. Teachers and students never do.</p>
        <label className="block text-sm font-medium text-slate-700">
          Short description
          <textarea
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            maxLength={1000}
            rows={4}
            placeholder="Strengths, teaching style, what kind of students they work best with…"
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-normal"
          />
          <span className="text-xs font-normal text-slate-400">{descripcion.length} / 1000</span>
        </label>
        {campos.filter((c) => c.activo).map((c) => {
          const todas = [...new Set([...c.opciones, ...atributos[c.id]])]
          return (
            <fieldset key={c.id}>
              <legend className="mb-1 text-sm font-medium text-slate-700">{c.nombre}</legend>
              <div className="flex flex-wrap items-center gap-1.5">
                {todas.map((o) => {
                  const on = atributos[c.id].includes(o)
                  return (
                    <button key={o} type="button" aria-pressed={on} onClick={() => alternar(c.id, o)} className={`rounded-full border px-3 py-1 text-sm ${on ? 'border-brand-600 bg-brand-600 font-semibold text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-brand-300'}`}>
                      {o}
                    </button>
                  )
                })}
                <input
                  value={nuevas[c.id] ?? ''}
                  onChange={(e) => setNuevas((n) => ({ ...n, [c.id]: e.target.value }))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      agregar(c)
                    }
                  }}
                  onBlur={() => agregar(c)}
                  maxLength={40}
                  placeholder="+ add option"
                  aria-label={`Add an option to ${c.nombre}`}
                  className="w-32 rounded-full border border-dashed border-slate-300 px-3 py-1 text-sm"
                />
              </div>
            </fieldset>
          )
        })}
        {campos.length === 0 && <p className="text-sm text-slate-500">No fields yet. Create them from “Profile fields” in the teachers list.</p>}
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={guardando}>
            {guardando ? 'Saving…' : 'Save profile'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
