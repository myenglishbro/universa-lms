import { inputClass } from '../ui/Field'
import { agruparPorIntensidad, estructuraTexto, frecuenciasParaSalon, horasSemanaTexto } from '../../lib/frecuencias'

// Elección de la frecuencia de clases del salón. Muestra solo las frecuencias activas del formato del salón
// compatibles con la modalidad elegida. La duración estimada aparece en el resumen del formulario.
export default function FrecuenciaSalon({ catalogo, frecuenciaId, modalidadCodigo, onChange }) {
  const { frecuencias = [], modalidades = [], errorFrecuencias = '' } = catalogo
  const modalidad = modalidades.find((m) => m.codigo === modalidadCodigo)
  const opciones = frecuenciasParaSalon(frecuencias, { modalidadId: modalidad?.id ?? '', actualId: frecuenciaId })
  const elegida = frecuencias.find((f) => f.id === frecuenciaId) ?? null

  if (errorFrecuencias)
    return (
      <p className="text-sm text-slate-500 sm:col-span-2">
        Could not load the frequencies ({errorFrecuencias}). Turn this option off to save the classroom without a frequency.
      </p>
    )

  const etiqueta = (f) => `${f.nombre} · ${estructuraTexto(f.minutos)}${f.id === frecuenciaId && !f.activa ? ' (inactive)' : ''}`

  return (
    <div className="sm:col-span-2">
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
