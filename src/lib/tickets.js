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
  { value: 'informe', label: 'Report' },
]
// Guía para elegir: icono, color y cuándo usar cada prioridad / tipo (se muestra siempre, sin tener que abrir el selector).
export const GUIA_PRIORIDAD = {
  urgente: { icono: 'alert', color: 'text-rose-600 bg-rose-50', cuando: 'Blocks something or affects students or classes today. Needs attention right now.' },
  alta: { icono: 'upup', color: 'text-peach-700 bg-peach-100', cuando: 'Important and with a close date, but nothing is blocked today.' },
  media: { icono: 'equal', color: 'text-brand-700 bg-brand-100', cuando: 'Normal day-to-day work.' },
  baja: { icono: 'down', color: 'text-slate-500 bg-slate-100', cuando: 'Can wait: no date and no impact.' },
}
export const GUIA_TIPO = {
  tarea: { icono: 'checksquare', cuando: 'Work that has to be done' },
  solicitud: { icono: 'inbox', cuando: 'Something someone asks for' },
  incidencia: { icono: 'wrench', cuando: 'A problem that needs fixing' },
  informe: { icono: 'doc', cuando: 'Just to inform or report' },
}
export const COLOR_PRIORIDAD = { baja: 'slate', media: 'brand', alta: 'peach', urgente: 'rose' }

// Aspecto de cada prioridad: franja lateral, etiqueta con icono y fondo de la tarjeta. Urgente y alta saltan a la vista.
export const ESTILO_PRIORIDAD = {
  urgente: { franja: 'bg-rose-600', chip: 'bg-rose-600 text-white', fondo: 'bg-rose-50/60', icono: 'alert' },
  alta: { franja: 'bg-peach-500', chip: 'bg-peach-100 text-peach-700 ring-1 ring-inset ring-peach-200', fondo: 'bg-white', icono: 'up' },
  media: { franja: 'bg-brand-200', chip: 'bg-brand-50 text-brand-700 ring-1 ring-inset ring-brand-100', fondo: 'bg-white', icono: 'flag' },
  baja: { franja: 'bg-slate-300', chip: 'bg-slate-100 text-slate-500', fondo: 'bg-white', icono: 'down' },
}
// Color de cada columna del tablero.
export const ESTILO_ESTADO = {
  pendiente: { punto: 'bg-slate-400', cab: 'text-slate-700', soltar: 'bg-slate-200/70 ring-slate-400' },
  en_proceso: { punto: 'bg-brand-500', cab: 'text-brand-800', soltar: 'bg-brand-100/80 ring-brand-400' },
  en_espera: { punto: 'bg-peach-500', cab: 'text-peach-700', soltar: 'bg-peach-100/80 ring-peach-500' },
  realizado: { punto: 'bg-brand-800', cab: 'text-brand-800', soltar: 'bg-brand-100/80 ring-brand-500' },
}
// Colores de avatar por persona (el mismo nombre siempre da el mismo color).
const AVATARES = ['bg-brand-100 text-brand-700', 'bg-peach-100 text-peach-700', 'bg-slate-200 text-slate-700', 'bg-brand-200 text-brand-800', 'bg-peach-200 text-peach-700', 'bg-slate-100 text-slate-600']
export const colorAvatar = (texto = '') => AVATARES[[...texto].reduce((n, c) => n + c.charCodeAt(0), 0) % AVATARES.length]

const etiqueta = (lista) => (v) => lista.find((x) => x.value === v)?.label ?? v
export const etiquetaEstado = etiqueta(ESTADOS)
export const etiquetaPrioridad = etiqueta(PRIORIDADES)
export const etiquetaTipo = etiqueta(TIPOS)

// Fecha de hoy en Lima (AAAA-MM-DD), como el resto del sistema.
export const hoyLima = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' })

// Responsables de un ticket: la lista nueva o, en tickets anteriores, el único responsable.
export const responsablesDe = (t) => (t.responsables?.length ? t.responsables : t.responsable_id ? [t.responsable_id] : [])

// Vencido = tiene fecha límite pasada y aún no está realizado.
export const vencido = (t, hoy = hoyLima()) => Boolean(t.fecha_limite) && t.estado !== 'realizado' && t.fecha_limite < hoy

const sinTildes = (s) => (s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

// vista: todos | mios | creados | urgentes | vencidos | estancados | archivados. Los archivados solo se ven en su vista.
export function filtrarTickets(tickets, { vista = 'todos', estado = '', prioridad = '', tipo = '', responsable = '', texto = '' }, uid, hoy = hoyLima(), ahora = Date.now()) {
  const q = sinTildes(texto.trim())
  return tickets.filter((t) => {
    if (vista === 'archivados' ? !t.archivado : t.archivado) return false
    if (vista === 'mios' && !responsablesDe(t).includes(uid)) return false
    if (vista === 'creados' && t.creado_por !== uid) return false
    if (vista === 'urgentes' && !(t.prioridad === 'urgente' && t.estado !== 'realizado')) return false
    if (vista === 'vencidos' && !vencido(t, hoy)) return false
    if (vista === 'estancados' && !estancado(t, ahora)) return false
    if (estado && t.estado !== estado) return false
    if (prioridad && t.prioridad !== prioridad) return false
    if (tipo && t.tipo !== tipo) return false
    if (responsable === 'sin' ? responsablesDe(t).length > 0 : responsable && !responsablesDe(t).includes(responsable)) return false
    if (q && !sinTildes(t.titulo).includes(q) && !sinTildes(t.codigo).includes(q)) return false
    return true
  })
}

const PESO = { urgente: 0, alta: 1, media: 2, baja: 3 }
// Orden dentro de una columna: prioridad, luego fecha límite más próxima, luego el más reciente.
export const ordenarTickets = (a, b) =>
  PESO[a.prioridad] - PESO[b.prioridad] ||
  (a.fecha_limite ?? '9999') .localeCompare(b.fecha_limite ?? '9999') ||
  (a.created_at ?? '').localeCompare(b.created_at ?? '') || // a igual prioridad y fecha, el más antiguo primero (cola)
  (a.codigo ?? '').localeCompare(b.codigo ?? '')

// «juan.perez@x.com» → «juan.perez»; sin dato → texto de reemplazo.
export const nombreCorto = (correo, vacio = 'Unassigned') => (correo ? correo.split('@')[0] : vacio)

export function textoHistorial(h, nombre) {
  const quien = nombre(h.usuario_id)
  if (h.accion === 'cambió') {
    const lista = (v) => (v ? v.split(',').map((id) => nombreCorto(nombre(id), 'someone')).join(', ') : 'nobody')
    const valor = (v) => (h.campo === 'responsables' ? lista(v) : h.campo === 'responsable' ? nombre(v, 'nobody') : h.campo === 'estado' ? etiquetaEstado(v) : h.campo === 'prioridad' ? etiquetaPrioridad(v) : h.campo === 'tipo' ? etiquetaTipo(v) : v || '—')
    const campo = { titulo: 'the title', descripcion: 'the description', tipo: 'the type', prioridad: 'the priority', estado: 'the status', responsable: 'the assignee', responsables: 'the assignees', fecha_limite: 'the due date', checklist: 'the checklist' }[h.campo] ?? h.campo
    if (h.campo === 'descripcion') return `${quien} edited the description`
    return `${quien} changed ${campo}: ${valor(h.valor_anterior)} → ${valor(h.valor_nuevo)}`
  }
  const verbo = { 'creó': 'created', 'archivó': 'archived', 'restauró': 'restored' }[h.accion] ?? h.accion
  return h.accion === 'comentó' ? `${quien} commented` : `${quien} ${verbo} the ticket`
}

// ---------------------------------------------------------------------------------------------------------------------
// Checklist, «estancado», plantillas por tipo y calendario por fecha límite
// ---------------------------------------------------------------------------------------------------------------------

export const checklistDe = (t) => (Array.isArray(t.checklist) ? t.checklist : [])
// Avance del checklist: { hechos, total, completo }; total 0 = sin checklist.
export function progresoChecklist(t) {
  const items = checklistDe(t)
  const hechos = items.filter((i) => i.hecho).length
  return { hechos, total: items.length, completo: items.length > 0 && hechos === items.length }
}

// Estancado: en proceso o en espera sin ningún movimiento (cambio, comentario o checklist) desde hace DIAS_ESTANCADO días o más.
export const DIAS_ESTANCADO = 5
export const diasSinMovimiento = (t, ahora = Date.now()) => Math.max(0, Math.floor((ahora - new Date(t.updated_at).getTime()) / 86400000))
export const estancado = (t, ahora = Date.now()) => !t.archivado && (t.estado === 'en_proceso' || t.estado === 'en_espera') && diasSinMovimiento(t, ahora) >= DIAS_ESTANCADO

// Plantilla de descripción por tipo: se propone al crear el ticket (el equipo la completa en vez de escribir desde cero).
export const PLANTILLAS = {
  tarea: 'Goal:\n\nDetails / steps:\n\nDone when:\n',
  solicitud: 'What is requested:\n\nWho requests it and why:\n\nNeeded by (date):\n',
  incidencia: 'What happened:\n\nWho or what is affected (student, classroom, teacher):\n\nWhen it happened:\n\nImpact:\n\nWhat is needed to fix it:\n',
  informe: 'Summary:\n\nDetails:\n\nWho should know / next steps (if any):\n',
}

// Calendario mensual (semanas de lunes a domingo): matriz de semanas con fechas AAAA-MM-DD y si pertenecen al mes mostrado.
const iso = (d) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
export function mesGrid(anio, mes) {
  const primero = new Date(Date.UTC(anio, mes, 1))
  const desfase = (primero.getUTCDay() + 6) % 7
  const inicio = new Date(Date.UTC(anio, mes, 1 - desfase))
  const dias = new Date(Date.UTC(anio, mes + 1, 0)).getUTCDate()
  const semanas = Math.ceil((desfase + dias) / 7)
  return Array.from({ length: semanas }, (_, s) =>
    Array.from({ length: 7 }, (_, d) => {
      const f = new Date(inicio.getTime() + (s * 7 + d) * 86400000)
      return { fecha: iso(f), delMes: f.getUTCMonth() === mes }
    }),
  )
}
// Tickets agrupados por fecha límite: Map(fecha → tickets). Los que no tienen fecha no aparecen.
export function ticketsPorFecha(tickets) {
  const m = new Map()
  for (const t of tickets) {
    if (!t.fecha_limite) continue
    if (!m.has(t.fecha_limite)) m.set(t.fecha_limite, [])
    m.get(t.fecha_limite).push(t)
  }
  for (const lista of m.values()) lista.sort(ordenarTickets)
  return m
}

// Carga de trabajo por persona (para los personajes del equipo): tickets abiertos asignados, por prioridad, y cuántos cerró en la última semana.
// Ánimo: libre (0) · tranquilo (1-3) · cargado (4-7) · agobiado (8 o más, o 3 o más vencidos).
export const DIAS_RECIENTE = 7
export function cargaPorPersona(tickets, personal, ahora = Date.now(), hoy = hoyLima()) {
  const corte = ahora - DIAS_RECIENTE * 86400000
  return personal.map((p) => {
    const suyos = tickets.filter((t) => !t.archivado && responsablesDe(t).includes(p.user_id))
    const abiertos = suyos.filter((t) => t.estado !== 'realizado')
    const porPrioridad = { urgente: 0, alta: 0, media: 0, baja: 0 }
    for (const t of abiertos) porPrioridad[t.prioridad] = (porPrioridad[t.prioridad] ?? 0) + 1
    const vencidos = abiertos.filter((t) => vencido(t, hoy)).length
    const hechosSemana = suyos.filter((t) => t.estado === 'realizado' && Date.parse(t.updated_at) >= corte).length
    const n = abiertos.length
    const animo = n === 0 ? 'libre' : n >= 8 || vencidos >= 3 ? 'agobiado' : n >= 4 ? 'cargado' : 'tranquilo'
    // Cajas en el orden en que se apilan: lo más pesado abajo.
    const cajas = abiertos.slice().sort(ordenarTickets).reverse().map((t) => t.prioridad)
    return { id: p.user_id, correo: p.correo, abiertos: n, porPrioridad, vencidos, hechosSemana, animo, cajas }
  })
}
