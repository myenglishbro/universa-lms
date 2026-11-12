import { useState } from 'react'
import Button from '../ui/Button'
import Field from '../ui/Field'
import Modal from '../ui/Modal'
import { formatFecha } from '../../lib/salones'

// Cierra un ciclo: los salones finalizados elegidos pasan al archivo bajo el nombre del ciclo.
export default function CerrarCicloModal({ finalizados, ciclosExistentes, onConfirm, onClose }) {
  const [ciclo, setCiclo] = useState('')
  const [elegidos, setElegidos] = useState(() => new Set(finalizados.map((s) => s.id)))
  const [descargar, setDescargar] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  const alternar = (id) =>
    setElegidos((prev) => {
      const nuevo = new Set(prev)
      if (nuevo.has(id)) nuevo.delete(id)
      else nuevo.add(id)
      return nuevo
    })

  const confirmar = async (e) => {
    e.preventDefault()
    setError('')
    if (!ciclo.trim()) return setError('Enter the cycle name, for example 2026-II')
    if (elegidos.size === 0) return setError('Choose at least one classroom')
    setGuardando(true)
    try {
      await onConfirm([...elegidos], ciclo.trim(), { descargar })
    } catch (err) {
      setError(err.message)
      setGuardando(false)
    }
  }

  return (
    <Modal title="Close cycle and archive" onClose={onClose} wide>
      <form onSubmit={confirmar} className="space-y-4">
        <p className="text-sm text-slate-600">
          The chosen classrooms disappear from “Group classrooms” and from the portals, and move to <strong>Cycle archive</strong> with their students and each student's grade report as they are today. Nothing is deleted.
        </p>
        <Field
          label="Cycle name"
          value={ciclo}
          onChange={(e) => setCiclo(e.target.value)}
          placeholder="E.g. 2026-II"
          list="ciclos-existentes"
          autoFocus
          hint={ciclosExistentes.length ? 'You can reuse an already archived cycle to add more classrooms to it.' : undefined}
        />
        <datalist id="ciclos-existentes">
          {ciclosExistentes.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>

        <fieldset>
          <legend className="mb-1 text-sm font-medium text-slate-700">
            Finished classrooms ({elegidos.size} of {finalizados.length})
          </legend>
          <ul className="max-h-64 divide-y divide-slate-100 overflow-y-auto rounded-xl border border-slate-200">
            {finalizados.map((s) => (
              <li key={s.id}>
                <label className="flex cursor-pointer items-center gap-3 px-3 py-2 text-sm hover:bg-slate-50">
                  <input type="checkbox" checked={elegidos.has(s.id)} onChange={() => alternar(s.id)} />
                  <span className="flex-1">
                    <span className="font-medium text-slate-900">{s.nombre}</span>
                    <span className="block text-xs text-slate-500">
                      {s.docente || 'No teacher'} · {formatFecha(s.fechaInicio)} → {formatFecha(s.fechaFin)}
                    </span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </fieldset>

        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-peach-200 bg-peach-50 px-4 py-3 text-sm text-peach-700">
          <input type="checkbox" className="mt-0.5" checked={descargar} onChange={(e) => setDescargar(e.target.checked)} />
          <span>
            <strong>Download each classroom's Excel (assessment file) before archiving</strong>
            <span className="block text-xs">Recommended: saves the cycle's grades, attendance and comments in a file with the Universa brand. Your browser may ask permission to download several files.</span>
          </span>
        </label>

        <p className="text-xs text-slate-500">
          Active enrollments in these classrooms are closed automatically as part of the cycle closure. Only classrooms with status <em>Finished</em> are archived.
        </p>
        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={guardando}>
            {guardando ? (descargar ? 'Preparing Excel and archiving…' : 'Archiving…') : 'Archive cycle'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
