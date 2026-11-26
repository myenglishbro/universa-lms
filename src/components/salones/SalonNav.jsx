import { useRef } from 'react'
import Icon from '../ui/Icon'

// Navegación lateral del salón: grupos con icono y contador. En pantallas chicas se vuelve una cuadrícula (sin scroll horizontal).
// `grupos`: [{ titulo, items: [{ id, label, icono, conteo? }] }]
export default function SalonNav({ grupos, activa, onCambiar, etiqueta = 'Classroom sections' }) {
  const refs = useRef({})
  const todos = grupos.flatMap((g) => g.items)

  const mover = (e, i) => {
    const d = ['ArrowDown', 'ArrowRight'].includes(e.key) ? 1 : ['ArrowUp', 'ArrowLeft'].includes(e.key) ? -1 : 0
    if (!d) return
    e.preventDefault()
    const t = todos[(i + d + todos.length) % todos.length]
    onCambiar(t.id)
    refs.current[t.id]?.focus()
  }

  return (
    <nav aria-label={etiqueta} className="rounded-2xl border border-slate-200 bg-white p-2 shadow-sm lg:sticky lg:top-4 lg:p-3">
      <div role="tablist" aria-label={etiqueta} aria-orientation="vertical" className="space-y-3">
        {grupos.map((g) => (
          <div key={g.titulo} className="lg:[&:not(:first-child)]:border-t lg:[&:not(:first-child)]:border-slate-100 lg:[&:not(:first-child)]:pt-2">
            <p className="px-2 pb-1 pt-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">{g.titulo}</p>
            <div className="grid grid-cols-2 gap-1 sm:grid-cols-3 lg:grid-cols-1">
              {g.items.map((t) => {
                const on = t.id === activa
                const i = todos.indexOf(t)
                return (
                  <button
                    key={t.id}
                    ref={(el) => (refs.current[t.id] = el)}
                    role="tab"
                    id={`tab-${t.id}`}
                    aria-selected={on}
                    aria-controls={`panel-${t.id}`}
                    tabIndex={on ? 0 : -1}
                    onClick={() => onCambiar(t.id)}
                    onKeyDown={(e) => mover(e, i)}
                    className={`group relative flex items-center gap-3 rounded-xl px-2.5 py-2 text-left text-sm font-medium transition-colors ${
                      on ? 'bg-brand-50 text-brand-800' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                    }`}
                  >
                    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors ${on ? 'bg-brand-600 text-white shadow-sm' : 'bg-slate-100 text-slate-500 group-hover:bg-brand-100 group-hover:text-brand-700'}`}>
                      <Icon name={t.icono} className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1 truncate">{t.label}</span>
                    {t.conteo != null && (
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums ${on ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-500'}`}>{t.conteo}</span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </nav>
  )
}
