import { useRef } from 'react'
import { BLOQUES, BLOQUE_HORAS, DIAS, HORAS, clave, horaTexto } from '../../lib/disponibilidad'

const PRESETS = [
  { id: 'manana', label: 'Mornings', sub: '7:00–12:00', horas: [7, 8, 9, 10, 11] },
  { id: 'tarde', label: 'Afternoons', sub: '12:00–18:00', horas: [12, 13, 14, 15, 16, 17] },
  { id: 'noche', label: 'Evenings', sub: '18:00–23:00', horas: [18, 19, 20, 21, 22] },
]

// Cuadrícula semanal de 07:00 a 23:00 (lunes a domingo) hora por hora. Se marca con un toque o arrastrando; los encabezados marcan un día o una hora completa.
// `value` es un Set de claves «dia-hora». Sin `onChange` es de solo lectura.
export default function GrillaDisponibilidad({ value, onChange }) {
  const pintando = useRef(null) // true = marcando, false = desmarcando, null = sin arrastre
  const editable = Boolean(onChange)

  const aplicar = (claves, valor) => {
    const n = new Set(value)
    for (const k of claves) {
      if (valor) n.add(k)
      else n.delete(k)
    }
    onChange(n)
  }
  const alternarGrupo = (claves) => aplicar(claves, !claves.every((k) => value.has(k)))

  // Un bloque son sus 2 franjas de 1 hora.
  const franjasBloque = (dia, b) => Array.from({ length: BLOQUE_HORAS }, (_, i) => clave(dia, b + i))
  const inicio = (e, ks) => {
    if (!editable) return
    e.currentTarget.releasePointerCapture?.(e.pointerId) // permite arrastrar sobre otras celdas también en pantallas táctiles
    pintando.current = !ks.every((k) => value.has(k))
    aplicar(ks, pintando.current)
  }
  const sobre = (e, ks) => {
    if (!editable || pintando.current === null || e.buttons !== 1) return
    if (ks.some((k) => value.has(k) !== pintando.current)) aplicar(ks, pintando.current)
  }
  const fin = () => {
    pintando.current = null
  }

  const total = value.size
  return (
    <div>
      {editable && (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="text-sm text-slate-600">Quick-select every day:</span>
          {PRESETS.map((p) => {
            const claves = DIAS.flatMap((d) => p.horas.map((h) => clave(d.n, h)))
            const activo = claves.every((k) => value.has(k))
            return (
              <button
                key={p.id}
                type="button"
                aria-pressed={activo}
                onClick={() => alternarGrupo(claves)}
                className={`rounded-full border px-3 py-1.5 text-sm transition ${activo ? 'border-brand-600 bg-brand-600 font-semibold text-white' : 'border-brand-200 bg-white text-brand-700 hover:bg-brand-50'}`}
              >
                {p.label} <span className={`text-xs ${activo ? 'text-white/80' : 'text-slate-400'}`}>{p.sub}</span>
              </button>
            )
          })}
          <button type="button" onClick={() => onChange(new Set())} disabled={total === 0} className="rounded-full px-3 py-1.5 text-sm text-slate-500 hover:bg-slate-100 disabled:opacity-40">
            Clear
          </button>
        </div>
      )}

      <div
        className="touch-none select-none overflow-hidden rounded-2xl border border-brand-100 bg-white"
        onPointerUp={fin}
        onPointerLeave={fin}
        onPointerCancel={fin}
        role="grid"
        aria-label="Weekly availability"
      >
        <div className="grid grid-cols-[5.5rem_repeat(7,minmax(0,1fr))] border-b border-brand-100 bg-brand-50">
          <span />
          {DIAS.map((d) => (
            <button
              key={d.n}
              type="button"
              disabled={!editable}
              onClick={() => alternarGrupo(HORAS.map((h) => clave(d.n, h)))}
              title={editable ? `Select or clear all of ${d.largo}` : d.largo}
              className={`py-2 text-center text-xs font-semibold uppercase text-brand-700 ${editable ? 'hover:bg-brand-100' : ''}`}
            >
              {d.corto}
            </button>
          ))}
        </div>
        {BLOQUES.map((b) => (
          <div key={b} role="row" className="grid grid-cols-[5.5rem_repeat(7,minmax(0,1fr))] border-b border-slate-100 last:border-b-0">
            <button
              type="button"
              disabled={!editable}
              onClick={() => alternarGrupo(DIAS.flatMap((d) => franjasBloque(d.n, b)))}
              title={editable ? `Select or clear ${horaTexto(b)}–${horaTexto(b + BLOQUE_HORAS)} on all days` : undefined}
              className={`pr-2 text-right text-[11px] leading-9 text-slate-500 ${editable ? 'hover:text-brand-700' : ''}`}
            >
              {horaTexto(b)}–{horaTexto(b + BLOQUE_HORAS)}
            </button>
            {DIAS.map((d) => {
              const ks = franjasBloque(d.n, b)
              const todo = ks.every((k) => value.has(k))
              const algo = !todo && ks.some((k) => value.has(k)) // dato antiguo: solo una de las 2 horas
              return (
                <button
                  key={d.n}
                  type="button"
                  role="gridcell"
                  aria-selected={todo}
                  aria-label={`${d.largo} ${horaTexto(b)} to ${horaTexto(b + BLOQUE_HORAS)}${todo ? ', available' : algo ? ', available for one hour only' : ''}`}
                  disabled={!editable}
                  onPointerDown={(e) => inicio(e, ks)}
                  onPointerEnter={(e) => sobre(e, ks)}
                  onKeyDown={(e) => editable && (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), aplicar(ks, !todo))}
                  className={`m-px h-9 rounded-md transition-colors ${todo ? 'bg-brand-500 hover:bg-brand-600' : algo ? 'bg-brand-200 hover:bg-brand-300' : editable ? 'bg-slate-50 hover:bg-brand-100' : 'bg-slate-50'}`}
                />
              )
            })}
          </div>
        ))}
      </div>
      <p className="mt-2 text-sm text-slate-600">
        {total === 0 ? 'You have not marked any hours yet.' : `You marked ${total} free ${total === 1 ? 'hour' : 'hours'} per week.`}
        {editable && <span className="text-slate-400"> Tap or drag to select; tap again to clear.</span>}
      </p>
    </div>
  )
}
