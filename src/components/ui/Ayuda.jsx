import { useState } from 'react'
import Icon from './Icon'

const leer = (id) => {
  try {
    return localStorage.getItem(`ayuda:${id}`) === 'cerrada'
  } catch {
    return false
  }
}
const guardar = (id, cerrada) => {
  try {
    localStorage.setItem(`ayuda:${id}`, cerrada ? 'cerrada' : 'abierta')
  } catch {
    /* sin almacenamiento: la ayuda simplemente no recuerda su estado */
  }
}

// Franja plegable «¿Para qué sirve esta pantalla?». Se muestra abierta la primera vez y recuerda si la cierran.
export default function Ayuda({ id, titulo = '¿Para qué sirve esta pantalla?', children }) {
  const [cerrada, setCerrada] = useState(() => leer(id))
  const alternar = () => {
    guardar(id, !cerrada)
    setCerrada(!cerrada)
  }
  return (
    <div className="mb-5 rounded-2xl border border-brand-100 bg-brand-50/60">
      <button type="button" onClick={alternar} aria-expanded={!cerrada} className="flex w-full items-center gap-3 px-4 py-3 text-left">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-700">
          <Icon name="info" className="h-4 w-4" />
        </span>
        <span className="flex-1 text-sm font-semibold text-brand-800">{titulo}</span>
        <Icon name="down" className={`h-4 w-4 text-brand-500 transition ${cerrada ? '' : 'rotate-180'}`} />
      </button>
      {!cerrada && <div className="space-y-3 px-4 pb-4 pl-15 text-sm text-slate-700 sm:pl-[3.75rem]">{children}</div>}
    </div>
  )
}

// Paso numerado para explicar un flujo.
export function Paso({ n, children }) {
  return (
    <p className="flex items-start gap-2">
      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-600 text-xs font-bold text-white">{n}</span>
      <span>{children}</span>
    </p>
  )
}
