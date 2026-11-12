const colorAviso = { error: 'text-red-600', aviso: 'text-peach-700', info: 'text-slate-500' }

function Fila({ etiqueta, children }) {
  return (
    <div className="flex justify-between gap-3 py-1.5 text-sm">
      <dt className="text-slate-500">{etiqueta}</dt>
      <dd className="text-right font-medium text-slate-900">{children}</dd>
    </div>
  )
}

const modoTexto = { ninguna: 'Manual', plan: 'Academic plan', frecuencia: 'Frequency', ambos: 'Plan and frequency' }

// Resumen en vivo del salón. `datos` sale de resumenSalon(); aquí solo se presenta. Las filas sin dato no se muestran.
export default function ResumenSalon({ datos }) {
  const { modo, nivelTexto, planTexto, frecuenciaTexto, clasesTexto, ciclosTexto, sesiones, horas, duracion, horario, inicio, fin, avisos } = datos
  return (
    <aside aria-label="Classroom summary" className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <dl className="divide-y divide-slate-200">
        <Fila etiqueta="Level">{nivelTexto ?? <span className="text-peach-700">Unassigned</span>}</Fila>
        <Fila etiqueta="Setup">{modoTexto[modo]}</Fila>
        {planTexto && <Fila etiqueta="Plan">{planTexto}</Fila>}
        {ciclosTexto && <Fila etiqueta="Cycles">{ciclosTexto}</Fila>}
        {frecuenciaTexto && <Fila etiqueta="Frequency">{frecuenciaTexto}</Fila>}
        {clasesTexto && <Fila etiqueta="Classes">{clasesTexto}</Fila>}
        <Fila etiqueta="Sessions">{sesiones == null ? '—' : sesiones}</Fila>
        {horas && <Fila etiqueta="Hours">{horas} h</Fila>}
        {horario && <Fila etiqueta="Schedule">{horario}</Fila>}
        {inicio && <Fila etiqueta="Start">{inicio}</Fila>}
        {fin && <Fila etiqueta="Estimated end">{fin}</Fila>}
      </dl>
      {duracion.length > 0 && (
        <div className="mt-3 text-xs text-slate-600">
          <p className="font-medium text-slate-700">Estimated duration</p>
          {duracion.map((d, i) => (
            <p key={i}>{d}</p>
          ))}
          <p className="mt-1 text-slate-500">This is an estimate, not an end date: it does not account for holidays or breaks.</p>
        </div>
      )}
      {avisos.length > 0 && (
        <ul className="mt-3 space-y-1 border-t border-slate-200 pt-3 text-xs">
          {avisos.map((a, i) => (
            <li key={i} className={colorAviso[a.nivel]}>
              {a.texto}
            </li>
          ))}
        </ul>
      )}
    </aside>
  )
}
