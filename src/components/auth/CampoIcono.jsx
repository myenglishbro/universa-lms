import { useState } from 'react'
import Icon from '../ui/Icon'

// Campo grande con icono a la izquierda. Con `secreto` agrega el botón «Mostrar / Ocultar» para contraseñas.
export default function CampoIcono({ icono, etiqueta, secreto = false, ayuda, className = '', ...props }) {
  const [ver, setVer] = useState(false)
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 block text-sm font-semibold text-slate-700">{etiqueta}</span>
      <span className="relative block">
        <Icon name={icono} className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
        <input
          {...props}
          type={secreto && !ver ? 'password' : secreto ? 'text' : props.type}
          className={`h-12 w-full rounded-xl border border-slate-300 bg-white pl-11 text-base text-ink placeholder:text-slate-400 transition focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200 disabled:bg-slate-50 ${secreto ? 'pr-24' : 'pr-4'}`}
        />
        {secreto && (
          <button type="button" aria-pressed={ver} onClick={() => setVer(!ver)} className="absolute inset-y-0 right-0 px-4 text-sm font-semibold text-brand-600 hover:text-brand-800">
            {ver ? 'Hide' : 'Show'}
          </button>
        )}
      </span>
      {ayuda && <span className="mt-1 block text-xs text-slate-500">{ayuda}</span>}
    </label>
  )
}
