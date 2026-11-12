// Helpers de la agenda académica unificada. No contienen reglas académicas: dan forma a lo que entrega Supabase
// (vistas agenda_sesiones y agenda_conflictos) y manejan fechas ISO (YYYY-MM-DD) sin desfases de zona horaria.

const pad = (n) => String(n).padStart(2, '0')
const aISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const deISO = (iso) => new Date(`${iso}T00:00:00`)

export const sumarDias = (iso, n) => {
  const d = deISO(iso)
  d.setDate(d.getDate() + n)
  return aISO(d)
}
export const lunesDe = (iso) => sumarDias(iso, -((deISO(iso).getDay() + 6) % 7))
export const diasDeSemana = (iso) => Array.from({ length: 7 }, (_, i) => sumarDias(lunesDe(iso), i))

const nombresDia = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const meses = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
export const nombreDia = (iso) => nombresDia[deISO(iso).getDay()]
export const diaMes = (iso) => `${meses[Number(iso.slice(5, 7)) - 1]} ${Number(iso.slice(8, 10))}`
export const rangoSemana = (lunes) => `${diaMes(lunes)} – ${diaMes(sumarDias(lunes, 6))} ${sumarDias(lunes, 6).slice(0, 4)}`

export const SIN_DOCENTE = '__sin_docente__'

export const modalidadesAgenda = [
  { value: '', label: 'All modalities' },
  { value: 'grupal', label: 'Group (classrooms)' },
  { value: 'particular', label: 'Private (1-on-1)' },
]
export const estadosAgenda = [
  { value: '', label: 'All statuses' },
  { value: 'programada', label: 'Scheduled' },
  { value: 'realizada', label: 'Held' },
  { value: 'cancelada', label: 'Cancelled' },
]
// Estado unificado de una sesión (una clase particular «dictada» se muestra como «realizada»).
export const estadoAgendaInfo = {
  programada: { color: 'peach', label: 'Scheduled' },
  realizada: { color: 'brand', label: 'Held' },
  cancelada: { color: 'slate', label: 'Cancelled' },
}
export const origenLabel = { grupal: 'Group', particular: 'Private' }

export const claveItem = (i) => `${i.origen}:${i.id}`
const hora = (t) => t.slice(0, 5)

export const aItemAgenda = (r) => ({
  origen: r.origen,
  id: r.id,
  salonId: r.salon_id,
  paqueteId: r.paquete_id,
  alumnoId: r.alumno_id ?? null,
  docenteId: r.docente_id ?? '',
  docente: r.docente ?? '',
  fecha: r.fecha,
  horaInicio: hora(r.hora_inicio),
  horaFin: hora(r.hora_fin),
  minutos: r.minutos,
  estado: r.estado,
  tipo: r.tipo,
  titulo: r.titulo,
  detalle: r.detalle ?? '',
})

// Mapa clave de sesión -> lista de textos de cruce («Alumna X (18:00–19:00)»).
export function conflictosPorSesion(filas) {
  const m = new Map()
  for (const c of filas) {
    const k = `${c.origen}:${c.sesion_id}`
    const texto = `${c.otro_titulo} (${hora(c.otra_hora_inicio)}–${hora(c.otra_hora_fin)})`
    m.set(k, [...(m.get(k) ?? []), texto])
  }
  return m
}

// Criterios combinados con AND. docenteId puede ser SIN_DOCENTE.
export function filtrarAgenda(items, { docenteId = '', modalidad = '', estado = '', soloConflictos = false }, conflictos = new Map()) {
  return items.filter(
    (i) =>
      (!docenteId || (docenteId === SIN_DOCENTE ? !i.docenteId : i.docenteId === docenteId)) &&
      (!modalidad || i.origen === modalidad) &&
      (!estado || i.estado === estado) &&
      (!soloConflictos || conflictos.has(claveItem(i))),
  )
}

export const ordenarAgenda = (items) =>
  [...items].sort((a, b) => a.fecha.localeCompare(b.fecha) || a.horaInicio.localeCompare(b.horaInicio) || a.titulo.localeCompare(b.titulo))
