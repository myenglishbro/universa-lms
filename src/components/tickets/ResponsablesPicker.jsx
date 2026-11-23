import { inputClass } from '../ui/Field'
import { colorAvatar, nombreCorto } from '../../lib/tickets'

// Elección de varios responsables: se agregan de uno en uno desde la lista y quedan como etiquetas que se pueden quitar.
// `personal`: usuarios administrativos. `conservar`: responsables actuales aunque ya estén desactivados (para poder verlos y quitarlos).
export default function ResponsablesPicker({ personal, valor, onChange, miId, conservar = [], deshabilitado = false }) {
  const porId = Object.fromEntries(personal.map((p) => [p.user_id, p]))
  const disponibles = personal.filter((p) => !valor.includes(p.user_id) && (p.activo || conservar.includes(p.user_id)))
  const etiqueta = (id) => `${nombreCorto(porId[id]?.correo, 'someone')}${id === miId ? ' (me)' : ''}${porId[id] && !porId[id].activo ? ' (inactive)' : ''}`
  return (
    <div>
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-slate-700">Assignees</span>
        <select value="" onChange={(e) => e.target.value && onChange([...valor, e.target.value])} className={inputClass} disabled={deshabilitado} aria-label="Add an assignee">
          <option value="">{disponibles.length ? (valor.length ? 'Add another assignee…' : 'Add an assignee…') : 'Everyone is already assigned'}</option>
          {disponibles.map((p) => (
            <option key={p.user_id} value={p.user_id}>
              {p.user_id === miId ? `${p.correo} (me)` : p.correo}
            </option>
          ))}
        </select>
      </label>
      {valor.length === 0 ? (
        <p className="mt-1 text-xs text-slate-500">Unassigned</p>
      ) : (
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {valor.map((id) => (
            <li key={id} className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 py-0.5 pl-0.5 pr-2 text-xs font-medium text-slate-700" title={porId[id]?.correo}>
              <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold uppercase ${colorAvatar(nombreCorto(porId[id]?.correo, '?'))}`}>
                {nombreCorto(porId[id]?.correo, '?').charAt(0)}
              </span>
              {etiqueta(id)}
              {!deshabilitado && (
                <button type="button" onClick={() => onChange(valor.filter((x) => x !== id))} aria-label={`Remove ${etiqueta(id)}`} className="text-slate-400 hover:text-slate-700">
                  ×
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
