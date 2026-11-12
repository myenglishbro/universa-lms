import { useState } from 'react'
import Button from '../ui/Button'
import Icon from '../ui/Icon'
import { descargarCompendio } from '../../services/compendio'

// Descarga el compendio Excel (ASSESSMENT FILE) de un salón. `archivo`: filas guardadas al cerrar el ciclo (salones archivados).
export default function BotonCompendio({ salon, archivo = null, variant = 'secondary', className = '', etiqueta = 'Download Excel' }) {
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
      <Button type="button" variant={variant} className={className} onClick={descargar} disabled={estado === 'generando'} title="Excel workbook with the classroom profile, grades, attendance and rubrics">
        <Icon name={estado === 'listo' ? 'check' : 'doc'} className="h-4 w-4" />
        {estado === 'generando' ? 'Preparing…' : estado === 'listo' ? 'Downloaded' : etiqueta}
      </Button>
      {error && (
        <span role="alert" className="mt-1 max-w-64 text-xs text-rose-700">
          Could not generate the Excel file: {error}
        </span>
      )}
    </span>
  )
}
