import assert from 'node:assert/strict'
import { test } from 'node:test'
import { analizarLote, ejecutarImportacion, leerJson, normalizarFila, plantillaSalones, resumenLote, validarContraBase } from './importarSalones.js'

const HOY = '2026-11-11'
const niveles = [
  { id: 'n1', codigo: 'basico', nombre: 'Básico' },
  { id: 'n2', codigo: 'intermedio', nombre: 'Intermedio' },
]
const docentes = [
  { id: 'd1', nombre: 'Ana Ruiz Paz', correo: 'ana@x.com', activo: true },
  { id: 'd2', nombre: 'Luis Gómez', correo: 'luis@x.com', activo: true },
]
const planes = [
  { id: 'p1', nivelCodigo: 'basico', nivel: 'Básico', modalidadCodigo: 'estandar', modalidad: 'Estándar Grupal', minutos: 60, sesionesSemana: 5, tipoAlumno: 'unico', vigente: true, ciclos: [{ ciclo: 1, sesiones: 40 }, { ciclo: 2, sesiones: 40 }] },
  { id: 'p2', nivelCodigo: 'basico', nivel: 'Básico', modalidadCodigo: 'estandar', modalidad: 'Estándar Grupal', minutos: 90, sesionesSemana: 3, tipoAlumno: 'unico', vigente: true, ciclos: [{ ciclo: 1, sesiones: 30 }] },
]
const frecuencias = [{ id: 'f1', codigo: 'grupal-lv-60', nombre: 'LV 60', formato: 'grupal', activa: true, estado: 'confirmado' }]
const ctx = { hoy: HOY, niveles, docentes, catalogo: { planes, frecuencias } }
const ok = (o = {}) => ({ nombre: 'Salón A', nivel: 'basico', fecha_inicio: '2026-12-01', capacidad: 8, ...o })
const h = (dia, a = '19:00', b = '20:00') => ({ dia, hora_inicio: a, hora_fin: b })

test('leerJson: lista, objeto con "salones" y errores claros', () => {
  assert.equal(leerJson('[{"nombre":"A"}]').filas.length, 1)
  assert.equal(leerJson('{"salones":[{"nombre":"A"}]}').filas.length, 1)
  assert.match(leerJson('{"x":1}').error, /list of classrooms/)
  assert.match(leerJson('nada').error, /valid JSON/)
  assert.match(leerJson('[]').error, /has no classrooms/)
  assert.match(leerJson(JSON.stringify(Array.from({ length: 201 }, () => ({})))).error, /Maximum 200/)
})

test('la plantilla de ejemplo es válida con un catálogo que tenga ese plan', () => {
  const a = analizarLote(plantillaSalones.salones, { ...ctx, catalogo: { planes: [planes[0]], frecuencias } })
  assert.deepEqual(a.map((r) => [r.estado, r.errores]), [['nuevo', []], ['nuevo', []]])
  assert.equal(a[1].fila.fechaInicio, '2026-12-05') // DD/MM/AAAA → ISO
  assert.equal(a[1].fila.totalSesiones, 24)
})

test('obligatorios, nivel, fecha, capacidad y estado', () => {
  assert.deepEqual(normalizarFila({}, ctx).errores, ['Missing "nombre".', 'Missing "nivel".', 'Missing "fecha_inicio".'])
  const sinCap = normalizarFila(ok({ capacidad: undefined }), ctx) // no bloquea: capacidad provisional
  assert.deepEqual([sinCap.errores, sinCap.fila.capacidad], [[], 8])
  assert.match(sinCap.avisos[0], /provisional/)
  assert.equal(normalizarFila(ok({ nombre: 'BASIC - PRIVADO: ANA', capacidad: '' }), ctx).fila.capacidad, 1)
  assert.match(normalizarFila(ok({ nivel: 'zzz' }), ctx).errores[0], /does not exist/)
  assert.equal(normalizarFila(ok({ nivel: 'Basico' }), ctx).fila.nivelId, 'n1') // por nombre, sin tildes
  assert.match(normalizarFila(ok({ fecha_inicio: '31/02/2026' }), ctx).errores[0], /Invalid start date/)
  assert.match(normalizarFila(ok({ capacidad: 0 }), ctx).errores[0], /Invalid capacity/)
  assert.match(normalizarFila(ok({ capacidad: '1.5' }), ctx).errores[0], /Invalid capacity/)
  assert.equal(normalizarFila(ok({ estado: 'En curso' }), ctx).fila.estado, 'en_curso')
  assert.equal(normalizarFila(ok({ estado: 'Planificado' }), ctx).fila.estado, 'pendiente')
  const malEstado = normalizarFila(ok({ estado: 'x' }), ctx) // no bloquea: se crea como Planificado
  assert.deepEqual([malEstado.errores, malEstado.fila.estado], [[], 'pendiente'])
  assert.match(malEstado.avisos[0], /Unrecognized status/)
  assert.match(normalizarFila('texto', ctx).errores[0], /not an object/)
})

test('docente: por nombre o correo, inexistente y ambiguo', () => {
  assert.equal(normalizarFila(ok({ docente: 'ana ruiz paz' }), ctx).fila.docenteId, 'd1')
  assert.equal(normalizarFila(ok({ docente: 'LUIS@x.com' }), ctx).fila.docenteId, 'd2')
  assert.equal(normalizarFila(ok({ profesor: 'Ana Ruiz Paz' }), ctx).fila.docenteId, 'd1')
  const nadie = normalizarFila(ok({ docente: 'Nadie' }), ctx) // no bloquea: sin docente
  assert.deepEqual([nadie.errores, nadie.fila.docenteId], [[], ''])
  assert.match(nadie.avisos[0], /not found/)
  const dup = { ...ctx, docentes: [...docentes, { id: 'd3', nombre: 'Ana Ruiz Paz', correo: null, activo: true }] }
  const amb = normalizarFila(ok({ docente: 'Ana Ruiz Paz' }), dup)
  assert.deepEqual([amb.errores, amb.fila.docenteId], [[], ''])
  assert.match(amb.avisos[0], /2 teachers/)
})

test('horarios: días con nombre, horas, orden y cruces', () => {
  const r = normalizarFila(ok({ horarios: [h('Lunes', '8:00', '09:30'), h(3), h('mié', '21:00', '22:00')] }), ctx)
  assert.deepEqual(r.errores, [])
  assert.deepEqual(r.fila.horarios[0], { dia: 1, horaInicio: '08:00', horaFin: '09:30' })
  assert.match(normalizarFila(ok({ horarios: [h('xx')] }), ctx).errores[0], /invalid day/)
  assert.match(normalizarFila(ok({ horarios: [h(1, '25:00', '26:00')] }), ctx).errores[0], /invalid time/)
  assert.match(normalizarFila(ok({ horarios: [h(1, '20:00', '19:00')] }), ctx).errores[0], /after the start/)
  assert.match(normalizarFila(ok({ horarios: [h(1), h(1)] }), ctx).errores[0], /Duplicate schedule/)
  assert.match(normalizarFila(ok({ horarios: [h(1, '19:00', '20:00'), h(1, '19:30', '21:00')] }), ctx).errores[0], /overlap/)
  assert.equal(normalizarFila(ok({ horarios: [h(1, '19:00', '20:00'), h(1, '20:00', '21:00')] }), ctx).errores.length, 0) // contiguos
  assert.match(normalizarFila(ok({ horarios: 'lunes' }), ctx).errores[0], /must be a list/)
})

test('plan: se identifica con lo mínimo, detecta ambigüedad y ciclos', () => {
  assert.match(normalizarFila(ok({ plan: {} }), ctx).errores[0], /ambiguous/)
  const r = normalizarFila(ok({ plan: { modalidad: 'Estándar Grupal', minutos: 60 }, total_sesiones: 10 }), ctx)
  assert.deepEqual(r.errores, [])
  assert.equal(r.fila.planId, 'p1')
  assert.deepEqual([r.fila.cicloDesde, r.fila.cicloHasta, r.fila.totalSesiones], [1, 2, ''])
  assert.ok(r.avisos.some((a) => /set by the plan/.test(a)))
  assert.equal(normalizarFila(ok({ plan: { minutos: 60, ciclo_desde: 2, ciclo_hasta: 2 } }), ctx).fila.cicloDesde, 2)
  assert.match(normalizarFila(ok({ plan: { minutos: 60, ciclo_desde: 3, ciclo_hasta: 3 } }), ctx).errores[0], /Invalid cycles/)
  assert.match(normalizarFila(ok({ plan: { minutos: 45 } }), ctx).errores[0], /45-minute/)
  assert.match(normalizarFila(ok({ nivel: 'intermedio', plan: { minutos: 60 } }), ctx).errores[0], /no current academic plans/)
})

test('frecuencia y total de sesiones', () => {
  assert.equal(normalizarFila(ok({ frecuencia: 'GRUPAL-LV-60' }), ctx).fila.frecuenciaId, 'f1')
  assert.match(normalizarFila(ok({ frecuencia: 'otra' }), ctx).errores[0], /No active group frequency/)
  assert.equal(normalizarFila(ok({ total_sesiones: '24' }), ctx).fila.totalSesiones, 24)
  assert.match(normalizarFila(ok({ total_sesiones: -3 }), ctx).errores[0], /Invalid total of sessions/)
})

test('analizarLote: repetidos en el archivo y salones que ya existen', () => {
  const a = analizarLote([ok(), ok(), ok({ nombre: 'Salón B' })], { ...ctx, salones: [{ nombre: 'salon b', fechaInicio: '2026-12-01', codigo: 'SAL-0009' }] })
  assert.deepEqual(a.map((r) => r.estado), ['nuevo', 'error', 'existente'])
  assert.match(a[1].errores[0], /row 1/)
  assert.deepEqual(resumenLote(a), { total: 3, nuevos: 1, existentes: 1, errores: 1 })
})

test('validarContraBase: avisos de horario, choque de docente y falla de la consulta', async () => {
  const lote = analizarLote(
    [
      ok({ nombre: 'A', plan: { minutos: 60 }, horarios: [h(1)], docente: 'Ana Ruiz Paz' }),
      ok({ nombre: 'B', horarios: [h(1)], docente: 'Luis Gómez' }),
      ok({ nombre: 'C', frecuencia: 'grupal-lv-60', horarios: [h(2)] }),
    ],
    ctx,
  )
  const servicio = {
    validarHorariosSalon: async (planId) => {
      if (planId) return [{ severidad: 'error', mensaje: 'Faltan clases.' }, { severidad: 'advertencia', mensaje: 'Revisa.' }]
      throw new Error('sin red')
    },
    choquesHorarioSalon: async () => new Map([['d2', ['Inglés B1 (Lun 19:00–20:00)']]]),
  }
  const r = await validarContraBase(lote, { servicio })
  assert.equal(r[0].estado, 'error')
  assert.deepEqual(r[0].errores, ['Schedule: Faltan clases.'])
  assert.equal(r[1].estado, 'error')
  assert.match(r[1].errores[0], /busy/)
  assert.equal(r[2].estado, 'nuevo')
  assert.match(r[2].avisos.at(-1), /validated when saving/)
})

test('validarContraBase avisa si un docente se repite con horarios cruzados dentro del archivo', async () => {
  const lote = analizarLote([ok({ nombre: 'A', docente: 'Ana Ruiz Paz', horarios: [h(1)] }), ok({ nombre: 'B', docente: 'Ana Ruiz Paz', horarios: [h(1, '19:30', '20:30')] })], ctx)
  const r = await validarContraBase(lote, { servicio: { validarHorariosSalon: async () => [], choquesHorarioSalon: async () => new Map() } })
  assert.match(r[1].avisos.at(-1), /row 1/)
})

test('ejecutarImportacion: crea, omite, reporta errores y respeta la cancelación', async () => {
  const lote = analizarLote([ok({ nombre: 'A' }), ok({ nombre: 'B' }), ok({ nombre: 'C' }), ok({ nivel: 'zzz' })], { ...ctx, salones: [{ nombre: 'B', fechaInicio: '2026-12-01', codigo: 'SAL-0001' }] })
  const guardados = []
  const servicio = {
    guardarSalon: async (id, f) => {
      if (f.nombre === 'C') throw new Error('Docente ocupado')
      guardados.push([id, f.nombre])
    },
  }
  const res = await ejecutarImportacion(lote, { servicio })
  assert.deepEqual(res.map((x) => x.resultado), ['creado', 'omitido', 'error', 'error'])
  assert.deepEqual(guardados, [[null, 'A']])
  assert.match(res[2].mensaje, /Docente ocupado/)
  const cancel = await ejecutarImportacion(lote, { servicio, cancelado: () => true })
  assert.ok(cancel.every((x) => x.resultado === 'no_procesado'))
})
