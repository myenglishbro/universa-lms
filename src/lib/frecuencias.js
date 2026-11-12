// Helpers de frecuencias de clase. Solo presentan y filtran lo que entrega Supabase (horas por semana y duración
// teórica las calcula la base de datos); no contienen reglas académicas.
//
// Forma de una frecuencia (ver services/frecuencias.js):
// { id, codigo, nombre, formato, intensidad, clases, minutos: [..], dias: [..]|null, horasSemana, activa,
//   estado ('confirmado'|'pendiente'), notas, modalidadIds: [..], duraciones: [{ modalidadId, modalidad, horasNivel, semanas, meses }] }

export const FORMATO_SALON = 'grupal' // los salones de Universa son grupales; la arquitectura admite también 'privado'
export const formatos = [
  { value: 'grupal', label: 'Group' },
  { value: 'privado', label: 'Private' },
]
export const formatoLabel = (v) => formatos.find((f) => f.value === v)?.label ?? v

const num = (n) => String(Math.round(n * 100) / 100)

export const horasTexto = (minutos) => `${num(minutos / 60)} h`

// "5 × 1 h" o, con clases de distinta duración, "2 × 2 h + 1 × 1 h".
export function estructuraTexto(minutos) {
  if (!minutos?.length) return 'Not defined'
  const grupos = []
  for (const m of [...minutos].sort((a, b) => b - a)) {
    const g = grupos.find((x) => x.m === m)
    if (g) g.n += 1
    else grupos.push({ m, n: 1 })
  }
  return grupos.map((g) => `${g.n} × ${horasTexto(g.m)}`).join(' + ')
}

export const horasSemanaTexto = (f) => (f.horasSemana == null ? '—' : `${num(f.horasSemana)} h per week`)

export const estadoFrecuencia = (f) => (f.estado === 'pendiente' ? 'pendiente' : f.activa ? 'activa' : 'inactiva')

// Opciones del selector de un salón: activas y confirmadas, del formato indicado y compatibles con la modalidad elegida.
// Sin modalidad elegida se muestran todas las del formato. La frecuencia que el salón ya tiene se conserva siempre.
export function frecuenciasParaSalon(frecuencias, { formato = FORMATO_SALON, modalidadId = '', actualId = '' } = {}) {
  return frecuencias.filter(
    (f) =>
      f.formato === formato &&
      (f.id === actualId || (f.activa && f.estado === 'confirmado' && (!modalidadId || f.modalidadIds.includes(modalidadId)))),
  )
}

// Grupos por intensidad conservando el orden del catálogo.
export function agruparPorIntensidad(lista) {
  const grupos = []
  for (const f of lista) {
    const nombre = f.intensidad || 'Other'
    const g = grupos.find((x) => x.intensidad === nombre)
    if (g) g.items.push(f)
    else grupos.push({ intensidad: nombre, items: [f] })
  }
  return grupos
}

// Duraciones teóricas que corresponden mostrar: la de la modalidad elegida o, si no hay, la de cada modalidad compatible.
export const duracionesParaMostrar = (f, modalidadId) =>
  f.duraciones.filter((d) => !modalidadId || d.modalidadId === modalidadId)

export const textoDuracion = (d) => {
  const meses = d.meses === 1 ? '1 month' : `${num(d.meses)} months`
  return `${d.modalidad} (${num(d.horasNivel)} h per level): approx. ${num(d.semanas)} weeks (${meses})`
}
