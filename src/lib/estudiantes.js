import { hoyLima } from './salones.js'

// Datos personales del estudiante. Los valores son los que guarda la base de datos (ver migración alumnos_datos_completos).
export const tiposDocumento = [
  { value: '', label: 'Sin documento' },
  { value: 'dni', label: 'DNI (Perú)' },
  { value: 'ce', label: 'Carné de extranjería' },
  { value: 'pasaporte', label: 'Pasaporte' },
  { value: 'licencia', label: 'Licencia de conducir' },
  { value: 'otro', label: 'Otro' },
]

export const generos = [
  { value: '', label: 'Sin indicar' },
  { value: 'M', label: 'Masculino' },
  { value: 'F', label: 'Femenino' },
  { value: 'O', label: 'Otro' },
]

export const paises = ['Perú', 'Argentina', 'Bolivia', 'Brasil', 'Chile', 'Colombia', 'Ecuador', 'España', 'Estados Unidos', 'México', 'Paraguay', 'Uruguay', 'Venezuela']

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
  if (!tipo) return 'Elige el tipo de documento'
  if (!n) return 'Indica el número de documento'
  if (tipo === 'dni') return /^[0-9]{8}$/.test(n) ? null : 'El DNI debe tener 8 dígitos'
  return /^[A-Z0-9-]{5,20}$/.test(n) ? null : 'Debe tener entre 5 y 20 letras o números'
}
