import { useEffect, useRef, useState } from 'react'
import Icon from '../ui/Icon'
import { checklistDe, progresoChecklist } from '../../lib/tickets'
import { guardarChecklist } from '../../services/tickets'

const nuevoId = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`

// Checklist del ticket: cada cambio (marcar, agregar, editar, quitar) se guarda al instante. Archivado = solo lectura.
export default function ChecklistTicket({ ticket, deshabilitado, onCambio }) {
  const [items, setItems] = useState(() => checklistDe(ticket))
  const [nuevo, setNuevo] = useState('')
  const [error, setError] = useState('')
  const guardando = useRef(0)
  const remoto = JSON.stringify(checklistDe(ticket))
  // Un cambio hecho por otra persona se refleja, salvo mientras hay un guardado propio en curso.
  useEffect(() => {
    if (guardando.current === 0) setItems(checklistDe(ticket))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remoto])

  const aplicar = async (lista) => {
    const previo = items
    setItems(lista)
    setError('')
    guardando.current++
    try {
      const guardada = await guardarChecklist(ticket.id, lista)
      setItems(guardada)
      await onCambio()
    } catch (e) {
      setItems(previo)
      setError(e.message)
    } finally {
      guardando.current--
    }
  }
  const agregar = (e) => {
    e.preventDefault()
    const texto = nuevo.trim()
    if (!texto || items.length >= 40) return
    setNuevo('')
    aplicar([...items, { id: nuevoId(), texto, hecho: false }])
  }
  const p = progresoChecklist({ checklist: items })

  return (
    <section aria-label="Checklist" className="mt-4 border-t border-slate-100 pt-3">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900">Checklist</h3>
        {p.total > 0 && (
          <span className={`text-xs font-semibold ${p.completo ? 'text-brand-700' : 'text-slate-500'}`}>
            {p.hechos}/{p.total}
            {p.completo ? ' · all done' : ''}
          </span>
        )}
      </div>
      {p.total > 0 && (
        <div role="progressbar" aria-label="Checklist progress" aria-valuenow={Math.round((100 * p.hechos) / p.total)} aria-valuemin={0} aria-valuemax={100} className="mb-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
          <div className={`h-full rounded-full transition-all ${p.completo ? 'bg-brand-700' : 'bg-brand-500'}`} style={{ width: `${(100 * p.hechos) / p.total}%` }} />
        </div>
      )}
      <ul className="space-y-1">
        {items.map((it) => (
          <li key={it.id} className="group flex items-center gap-2 rounded-lg px-1 py-0.5 hover:bg-slate-50">
            <input type="checkbox" checked={it.hecho} disabled={deshabilitado} onChange={() => aplicar(items.map((x) => (x.id === it.id ? { ...x, hecho: !x.hecho } : x)))} aria-label={`Done: ${it.texto}`} className="h-4 w-4 shrink-0 rounded border-slate-300 text-brand-600" />
            <input
              defaultValue={it.texto}
              key={`${it.id}-${it.texto}`}
              disabled={deshabilitado}
              maxLength={200}
              aria-label="Step"
              onBlur={(e) => {
                const t = e.target.value.trim()
                if (t === it.texto) return
                aplicar(t ? items.map((x) => (x.id === it.id ? { ...x, texto: t } : x)) : items.filter((x) => x.id !== it.id))
              }}
              onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
              className={`min-w-0 flex-1 border-0 bg-transparent p-0 text-sm focus:outline-none focus:ring-0 ${it.hecho ? 'text-slate-400 line-through' : 'text-slate-800'}`}
            />
            {!deshabilitado && (
              <button type="button" onClick={() => aplicar(items.filter((x) => x.id !== it.id))} aria-label={`Remove step: ${it.texto}`} className="rounded p-1 text-slate-300 hover:bg-rose-50 hover:text-rose-600 group-hover:text-slate-400">
                <Icon name="close" className="h-3.5 w-3.5" />
              </button>
            )}
          </li>
        ))}
        {items.length === 0 && <li className="text-xs text-slate-400">No steps yet. Break the work into small steps and tick them off.</li>}
      </ul>
      {!deshabilitado && (
        <form onSubmit={agregar} className="mt-2 flex gap-2">
          <input value={nuevo} onChange={(e) => setNuevo(e.target.value)} maxLength={200} placeholder={items.length >= 40 ? 'Maximum of 40 steps' : 'Add a step and press Enter'} disabled={items.length >= 40} aria-label="New step" className="min-w-0 flex-1 rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200" />
        </form>
      )}
      {error && <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
    </section>
  )
}
