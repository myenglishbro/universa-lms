// Task Board: constantes y reglas puras (sin red) para que se puedan probar.
export const ESTADOS = [
  { value: 'pendiente', label: 'Pendiente' },
  { value: 'en_proceso', label: 'En proceso' },
  { value: 'en_espera', label: 'En espera' },
  { value: 'realizado', label: 'Realizado' },
]
export const PRIORIDADES = [
  { value: 'baja', label: 'Baja' },
  { value: 'media', label: 'Media' },
  { value: 'alta', label: 'Alta' },
  { value: 'urgente', label: 'Urgente' },
]
export const TIPOS = [
  { value: 'tarea', label: 'Tarea' },
  { value: 'solicitud', label: 'Solicitud' },
  { value: 'incidencia', label: 'Incidencia' },
]
export const COLOR_PRIORIDAD = { baja: 'slate', media: 'brand', alta: 'peach', urgente: 'rose' }

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
export const nombreCorto = (correo, vacio = 'Sin asignar') => (correo ? correo.split('@')[0] : vacio)

export function textoHistorial(h, nombre) {
  const quien = nombre(h.usuario_id)
  if (h.accion === 'cambió') {
    const valor = (v) => (h.campo === 'responsable' ? nombre(v, 'nadie') : h.campo === 'estado' ? etiquetaEstado(v) : h.campo === 'prioridad' ? etiquetaPrioridad(v) : h.campo === 'tipo' ? etiquetaTipo(v) : v || '—')
    const campo = { titulo: 'el título', descripcion: 'la descripción', tipo: 'el tipo', prioridad: 'la prioridad', estado: 'el estado', responsable: 'el responsable', fecha_limite: 'la fecha límite' }[h.campo] ?? h.campo
    if (h.campo === 'descripcion') return `${quien} editó la descripción`
    return `${quien} cambió ${campo}: ${valor(h.valor_anterior)} → ${valor(h.valor_nuevo)}`
  }
  return h.accion === 'comentó' ? `${quien} comentó` : `${quien} ${h.accion} el ticket`
}
