import { supabase } from '../lib/supabase'
import { datos } from './util'

const rpc = async (nombre, args) => datos(await supabase.rpc(nombre, args))

// Solo administración puede leer estas tablas (RLS); para el resto devuelven vacío o error y la pantalla funciona sin ellas.
export async function cargarPerfilInterno() {
  const [campos, perfiles] = await Promise.all([
    datos(await supabase.from('docente_campos').select('id, nombre, opciones, orden, activo').order('orden').order('nombre')),
    datos(await supabase.from('docente_perfil_interno').select('docente_id, descripcion, atributos')),
  ])
  return { campos, perfiles: new Map(perfiles.map((p) => [p.docente_id, p])) }
}
export const guardarCampo = (c) => rpc('admin_guardar_campo_docente', { p_id: c.id ?? null, p_nombre: c.nombre, p_opciones: c.opciones, p_orden: c.orden ?? 0, p_activo: c.activo ?? true })
export const eliminarCampo = (id) => rpc('admin_eliminar_campo_docente', { p_id: id })
export const guardarPerfil = (docenteId, descripcion, atributos) => rpc('admin_guardar_perfil_docente', { p_docente: docenteId, p_descripcion: descripcion, p_atributos: atributos })
export const guardarDisponibilidadDocente = (docenteId, slots) => rpc('admin_guardar_disponibilidad_docente', { p_docente: docenteId, p_slots: slots })
