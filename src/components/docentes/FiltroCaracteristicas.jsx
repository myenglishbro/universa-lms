import { alternarOpcion, filtrosVacios, hayFiltros } from '../../lib/perfilDocente'

// Filtro por características internas del docente: texto en la descripción y opciones por campo. No muestra nada si no hay campos ni descripciones.
export default function FiltroCaracteristicas({ campos, filtros, onChange, className = '' }) {
  const activos = campos.filter((c) => c.activo && c.opciones.length > 0)
  return (
    <div className={`space-y-2 rounded-xl border border-brand-100 bg-brand-50/40 p-3 ${className}`}>
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Filter by teacher profile</p>
        {hayFiltros(filtros) && (
          <button type="button" onClick={() => onChange(filtrosVacios)} className="text-xs font-medium text-brand-700 hover:underline">
            Clear
          </button>
        )}
      </div>
      <input
        value={filtros.texto}
        onChange={(e) => onChange({ ...filtros, texto: e.target.value })}
        placeholder="Search the internal description (e.g. patient, exams)"
        aria-label="Search teacher descriptions"
        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm"
      />
      {activos.map((c) => (
        <div key={c.id} className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-xs font-medium text-slate-600">{c.nombre}</span>
          {c.opciones.map((o) => {
            const on = (filtros.sel[c.id] ?? []).includes(o)
            return (
              <button
                key={o}
                type="button"
                aria-pressed={on}
                onClick={() => onChange(alternarOpcion(filtros, c.id, o))}
                className={`rounded-full border px-2.5 py-0.5 text-xs transition-colors ${on ? 'border-brand-600 bg-brand-600 font-semibold text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-brand-300'}`}
              >
                {o}
              </button>
            )
          })}
        </div>
      ))}
    </div>
  )
}
