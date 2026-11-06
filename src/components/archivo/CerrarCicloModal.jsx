import { useState } from 'react'
import Button from '../ui/Button'
import Field from '../ui/Field'
import Modal from '../ui/Modal'
import { formatFecha } from '../../lib/salones'

// Cierra un ciclo: los salones finalizados elegidos pasan al archivo bajo el nombre del ciclo.
export default function CerrarCicloModal({ finalizados, ciclosExistentes, onConfirm, onClose }) {
  const [ciclo, setCiclo] = useState('')
  const [elegidos, setElegidos] = useState(() => new Set(finalizados.map((s) => s.id)))
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
    if (!ciclo.trim()) return setError('Escribe el nombre del ciclo, por ejemplo 2026-II')
    if (elegidos.size === 0) return setError('Elige al menos un salón')
    setGuardando(true)
    try {
      await onConfirm([...elegidos], ciclo.trim())
    } catch (err) {
      setError(err.message)
      setGuardando(false)
    }
  }

  return (
    <Modal title="Cerrar ciclo y archivar" onClose={onClose} wide>
      <form onSubmit={confirmar} className="space-y-4">
        <p className="text-sm text-slate-600">
          Los salones elegidos dejan de verse en «Salones grupales» y en los portales, y pasan a <strong>Archivo de ciclos</strong> con sus estudiantes y el informe de notas de cada uno tal como están hoy. No se borra nada.
        </p>
        <Field
          label="Nombre del ciclo"
          value={ciclo}
          onChange={(e) => setCiclo(e.target.value)}
          placeholder="Ej. 2026-II"
          list="ciclos-existentes"
          autoFocus
          hint={ciclosExistentes.length ? 'Puedes reutilizar un ciclo ya archivado para añadirle más salones.' : undefined}
        />
        <datalist id="ciclos-existentes">
          {ciclosExistentes.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>

        <fieldset>
          <legend className="mb-1 text-sm font-medium text-slate-700">
            Salones finalizados ({elegidos.size} de {finalizados.length})
          </legend>
          <ul className="max-h-64 divide-y divide-slate-100 overflow-y-auto rounded-xl border border-slate-200">
            {finalizados.map((s) => (
              <li key={s.id}>
                <label className="flex cursor-pointer items-center gap-3 px-3 py-2 text-sm hover:bg-slate-50">
                  <input type="checkbox" checked={elegidos.has(s.id)} onChange={() => alternar(s.id)} />
                  <span className="flex-1">
                    <span className="font-medium text-slate-900">{s.nombre}</span>
                    <span className="block text-xs text-slate-500">
                      {s.docente || 'Sin docente'} · {formatFecha(s.fechaInicio)} → {formatFecha(s.fechaFin)}
                    </span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </fieldset>

        <p className="text-xs text-slate-500">
          Las matrículas activas de estos salones quedan cerradas con el motivo «Ciclo cerrado». Solo se archivan salones en estado <em>Finalizado</em>.
        </p>
        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={guardando}>
            {guardando ? 'Archivando…' : 'Archivar ciclo'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
