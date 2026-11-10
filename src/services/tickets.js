import { supabase } from '../lib/supabase'
import { datos } from './util'

const rpc = async (nombre, args) => datos(await supabase.rpc(nombre, args))

// Lecturas: las filtra RLS (solo personal activo). Las escrituras pasan únicamente por funciones SQL.
export const listarTickets = async () => datos(await supabase.from('tickets').select('*').order('updated_at', { ascending: false }).limit(1000))
export const personalTickets = () => rpc('ticket_personal')
export const comentariosDe = async (id) => datos(await supabase.from('ticket_comentarios').select('*').eq('ticket_id', id).order('created_at'))
export const historialDe = async (id) => datos(await supabase.from('ticket_historial').select('*').eq('ticket_id', id).order('created_at', { ascending: false }))
export const misNotificaciones = async () =>
  datos(await supabase.from('ticket_notificaciones').select('*').order('created_at', { ascending: false }).limit(30))

export const crearTicket = (t) =>
  rpc('ticket_crear', {
    p_titulo: t.titulo,
    p_descripcion: t.descripcion || null,
    p_tipo: t.tipo,
    p_prioridad: t.prioridad,
    p_responsable: t.responsable_id || null,
    p_fecha_limite: t.fecha_limite || null,
  })
// cambios: solo las claves a modificar (titulo, descripcion, tipo, prioridad, estado, responsable_id, fecha_limite).
export const actualizarTicket = (id, cambios) => rpc('ticket_actualizar', { p_id: id, p_cambios: cambios })
export const comentarTicket = (id, texto) => rpc('ticket_comentar', { p_id: id, p_texto: texto })
export const archivarTicket = (id, archivar = true) => rpc('ticket_archivar', { p_id: id, p_archivar: archivar })
export const marcarLeidas = (ids = null) => rpc('ticket_marcar_leidas', { p_ids: ids })

// Cambios en vivo: llama a `alCambiar` cuando alguien modifica tickets, comentarios o historial. Devuelve la función para cancelar.
export function suscribirTickets(tablas, alCambiar) {
  const canal = supabase.channel(`tickets-${tablas.join('-')}-${Math.random().toString(36).slice(2)}`)
  tablas.forEach((tabla) => canal.on('postgres_changes', { event: '*', schema: 'public', table: tabla }, alCambiar))
  canal.subscribe()
  return () => supabase.removeChannel(canal)
}
