import { supabase } from '../lib/supabase'
import { datos } from './util'

const rpc = async (nombre, args) => datos(await supabase.rpc(nombre, args))

// Documentos de una zona. Cada rol solo ve su zona (lo aplica Supabase con RLS); el personal ve ambas, incluidos los ocultos.
export async function listarZona(zona) {
  return datos(await supabase.from('zona_documentos').select('*').eq('zona', zona).order('categoria').order('orden').order('created_at'))
}
export const guardarDocumento = (id, d) =>
  rpc('guardar_zona_documento', { p_id: id, p_datos: { zona: d.zona, titulo: d.titulo, descripcion: d.descripcion, categoria: d.categoria, url: d.url, oculto: d.oculto } })
export const eliminarDocumento = (id) => rpc('eliminar_zona_documento', { p_id: id })
