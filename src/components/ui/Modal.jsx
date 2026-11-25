import Icon from './Icon'

// Ventana modal. `subtitulo` (opcional) va bajo el título.
// Se cierra al hacer clic fuera. El encabezado queda fijo mientras se desplaza el contenido largo.
export default function Modal({ title, subtitulo, onClose, wide = false, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-brand-900/50 p-2 backdrop-blur-[2px] sm:p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === 'string' ? title : undefined}
        className={`my-2 w-full rounded-3xl bg-white shadow-2xl ring-1 ring-black/5 sm:my-8 ${wide === '2xl' ? 'max-w-6xl' : wide === 'xl' ? 'max-w-4xl' : wide ? 'max-w-2xl' : 'max-w-md'}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-20 flex items-start rounded-t-3xl justify-between gap-4 border-b border-slate-100 bg-white/95 px-5 py-4 backdrop-blur sm:px-7">
          <div className="min-w-0">
            <h2 className="truncate text-lg font-semibold leading-snug text-slate-900">{title}</h2>
            {subtitulo && <p className="mt-0.5 truncate text-sm text-slate-500">{subtitulo}</p>}
          </div>
          <button onClick={onClose} className="-mr-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-700" aria-label="Close">
            <Icon name="close" />
          </button>
        </div>
        <div className="px-5 py-5 sm:px-7 sm:py-6">{children}</div>
      </div>
    </div>
  )
}
