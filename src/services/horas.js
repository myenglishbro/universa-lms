import { supabase } from '../lib/supabase'
import { datos } from './util'

const rpc = async (nombre, args) => datos(await supabase.rpc(nombre, args))

// Administración y RR. HH.: horas por periodo (p_desde y p_hasta incluidos, 'YYYY-MM-DD').
export const resumenHoras = (desde, hasta) => rpc('horas_resumen', { p_desde: desde, p_hasta: hasta })
export const detalleHoras = (desde, hasta, docenteId) => rpc('horas_detalle', { p_desde: desde, p_hasta: hasta, p_docente: docenteId })
// Administración: enlace de Zoom único y corrección de marcas. `entrada` null borra la marca.
export const zoomClase = () => rpc('zoom_clase')
export const guardarZoom = (url) => rpc('guardar_zoom', { p_url: url })
export const ajustarMarca = (sesionId, entrada, salida, nota) => rpc('ajustar_marca', { p_sesion: sesionId, p_entrada: entrada, p_salida: salida, p_nota: nota || null })
// Pago: tarifas por servicio, servicio de cada salón y marca de docente nativo (solo administración cambia).
export const tarifasPago = () => rpc('tarifas_pago')
export const asignarServicioSalon = (salonId, servicio) => rpc('asignar_servicio_salon', { p_salon: salonId, p_servicio: servicio })
export const marcarNativo = (docenteId, nativo) => rpc('marcar_docente_nativo', { p_docente: docenteId, p_nativo: nativo })
