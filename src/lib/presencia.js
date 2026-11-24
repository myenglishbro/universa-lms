// Estado de cada persona en la oficina del Task Board. «Almuerzo» y «fuera» sacan al personaje de su puesto, pero sus tickets siguen a la vista.
export const PRESENCIA = [
  { id: 'disponible', label: 'Available', punto: 'bg-emerald-500', ausente: false, ayuda: 'At your desk and open to requests' },
  { id: 'ocupado', label: 'Busy', punto: 'bg-rose-500', ausente: false, ayuda: 'Focused on something: please do not interrupt' },
  { id: 'reunion', label: 'In a meeting', punto: 'bg-amber-500', ausente: false, ayuda: 'In a call or a meeting' },
  { id: 'almuerzo', label: 'At lunch', punto: 'bg-sky-500', ausente: true, ayuda: 'Away from the desk, back soon', cartel: 'Back soon' },
  { id: 'fuera', label: 'Gone for the day', punto: 'bg-slate-400', ausente: true, ayuda: 'Out of the office until tomorrow', cartel: 'Back tomorrow' },
]
export const RINCON_IDS = ['escritorio', 'reunion', 'pizarra', 'sala', 'cafe', 'archivo']

const porId = Object.fromEntries(PRESENCIA.map((p) => [p.id, p]))

// Lo que guarda la base → lo que se muestra. El estado vale solo el día en que se marcó: al día siguiente la persona vuelve a «disponible».
export function presenciaDe(fila, hoy) {
  const vigente = fila?.estado_fecha && fila.estado_fecha === hoy
  const estado = vigente && porId[fila.estado] ? fila.estado : 'disponible'
  return {
    estado,
    info: porId[estado],
    mensaje: vigente ? (fila.mensaje ?? '') : '',
    rincon: RINCON_IDS.includes(fila?.rincon) ? fila.rincon : null,
  }
}

// Reparte los rincones: cada quien en el que eligió; el resto, en los que nadie eligió (y si ya no quedan, se repiten).
export function repartirRincones(personas, elegidos) {
  const usados = new Set(personas.map((p) => elegidos[p]).filter(Boolean))
  const libres = RINCON_IDS.filter((r) => !usados.has(r))
  let i = 0
  const salida = {}
  for (const p of personas) {
    if (elegidos[p]) salida[p] = elegidos[p]
    else salida[p] = libres.length ? libres[i++ % libres.length] : RINCON_IDS[i++ % RINCON_IDS.length]
  }
  return salida
}
