import { useCallback } from 'react'
import useCarga from '../../hooks/useCarga'
import Icon from '../ui/Icon'
import { enlaceRecursos } from '../../services/salones'
import { proveedorDe } from '../../lib/recursos'

// Acceso a la carpeta de recursos (Drive) del curso; se abre en otra pestaña.
// Con `url` (administración ya la tiene) no consulta nada; sin `url` la pide al servidor según el acceso de la cuenta.
// Variantes: `claro` = botón translúcido para cabeceras de color; `tarjeta` = tarjeta con título y subtítulo; por defecto, botón.
// Si el curso no tiene enlace, no muestra nada.
export default function EnlaceRecursos({ salonId, url, claro = false, tarjeta = false }) {
  const cargar = useCallback(() => (url === undefined ? enlaceRecursos(salonId) : Promise.resolve(url)), [salonId, url])
  const { datos } = useCarga(cargar, '')
  const href = typeof datos === 'string' && proveedorDe(datos) ? datos : ''
  if (!href) return null
  const origen = proveedorDe(href) === 'drive' ? 'Google Drive' : new URL(href).hostname.replace(/^www\./, '')
  const abrir = { href, target: '_blank', rel: 'noopener noreferrer' }

  if (tarjeta)
    return (
      <a {...abrir} className="group flex items-center gap-4 rounded-2xl border border-brand-100 bg-white p-4 shadow-sm transition hover:border-brand-300 hover:shadow-md">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
          <Icon name="book" className="h-5 w-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-slate-900">Course materials</span>
          <span className="block truncate text-xs text-slate-500">{origen} · opens in a new tab</span>
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white group-hover:bg-brand-700">
          Open <Icon name="external" className="h-3.5 w-3.5" />
        </span>
      </a>
    )

  return (
    <a
      {...abrir}
      className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium shadow-sm transition ${
        claro ? 'bg-white/20 text-white backdrop-blur hover:bg-white/30' : 'border border-brand-200 bg-white text-brand-700 hover:bg-brand-50'
      }`}
    >
      <Icon name="book" className="h-4 w-4" /> Course materials <Icon name="external" className="h-3.5 w-3.5" />
    </a>
  )
}
