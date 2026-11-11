import assert from 'node:assert/strict'
import { test } from 'node:test'
import { analizarLote, ejecutarImportacion, leerJson, normalizarFila, plantillaEstudiantes, resumenLote } from './importarEstudiantes.js'

const HOY = '2026-11-11'
const ok = (o = {}) => ({ nombres: 'Ana', apellidos: 'Ruiz Paz', ...o })

test('leerJson: lista, objeto con "estudiantes" y errores claros', () => {
  assert.equal(leerJson('[{"nombres":"A"}]').filas.length, 1)
  assert.equal(leerJson('{"estudiantes":[{"nombres":"A"}]}').filas.length, 1)
  assert.match(leerJson('{"x":1}').error, /lista de estudiantes/)
  assert.match(leerJson('no es json').error, /JSON válido/)
  assert.match(leerJson('[]').error, /no tiene estudiantes/)
  assert.match(leerJson(JSON.stringify(Array.from({ length: 501 }, () => ({})))).error, /Máximo 500/)
  assert.equal(leerJson('﻿[{"nombres":"A"}]').filas.length, 1) // BOM de Excel/Windows
})

test('la plantilla de ejemplo es válida de punta a punta', () => {
  const a = analizarLote(plantillaEstudiantes.estudiantes, { hoy: HOY, salones: [{ id: 's1', codigo: 'SAL-0001', estado: 'en_curso' }] })
  assert.deepEqual(a.map((r) => [r.estado, r.errores]), [['nuevo', []], ['nuevo', []]])
  assert.equal(a[1].fila.fechaNacimiento, '2001-03-15') // DD/MM/AAAA → ISO
  assert.equal(a[1].fila.genero, 'F')
})

test('normalizarFila: obligatorios, documento, fecha, género, correo y celular', () => {
  assert.deepEqual(normalizarFila({}, HOY).errores, ['Falta "nombres".', 'Falta "apellidos".'])
  assert.match(normalizarFila(ok({ tipo_documento: 'dni', numero_documento: '123' }), HOY).errores[0], /8 dígitos/)
  assert.match(normalizarFila(ok({ numero_documento: '72266090' }), HOY).errores[0], /tipo de documento/)
  assert.match(normalizarFila(ok({ tipo_documento: 'inventado', numero_documento: '1' }), HOY).errores[0], /no válido/)
  assert.equal(normalizarFila(ok({ tipo_documento: 'DNI (Perú)', numero_documento: '72 266 090' }), HOY).fila.numeroDocumento, '72266090')
  assert.equal(normalizarFila(ok({ tipo_documento: 'Carné de extranjería', numero_documento: 'ab-12345' }), HOY).fila.tipoDocumento, 'ce')
  assert.match(normalizarFila(ok({ fecha_nacimiento: '2026-02-31' }), HOY).errores[0], /no válida/)
  assert.match(normalizarFila(ok({ fecha_nacimiento: '2999-01-01' }), HOY).errores[0], /fuera de rango/)
  assert.match(normalizarFila(ok({ genero: 'x' }), HOY).errores[0], /Género/)
  assert.equal(normalizarFila(ok({ genero: 'Masculino' }), HOY).fila.genero, 'M')
  assert.match(normalizarFila(ok({ correo: 'sin-arroba' }), HOY).errores[0], /Correo/)
  assert.equal(normalizarFila(ok({ correo: ' ANA@Correo.COM ' }), HOY).fila.correo, 'ana@correo.com')
  assert.match(normalizarFila(ok({ celular: '12' }), HOY).errores[0], /Celular/)
  assert.equal(normalizarFila(ok({ telefono: '+51 949 531 737' }), HOY).fila.telefono, '+51 949 531 737') // alias "telefono"
})

test('normalizarFila: MaskPark (plano o anidado) y campos ignorados', () => {
  assert.match(normalizarFila(ok({ maskpark_clave: 'x' }), HOY).errores[0], /falta "maskpark_usuario"/)
  const anidado = normalizarFila(ok({ maskpark: { usuario: 'ANA', clave: 'k1' } }), HOY).fila
  assert.deepEqual([anidado.maskparkUsuario, anidado.maskparkClave], ['ANA', 'k1'])
  const r = normalizarFila(ok({ edad: 28, color: 'rojo' }), HOY)
  assert.deepEqual(r.errores, [])
  assert.match(r.avisos[0], /edad, color.*edad se calcula/)
  assert.deepEqual(normalizarFila([1], HOY).errores, ['La fila no es un objeto.'])
})

test('analizarLote: repetidos en el archivo y contra lo ya registrado', () => {
  const existentes = [
    { id: 'e1', nombre: 'Luis Gómez', tipo_documento: 'dni', numero_documento: '11111111', correo: 'luis@x.com', telefono: '999 000 111', activo: true },
  ]
  const filas = [
    ok({ tipo_documento: 'dni', numero_documento: '22222222' }), // 1 nuevo
    ok({ nombres: 'Otra', apellidos: 'Persona', tipo_documento: 'dni', numero_documento: '22222222' }), // 2 documento repetido en el archivo
    ok({ nombres: 'Luis', apellidos: 'Gomez', tipo_documento: 'dni', numero_documento: '11111111' }), // 3 existente (sin tildes igual)
    ok({ nombres: 'Pedro', apellidos: 'Sol', correo: 'luis@x.com' }), // 4 correo de otra persona
    ok({ nombres: 'Rosa', apellidos: 'Mar', celular: '999000111' }), // 5 celular de otra persona
    ok({ nombres: 'Ana', apellidos: 'Ruiz Paz' }), // 6 mismo nombre que la fila 1
    ok({ nombres: 'Eva', apellidos: 'Sol', salon: 'SAL-9999' }), // 7 salón inexistente
    ok({ nombres: 'Ivo', apellidos: 'Sol', salon: 'sal-0002' }), // 8 salón finalizado
  ]
  const a = analizarLote(filas, { hoy: HOY, estudiantes: existentes, salones: [{ id: 's2', codigo: 'SAL-0002', estado: 'finalizado' }] })
  assert.deepEqual(a.map((r) => r.estado), ['nuevo', 'error', 'existente', 'error', 'error', 'error', 'error', 'error'])
  assert.match(a[1].errores.join(' '), /Documento repetido.*fila 1/)
  assert.equal(a[2].existente.id, 'e1')
  assert.match(a[3].errores.join(' '), /correo ya pertenece a «Luis Gómez»/)
  assert.match(a[4].errores.join(' '), /celular ya pertenece/)
  assert.match(a[5].errores.join(' '), /Nombre repetido.*fila 1/)
  assert.match(a[6].errores.join(' '), /No existe el salón/)
  assert.match(a[7].errores.join(' '), /finalizado/)
  assert.deepEqual(resumenLote(a), { total: 8, nuevos: 1, existentes: 1, errores: 6 })
})

test('analizarLote: el documento y el nombre apuntan a personas distintas = error', () => {
  const existentes = [
    { id: 'e1', nombre: 'Luis Gómez', tipo_documento: 'dni', numero_documento: '11111111' },
    { id: 'e2', nombre: 'Ana Ruiz Paz', tipo_documento: 'dni', numero_documento: '33333333' },
  ]
  const [r] = analizarLote([ok({ tipo_documento: 'dni', numero_documento: '11111111' })], { hoy: HOY, estudiantes: existentes })
  assert.equal(r.estado, 'error')
  assert.match(r.errores[0], /documento es de «Luis Gómez».*«Ana Ruiz Paz»/)
})

// Servicio de prueba que registra las llamadas y puede fallar por nombre.
const servicioFalso = (fallan = []) => {
  const llamadas = []
  return {
    llamadas,
    guardarEstudiante: async (id, datos) => {
      llamadas.push(['guardar', id, datos])
      if (fallan.includes(datos.nombre)) throw new Error('rechazado por la base')
      return id ?? `id-${llamadas.length}`
    },
    matricularAlumnos: async (salon, ids) => {
      llamadas.push(['matricular', salon, ids])
      if (salon === 'lleno') throw new Error('El salón no tiene cupos')
      if (salon === 'repetido') throw new Error('Ya matriculados en este salón: Ana')
      return 1
    },
  }
}

test('ejecutarImportacion: crea, omite, actualiza conservando lo existente, matricula y sigue ante errores', async () => {
  const existentes = [{ id: 'e1', nombre: 'Luis Gómez', correo: 'luis@x.com', telefono: '999', notas: 'nota previa', activo: false, genero: 'M' }]
  const salones = [{ id: 's1', codigo: 'SAL-0001', estado: 'en_curso' }, { id: 'lleno', codigo: 'SAL-0002', estado: 'en_curso' }]
  const filas = [
    ok({ nombres: 'Nueva', apellidos: 'Uno', salon: 'SAL-0001' }),
    ok({ nombres: 'Luis', apellidos: 'Gómez', celular: '988777666' }),
    ok({ nombres: 'Falla', apellidos: 'Seguro' }),
    ok({ nombres: 'Sin', apellidos: 'Cupo', salon: 'SAL-0002' }),
    { apellidos: 'Sin nombres' },
  ]
  const analisis = analizarLote(filas, { hoy: HOY, estudiantes: existentes, salones })

  // Modo omitir
  let svc = servicioFalso(['Falla Seguro'])
  let res = await ejecutarImportacion(analisis, { servicio: svc, modo: 'omitir' })
  assert.deepEqual(res.map((r) => r.resultado), ['creado', 'omitido', 'error', 'creado', 'error'])
  assert.equal(res[0].matricula, 'Matriculado en SAL-0001')
  assert.match(res[2].mensaje, /rechazado/)
  assert.match(res[3].matricula, /No se pudo matricular en SAL-0002: El salón no tiene cupos/) // creado igual, matrícula aparte
  assert.match(res[4].mensaje, /Falta "nombres"/)
  assert.equal(svc.llamadas.filter((l) => l[0] === 'guardar' && l[1] === 'e1').length, 0) // omitir no toca al existente

  // Modo actualizar: conserva correo, notas, género y estado activo que el archivo no trae
  svc = servicioFalso()
  res = await ejecutarImportacion(analisis.slice(1, 2), { servicio: svc, modo: 'actualizar' })
  assert.equal(res[0].resultado, 'actualizado')
  const [, id, datos] = svc.llamadas[0]
  assert.equal(id, 'e1')
  assert.deepEqual([datos.telefono, datos.correo, datos.notas, datos.activo, datos.genero], ['988777666', 'luis@x.com', 'nota previa', false, 'M'])
  assert.equal('maskparkUsuario' in datos, false) // sin usuario en el archivo, MaskPark no se toca
})

test('ejecutarImportacion: volver a subir un matriculado solo informa, no es error', async () => {
  const salones = [{ id: 'repetido', codigo: 'SAL-0003', estado: 'en_curso' }]
  const analisis = analizarLote([ok({ salon: 'SAL-0003' })], { hoy: HOY, estudiantes: [{ id: 'e1', nombre: 'Ana Ruiz Paz', activo: true }], salones })
  const [r] = await ejecutarImportacion(analisis, { servicio: servicioFalso(), modo: 'omitir' })
  assert.equal(r.resultado, 'omitido')
  assert.equal(r.matricula, 'Ya estaba matriculado en SAL-0003')
})

test('ejecutarImportacion: se puede cancelar y avisa el progreso', async () => {
  const analisis = analizarLote([ok({ nombres: 'A', apellidos: 'Uno' }), ok({ nombres: 'B', apellidos: 'Dos' }), ok({ nombres: 'C', apellidos: 'Tres' })], { hoy: HOY })
  let cancelar = false
  const avances = []
  const res = await ejecutarImportacion(analisis, {
    servicio: servicioFalso(),
    onProgreso: (h, t) => {
      avances.push(`${h}/${t}`)
      if (h === 1) cancelar = true
    },
    cancelado: () => cancelar,
  })
  assert.deepEqual(res.map((r) => r.resultado), ['creado', 'no_procesado', 'no_procesado'])
  assert.deepEqual(avances, ['1/3'])
})
