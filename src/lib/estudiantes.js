import { hoyLima } from './salones.js'

// Datos personales del estudiante. Los valores son los que guarda la base de datos (ver migración alumnos_datos_completos).
export const tiposDocumento = [
  { value: '', label: 'No document' },
  { value: 'dni', label: 'DNI (Peru)' },
  { value: 'ce', label: 'Foreigner ID card' },
  { value: 'pasaporte', label: 'Passport' },
  { value: 'licencia', label: 'Driver license' },
  { value: 'otro', label: 'Other' },
]

export const generos = [
  { value: '', label: 'Not specified' },
  { value: 'M', label: 'Male' },
  { value: 'F', label: 'Female' },
  { value: 'O', label: 'Other' },
]

export const paises = ['Perú', 'Argentina', 'Bolivia', 'Brasil', 'Chile', 'Colombia', 'Ecuador', 'España', 'Estados Unidos', 'México', 'Paraguay', 'Uruguay', 'Venezuela'] // valores guardados tal cual en la base

export const etiquetaTipoDocumento = (v) => tiposDocumento.find((t) => t.value === v)?.label ?? ''
export const etiquetaGenero = (v) => generos.find((g) => g.value === v)?.label ?? ''

// Edad en años cumplidos a una fecha (por defecto hoy en Lima). null si falta la fecha o no es válida.
export function calcularEdad(nacimiento, hoy = hoyLima()) {
  if (!nacimiento || !/^\d{4}-\d{2}-\d{2}$/.test(nacimiento)) return null
  const [ny, nm, nd] = nacimiento.split('-').map(Number)
  const [hy, hm, hd] = hoy.split('-').map(Number)
  const edad = hy - ny - (hm < nm || (hm === nm && hd < nd) ? 1 : 0)
  return edad >= 0 ? edad : null
}

// Misma regla que la base de datos: el DNI tiene 8 dígitos; los demás documentos, 5 a 20 letras o números. null = válido.
export function errorDocumento(tipo, numero) {
  const n = (numero ?? '').replace(/\s+/g, '').toUpperCase()
  if (!tipo && !n) return null
  if (!tipo) return 'Choose the document type'
  if (!n) return 'Enter the document number'
  if (tipo === 'dni') return /^[0-9]{8}$/.test(n) ? null : 'The DNI must have 8 digits'
  return /^[A-Z0-9-]{5,20}$/.test(n) ? null : 'Must be 5 to 20 letters or numbers'
}
