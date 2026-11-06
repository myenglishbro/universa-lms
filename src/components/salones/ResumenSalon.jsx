const colorAviso = { error: 'text-red-600', aviso: 'text-peach-700', info: 'text-slate-500' }

function Fila({ etiqueta, children }) {
  return (
    <div className="flex justify-between gap-3 py-1.5 text-sm">
      <dt className="text-slate-500">{etiqueta}</dt>
      <dd className="text-right font-medium text-slate-900">{children}</dd>
    </div>
  )
}

const modoTexto = { ninguna: 'Manual', plan: 'Plan académico', frecuencia: 'Frecuencia', ambos: 'Plan y frecuencia' }

// Resumen en vivo del salón. `datos` sale de resumenSalon(); aquí solo se presenta. Las filas sin dato no se muestran.
export default function ResumenSalon({ datos }) {
  const { modo, nivelTexto, planTexto, frecuenciaTexto, clasesTexto, ciclosTexto, sesiones, horas, duracion, horario, inicio, fin, avisos } = datos
  return (
    <aside aria-label="Resumen del salón" className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <dl className="divide-y divide-slate-200">
        <Fila etiqueta="Nivel">{nivelTexto ?? <span className="text-peach-700">Sin asignar</span>}</Fila>
        <Fila etiqueta="Configuración">{modoTexto[modo]}</Fila>
        {planTexto && <Fila etiqueta="Plan">{planTexto}</Fila>}
        {ciclosTexto && <Fila etiqueta="Ciclos">{ciclosTexto}</Fila>}
        {frecuenciaTexto && <Fila etiqueta="Frecuencia">{frecuenciaTexto}</Fila>}
        {clasesTexto && <Fila etiqueta="Clases">{clasesTexto}</Fila>}
        <Fila etiqueta="Sesiones">{sesiones == null ? '—' : sesiones}</Fila>
        {horas && <Fila etiqueta="Horas">{horas} h</Fila>}
        {horario && <Fila etiqueta="Horario">{horario}</Fila>}
        {inicio && <Fila etiqueta="Inicio">{inicio}</Fila>}
        {fin && <Fila etiqueta="Fin estimado">{fin}</Fila>}
      </dl>
      {duracion.length > 0 && (
        <div className="mt-3 text-xs text-slate-600">
          <p className="font-medium text-slate-700">Duración estimada</p>
          {duracion.map((d, i) => (
            <p key={i}>{d}</p>
          ))}
          <p className="mt-1 text-slate-500">Es una estimación, no una fecha de finalización: no considera feriados ni recesos.</p>
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
