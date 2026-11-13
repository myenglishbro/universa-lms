import { createContext, useContext, useState } from 'react'
import { inputClass } from '../ui/Field'
import { acotarPuntaje, adaptarNivel, agruparCriterios, bandaDe, fmtNota, nombreEnGrupo, subtotalGrupo } from '../../lib/evaluaciones'

// Formulario de los criterios de una rúbrica (diseño de la guía de Project Assessment): título con el total de puntos, una fila por criterio con su campo
// «0–máx» y «/máx», y los criterios que comparten prefijo («Grupo · Parte») dentro de un bloque con subtotal («0 / 25»).
// Cada campo se mantiene entre 0 y su máximo; vacío = pendiente. La descripción y los niveles de desempeño van en un desplegable bajo cada criterio.
//   criterios: [{ id, nombre, descripcion, max_puntaje, bandas }]   valores: { [id]: texto }   onCambiar(id, texto)
//   titulo: encabezado opcional (con badge de puntos)   etiquetaSufijo: texto para los aria-label (p. ej. « for Ana»)
//   sinDetalle: oculta descripción y niveles (Formative)
// Nivel MCER del salón (p. ej. «A2.2 – B1.1»): adapta los descriptores. Sin proveedor = texto general.
export const NivelMcerContext = createContext(null)

export default function CriteriosRubrica({ criterios, valores, onCambiar, deshabilitado = false, etiquetaSufijo = '', sinDetalle = false, titulo = '' }) {
  const mcer = useContext(NivelMcerContext)
  const [abiertos, setAbiertos] = useState({})
  const total = criterios.reduce((s, c) => s + Number(c.max_puntaje), 0)

  const campo = (c, etiqueta, enGrupo) => {
    const banda = bandaDe(c, valores?.[c.id])
    const hayNiveles = (c.bandas ?? []).some((b) => b.desde != null)
    return (
      <div key={c.id} className="py-1.5">
        <div className="flex items-center justify-between gap-3">
          <span className={`text-sm ${enGrupo ? 'pl-1 text-slate-700' : 'text-slate-800'}`}>
            {enGrupo && <span aria-hidden="true">↳ </span>}
            {etiqueta}
            {!sinDetalle && (c.descripcion || hayNiveles) && (
              <button
                type="button"
                onClick={() => setAbiertos((x) => ({ ...x, [c.id]: !x[c.id] }))}
                aria-expanded={!!abiertos[c.id]}
                aria-label={`Show performance levels for ${etiqueta}`}
                title="Low / Fair / Excellent descriptors"
                className="ml-1.5 inline-flex h-4 w-4 items-center justify-center rounded-full border border-brand-300 align-middle text-[10px] font-bold leading-none text-brand-700 hover:bg-brand-50"
              >
                i
              </button>
            )}
            {banda && !sinDetalle && <span className="ml-2 text-[11px] font-medium text-brand-700">{banda.etiqueta}</span>}
          </span>
          <span className="flex shrink-0 items-center gap-2">
            <input
              type="number"
              inputMode="decimal"
              min={0}
              max={c.max_puntaje}
              step="0.5"
              disabled={deshabilitado}
              aria-label={`${c.nombre}${etiquetaSufijo}`}
              value={valores?.[c.id] ?? ''}
              onChange={(e) => onCambiar(c.id, acotarPuntaje(e.target.value, c.max_puntaje))}
              className={`${inputClass} w-24 rounded-full text-right`}
              placeholder={`0–${fmtNota(c.max_puntaje)}`}
            />
            <span className="w-9 text-xs text-slate-500">/{fmtNota(c.max_puntaje)}</span>
          </span>
        </div>
        {!sinDetalle && abiertos[c.id] && (
          <div className="mt-1 rounded-xl bg-brand-50/50 px-3 py-2">
            {c.descripcion && <p className="text-xs text-slate-600">{adaptarNivel(c.descripcion, mcer)}</p>}
            {hayNiveles && (
              <ul className="mt-1 space-y-1">
                {c.bandas.map((b) => (
                  <li key={b.etiqueta} className={`text-xs ${banda?.etiqueta === b.etiqueta ? 'font-semibold text-brand-800' : 'text-slate-600'}`}>
                    <span className="font-semibold">{b.etiqueta} ({fmtNota(b.desde)}–{fmtNota(b.hasta)})</span>
                    {b.descripcion ? `: ${adaptarNivel(b.descripcion, mcer)}` : ''}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className={titulo ? 'rounded-2xl border border-brand-100 bg-white px-4 py-3' : ''}>
      {titulo && (
        <div className="mb-1 flex items-center justify-between gap-3">
          <h3 className="text-base font-semibold text-slate-900">{titulo}</h3>
          <span className="rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-semibold text-brand-800">{fmtNota(total)} pts</span>
        </div>
      )}
      <ul className="divide-y divide-slate-100">
        {agruparCriterios(criterios).map((g) => {
          if (!g.grupo) return <li key={g.items[0].id}>{campo(g.items[0], g.items[0].nombre, false)}</li>
          const sub = subtotalGrupo(g.items, valores)
          return (
            <li key={g.grupo} className="py-1">
              <div className="flex items-center justify-between gap-3 pt-1.5">
                <span className="text-sm font-semibold text-slate-900">{g.grupo}</span>
                <span className="text-xs font-medium text-slate-600" aria-label={`Subtotal of ${g.grupo}`}>
                  {fmtNota(sub.suma)} / {fmtNota(g.max)}
                </span>
              </div>
              {g.items.map((c) => campo(c, nombreEnGrupo(c, g.grupo), true))}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
