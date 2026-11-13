// Task Board: constantes y reglas puras (sin red) para que se puedan probar.
export const ESTADOS = [
  { value: 'pendiente', label: 'Pending' },
  { value: 'en_proceso', label: 'In progress' },
  { value: 'en_espera', label: 'On hold' },
  { value: 'realizado', label: 'Done' },
]
export const PRIORIDADES = [
  { value: 'baja', label: 'Low' },
  { value: 'media', label: 'Medium' },
  { value: 'alta', label: 'High' },
  { value: 'urgente', label: 'Urgent' },
]
export const TIPOS = [
  { value: 'tarea', label: 'Task' },
  { value: 'solicitud', label: 'Request' },
  { value: 'incidencia', label: 'Incident' },
]
export const COLOR_PRIORIDAD = { baja: 'slate', media: 'brand', alta: 'peach', urgente: 'rose' }

// Aspecto de cada prioridad: franja lateral, etiqueta con icono y fondo de la tarjeta. Urgente y alta saltan a la vista.
export const ESTILO_PRIORIDAD = {
  urgente: { franja: 'bg-rose-600', chip: 'bg-rose-600 text-white', fondo: 'bg-rose-50/60', icono: 'alert' },
  alta: { franja: 'bg-orange-500', chip: 'bg-orange-100 text-orange-800 ring-1 ring-inset ring-orange-300', fondo: 'bg-white', icono: 'up' },
  media: { franja: 'bg-sky-400', chip: 'bg-sky-50 text-sky-700 ring-1 ring-inset ring-sky-200', fondo: 'bg-white', icono: 'flag' },
  baja: { franja: 'bg-slate-300', chip: 'bg-slate-100 text-slate-500', fondo: 'bg-white', icono: 'down' },
}
// Color de cada columna del tablero.
export const ESTILO_ESTADO = {
  pendiente: { punto: 'bg-slate-400', cab: 'text-slate-700', soltar: 'bg-slate-200/70 ring-slate-400' },
  en_proceso: { punto: 'bg-brand-500', cab: 'text-brand-800', soltar: 'bg-brand-100/80 ring-brand-400' },
  en_espera: { punto: 'bg-amber-400', cab: 'text-amber-800', soltar: 'bg-amber-100/80 ring-amber-400' },
  realizado: { punto: 'bg-emerald-500', cab: 'text-emerald-800', soltar: 'bg-emerald-100/80 ring-emerald-400' },
}
// Colores de avatar por persona (el mismo nombre siempre da el mismo color).
const AVATARES = ['bg-violet-100 text-violet-700', 'bg-teal-100 text-teal-700', 'bg-pink-100 text-pink-700', 'bg-amber-100 text-amber-800', 'bg-sky-100 text-sky-700', 'bg-lime-100 text-lime-800']
export const colorAvatar = (texto = '') => AVATARES[[...texto].reduce((n, c) => n + c.charCodeAt(0), 0) % AVATARES.length]

const etiqueta = (lista) => (v) => lista.find((x) => x.value === v)?.label ?? v
export const etiquetaEstado = etiqueta(ESTADOS)
export const etiquetaPrioridad = etiqueta(PRIORIDADES)
export const etiquetaTipo = etiqueta(TIPOS)

// Fecha de hoy en Lima (AAAA-MM-DD), como el resto del sistema.
export const hoyLima = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' })

// Vencido = tiene fecha límite pasada y aún no está realizado.
export const vencido = (t, hoy = hoyLima()) => Boolean(t.fecha_limite) && t.estado !== 'realizado' && t.fecha_limite < hoy

const sinTildes = (s) => (s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

// vista: todos | mios | creados | urgentes | vencidos | archivados. Los archivados solo se ven en su vista.
export function filtrarTickets(tickets, { vista = 'todos', estado = '', prioridad = '', tipo = '', responsable = '', texto = '' }, uid, hoy = hoyLima()) {
  const q = sinTildes(texto.trim())
  return tickets.filter((t) => {
    if (vista === 'archivados' ? !t.archivado : t.archivado) return false
    if (vista === 'mios' && t.responsable_id !== uid) return false
    if (vista === 'creados' && t.creado_por !== uid) return false
    if (vista === 'urgentes' && !(t.prioridad === 'urgente' && t.estado !== 'realizado')) return false
    if (vista === 'vencidos' && !vencido(t, hoy)) return false
    if (estado && t.estado !== estado) return false
    if (prioridad && t.prioridad !== prioridad) return false
    if (tipo && t.tipo !== tipo) return false
    if (responsable === 'sin' ? t.responsable_id : responsable && t.responsable_id !== responsable) return false
    if (q && !sinTildes(t.titulo).includes(q) && !sinTildes(t.codigo).includes(q)) return false
    return true
  })
}

const PESO = { urgente: 0, alta: 1, media: 2, baja: 3 }
// Orden dentro de una columna: prioridad, luego fecha límite más próxima, luego el más reciente.
export const ordenarTickets = (a, b) =>
  PESO[a.prioridad] - PESO[b.prioridad] ||
  (a.fecha_limite ?? '9999') .localeCompare(b.fecha_limite ?? '9999') ||
  b.updated_at.localeCompare(a.updated_at)

// «juan.perez@x.com» → «juan.perez»; sin dato → texto de reemplazo.
export const nombreCorto = (correo, vacio = 'Unassigned') => (correo ? correo.split('@')[0] : vacio)

export function textoHistorial(h, nombre) {
  const quien = nombre(h.usuario_id)
  if (h.accion === 'cambió') {
    const valor = (v) => (h.campo === 'responsable' ? nombre(v, 'nobody') : h.campo === 'estado' ? etiquetaEstado(v) : h.campo === 'prioridad' ? etiquetaPrioridad(v) : h.campo === 'tipo' ? etiquetaTipo(v) : v || '—')
    const campo = { titulo: 'the title', descripcion: 'the description', tipo: 'the type', prioridad: 'the priority', estado: 'the status', responsable: 'the assignee', fecha_limite: 'the due date' }[h.campo] ?? h.campo
    if (h.campo === 'descripcion') return `${quien} edited the description`
    return `${quien} changed ${campo}: ${valor(h.valor_anterior)} → ${valor(h.valor_nuevo)}`
  }
  const verbo = { 'creó': 'created', 'archivó': 'archived', 'restauró': 'restored' }[h.accion] ?? h.accion
  return h.accion === 'comentó' ? `${quien} commented` : `${quien} ${verbo} the ticket`
}
