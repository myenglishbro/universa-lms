import { useState } from 'react'
import Icon from '../ui/Icon'
import SalonesCards from './SalonesCards'
import { SIN_NIVEL, estados } from '../../lib/salones'

const ORDEN_ESTADO = { en_curso: 0, pendiente: 1, finalizado: 2 }
const PUNTO = { en_curso: 'bg-emerald-500', pendiente: 'bg-amber-400', finalizado: 'bg-slate-300' }

const conPendientes = (s) => (s.progreso?.porRegistrar ?? 0) > 0 || (s.pendientes?.sinGrabacion ?? 0) > 0

// Salones agrupados por nivel académico en acordeón: cada nivel se despliega a demanda (o todos a la vez) y, dentro,
// van primero los que están en curso, luego los pendientes y al final los finalizados.
// `abrirTodo`: se fuerza a mostrar todo abierto (p. ej. al elegir un nivel o buscar).
export default function SalonesAgrupados({ salones, niveles, puedeEditar, abrirTodo = false, onVer, onEditar }) {
  const [abiertos, setAbiertos] = useState(() => new Set())
  const grupos = [
    ...niveles.map((n) => ({ id: n.id, nombre: n.nombre, lista: salones.filter((s) => s.nivelId === n.id) })),
    { id: SIN_NIVEL, nombre: 'Sin nivel asignado', lista: salones.filter((s) => !s.nivelId) },
  ].filter((g) => g.lista.length > 0)

  const estaAbierto = (id) => abrirTodo || grupos.length === 1 || abiertos.has(id)
  const alternar = (id) =>
    setAbiertos((prev) => {
      const n = new Set(prev)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  const todosAbiertos = grupos.every((g) => estaAbierto(g.id))

  return (
    <div>
      <div className="flex items-center justify-between gap-2 px-4 pt-3">
        <p className="text-sm text-slate-500">
          {grupos.length} {grupos.length === 1 ? 'nivel' : 'niveles'} · {salones.length} {salones.length === 1 ? 'salón' : 'salones'}
        </p>
        {grupos.length > 1 && !abrirTodo && (
          <button
            type="button"
            onClick={() => setAbiertos(todosAbiertos ? new Set() : new Set(grupos.map((g) => g.id)))}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-brand-700 hover:bg-brand-50"
          >
            <Icon name={todosAbiertos ? 'up' : 'down'} className="h-4 w-4" /> {todosAbiertos ? 'Contraer todo' : 'Expandir todo'}
          </button>
        )}
      </div>

      <div className="space-y-3 p-4">
        {grupos.map((g) => {
          const ordenados = [...g.lista].sort((a, b) => ORDEN_ESTADO[a.estado] - ORDEN_ESTADO[b.estado] || a.nombre.localeCompare(b.nombre))
          const abierto = estaAbierto(g.id)
          const nPend = g.lista.filter(conPendientes).length
          const panel = `nivel-${g.id}`
          return (
            <section key={g.id} aria-label={`Nivel ${g.nombre}`} className={`overflow-hidden rounded-2xl border bg-white transition-shadow ${abierto ? 'border-brand-200 shadow-sm' : 'border-slate-200 hover:border-brand-200 hover:shadow-sm'}`}>
              <button
                type="button"
                aria-expanded={abierto}
                aria-controls={panel}
                onClick={() => alternar(g.id)}
                disabled={abrirTodo || grupos.length === 1}
                className={`flex w-full flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3.5 text-left transition-colors disabled:cursor-default ${abierto ? 'bg-brand-50/70' : 'bg-white hover:bg-brand-50/40'}`}
              >
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${abierto ? 'bg-brand-600 text-white' : 'bg-brand-100 text-brand-700'}`}>
                  <Icon name="box" className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-base font-bold text-brand-800">{g.nombre}</span>
                  <span className="block text-xs text-slate-500">
                    {g.lista.length} {g.lista.length === 1 ? 'salón' : 'salones'}
                  </span>
                </span>
                <span className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
                  {estados.map((e) => {
                    const n = g.lista.filter((s) => s.estado === e.value).length
                    return (
                      n > 0 && (
                        <span key={e.value} className="inline-flex items-center gap-1.5">
                          <span className={`h-2 w-2 rounded-full ${PUNTO[e.value]}`} /> {n} {e.label.toLowerCase()}
                        </span>
                      )
                    )
                  })}
                  {nPend > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-peach-50 px-2 py-0.5 font-medium text-peach-700 ring-1 ring-inset ring-peach-200">
                      <Icon name="alert" className="h-3 w-3" /> {nPend} con pendientes
                    </span>
                  )}
                </span>
                {!abrirTodo && grupos.length > 1 && <Icon name="down" className={`h-5 w-5 shrink-0 text-slate-400 transition-transform ${abierto ? 'rotate-180' : ''}`} />}
              </button>
              {abierto && (
                <div id={panel} className="border-t border-brand-100">
                  <SalonesCards salones={ordenados} puedeEditar={puedeEditar} onVer={onVer} onEditar={onEditar} />
                </div>
              )}
            </section>
          )
        })}
      </div>
    </div>
  )
}
