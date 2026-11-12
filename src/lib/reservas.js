// Reservas de docente: bloques puntuales (examen de nivel, entrevista…) que ocupan al docente como una clase.
export const tiposReserva = [
  { value: 'examen_nivel', label: 'Placement test' },
  { value: 'entrevista', label: 'Interview' },
  { value: 'reunion', label: 'Meeting' },
  { value: 'otro', label: 'Other' },
]

export const tituloReserva = (r) => [tiposReserva.find((t) => t.value === r.tipo)?.label, r.titulo?.trim()].filter(Boolean).join(' · ')
