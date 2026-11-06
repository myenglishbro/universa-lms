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
  activo: { color: 'brand', label: 'Activo' },
  agotado: { color: 'slate', label: 'Agotado' },
  vencido: { color: 'peach', label: 'Vencido' },
  anulado: { color: 'rose', label: 'Anulado' },
}
export const estadosFiltro = [
  { value: '', label: 'Todos los estados' },
  { value: 'activo', label: 'Activos' },
  { value: 'agotado', label: 'Agotados' },
  { value: 'vencido', label: 'Vencidos' },
  { value: 'anulado', label: 'Anulados' },
]

export const estadoClase = {
  programada: { color: 'peach', label: 'Programada' },
  dictada: { color: 'brand', label: 'Dictada' },
  cancelada: { color: 'slate', label: 'Cancelada' },
}

export const tipoMovimiento = {
  compra: 'Compra',
  ampliacion: 'Ampliación',
  ajuste: 'Ajuste',
  consumo: 'Clase dictada',
  cancelacion_tardia: 'Cancelación tardía',
  reversion: 'Corrección (devolución)',
}

export const metodosPago = ['Efectivo', 'Yape / Plin', 'Transferencia', 'Tarjeta', 'Otro']

// Advertencia cuando lo programado supera lo disponible (programar se permite; confirmar no).
export const advertenciaSaldo = (s) =>
  s && s.libres < 0 && !['anulado'].includes(s.estado)
    ? `Hay ${minutosTexto(-s.libres)} programadas por encima de lo disponible. Puedes programarlas, pero no confirmarlas como dictadas hasta ampliar el paquete.`
    : ''

export const hoyISO = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima' }).format(new Date())

// Semáforo del saldo de un paquete: qué tan cerca está de quedarse sin horas (pocas = 20 % o menos, o 1 hora).
export function nivelSaldo(p) {
  const total = Math.max(p.compradas + p.ajustes, 1)
  if (p.estado === 'anulado') return { tono: 'rose', icono: 'close', texto: 'Anulado' }
  if (p.disponibles <= 0) return { tono: 'rose', icono: 'alert', texto: 'Sin horas' }
  if (p.disponibles <= Math.max(60, total * 0.2)) return { tono: 'peach', icono: 'clock', texto: 'Pocas horas' }
  return { tono: 'brand', icono: 'check', texto: 'Con horas' }
}
