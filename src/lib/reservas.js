// Reservas de docente: bloques puntuales (examen de nivel, entrevista…) que ocupan al docente como una clase.
export const tiposReserva = [
  { value: 'examen_nivel', label: 'Examen de nivel' },
  { value: 'entrevista', label: 'Entrevista' },
  { value: 'reunion', label: 'Reunión' },
  { value: 'otro', label: 'Otro' },
]

export const tituloReserva = (r) => [tiposReserva.find((t) => t.value === r.tipo)?.label, r.titulo?.trim()].filter(Boolean).join(' · ')
