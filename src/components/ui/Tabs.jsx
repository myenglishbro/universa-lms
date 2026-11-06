import { useRef } from 'react'

// Pestañas accesibles (flechas ← → para moverse). `tabs`: [{ id, label, conteo? }]. El contenido lo pinta quien la usa.
export default function Tabs({ tabs, activa, onCambiar, etiqueta = 'Secciones' }) {
  const refs = useRef({})
  const mover = (e, i) => {
    const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0
    if (!d) return
    e.preventDefault()
    const t = tabs[(i + d + tabs.length) % tabs.length]
    onCambiar(t.id)
    refs.current[t.id]?.focus()
  }
  return (
    <div role="tablist" aria-label={etiqueta} className="-mx-1 flex gap-1 overflow-x-auto border-b border-brand-100 px-1">
      {tabs.map((t, i) => {
        const on = t.id === activa
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
            className={`relative -mb-px inline-flex shrink-0 items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
              on ? 'border-brand-600 text-brand-700' : 'border-transparent text-slate-500 hover:text-brand-700'
            }`}
          >
            {t.label}
            {t.conteo != null && (
              <span className={`rounded-full px-2 py-0.5 text-xs ${on ? 'bg-brand-100 text-brand-700' : 'bg-slate-100 text-slate-500'}`}>{t.conteo}</span>
            )}
          </button>
        )
      })}
    </div>
  )
}
