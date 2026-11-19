// «Needs attention»: cada pendiente es un botón con su conteo que filtra la lista (otra vez para quitar el filtro). Sin pendientes, lo dice.
const TONO = {
  rose: 'bg-rose-50 text-rose-700',
  peach: 'bg-peach-50 text-peach-700',
}

export default function FranjaAtencion({ grupos, activo, onElegir }) {
  const conteo = grupos.filter((g) => g.n > 0)
  return (
    <section aria-label="Needs attention" className="mb-4 flex flex-wrap items-center gap-2 rounded-2xl border border-brand-100 bg-white px-4 py-3 shadow-sm">
      {conteo.length > 0 ? (
        <>
          <span className="mr-1 text-sm font-semibold text-slate-900">Needs attention</span>
          {conteo.map((g) => (
            <button
              key={g.clave}
              type="button"
              aria-pressed={activo === g.clave}
              onClick={() => onElegir(activo === g.clave ? '' : g.clave)}
              title={g.ayuda}
              className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${TONO[g.tono]} ${activo === g.clave ? 'ring-2 ring-current ring-offset-2' : 'hover:brightness-95'}`}
            >
              <span className="tabular-nums">{g.n}</span> {g.etiqueta}
            </button>
          ))}
        </>
      ) : (
        <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-sm font-semibold text-emerald-700">✓ Everything is up to date</span>
      )}
    </section>
  )
}
