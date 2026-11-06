// Disponibilidad semanal de los profesores: franjas de 1 hora, de 07:00 a 23:00, de lunes a domingo.
// La franja `hora = 7` es 07:00–08:00 y `hora = 22` es 22:00–23:00. Los días siguen salon_horarios.dia (1 = lunes … 7 = domingo).
export const DIAS = [
  { n: 1, corto: 'Lun', largo: 'Lunes' },
  { n: 2, corto: 'Mar', largo: 'Martes' },
  { n: 3, corto: 'Mié', largo: 'Miércoles' },
  { n: 4, corto: 'Jue', largo: 'Jueves' },
  { n: 5, corto: 'Vie', largo: 'Viernes' },
  { n: 6, corto: 'Sáb', largo: 'Sábado' },
  { n: 7, corto: 'Dom', largo: 'Domingo' },
]
export const HORA_PRIMERA = 7
export const HORA_ULTIMA = 22
export const HORAS = Array.from({ length: HORA_ULTIMA - HORA_PRIMERA + 1 }, (_, i) => HORA_PRIMERA + i)

// Cada fila de la grilla es una franja de 1 hora (07–08, 08–09 …). Si algún día se quieren bloques más largos, basta subir BLOQUE_HORAS.
export const BLOQUE_HORAS = 1
export const BLOQUES = Array.from({ length: HORAS.length / BLOQUE_HORAS }, (_, i) => HORA_PRIMERA + i * BLOQUE_HORAS)

export const clave = (dia, hora) => `${dia}-${hora}`
export const horaTexto = (h) => `${String(h).padStart(2, '0')}:00`

export const aConjunto = (filas) => new Set(filas.map((f) => clave(f.dia, f.hora)))
export const aLista = (conjunto) =>
  [...conjunto].map((k) => {
    const [dia, hora] = k.split('-').map(Number)
    return { dia, hora }
  })

// Franjas que necesita un horario de salón ({ dia, horaInicio: '20:00', horaFin: '21:30' }): 20:00–21:30 ocupa las de las 20 y las 21.
export function franjasDe(h) {
  const inicio = Number(h.horaInicio.slice(0, 2))
  const fin = Math.ceil((Number(h.horaFin.slice(0, 2)) * 60 + Number(h.horaFin.slice(3, 5))) / 60)
  const lista = []
  for (let x = inicio; x < fin; x++) lista.push(clave(h.dia, x))
  return lista
}

// ¿El profesor tiene libres TODAS las franjas de TODOS los horarios del salón?
export const cubreHorarios = (conjunto, horarios) => horarios.length > 0 && horarios.every((h) => franjasDe(h).every((k) => conjunto.has(k)))

// «Lun 18:00–22:00 · Sáb 08:00–12:00»: junta las horas seguidas de cada día.
export function resumenDisponibilidad(conjunto) {
  const partes = []
  for (const d of DIAS) {
    let inicio = null
    for (const h of [...HORAS, HORA_ULTIMA + 1]) {
      const libre = conjunto.has(clave(d.n, h))
      if (libre && inicio === null) inicio = h
      if (!libre && inicio !== null) {
        partes.push(`${d.corto} ${horaTexto(inicio)}–${horaTexto(h)}`)
        inicio = null
      }
    }
  }
  return partes.join(' · ')
}
