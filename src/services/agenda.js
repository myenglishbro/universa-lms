import { supabase } from '../lib/supabase'
import { datos } from './util'

// Lecturas de la agenda unificada (vistas agenda_sesiones y agenda_conflictos). La escritura no pasa por aquí:
// se reutilizan las funciones existentes de salones (registrar_realizada) y de paquetes (programar_clase, etc.).
export async function listarAgenda(desde, hasta) {
  return datos(
    await supabase
      .from('agenda_sesiones')
      .select('*')
      .gte('fecha', desde)
      .lte('fecha', hasta)
      .order('fecha')
      .order('hora_inicio'),
  )
}

export async function listarConflictosAgenda(desde, hasta) {
  return datos(await supabase.from('agenda_conflictos').select('*').gte('fecha', desde).lte('fecha', hasta))
}
