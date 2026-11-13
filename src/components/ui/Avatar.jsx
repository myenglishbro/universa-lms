import { useState } from 'react'
import { fotoDeDrive } from '../../lib/fotos'

const TAMANOS = { sm: 'h-8 w-8 text-xs', md: 'h-11 w-11 text-base', lg: 'h-20 w-20 text-2xl', xl: 'h-28 w-28 text-4xl' }

// Foto de perfil: usa el enlace de Drive y, si no hay foto o no carga, muestra la inicial del nombre sobre un círculo de color.
export default function Avatar({ nombre = '', fotoUrl = '', tamano = 'md', className = '' }) {
  const [fallo, setFallo] = useState(null)
  const src = fotoDeDrive(fotoUrl)
  const inicial = nombre.trim().charAt(0).toUpperCase() || '?'
  const mostrar = src && fallo !== src
  return (
    <span className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-100 font-bold text-brand-700 ${TAMANOS[tamano]} ${className}`}>
      {mostrar ? (
        <img src={src} alt={nombre ? `Photo of ${nombre}` : ''} className="h-full w-full object-cover" referrerPolicy="no-referrer" onError={() => setFallo(src)} />
      ) : (
        inicial
      )}
    </span>
  )
}
