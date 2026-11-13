// Helpers de presentación para paquetes de horas. Las horas se guardan en minutos (duración real de cada clase);
// el saldo lo calcula Supabase (vista paquete_saldos). Aquí solo se da formato.

export const minutosTexto = (min) => {
  const m = Math.abs(Math.round(min ?? 0))
  const h = Math.floor(m / 60)
  const r = m % 60
  const t = h === 0 ? `${r} min` : r === 0 ? `${h} h` : `${h} h ${r} min`
  return min < 0 ? `−${t}` : t
}

export const duracionMinutos = (inicio, fin) => {
  if (!inicio || !fin) return 0
  const [h1, m1] = inicio.split(':').map(Number)
  const [h2, m2] = fin.split(':').map(Number)
  return h2 * 60 + m2 - (h1 * 60 + m1)
}

const simbolo = { PEN: 'S/', USD: 'US$' }
export const dinero = (monto, moneda = 'PEN') => `${simbolo[moneda] ?? moneda} ${Number(monto ?? 0).toFixed(2)}`

export const estadoPaquete = {
  activo: { color: 'brand', label: 'Active' },
  agotado: { color: 'slate', label: 'Used up' },
  vencido: { color: 'peach', label: 'Expired' },
  anulado: { color: 'rose', label: 'Voided' },
}
export const estadosFiltro = [
  { value: '', label: 'All statuses' },
  { value: 'activo', label: 'Active' },
  { value: 'agotado', label: 'Used up' },
  { value: 'vencido', label: 'Expired' },
  { value: 'anulado', label: 'Voided' },
]

export const estadoClase = {
  programada: { color: 'peach', label: 'Scheduled' },
  dictada: { color: 'brand', label: 'Taught' },
  cancelada: { color: 'slate', label: 'Cancelled' },
}

export const tipoMovimiento = {
  compra: 'Purchase',
  ampliacion: 'Extension',
  ajuste: 'Adjustment',
  consumo: 'Class taught',
  cancelacion_tardia: 'Late cancellation',
  reversion: 'Correction (refund)',
}

export const metodosPago = ['Cash', 'Yape / Plin', 'Bank transfer', 'Card', 'Other']

// Advertencia cuando lo programado supera lo disponible (programar se permite; confirmar no).
export const advertenciaSaldo = (s) =>
  s && s.libres < 0 && !['anulado'].includes(s.estado)
    ? `${minutosTexto(-s.libres)} are scheduled above what is available. You can schedule them, but not confirm them as taught until the package is extended.`
    : ''

export const hoyISO = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima' }).format(new Date())

// Semáforo del saldo de un paquete: qué tan cerca está de quedarse sin horas (pocas = 20 % o menos, o 1 hora).
export function nivelSaldo(p) {
  const total = Math.max(p.compradas + p.ajustes, 1)
  if (p.estado === 'anulado') return { tono: 'rose', icono: 'close', texto: 'Voided' }
  if (p.disponibles <= 0) return { tono: 'rose', icono: 'alert', texto: 'No hours' }
  if (p.disponibles <= Math.max(60, total * 0.2)) return { tono: 'peach', icono: 'clock', texto: 'Few hours' }
  return { tono: 'brand', icono: 'check', texto: 'Has hours' }
}
