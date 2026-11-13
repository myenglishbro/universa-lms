import { useRef, useState } from 'react'
import Badge from '../ui/Badge'
import Icon from '../ui/Icon'
import { incrustarDe, tipoLabel } from '../../lib/recursos'
import { formatFecha } from '../../lib/salones'

const PROVEEDOR = { youtube: 'YouTube', vimeo: 'Vimeo', drive: 'Google Drive', externo: 'external site' }

// Un documento (PDF, Docs, Slides) necesita una ventana alta; un video, formato panorámico.
const esDocumento = (l) => l.tipo === 'documento' || /docs\.google\.com|\/(document|presentation|spreadsheets)\//.test(l.url)

// Visor de una lección para el estudiante: video o PDF incrustado, pantalla completa y acceso directo al archivo original.
export default function VisorLeccion({ leccion: l }) {
  const caja = useRef(null)
  const [listo, setListo] = useState(null) // id de la lección cuyo iframe ya cargó
  const seguro = l.url.startsWith('https://')
  const embed = seguro ? incrustarDe(l) : null
  const documento = esDocumento(l)

  const pantallaCompleta = () => {
    const el = caja.current
    if (!el) return
    if (document.fullscreenElement) document.exitFullscreen?.()
    else el.requestFullscreen?.()
  }

  return (
    <div>
      {embed ? (
        <div ref={caja} className={`relative w-full overflow-hidden rounded-2xl bg-slate-900 shadow-sm ${documento ? 'h-[72vh] min-h-[26rem]' : 'aspect-video'}`}>
          {listo !== l.id && (
            <div className="absolute inset-0 flex animate-pulse items-center justify-center bg-slate-800 text-sm text-slate-300">
              <Icon name={documento ? 'doc' : 'play'} className="mr-2 h-5 w-5" /> Loading {documento ? 'document' : 'video'}…
            </div>
          )}
          <iframe
            key={l.id}
            src={embed}
            title={l.titulo}
            onLoad={() => setListo(l.id)}
            className="relative h-full w-full"
            allow="fullscreen; picture-in-picture; encrypted-media"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
          />
          <button
            type="button"
            onClick={pantallaCompleta}
            className="absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-black/60 px-3 py-1.5 text-xs font-medium text-white backdrop-blur transition hover:bg-black/80"
          >
            <Icon name="external" className="h-3.5 w-3.5" /> Full screen
          </button>
        </div>
      ) : (
        <div className="flex aspect-video w-full flex-col items-center justify-center gap-4 rounded-2xl bg-gradient-to-br from-brand-50 to-peach-50 p-6 text-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white text-brand-600 shadow-sm">
            <Icon name={documento ? 'doc' : 'link'} className="h-8 w-8" />
          </span>
          <p className="max-w-sm text-sm text-slate-600">This resource cannot be displayed here. Open it in {PROVEEDOR[l.proveedor]}.</p>
          {seguro && (
            <a href={l.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-full bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700">
              <Icon name="external" className="h-4 w-4" /> Open resource
            </a>
          )}
        </div>
      )}

      <div className="mt-5 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-xl font-semibold text-slate-900 sm:text-2xl">{l.titulo}</h2>
          <p className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <Badge color="brand">{tipoLabel(l.tipo)}</Badge>
            <Badge color="slate">{PROVEEDOR[l.proveedor]}</Badge>
            {l.sesionFecha && <span>Class of {formatFecha(l.sesionFecha)}</span>}
          </p>
        </div>
        {seguro && embed && (
          <a
            href={l.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-white px-4 py-2 text-sm font-medium text-brand-700 hover:bg-brand-50"
          >
            <Icon name="external" className="h-4 w-4" /> {documento ? 'Open or download' : `Open in ${PROVEEDOR[l.proveedor]}`}
          </a>
        )}
      </div>
      {l.descripcion && <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-slate-700">{l.descripcion}</p>}
      {l.proveedor !== 'externo' && (
        <p className="mt-3 text-xs text-slate-400">
          Can’t see it? The file may not be shared with your account: ask the teacher to share it in {PROVEEDOR[l.proveedor]}.
        </p>
      )}
    </div>
  )
}
