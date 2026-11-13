// Carga masiva de salones grupales desde un archivo JSON.
//
// Formato: una lista de salones, o un objeto { "salones": [ ... ] }. Cada salón usa estos campos:
//
//   nombre*          Nombre del salón                                    "Básico noche A"
//   nivel*           Nivel académico (código o nombre)                   "basico" · "Intermedio Alto"
//   fecha_inicio*    AAAA-MM-DD (también DD/MM/AAAA)                     "2026-12-01"
//   capacidad        Alumnos máximos (entero). Opcional: si falta se pone 8 (1 si el nombre dice «privado») para ajustarla después
//   docente          Nombre completo o correo (también «profesor»). Opcional: si falta o no se encuentra, se crea sin docente
//   estado           pendiente | en_curso | finalizado (también «Planificado», «En curso»). Opcional: por defecto pendiente
//   total_sesiones   Cantidad de clases. Con plan lo fija el plan.        40
//   observaciones    Texto libre
//   plan             { modalidad, minutos, sesiones_semana, tipo_alumno, ciclo_desde, ciclo_hasta }
//                    Solo hace falta lo necesario para identificar un único plan del nivel (modalidad: código o nombre).
//   frecuencia       Código o nombre de una frecuencia grupal activa     "grupal-lv-60"
//   horarios         [{ dia, hora_inicio, hora_fin }]  dia = 1 a 7 o lun, mar, mié, jue, vie, sáb, dom   hora = "18:00"
//
// * = obligatorio (la base no puede crear un salón sin nombre, nivel y fecha de inicio). Un campo que no se reconoce se avisa y se ignora. La base de datos vuelve a validar todo al guardar.
export const MAX_FILAS = 200
export const MAX_BYTES = 2 * 1024 * 1024
const CAPACIDAD_POR_DEFECTO = 8

export const plantillaSalones = {
  salones: [
    {
      nombre: 'Básico noche A',
      nivel: 'basico',
      docente: '',
      fecha_inicio: '2026-12-01',
      capacidad: 8,
      estado: 'pendiente',
      plan: { modalidad: 'estandar', minutos: 60, sesiones_semana: 5 },
      horarios: [
        { dia: 'lun', hora_inicio: '19:00', hora_fin: '20:00' },
        { dia: 'mar', hora_inicio: '19:00', hora_fin: '20:00' },
        { dia: 'mié', hora_inicio: '19:00', hora_fin: '20:00' },
        { dia: 'jue', hora_inicio: '19:00', hora_fin: '20:00' },
        { dia: 'vie', hora_inicio: '19:00', hora_fin: '20:00' },
      ],
      observaciones: '',
    },
    {
      nombre: 'Intermedio sábados',
      nivel: 'Intermedio',
      fecha_inicio: '05/12/2026',
      capacidad: 10,
      total_sesiones: 24,
      horarios: [{ dia: 6, hora_inicio: '09:00', hora_fin: '13:00' }],
    },
  ],
}

const CAMPOS = new Set(['nombre', 'nivel', 'fecha_inicio', 'capacidad', 'docente', 'estado', 'total_sesiones', 'observaciones', 'plan', 'frecuencia', 'horarios', 'profesor'])
const CAMPOS_PLAN = new Set(['modalidad', 'minutos', 'sesiones_semana', 'tipo_alumno', 'ciclo_desde', 'ciclo_hasta'])

export const sinTildes = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const txt = (v) => (v == null ? '' : String(v).replace(/\s+/g, ' ').trim())
const clave = (s) => sinTildes(txt(s))
const vacio = (v) => v == null || txt(v) === ''

const ESTADOS = { pendiente: 'pendiente', planificado: 'pendiente', en_curso: 'en_curso', 'en curso': 'en_curso', finalizado: 'finalizado' }
const DIAS = {
  1: 1, lun: 1, lunes: 1,
  2: 2, mar: 2, martes: 2,
  3: 3, mie: 3, miercoles: 3,
  4: 4, jue: 4, jueves: 4,
  5: 5, vie: 5, viernes: 5,
  6: 6, sab: 6, sabado: 6,
  7: 7, dom: 7, domingo: 7,
}
const NOMBRE_DIA = { 1: 'Lun', 2: 'Mar', 3: 'Mié', 4: 'Jue', 5: 'Vie', 6: 'Sáb', 7: 'Dom' }

// AAAA-MM-DD o DD/MM/AAAA → AAAA-MM-DD, o null si no es una fecha real.
export function aFechaIso(v) {
  const s = txt(v)
  let y, m, d
  let r = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s)
  if (r) [, y, m, d] = r
  else if ((r = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s))) [, d, m, y] = r
  else return null
  const f = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)))
  if (f.getUTCFullYear() !== Number(y) || f.getUTCMonth() !== Number(m) - 1 || f.getUTCDate() !== Number(d)) return null
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

// "8:00", "08:00" o "18:00:00" → "HH:MM", o null.
function aHora(v) {
  const r = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(txt(v))
  if (!r) return null
  const h = Number(r[1])
  const m = Number(r[2])
  if (h > 23 || m > 59) return null
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

// Entero positivo escrito como número o como texto ("12"); null si no lo es.
const entero = (v) => {
  const s = txt(v)
  return /^\d+$/.test(s) && Number(s) > 0 ? Number(s) : null
}

// Texto del archivo → { filas } o { error }. Acepta una lista o { salones: [...] }.
export function leerJson(texto) {
  let datos
  try {
    datos = JSON.parse(texto.replace(/^﻿/, ''))
  } catch (e) {
    return { error: `The file is not valid JSON (${e.message}).` }
  }
  const lista = Array.isArray(datos) ? datos : Array.isArray(datos?.salones) ? datos.salones : null
  if (!lista) return { error: 'The JSON must be a list of classrooms or an object with the key "salones".' }
  if (lista.length === 0) return { error: 'The file has no classrooms.' }
  if (lista.length > MAX_FILAS) return { error: `Maximum ${MAX_FILAS} classrooms per file (yours has ${lista.length}). Split it into parts.` }
  return { filas: lista }
}

const descripcionPlan = (p) => `${p.modalidad} · ${p.minutos} min · ${p.sesionesSemana} per week${p.tipoAlumno && p.tipoAlumno !== 'unico' && p.tipoAlumno !== 'ambos' ? ` · ${p.tipoAlumno}` : ''}`

// Busca el único plan vigente del nivel que cumple lo que pide el archivo. Devuelve { plan } o { error }.
function resolverPlanJson(rawPlan, nivel, planes) {
  const candidatos = planes.filter((p) => p.nivelCodigo === nivel.codigo && p.vigente !== false)
  if (!candidatos.length) return { error: `The level «${nivel.nombre}» has no current academic plans.` }
  let c = candidatos
  if (!vacio(rawPlan.modalidad)) {
    const m = clave(rawPlan.modalidad)
    c = c.filter((p) => clave(p.modalidadCodigo) === m || clave(p.modalidad) === m)
    if (!c.length) return { error: `There is no plan of «${nivel.nombre}» with the modality "${rawPlan.modalidad}".` }
  }
  if (!vacio(rawPlan.minutos)) {
    const n = entero(rawPlan.minutos)
    c = c.filter((p) => p.minutos === n)
    if (!c.length) return { error: `There is no plan of «${nivel.nombre}» with ${rawPlan.minutos}-minute classes in that modality.` }
  }
  if (!vacio(rawPlan.sesiones_semana)) {
    const n = entero(rawPlan.sesiones_semana)
    c = c.filter((p) => p.sesionesSemana === n)
    if (!c.length) return { error: `There is no plan of «${nivel.nombre}» with ${rawPlan.sesiones_semana} classes per week with those details.` }
  }
  if (!vacio(rawPlan.tipo_alumno)) {
    const t = clave(rawPlan.tipo_alumno)
    c = c.filter((p) => clave(p.tipoAlumno) === t)
    if (!c.length) return { error: `There is no plan of «${nivel.nombre}» for student type "${rawPlan.tipo_alumno}" with those details.` }
  }
  if (c.length > 1) return { error: `The plan is ambiguous: ${c.length} plans match (${c.map(descripcionPlan).join(' | ')}). Add modalidad, minutos, sesiones_semana or tipo_alumno.` }
  return { plan: c[0] }
}

// Una fila cruda → { fila (lista para guardarSalon), errores, avisos }.
export function normalizarFila(raw, { hoy, niveles = [], docentes = [], catalogo = { planes: [], frecuencias: [] } }) {
  const errores = []
  const avisos = []
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return { fila: null, errores: ['The row is not an object.'], avisos }

  const ignorados = Object.keys(raw).filter((k) => !CAMPOS.has(k))
  if (ignorados.length) avisos.push(`Campos ignorados: ${ignorados.join(', ')}.`)

  const nombre = txt(raw.nombre)
  if (!nombre) errores.push('Missing "nombre".')

  // Nivel
  let nivel = null
  if (vacio(raw.nivel)) errores.push('Missing "nivel".')
  else {
    const k = clave(raw.nivel)
    nivel = niveles.find((n) => clave(n.codigo) === k || clave(n.nombre) === k) ?? null
    if (!nivel) errores.push(`The level "${raw.nivel}" does not exist (use: ${niveles.map((n) => n.codigo).join(', ')}).`)
  }

  // Fecha de inicio
  let fechaInicio = ''
  if (vacio(raw.fecha_inicio)) errores.push('Missing "fecha_inicio".')
  else {
    fechaInicio = aFechaIso(raw.fecha_inicio)
    if (!fechaInicio) {
      errores.push(`Invalid start date: "${raw.fecha_inicio}" (use YYYY-MM-DD or DD/MM/YYYY).`)
      fechaInicio = ''
    } else if (fechaInicio < '2000-01-01' || fechaInicio > '2100-12-31') {
      errores.push('The start date is out of range.')
    }
  }

  // Capacidad
  // Opcional: la base exige una capacidad, así que si falta se pone una provisional (1 en salones privados, 8 en grupales) para que la ajustes luego.
  let capacidad = entero(raw.capacidad)
  if (vacio(raw.capacidad)) {
    capacidad = /privad/.test(clave(nombre)) ? 1 : CAPACIDAD_POR_DEFECTO
    avisos.push(`No "capacidad": it will be created with ${capacidad} (provisional); adjust it later.`)
  } else if (!capacidad) errores.push(`Invalid capacity: "${raw.capacidad}" (must be a whole number greater than 0).`)

  // Estado
  let estado = 'pendiente'
  if (!vacio(raw.estado)) {
    estado = ESTADOS[clave(raw.estado)]
    if (!estado) {
      avisos.push(`Unrecognized status: "${raw.estado}" (use pendiente, en_curso or finalizado). It will be created as “Planned”; change it later.`)
      estado = 'pendiente'
    }
  }

  // Docente (opcional): nombre completo o correo
  let docente = null
  const pedido = raw.docente ?? raw.profesor
  if (!vacio(pedido)) {
    const k = clave(pedido)
    const coinciden = docentes.filter((d) => clave(d.nombre) === k || (d.correo && clave(d.correo) === k))
    // Un docente que no se encuentra no impide crear el salón: queda «Sin asignar» y se asigna después.
    if (coinciden.length === 0) avisos.push(`Teacher "${pedido}" not found (write their full name or email). The classroom will be created without a teacher; assign one later.`)
    else if (coinciden.length > 1) avisos.push(`${coinciden.length} teachers match "${pedido}" (use the email). The classroom will be created without a teacher; assign one later.`)
    else {
      docente = coinciden[0]
      if (!docente.activo) avisos.push(`The teacher «${docente.nombre}» is inactive.`)
    }
  }

  // Horarios
  const horarios = []
  if (raw.horarios != null && !Array.isArray(raw.horarios)) errores.push('"horarios" must be a list.')
  else {
    ;(raw.horarios ?? []).forEach((h, i) => {
      const etiqueta = `Horario ${i + 1}`
      if (h === null || typeof h !== 'object' || Array.isArray(h)) return errores.push(`${etiqueta}: is not an object.`)
      const dia = DIAS[clave(h.dia)]
      const horaInicio = aHora(h.hora_inicio)
      const horaFin = aHora(h.hora_fin)
      if (!dia) return errores.push(`${etiqueta}: invalid day "${h.dia ?? ''}" (use 1 to 7 or mon, tue, wed, thu, fri, sat, sun).`)
      if (!horaInicio || !horaFin) return errores.push(`${etiqueta}: invalid time (use HH:MM, for example 18:00).`)
      if (horaFin <= horaInicio) return errores.push(`${etiqueta}: the end time must be after the start time.`)
      horarios.push({ dia, horaInicio, horaFin })
    })
    const vistos = new Set()
    for (const h of horarios) {
      const k = `${h.dia}|${h.horaInicio}`
      if (vistos.has(k)) errores.push(`Duplicate schedule: ${NOMBRE_DIA[h.dia]} ${h.horaInicio}.`)
      vistos.add(k)
    }
    const porDia = new Map()
    for (const h of horarios) porDia.set(h.dia, [...(porDia.get(h.dia) ?? []), h])
    for (const [dia, hs] of porDia) {
      const ord = [...hs].sort((a, b) => a.horaInicio.localeCompare(b.horaInicio))
      if (ord.some((h, i) => i > 0 && h.horaInicio < ord[i - 1].horaFin && h.horaInicio !== ord[i - 1].horaInicio)) errores.push(`Some schedules overlap on ${NOMBRE_DIA[dia]}.`)
    }
  }

  // Plan académico (opcional)
  let plan = null
  let cicloDesde = ''
  let cicloHasta = ''
  if (raw.plan != null) {
    if (typeof raw.plan !== 'object' || Array.isArray(raw.plan)) errores.push('"plan" must be an object { modalidad, minutos, sesiones_semana, … }.')
    else if (nivel) {
      const extra = Object.keys(raw.plan).filter((k) => !CAMPOS_PLAN.has(k))
      if (extra.length) avisos.push(`Ignored plan fields: ${extra.join(', ')}.`)
      const r = resolverPlanJson(raw.plan, nivel, catalogo.planes)
      if (r.error) errores.push(r.error)
      else {
        plan = r.plan
        const numeros = plan.ciclos.map((c) => c.ciclo)
        const desde = vacio(raw.plan.ciclo_desde) ? numeros[0] : Number(txt(raw.plan.ciclo_desde))
        const hasta = vacio(raw.plan.ciclo_hasta) ? numeros[numeros.length - 1] : Number(txt(raw.plan.ciclo_hasta))
        if (!numeros.includes(desde) || !numeros.includes(hasta) || desde > hasta) {
          errores.push(`Invalid cycles for this plan (available: ${numeros[0]}${numeros.length > 1 ? ` to ${numeros[numeros.length - 1]}` : ''}).`)
        } else {
          cicloDesde = desde
          cicloHasta = hasta
        }
      }
    }
  }

  // Frecuencia (opcional)
  let frecuencia = null
  if (!vacio(raw.frecuencia)) {
    const k = clave(raw.frecuencia)
    const grupales = catalogo.frecuencias.filter((f) => f.formato === 'grupal' && f.activa && f.estado === 'confirmado')
    const coinciden = grupales.filter((f) => clave(f.codigo) === k || clave(f.nombre) === k)
    if (coinciden.length === 0) errores.push(`No active group frequency "${raw.frecuencia}" exists.`)
    else if (coinciden.length > 1) errores.push(`${coinciden.length} frequencies match "${raw.frecuencia}": use the code.`)
    else frecuencia = coinciden[0]
  }

  // Total de sesiones: con plan lo fija el plan
  let totalSesiones = ''
  if (!vacio(raw.total_sesiones)) {
    const n = entero(raw.total_sesiones)
    if (!n) errores.push(`Invalid total of sessions: "${raw.total_sesiones}" (must be a whole number greater than 0).`)
    else if (plan) avisos.push('With an academic plan the total of sessions is set by the plan: "total_sesiones" is ignored.')
    else totalSesiones = n
  }
  if (!plan && totalSesiones === '' && !errores.length) avisos.push('Sin plan ni "total_sesiones": no tendrá calendario hasta que lo completes.')

  if (estado === 'finalizado') avisos.push('It will be created as finished.')
  else if (fechaInicio && fechaInicio < hoy && estado === 'pendiente') avisos.push('The start date has already passed: it will be marked “Ongoing” when synchronizing.')

  const fila = {
    nombre,
    nivelId: nivel?.id ?? '',
    docenteId: docente?.id ?? '',
    fechaInicio,
    capacidad: capacidad ?? '',
    totalSesiones,
    estado,
    observaciones: String(raw.observaciones ?? '').trim(),
    planId: plan?.id ?? '',
    frecuenciaId: frecuencia?.id ?? '',
    cicloDesde,
    cicloHasta,
    horarios,
  }
  return { fila, errores, avisos, docente, nivel, plan, frecuencia }
}

// Revisa todo el lote contra lo que ya existe y contra sí mismo. Una entrada por fila:
//   'nuevo' (se creará) · 'existente' (ya hay un salón con ese nombre y fecha de inicio: se omite) · 'error' (no se importará)
export function analizarLote(crudas, { salones = [], niveles = [], docentes = [], catalogo = { planes: [], frecuencias: [] }, hoy }) {
  const existentes = new Map(salones.map((s) => [`${clave(s.nombre)}|${s.fechaInicio}`, s]))
  const vistos = new Map()
  return crudas.map((raw, i) => {
    const n = i + 1
    const { fila, errores, avisos, docente, nivel, plan, frecuencia } = normalizarFila(raw, { hoy, niveles, docentes, catalogo })
    const r = { n, fila, errores: [...errores], avisos: [...avisos], estado: 'nuevo', existente: null, docente: docente ?? null, nivel: nivel ?? null, plan: plan ?? null, frecuencia: frecuencia ?? null }
    if (!fila) {
      r.estado = 'error'
      return r
    }
    if (fila.nombre && fila.fechaInicio) {
      const k = `${clave(fila.nombre)}|${fila.fechaInicio}`
      if (vistos.has(k)) r.errores.push(`Duplicate classroom: already appears in row ${vistos.get(k)} (same name and start date).`)
      else vistos.set(k, n)
      const ya = existentes.get(k)
      if (ya) {
        r.existente = ya
        r.estado = 'existente'
        r.avisos.push(`Classroom ${ya.codigo} already exists with that name and start date: skipped.`)
      }
    }
    if (r.errores.length) r.estado = 'error'
    return r
  })
}

export const resumenLote = (analisis) => ({
  total: analisis.length,
  nuevos: analisis.filter((r) => r.estado === 'nuevo').length,
  existentes: analisis.filter((r) => r.estado === 'existente').length,
  errores: analisis.filter((r) => r.estado === 'error').length,
})

// Segunda revisión, contra la base de datos (solo lectura): ¿los horarios cuadran con el plan o la frecuencia?, ¿el docente
// está libre? También detecta docentes que chocan entre dos salones del mismo archivo. `servicio` = { validarHorariosSalon, choquesHorarioSalon }.
// Devuelve un lote nuevo con los errores/avisos añadidos; si una consulta falla, se avisa y esa fila se valida al guardar.
export async function validarContraBase(analisis, { servicio, cancelado = () => false }) {
  const salida = analisis.map((r) => ({ ...r, errores: [...r.errores], avisos: [...r.avisos] }))
  for (const r of salida) {
    if (cancelado()) break
    if (r.estado !== 'nuevo' || !r.fila) continue
    const { fila } = r
    const completos = fila.horarios.length > 0
    try {
      if ((fila.planId || fila.frecuenciaId) && completos) {
        const msgs = await servicio.validarHorariosSalon(fila.planId, fila.frecuenciaId, fila.horarios)
        for (const m of msgs) (m.severidad === 'error' ? r.errores : r.avisos).push(`Schedule: ${m.mensaje}`)
      }
      if (fila.docenteId && completos && fila.fechaInicio) {
        const choques = await servicio.choquesHorarioSalon(fila.horarios, fila.fechaInicio, '', null, fila.totalSesiones || undefined)
        const propios = choques.get(fila.docenteId) ?? []
        if (propios.length) r.errores.push(`The teacher is already busy at that time: ${propios.join(', ')}.`)
      }
    } catch (e) {
      r.avisos.push(`Could not check against the database (${e.message}); it will be validated when saving.`)
    }
    if (r.errores.length) r.estado = 'error'
  }

  // Un mismo docente en dos salones del archivo con horarios que se cruzan en fechas que se pisan.
  const porDocente = new Map()
  for (const r of salida) {
    if (r.estado === 'error' || !r.fila?.docenteId || !r.fila.horarios.length) continue
    for (const otro of porDocente.get(r.fila.docenteId) ?? []) {
      const cruce = r.fila.horarios.some((a) => otro.fila.horarios.some((b) => a.dia === b.dia && a.horaInicio < b.horaFin && b.horaInicio < a.horaFin))
      if (cruce) {
        r.avisos.push(`The teacher is also in row ${otro.n} with an overlapping schedule: check that the dates do not coincide.`)
        break
      }
    }
    porDocente.set(r.fila.docenteId, [...(porDocente.get(r.fila.docenteId) ?? []), r])
  }
  return salida
}

// Ejecuta el lote fila por fila (una falla no detiene las demás). Los 'existente' se omiten.
// Devuelve [{ n, nombre, resultado: 'creado'|'omitido'|'error'|'no_procesado', mensaje }].
export async function ejecutarImportacion(analisis, { servicio, onProgreso, cancelado = () => false }) {
  const resultados = []
  let hechas = 0
  for (const r of analisis) {
    const base = { n: r.n, nombre: r.fila?.nombre ?? '' }
    if (cancelado()) {
      resultados.push({ ...base, resultado: 'no_procesado', mensaje: 'Import cancelled before reaching this row.' })
      continue
    }
    if (r.estado === 'error') resultados.push({ ...base, resultado: 'error', mensaje: r.errores.join(' ') })
    else if (r.estado === 'existente') resultados.push({ ...base, resultado: 'omitido', mensaje: `Already existed as ${r.existente.codigo}: not modified.` })
    else {
      try {
        await servicio.guardarSalon(null, r.fila)
        resultados.push({ ...base, resultado: 'creado', mensaje: '' })
      } catch (e) {
        resultados.push({ ...base, resultado: 'error', mensaje: e.message })
      }
    }
    hechas++
    onProgreso?.(hechas, analisis.length)
  }
  return resultados
}
