import { supabase } from '../lib/supabase'
import { datos } from './util'

const hora = (t) => t.slice(0, 5)

// Reservas programadas desde `desde` (YYYY-MM-DD), con el nombre del docente.
export async function listarReservas(desde) {
  const filas = datos(
    await supabase
      .from('reservas_docente')
      .select('id, docente_id, fecha, hora_inicio, hora_fin, tipo, titulo, nota, docentes(nombre)')
      .eq('estado', 'programada')
      .gte('fecha', desde)
      .order('fecha')
      .order('hora_inicio'),
  )
  return filas.map((r) => ({ ...r, hora_inicio: hora(r.hora_inicio), hora_fin: hora(r.hora_fin), docente: r.docentes?.nombre ?? '' }))
}

export async function crearReserva({ docenteId, fecha, horaInicio, horaFin, tipo, titulo, nota }) {
  return datos(
    await supabase.rpc('crear_reserva_docente', {
      p_docente: docenteId,
      p_fecha: fecha,
      p_inicio: horaInicio,
      p_fin: horaFin,
      p_tipo: tipo,
      p_titulo: titulo || null,
      p_nota: nota || null,
    }),
  )
}

export async function cancelarReserva(id, motivo) {
  datos(await supabase.rpc('cancelar_reserva_docente', { p_reserva: id, p_motivo: motivo || null }))
}
