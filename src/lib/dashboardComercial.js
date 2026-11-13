// Lógica del Dashboard Comercial. Todo se deriva de datos existentes (salones + salon_progreso);
// nada se inventa ni se guarda. "Hoy" es la fecha de America/Lima (ver diasParaFin).
import { coincideNivel, diasParaFin, fechaFinSalon } from './salones'

export const VENTANAS = [
  { value: 'vencidos', label: 'Overdue', dias: null },
  { value: '7', label: '7 days', dias: 7 },
  { value: '15', label: '15 days', dias: 15 },
  { value: '30', label: '30 days', dias: 30 },
  { value: 'todos', label: 'All', dias: null },
]

// Clasifica un salón. Un salón "tiene calendario" cuando existen sesiones registradas;
// en ese caso la fecha de fin la calcula la base. Sin sesiones, la fecha es manual (o no existe).
export function analizarSalon(salon) {
  const p = salon.progreso
  const fin = fechaFinSalon(salon) || null
  const dias = diasParaFin(salon)
  const tieneCalendario = Boolean(p && p.sesiones > 0)
  const activo = salon.estado !== 'finalizado'
  const enCurso = salon.estado === 'en_curso'

  const provisional = tieneCalendario && p.sinProgramar > 0 // faltan sesiones por programar: el fin es una proyección
  const porValidar = tieneCalendario && p.porRegistrar > 0 // sesiones pasadas sin registrar como realizadas/canceladas
  const vencido = enCurso && dias !== null && dias < 0
  const sinCalendario = activo && !tieneCalendario

  return {
    fin,
    dias,
    origen: tieneCalendario ? 'calendario' : fin ? 'manual' : 'sin_fecha',
    tieneCalendario,
    provisional,
    porValidar,
    vencido,
    sinCalendario,
    revisar: activo && (sinCalendario || provisional || porValidar),
    en7: enCurso && dias !== null && dias >= 0 && dias <= 7,
    en30: enCurso && dias !== null && dias >= 0 && dias <= 30,
    en8a30: enCurso && dias !== null && dias >= 8 && dias <= 30,
  }
}

// Cada salón se cuenta como máximo una vez por indicador (un solo recorrido, un contador por indicador).
export function calcularIndicadores(filas) {
  const r = { enCurso: 0, en7: 0, en30: 0, pendientes: 0, revisar: 0, vencidos: 0, provisionales7: 0, provisionales30: 0 }
  for (const { salon, a } of filas) {
    if (salon.estado === 'en_curso') r.enCurso++
    if (salon.estado === 'pendiente') r.pendientes++
    if (a.en7) r.en7++
    if (a.en30) r.en30++
    if (a.en7 && a.provisional) r.provisionales7++
    if (a.en30 && a.provisional) r.provisionales30++
    if (a.revisar) r.revisar++
    if (a.vencido) r.vencidos++
  }
  return r
}

// Criterios (todos se combinan con AND): ventana, nivel académico, estado y `revisar` (solo salones por revisar).
// La ventana solo aplica a salones no finalizados; 7/15/30 incluyen los vencidos (días negativos).
export function filtrarFilas(filas, { ventana, nivelId, estado, revisar }) {
  const limite = VENTANAS.find((v) => v.value === ventana)?.dias ?? null
  return filas.filter(({ salon, a }) => {
    if (!coincideNivel(salon, nivelId)) return false
    if (estado && salon.estado !== estado) return false
    if (revisar && !a.revisar) return false
    if (ventana === 'vencidos') return a.vencido
    if (limite !== null && salon.estado !== 'finalizado' && (a.dias === null || a.dias > limite)) return false
    return true
  })
}

// Fecha de fin más próxima primero; sin fecha al final; desempate por código.
export function ordenarPorFin(filas) {
  return [...filas].sort((x, y) => {
    if (x.a.fin !== y.a.fin) {
      if (!x.a.fin) return 1
      if (!y.a.fin) return -1
      return x.a.fin.localeCompare(y.a.fin)
    }
    return x.salon.codigo.localeCompare(y.salon.codigo)
  })
}

export function textoDias(a, estado) {
  if (estado === 'finalizado' || a.dias === null) return '—'
  if (a.dias < 0) return `${-a.dias} ${a.dias === -1 ? 'day' : 'days'} ago`
  if (a.dias === 0) return 'Today'
  return `${a.dias} ${a.dias === 1 ? 'day' : 'days'}`
}
