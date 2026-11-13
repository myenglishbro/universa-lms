// Carga masiva de estudiantes desde un archivo JSON.
//
// Formato: una lista de estudiantes, o un objeto { "estudiantes": [ ... ] }. Cada estudiante usa estos campos (todos de texto):
//
//   nombres*            Nombres                                   "JUAN SEBASTIAN"
//   apellidos*          Apellidos                                 "MONTENEGRO ARIAS"
//   tipo_documento      dni | ce | pasaporte | licencia | otro     "dni"   (también «DNI (Perú)», «Pasaporte»…)
//   numero_documento    Número (DNI = 8 dígitos)                   "72266090"
//   fecha_nacimiento    AAAA-MM-DD (también DD/MM/AAAA)            "1997-10-15"
//   pais_nacionalidad   País                                       "Perú"
//   genero              M | F | O (también Masculino/Femenino)     "M"
//   correo              Correo                                     "juan@correo.com"
//   celular             Celular (también «telefono»)               "+51 949531737"
//   maskpark_usuario    Usuario en MaskPark                        "JUANSEBASTIANMONTENEGROARIAS"
//   maskpark_clave      Contraseña en MaskPark                     "72266090Jsma_"
//   notas               Notas                                      "Llegó por referido"
//   salon               Código del salón donde matricularlo        "SAL-0003"
//
// * = obligatorio. La edad no se carga (se calcula con la fecha de nacimiento). Un campo que no se reconoce se avisa y se ignora.
// tipo_documento y numero_documento van juntos. La base de datos vuelve a validar todo al guardar.
import { calcularEdad, errorDocumento } from './estudiantes.js'

export const MAX_FILAS = 500
export const MAX_BYTES = 2 * 1024 * 1024

export const plantillaEstudiantes = {
  estudiantes: [
    {
      nombres: 'JUAN SEBASTIAN',
      apellidos: 'MONTENEGRO ARIAS',
      tipo_documento: 'dni',
      numero_documento: '72266090',
      fecha_nacimiento: '1997-10-15',
      pais_nacionalidad: 'Perú',
      genero: 'M',
      correo: 'sebastian@correo.com',
      celular: '+51 949531737',
      maskpark_usuario: 'JUANSEBASTIANMONTENEGROARIAS',
      maskpark_clave: '72266090Jsma_',
      notas: '',
      salon: 'SAL-0001',
    },
    {
      nombres: 'MARY',
      apellidos: 'SMITH',
      tipo_documento: 'pasaporte',
      numero_documento: 'AB123456',
      fecha_nacimiento: '15/03/2001',
      pais_nacionalidad: 'Estados Unidos',
      genero: 'Femenino',
      correo: 'mary@correo.com',
      celular: '+1 555 0100',
    },
  ],
}

const CAMPOS = new Set([
  'nombres', 'apellidos', 'tipo_documento', 'numero_documento', 'fecha_nacimiento', 'pais_nacionalidad', 'genero',
  'correo', 'celular', 'telefono', 'maskpark_usuario', 'maskpark_clave', 'maskpark', 'notas', 'salon',
])

export const sinTildes = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const txt = (v) => (v == null ? '' : String(v).replace(/\s+/g, ' ').trim())
const claveNombre = (s) => sinTildes(txt(s))

const TIPOS = {
  dni: 'dni', 'dni (peru)': 'dni',
  ce: 'ce', 'carne de extranjeria': 'ce',
  pasaporte: 'pasaporte',
  licencia: 'licencia', 'licencia de conducir': 'licencia',
  otro: 'otro',
}
const GENEROS = { m: 'M', masculino: 'M', hombre: 'M', f: 'F', femenino: 'F', mujer: 'F', o: 'O', otro: 'O' }

// AAAA-MM-DD o DD/MM/AAAA → AAAA-MM-DD, o null si no es una fecha real.
function aFechaIso(v) {
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

// Texto del archivo → { filas } o { error }. Acepta una lista o { estudiantes: [...] }.
export function leerJson(texto) {
  let datos
  try {
    datos = JSON.parse(texto.replace(/^﻿/, ''))
  } catch (e) {
    return { error: `The file is not valid JSON (${e.message}).` }
  }
  const lista = Array.isArray(datos) ? datos : Array.isArray(datos?.estudiantes) ? datos.estudiantes : null
  if (!lista) return { error: 'The JSON must be a list of students or an object with the key "estudiantes".' }
  if (lista.length === 0) return { error: 'The file has no students.' }
  if (lista.length > MAX_FILAS) return { error: `Maximum ${MAX_FILAS} students per file (yours has ${lista.length}). Split it into parts.` }
  return { filas: lista }
}

// Una fila cruda → { fila (lista para guardarEstudiante), salon, errores, avisos }.
export function normalizarFila(raw, hoy) {
  const errores = []
  const avisos = []
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return { fila: null, salon: '', errores: ['La fila no es un objeto.'], avisos }

  const ignorados = Object.keys(raw).filter((k) => !CAMPOS.has(k))
  if (ignorados.length) avisos.push(`Ignored fields: ${ignorados.join(', ')}${ignorados.includes('edad') ? ' (age is calculated automatically)' : ''}.`)

  const nombres = txt(raw.nombres)
  const apellidos = txt(raw.apellidos)
  if (!nombres) errores.push('Missing "nombres".')
  if (!apellidos) errores.push('Missing "apellidos".')

  let tipo = ''
  let tipoInvalido = false
  if (txt(raw.tipo_documento)) {
    tipo = TIPOS[sinTildes(txt(raw.tipo_documento))] ?? ''
    if (!tipo) {
      tipoInvalido = true
      errores.push(`Invalid document type: "${raw.tipo_documento}" (use dni, ce, pasaporte, licencia or otro).`)
    }
  }
  const numero = txt(raw.numero_documento).replace(/\s+/g, '').toUpperCase()
  if (!tipoInvalido) {
    const e = errorDocumento(tipo, numero)
    if (e) errores.push(`Documento: ${e}.`)
  }

  let nacimiento = ''
  if (txt(raw.fecha_nacimiento)) {
    nacimiento = aFechaIso(raw.fecha_nacimiento)
    if (!nacimiento) errores.push(`Invalid birth date: "${raw.fecha_nacimiento}" (use YYYY-MM-DD or DD/MM/YYYY).`)
    else if (nacimiento > hoy || nacimiento < '1900-01-01') errores.push('The birth date is out of range.')
    else if (calcularEdad(nacimiento, hoy) > 110) avisos.push('The resulting age exceeds 110 years: check the date.')
  }

  let genero = ''
  if (txt(raw.genero)) {
    genero = GENEROS[sinTildes(txt(raw.genero))]
    if (!genero) {
      errores.push(`Invalid gender: "${raw.genero}" (use M, F or O).`)
      genero = ''
    }
  }

  const correo = txt(raw.correo).toLowerCase()
  if (correo && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) errores.push(`Invalid email: "${raw.correo}".`)

  const celular = txt(raw.celular ?? raw.telefono)
  if (celular) {
    const digitos = celular.replace(/\D/g, '').length
    if (digitos < 6 || digitos > 15) errores.push(`Invalid mobile number: "${celular}" (must have between 6 and 15 digits).`)
  }

  const mp = raw.maskpark && typeof raw.maskpark === 'object' ? raw.maskpark : {}
  const usuario = txt(raw.maskpark_usuario ?? mp.usuario)
  const clave = raw.maskpark_clave ?? mp.clave
  const claveTxt = clave == null ? '' : String(clave)
  if (claveTxt && !usuario) errores.push('There is a MaskPark password but "maskpark_usuario" is missing.')

  const fila = {
    nombres,
    apellidos,
    nombre: `${nombres} ${apellidos}`.trim(),
    tipoDocumento: tipo || '',
    numeroDocumento: tipo ? numero : '',
    fechaNacimiento: nacimiento || '',
    paisNacionalidad: txt(raw.pais_nacionalidad),
    genero,
    telefono: celular,
    correo,
    notas: String(raw.notas ?? '').trim(),
    maskparkUsuario: usuario,
    maskparkClave: claveTxt,
  }
  return { fila, salon: txt(raw.salon).toUpperCase(), errores, avisos }
}

// Revisa todo el lote contra lo que ya existe y contra sí mismo. Devuelve una entrada por fila con su estado:
//   'nuevo' (se creará) · 'existente' (ya está registrado: se omite o se actualiza según el modo) · 'error' (no se importará)
export function analizarLote(crudas, { estudiantes = [], salones = [], hoy }) {
  const porDoc = new Map()
  const porNombre = new Map()
  const porCorreo = new Map()
  const porTel = new Map()
  for (const e of estudiantes) {
    if (e.tipo_documento && e.numero_documento) porDoc.set(`${e.tipo_documento}|${e.numero_documento.toUpperCase()}`, e)
    porNombre.set(claveNombre(e.nombre), e)
    if (e.correo) porCorreo.set(e.correo.toLowerCase().trim(), e)
    if (e.telefono) porTel.set(e.telefono.replace(/\D/g, ''), e)
  }
  const salonPorCodigo = new Map(salones.map((s) => [String(s.codigo).toUpperCase(), s]))

  const vistos = { doc: new Map(), nombre: new Map(), correo: new Map(), tel: new Map(), usuario: new Map() }
  return crudas.map((raw, i) => {
    const n = i + 1
    const { fila, salon, errores, avisos } = normalizarFila(raw, hoy)
    const r = { n, fila, salon, errores: [...errores], avisos: [...avisos], estado: 'nuevo', existente: null, salonObj: null }
    if (!fila) {
      r.estado = 'error'
      return r
    }

    // Repetidos dentro del mismo archivo (la primera aparición manda)
    const repetido = (mapa, clave, etiqueta) => {
      if (!clave) return
      if (mapa.has(clave)) r.errores.push(`Duplicate ${etiqueta}: already appears in row ${mapa.get(clave)}.`)
      else mapa.set(clave, n)
    }
    repetido(vistos.doc, fila.tipoDocumento ? `${fila.tipoDocumento}|${fila.numeroDocumento}` : '', 'document')
    repetido(vistos.nombre, claveNombre(fila.nombre), 'name')
    repetido(vistos.correo, fila.correo, 'email')
    repetido(vistos.tel, fila.telefono.replace(/\D/g, ''), 'mobile number')
    repetido(vistos.usuario, fila.maskparkUsuario.toLowerCase(), 'MaskPark user')

    // ¿Ya está registrado? Primero por documento, luego por nombre completo.
    const porD = fila.tipoDocumento ? porDoc.get(`${fila.tipoDocumento}|${fila.numeroDocumento}`) : null
    const porN = porNombre.get(claveNombre(fila.nombre))
    if (porD && porN && porD.id !== porN.id) r.errores.push(`The document belongs to «${porD.nombre}» but the name matches «${porN.nombre}».`)
    r.existente = porD ?? porN ?? null
    if (r.existente) {
      r.estado = 'existente'
      if (!porD && fila.tipoDocumento && r.existente.numero_documento && r.existente.numero_documento.toUpperCase() !== fila.numeroDocumento)
        r.avisos.push('The student already has another document registered.')
    }

    // Correo o celular que ya son de otra persona
    const otroCorreo = fila.correo ? porCorreo.get(fila.correo) : null
    if (otroCorreo && otroCorreo.id !== r.existente?.id) r.errores.push(`The email already belongs to «${otroCorreo.nombre}».`)
    const otroTel = fila.telefono ? porTel.get(fila.telefono.replace(/\D/g, '')) : null
    if (otroTel && otroTel.id !== r.existente?.id) r.errores.push(`The mobile number already belongs to «${otroTel.nombre}».`)

    if (salon) {
      r.salonObj = salonPorCodigo.get(salon) ?? null
      if (!r.salonObj) r.errores.push(`The classroom "${salon}" does not exist.`)
      else if (r.salonObj.estado === 'finalizado') r.errores.push(`Classroom ${salon} is finished: it does not accept enrollments.`)
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

// Datos de un estudiante existente combinados con la fila del archivo: lo que el archivo no trae se conserva
// (la base reemplaza teléfono, correo y notas en cada edición, así que hay que reenviarlos).
function combinar(existente, fila) {
  const pide = (valor, anterior) => (valor !== '' && valor != null ? valor : anterior ?? '')
  return {
    nombre: fila.nombre,
    nombres: fila.nombres,
    apellidos: fila.apellidos,
    tipoDocumento: pide(fila.tipoDocumento, existente.tipo_documento),
    numeroDocumento: pide(fila.numeroDocumento, existente.numero_documento),
    fechaNacimiento: pide(fila.fechaNacimiento, existente.fecha_nacimiento),
    paisNacionalidad: pide(fila.paisNacionalidad, existente.pais_nacionalidad),
    genero: pide(fila.genero, existente.genero),
    telefono: pide(fila.telefono, existente.telefono),
    correo: pide(fila.correo, existente.correo),
    notas: pide(fila.notas, existente.notas),
    activo: existente.activo,
    // MaskPark solo se toca si el archivo trae usuario; con usuario sin contraseña se conserva la actual.
    ...(fila.maskparkUsuario ? { maskparkUsuario: fila.maskparkUsuario, maskparkClave: fila.maskparkClave } : {}),
  }
}

// Ejecuta el lote fila por fila (una falla no detiene las demás). `servicio` = { guardarEstudiante, matricularAlumnos }.
// modo: 'omitir' deja intactos los existentes; 'actualizar' los pone al día con el archivo. En ambos se matricula si hay `salon`.
// Devuelve [{ n, nombre, resultado: 'creado'|'actualizado'|'omitido'|'error'|'no_procesado', mensaje, matricula }].
export async function ejecutarImportacion(analisis, { servicio, modo = 'omitir', onProgreso, cancelado = () => false }) {
  const resultados = []
  let hechas = 0
  for (const r of analisis) {
    if (cancelado()) {
      resultados.push({ n: r.n, nombre: r.fila?.nombre ?? '', resultado: 'no_procesado', mensaje: 'Import cancelled before reaching this row.', matricula: '' })
      continue
    }
    const base = { n: r.n, nombre: r.fila?.nombre ?? '', matricula: '' }
    if (r.estado === 'error') {
      resultados.push({ ...base, resultado: 'error', mensaje: r.errores.join(' ') })
    } else {
      try {
        let id = r.existente?.id ?? null
        let resultado = 'omitido'
        if (r.estado === 'nuevo') {
          id = await servicio.guardarEstudiante(null, r.fila)
          resultado = 'creado'
        } else if (modo === 'actualizar') {
          await servicio.guardarEstudiante(id, combinar(r.existente, r.fila))
          resultado = 'actualizado'
        }
        const item = { ...base, resultado, mensaje: resultado === 'omitido' ? 'Already registered: not modified.' : '' }
        if (r.salonObj) {
          try {
            await servicio.matricularAlumnos(r.salonObj.id, [id])
            item.matricula = `Enrolled in ${r.salonObj.codigo}`
          } catch (e) {
            // Volver a subir el mismo archivo no es un problema: si ya estaba matriculado, solo se informa.
            item.matricula = e.message.startsWith('Ya matriculados') ? `Already enrolled in ${r.salonObj.codigo}` : `Could not enroll in ${r.salonObj.codigo}: ${e.message}`
          }
        }
        resultados.push(item)
      } catch (e) {
        resultados.push({ ...base, resultado: 'error', mensaje: e.message })
      }
    }
    hechas++
    onProgreso?.(hechas, analisis.length)
  }
  return resultados
}
