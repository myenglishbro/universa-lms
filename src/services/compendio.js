import { construirCompendio, nombreArchivo } from '../lib/compendio'
import * as asistencia from './asistencia'
import * as evaluaciones from './evaluaciones'
import * as portal from './portal'

// Procesa una lista en tandas pequeñas para no saturar la base con decenas de consultas a la vez.
async function enTandas(items, tamano, fn) {
  const salida = []
  for (let i = 0; i < items.length; i += tamano) salida.push(...(await Promise.all(items.slice(i, i + tamano).map(fn))))
  return salida
}

async function logo() {
  try {
    const r = await fetch('/landing/logo.png')
    return r.ok ? await r.arrayBuffer() : null
  } catch {
    return null
  }
}

// Reúne todo lo necesario del salón. `archivo`: filas de archivo_alumnos (salón archivado) → se usan los informes guardados al cerrar el ciclo.
export async function reunirDatos(salon, { archivo = null, conRubricas = true } = {}) {
  let alumnos
  if (archivo) {
    alumnos = archivo.map((a) => ({ id: a.alumno_id, nombre: a.alumno_nombre, informe: a.informe ?? null }))
  } else {
    const roster = await portal.estudiantesDelSalon(salon.id)
    alumnos = await enTandas(roster, 6, async (e) => {
      try {
        return { id: e.alumno_id, nombre: e.nombre, informe: await evaluaciones.informeAlumno(salon.id, e.alumno_id) }
      } catch {
        return { id: e.alumno_id, nombre: e.nombre, informe: null } // un informe que falle no impide el resto del archivo
      }
    })
  }

  // Asistencia por clase: solo se consultan las clases ya registradas.
  let clases = []
  const marcas = new Map()
  try {
    clases = (await asistencia.clasesDelSalon(salon.id)).map((c) => ({ sesion_id: c.sesion_id, numero: c.numero, fecha: c.fecha, registrada: c.estado_registro === 'registrada' }))
    const registradas = clases.filter((c) => c.registrada)
    await enTandas(registradas, 8, async (c) => {
      try {
        const r = await asistencia.sesionRegistro(c.sesion_id)
        marcas.set(c.sesion_id, new Map(r.alumnos.filter((x) => x.estado).map((x) => [x.alumno_id, x.estado])))
      } catch {
        /* esa clase queda en blanco */
      }
    })
  } catch {
    clases = []
  }

  let rubricas = []
  if (conRubricas) {
    try {
      rubricas = await evaluaciones.listarRubricas()
    } catch {
      rubricas = [] // los docentes no ven las rúbricas de administración: la hoja simplemente no se incluye
    }
  }
  return { salon, alumnos, clases, asistencia: marcas, rubricas, logo: await logo() }
}

function guardarArchivo(blob, nombre) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nombre
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

// Genera y descarga el compendio Excel de un salón.
export async function descargarCompendio(salon, opciones) {
  const datos = await reunirDatos(salon, opciones)
  const blob = await construirCompendio(datos)
  const nombre = nombreArchivo(salon)
  guardarArchivo(blob, nombre)
  return nombre
}
