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
    return { error: `El archivo no es un JSON válido (${e.message}).` }
  }
  const lista = Array.isArray(datos) ? datos : Array.isArray(datos?.salones) ? datos.salones : null
  if (!lista) return { error: 'El JSON debe ser una lista de salones o un objeto con la clave "salones".' }
  if (lista.length === 0) return { error: 'El archivo no tiene salones.' }
  if (lista.length > MAX_FILAS) return { error: `Máximo ${MAX_FILAS} salones por archivo (el tuyo tiene ${lista.length}). Divídelo en partes.` }
  return { filas: lista }
}

const descripcionPlan = (p) => `${p.modalidad} · ${p.minutos} min · ${p.sesionesSemana} por semana${p.tipoAlumno && p.tipoAlumno !== 'unico' && p.tipoAlumno !== 'ambos' ? ` · ${p.tipoAlumno}` : ''}`

// Busca el único plan vigente del nivel que cumple lo que pide el archivo. Devuelve { plan } o { error }.
function resolverPlanJson(rawPlan, nivel, planes) {
  const candidatos = planes.filter((p) => p.nivelCodigo === nivel.codigo && p.vigente !== false)
  if (!candidatos.length) return { error: `El nivel «${nivel.nombre}» no tiene planes académicos vigentes.` }
  let c = candidatos
  if (!vacio(rawPlan.modalidad)) {
    const m = clave(rawPlan.modalidad)
    c = c.filter((p) => clave(p.modalidadCodigo) === m || clave(p.modalidad) === m)
    if (!c.length) return { error: `No hay un plan de «${nivel.nombre}» con la modalidad "${rawPlan.modalidad}".` }
  }
  if (!vacio(rawPlan.minutos)) {
    const n = entero(rawPlan.minutos)
    c = c.filter((p) => p.minutos === n)
    if (!c.length) return { error: `No hay un plan de «${nivel.nombre}» con clases de ${rawPlan.minutos} minutos en esa modalidad.` }
  }
  if (!vacio(rawPlan.sesiones_semana)) {
    const n = entero(rawPlan.sesiones_semana)
    c = c.filter((p) => p.sesionesSemana === n)
    if (!c.length) return { error: `No hay un plan de «${nivel.nombre}» con ${rawPlan.sesiones_semana} clases por semana con esos datos.` }
  }
  if (!vacio(rawPlan.tipo_alumno)) {
    const t = clave(rawPlan.tipo_alumno)
    c = c.filter((p) => clave(p.tipoAlumno) === t)
    if (!c.length) return { error: `No hay un plan de «${nivel.nombre}» para alumno "${rawPlan.tipo_alumno}" con esos datos.` }
  }
  if (c.length > 1) return { error: `El plan es ambiguo: hay ${c.length} que coinciden (${c.map(descripcionPlan).join(' | ')}). Agrega modalidad, minutos, sesiones_semana o tipo_alumno.` }
  return { plan: c[0] }
}

// Una fila cruda → { fila (lista para guardarSalon), errores, avisos }.
export function normalizarFila(raw, { hoy, niveles = [], docentes = [], catalogo = { planes: [], frecuencias: [] } }) {
  const errores = []
  const avisos = []
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return { fila: null, errores: ['La fila no es un objeto.'], avisos }

  const ignorados = Object.keys(raw).filter((k) => !CAMPOS.has(k))
  if (ignorados.length) avisos.push(`Campos ignorados: ${ignorados.join(', ')}.`)

  const nombre = txt(raw.nombre)
  if (!nombre) errores.push('Falta "nombre".')

  // Nivel
  let nivel = null
  if (vacio(raw.nivel)) errores.push('Falta "nivel".')
  else {
    const k = clave(raw.nivel)
    nivel = niveles.find((n) => clave(n.codigo) === k || clave(n.nombre) === k) ?? null
    if (!nivel) errores.push(`No existe el nivel "${raw.nivel}" (usa: ${niveles.map((n) => n.codigo).join(', ')}).`)
  }

  // Fecha de inicio
  let fechaInicio = ''
  if (vacio(raw.fecha_inicio)) errores.push('Falta "fecha_inicio".')
  else {
    fechaInicio = aFechaIso(raw.fecha_inicio)
    if (!fechaInicio) {
      errores.push(`Fecha de inicio no válida: "${raw.fecha_inicio}" (usa AAAA-MM-DD o DD/MM/AAAA).`)
      fechaInicio = ''
    } else if (fechaInicio < '2000-01-01' || fechaInicio > '2100-12-31') {
      errores.push('La fecha de inicio está fuera de rango.')
    }
  }

  // Capacidad
  // Opcional: la base exige una capacidad, así que si falta se pone una provisional (1 en salones privados, 8 en grupales) para que la ajustes luego.
  let capacidad = entero(raw.capacidad)
  if (vacio(raw.capacidad)) {
    capacidad = /privad/.test(clave(nombre)) ? 1 : CAPACIDAD_POR_DEFECTO
    avisos.push(`Sin "capacidad": se creará con ${capacidad} (provisional); ajústala después.`)
  } else if (!capacidad) errores.push(`Capacidad no válida: "${raw.capacidad}" (debe ser un número entero mayor que 0).`)

  // Estado
  let estado = 'pendiente'
  if (!vacio(raw.estado)) {
    estado = ESTADOS[clave(raw.estado)]
    if (!estado) {
      avisos.push(`Estado no reconocido: "${raw.estado}" (usa pendiente, en_curso o finalizado). Se creará como «Planificado»; cámbialo después.`)
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
    if (coinciden.length === 0) avisos.push(`No se encontró al docente "${pedido}" (escribe su nombre completo o su correo). El salón se creará sin docente; asígnalo después.`)
    else if (coinciden.length > 1) avisos.push(`Hay ${coinciden.length} docentes que coinciden con "${pedido}" (usa el correo). El salón se creará sin docente; asígnalo después.`)
    else {
      docente = coinciden[0]
      if (!docente.activo) avisos.push(`El docente «${docente.nombre}» está inactivo.`)
    }
  }

  // Horarios
  const horarios = []
  if (raw.horarios != null && !Array.isArray(raw.horarios)) errores.push('"horarios" debe ser una lista.')
  else {
    ;(raw.horarios ?? []).forEach((h, i) => {
      const etiqueta = `Horario ${i + 1}`
      if (h === null || typeof h !== 'object' || Array.isArray(h)) return errores.push(`${etiqueta}: no es un objeto.`)
      const dia = DIAS[clave(h.dia)]
      const horaInicio = aHora(h.hora_inicio)
      const horaFin = aHora(h.hora_fin)
      if (!dia) return errores.push(`${etiqueta}: día no válido "${h.dia ?? ''}" (usa 1 a 7 o lun, mar, mié, jue, vie, sáb, dom).`)
      if (!horaInicio || !horaFin) return errores.push(`${etiqueta}: hora no válida (usa HH:MM, por ejemplo 18:00).`)
      if (horaFin <= horaInicio) return errores.push(`${etiqueta}: la hora de fin debe ser posterior a la de inicio.`)
      horarios.push({ dia, horaInicio, horaFin })
    })
    const vistos = new Set()
    for (const h of horarios) {
      const k = `${h.dia}|${h.horaInicio}`
      if (vistos.has(k)) errores.push(`Horario repetido: ${NOMBRE_DIA[h.dia]} ${h.horaInicio}.`)
      vistos.add(k)
    }
    const porDia = new Map()
    for (const h of horarios) porDia.set(h.dia, [...(porDia.get(h.dia) ?? []), h])
    for (const [dia, hs] of porDia) {
      const ord = [...hs].sort((a, b) => a.horaInicio.localeCompare(b.horaInicio))
      if (ord.some((h, i) => i > 0 && h.horaInicio < ord[i - 1].horaFin && h.horaInicio !== ord[i - 1].horaInicio)) errores.push(`Hay horarios que se cruzan el ${NOMBRE_DIA[dia]}.`)
    }
  }

  // Plan académico (opcional)
  let plan = null
  let cicloDesde = ''
  let cicloHasta = ''
  if (raw.plan != null) {
    if (typeof raw.plan !== 'object' || Array.isArray(raw.plan)) errores.push('"plan" debe ser un objeto { modalidad, minutos, sesiones_semana, … }.')
    else if (nivel) {
      const extra = Object.keys(raw.plan).filter((k) => !CAMPOS_PLAN.has(k))
      if (extra.length) avisos.push(`Campos del plan ignorados: ${extra.join(', ')}.`)
      const r = resolverPlanJson(raw.plan, nivel, catalogo.planes)
      if (r.error) errores.push(r.error)
      else {
        plan = r.plan
        const numeros = plan.ciclos.map((c) => c.ciclo)
        const desde = vacio(raw.plan.ciclo_desde) ? numeros[0] : Number(txt(raw.plan.ciclo_desde))
        const hasta = vacio(raw.plan.ciclo_hasta) ? numeros[numeros.length - 1] : Number(txt(raw.plan.ciclo_hasta))
        if (!numeros.includes(desde) || !numeros.includes(hasta) || desde > hasta) {
          errores.push(`Ciclos no válidos para este plan (disponibles: ${numeros[0]}${numeros.length > 1 ? ` a ${numeros[numeros.length - 1]}` : ''}).`)
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
    if (coinciden.length === 0) errores.push(`No existe una frecuencia grupal activa "${raw.frecuencia}".`)
    else if (coinciden.length > 1) errores.push(`Hay ${coinciden.length} frecuencias que coinciden con "${raw.frecuencia}": usa el código.`)
    else frecuencia = coinciden[0]
  }

  // Total de sesiones: con plan lo fija el plan
  let totalSesiones = ''
  if (!vacio(raw.total_sesiones)) {
    const n = entero(raw.total_sesiones)
    if (!n) errores.push(`Total de sesiones no válido: "${raw.total_sesiones}" (debe ser un entero mayor que 0).`)
    else if (plan) avisos.push('Con plan académico el total de sesiones lo fija el plan: se ignora "total_sesiones".')
    else totalSesiones = n
  }
  if (!plan && totalSesiones === '' && !errores.length) avisos.push('Sin plan ni "total_sesiones": no tendrá calendario hasta que lo completes.')

  if (estado === 'finalizado') avisos.push('Se creará como finalizado.')
  else if (fechaInicio && fechaInicio < hoy && estado === 'pendiente') avisos.push('La fecha de inicio ya pasó: se marcará «En curso» al sincronizar.')

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
      if (vistos.has(k)) r.errores.push(`Salón repetido: ya aparece en la fila ${vistos.get(k)} (mismo nombre y fecha de inicio).`)
      else vistos.set(k, n)
      const ya = existentes.get(k)
      if (ya) {
        r.existente = ya
        r.estado = 'existente'
        r.avisos.push(`Ya existe el salón ${ya.codigo} con ese nombre y fecha de inicio: se omite.`)
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
        for (const m of msgs) (m.severidad === 'error' ? r.errores : r.avisos).push(`Horario: ${m.mensaje}`)
      }
      if (fila.docenteId && completos && fila.fechaInicio) {
        const choques = await servicio.choquesHorarioSalon(fila.horarios, fila.fechaInicio, '', null, fila.totalSesiones || undefined)
        const propios = choques.get(fila.docenteId) ?? []
        if (propios.length) r.errores.push(`El docente ya está ocupado en ese horario: ${propios.join(', ')}.`)
      }
    } catch (e) {
      r.avisos.push(`No se pudo revisar contra la base de datos (${e.message}); se validará al guardar.`)
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
        r.avisos.push(`El docente también está en la fila ${otro.n} con un horario que se cruza: revisa que las fechas no coincidan.`)
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
      resultados.push({ ...base, resultado: 'no_procesado', mensaje: 'Importación cancelada antes de llegar a esta fila.' })
      continue
    }
    if (r.estado === 'error') resultados.push({ ...base, resultado: 'error', mensaje: r.errores.join(' ') })
    else if (r.estado === 'existente') resultados.push({ ...base, resultado: 'omitido', mensaje: `Ya existía como ${r.existente.codigo}: no se modificó.` })
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
