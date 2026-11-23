import { inputClass } from '../ui/Field'

// Estudiantes adicionales del paquete (pareja, hermanos, grupo pequeño): se eligen de a uno y quedan como etiquetas que se pueden quitar.
// `excluidos` son los que ya no se pueden elegir (el titular o los ya matriculados).
export default function AlumnosExtra({ alumnos, seleccionados, excluidos = [], onChange }) {
  const disponibles = alumnos.filter((a) => !seleccionados.includes(a.id) && !excluidos.includes(a.id))
  const nombre = (id) => alumnos.find((a) => a.id === id)?.nombre ?? '—'
  return (
    <div>
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-slate-700">Additional students (optional)</span>
        <select
          value=""
          onChange={(e) => e.target.value && onChange([...seleccionados, e.target.value])}
          className={inputClass}
          aria-label="Add another student"
        >
          <option value="">{disponibles.length ? 'Add another student…' : 'No more students available'}</option>
          {disponibles.map((a) => (
            <option key={a.id} value={a.id}>
              {a.nombre}
            </option>
          ))}
        </select>
      </label>
      {seleccionados.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {seleccionados.map((id) => (
            <li key={id} className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-800">
              {nombre(id)}
              <button type="button" onClick={() => onChange(seleccionados.filter((x) => x !== id))} aria-label={`Remove ${nombre(id)}`} className="text-brand-600 hover:text-brand-900">
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-1 text-xs text-slate-500">They share the package hours: each class is deducted once, not per student.</p>
    </div>
  )
}
