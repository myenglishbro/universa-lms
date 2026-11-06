import Icon from '../ui/Icon'
import Modal from '../ui/Modal'
import { incrustarDe, proveedorDe } from '../../lib/recursos'

// Ventana para leer un documento de la zona (PDF, Docs, Slides de Drive) sin salir de la plataforma.
export default function VisorDocumento({ doc, onClose }) {
  const proveedor = proveedorDe(doc.url)
  const embed = proveedor ? incrustarDe({ url: doc.url, proveedor }) : null
  return (
    <Modal wide="xl" title={doc.titulo} onClose={onClose}>
      {doc.descripcion && <p className="mb-4 text-sm text-slate-600">{doc.descripcion}</p>}
      {embed ? (
        <div className="h-[70vh] min-h-[24rem] overflow-hidden rounded-2xl bg-slate-100">
          <iframe src={embed} title={doc.titulo} className="h-full w-full" allow="fullscreen" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" />
        </div>
      ) : (
        <div className="flex h-56 flex-col items-center justify-center gap-3 rounded-2xl bg-brand-50 text-center">
          <Icon name="link" className="h-10 w-10 text-brand-500" />
          <p className="text-sm text-slate-600">Este documento se abre en otra pestaña.</p>
        </div>
      )}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-slate-400">¿No se ve? Pide a administración que lo comparta con tu cuenta.</p>
        <a href={doc.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-full border border-brand-200 px-4 py-2 text-sm font-medium text-brand-700 hover:bg-brand-50">
          <Icon name="external" className="h-4 w-4" /> Abrir o descargar
        </a>
      </div>
    </Modal>
  )
}
