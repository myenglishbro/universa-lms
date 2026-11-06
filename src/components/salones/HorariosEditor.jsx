import Button from '../ui/Button'
import { inputClass } from '../ui/Field'
import Icon from '../ui/Icon'
import { diasSemana } from '../../lib/salones'

// Lista editable de franjas: cada fila es un día con su hora de inicio y fin.
export default function HorariosEditor({ horarios, onChange, error }) {
  const cambiar = (i, campo, valor) =>
    onChange(horarios.map((h, j) => (j === i ? { ...h, [campo]: valor } : h)))

  return (
    <fieldset>
      <legend className="mb-1 text-sm font-medium text-slate-700">Horarios de clase</legend>
      <div className="space-y-2">
        {horarios.map((h, i) => (
          <div key={i} className="flex flex-wrap items-center gap-2">
            <select
              value={h.dia}
              onChange={(e) => cambiar(i, 'dia', Number(e.target.value))}
              className={`${inputClass} w-full sm:w-36`}
              aria-label="Día"
            >
              {diasSemana.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </select>
            <input type="time" value={h.horaInicio} onChange={(e) => cambiar(i, 'horaInicio', e.target.value)} className={`${inputClass} w-auto flex-1`} aria-label="Hora de inicio" required />
            <span className="text-slate-400">–</span>
            <input type="time" value={h.horaFin} onChange={(e) => cambiar(i, 'horaFin', e.target.value)} className={`${inputClass} w-auto flex-1`} aria-label="Hora de fin" required />
            <button
              type="button"
              onClick={() => onChange(horarios.filter((_, j) => j !== i))}
              className="rounded p-1 text-slate-400 hover:text-red-600"
              aria-label="Quitar horario"
            >
              <Icon name="close" className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      <Button
        type="button"
        variant="ghost"
        className="mt-1 px-2 py-1"
        onClick={() => onChange([...horarios, { dia: 1, horaInicio: '', horaFin: '' }])}
      >
        <Icon name="plus" className="h-4 w-4" /> Agregar horario
      </Button>
    </fieldset>
  )
}
