import Badge from '../ui/Badge'
import Icon from '../ui/Icon'
import { incrustarDe, tipoLabel } from '../../lib/recursos'
import { formatFecha } from '../../lib/salones'

const proveedorNombre = { youtube: 'YouTube', vimeo: 'Vimeo', drive: 'Google Drive', externo: 'external site' }

// Muestra una lección: video/archivo incrustado cuando es posible y, siempre, un botón para abrirlo en su plataforma.
export default function ReproductorRecurso({ leccion: l }) {
  const seguro = l.url.startsWith('https://')
  const embed = seguro ? incrustarDe(l) : null
  return (
    <div>
      {embed ? (
        <div className="aspect-video w-full overflow-hidden rounded-xl bg-slate-900 shadow-sm">
          <iframe
            key={l.id}
            src={embed}
            title={l.titulo}
            className="h-full w-full"
            loading="lazy"
            allow="fullscreen; picture-in-picture; encrypted-media"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
          />
        </div>
      ) : (
        <div className="flex aspect-video w-full flex-col items-center justify-center gap-3 rounded-xl bg-gradient-to-br from-slate-100 to-brand-50 p-6 text-center">
          <Icon name={l.tipo === 'documento' ? 'doc' : 'link'} className="h-12 w-12 text-brand-500" />
          <p className="text-sm text-slate-600">This resource opens in {proveedorNombre[l.proveedor]}.</p>
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-xl font-semibold text-slate-900">{l.titulo}</h2>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <Badge color="brand">{tipoLabel(l.tipo)}</Badge>
            {l.sesionFecha && <span>Class of {formatFecha(l.sesionFecha)}</span>}
          </p>
        </div>
        {seguro && (
          <a
            href={l.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <Icon name="external" className="h-4 w-4" /> Open in {proveedorNombre[l.proveedor]}
          </a>
        )}
      </div>
      {l.descripcion && <p className="mt-3 whitespace-pre-line text-sm text-slate-700">{l.descripcion}</p>}
      {l.proveedor !== 'externo' && (
        <p className="mt-3 text-xs text-slate-400">
          If you cannot see it, the file is not shared with your account: ask the teacher to share it in {proveedorNombre[l.proveedor]}.
        </p>
      )}
    </div>
  )
}
