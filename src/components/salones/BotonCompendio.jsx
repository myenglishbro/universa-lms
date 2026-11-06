import { useState } from 'react'
import Button from '../ui/Button'
import Icon from '../ui/Icon'
import { descargarCompendio } from '../../services/compendio'

// Descarga el compendio Excel (ASSESSMENT FILE) de un salón. `archivo`: filas guardadas al cerrar el ciclo (salones archivados).
export default function BotonCompendio({ salon, archivo = null, variant = 'secondary', className = '', etiqueta = 'Descargar Excel' }) {
  const [estado, setEstado] = useState('inicio') // inicio | generando | listo
  const [error, setError] = useState('')

  const descargar = async (e) => {
    e.stopPropagation()
    setError('')
    setEstado('generando')
    try {
      await descargarCompendio(salon, { archivo })
      setEstado('listo')
      setTimeout(() => setEstado('inicio'), 3000)
    } catch (err) {
      setError(err.message)
      setEstado('inicio')
    }
  }

  return (
    <span className="inline-flex flex-col items-start">
      <Button type="button" variant={variant} className={className} onClick={descargar} disabled={estado === 'generando'} title="Libro de Excel con ficha, notas, asistencia y rúbricas del salón">
        <Icon name={estado === 'listo' ? 'check' : 'doc'} className="h-4 w-4" />
        {estado === 'generando' ? 'Preparando…' : estado === 'listo' ? 'Descargado' : etiqueta}
      </Button>
      {error && (
        <span role="alert" className="mt-1 max-w-64 text-xs text-rose-700">
          No se pudo generar el Excel: {error}
        </span>
      )}
    </span>
  )
}
