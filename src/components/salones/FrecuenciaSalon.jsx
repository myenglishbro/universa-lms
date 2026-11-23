import { useState } from 'react'
import { inputClass } from '../ui/Field'
import { agruparPorIntensidad, estructuraTexto, frecuenciasParaSalon, horasSemanaTexto } from '../../lib/frecuencias'

// Elección de la frecuencia de clases del salón. Muestra solo las frecuencias activas del formato del salón
// compatibles con la modalidad elegida. La duración estimada aparece en el resumen del formulario.
export default function FrecuenciaSalon({ catalogo, frecuenciaId, modalidadCodigo, onChange }) {
  const { frecuencias = [], modalidades = [], errorFrecuencias = '' } = catalogo
  const modalidad = modalidades.find((m) => m.codigo === modalidadCodigo)
  const opciones = frecuenciasParaSalon(frecuencias, { modalidadId: modalidad?.id ?? '', actualId: frecuenciaId })
  const elegida = frecuencias.find((f) => f.id === frecuenciaId) ?? null

  // Atajo: escribir clases por semana y minutos por clase elige la frecuencia que coincida (todas las clases de igual duración).
  const [rapido, setRapido] = useState({ clases: '', minutos: '' })
  const buscar = (r) => {
    const n = Number(r.clases)
    const m = Number(r.minutos)
    if (!n || !m) return null
    return opciones.find((f) => f.minutos?.length === n && f.minutos.every((x) => Number(x) === m)) ?? null
  }
  const cambiarRapido = (campo, valor) => {
    const r = { ...rapido, [campo]: valor }
    setRapido(r)
    const f = buscar(r)
    if (f) onChange(f.id)
  }
  const sinCoincidencia = Number(rapido.clases) > 0 && Number(rapido.minutos) > 0 && !buscar(rapido)

  if (errorFrecuencias)
    return (
      <p className="text-sm text-slate-500 sm:col-span-2">
        Could not load the frequencies ({errorFrecuencias}). Turn this option off to save the classroom without a frequency.
      </p>
    )

  const etiqueta = (f) => `${f.nombre} · ${estructuraTexto(f.minutos)}${f.id === frecuenciaId && !f.activa ? ' (inactive)' : ''}`

  return (
    <div className="sm:col-span-2">
      <div className="mb-3 grid grid-cols-2 gap-3">
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700">Classes per week</span>
          <input type="number" min="1" max="7" step="1" value={rapido.clases} onChange={(e) => cambiarRapido('clases', e.target.value)} placeholder="E.g. 4" className={inputClass} />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700">Minutes per class</span>
          <input type="number" min="5" step="5" value={rapido.minutos} onChange={(e) => cambiarRapido('minutos', e.target.value)} placeholder="E.g. 60" className={inputClass} />
        </label>
        {sinCoincidencia && (
          <p className="col-span-2 text-xs text-peach-700">
            No active frequency is {rapido.clases} × {rapido.minutos} min{modalidad ? ` for ${modalidad.nombre}` : ''}. An administrator can create it under “Frequencies”.
          </p>
        )}
      </div>
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-slate-700">Class frequency</span>
        <select value={frecuenciaId} onChange={(e) => onChange(e.target.value)} className={inputClass}>
          <option value="">Select a frequency</option>
          {agruparPorIntensidad(opciones).map((g) => (
            <optgroup key={g.intensidad} label={g.intensidad}>
              {g.items.map((f) => (
                <option key={f.id} value={f.id}>
                  {etiqueta(f)}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        <span className="mt-1 block text-xs text-slate-500">
          {elegida
            ? `${estructuraTexto(elegida.minutos)} per week · ${horasSemanaTexto(elegida)}.${elegida.dias ? '' : ' Does not require specific days.'}`
            : 'Defines how many classes there are per week and how long each lasts.'}
        </span>
      </label>
      {opciones.length === 0 && (
        <p className="mt-1 text-xs text-peach-700">
          There are no active frequencies {modalidad ? `for ${modalidad.nombre}` : 'for group classrooms'}. An administrator can create them under “Frequencies”.
        </p>
      )}
    </div>
  )
}
