import { construirRespaldo, nombreRespaldo } from '../lib/respaldoSalones'
import { guardarArchivo } from './compendio'
import * as evaluaciones from './evaluaciones'

// Notas de los salones vigentes (los archivados ya tienen su Excel guardado al cerrar el ciclo): una consulta por salón, de a 3 a la vez.
// Un salón que falle no impide el resto: se cuenta y se avisa. `alAvanzar(hechos, total)` informa el progreso.
export async function reunirNotas(salones, alAvanzar = () => {}) {
  const vigentes = salones.filter((s) => !s.archivadoAt)
  const matrices = []
  let fallidos = 0
  let hechos = 0
  for (let i = 0; i < vigentes.length; i += 3) {
    await Promise.all(
      vigentes.slice(i, i + 3).map(async (salon) => {
        try {
          matrices.push({ salon, matriz: await evaluaciones.matrizSalon(salon.id) })
        } catch {
          fallidos += 1
        }
        alAvanzar(++hechos, vigentes.length)
      }),
    )
  }
  return { matrices, fallidos }
}

// Genera y descarga el respaldo. `datos`: { salones, estudiantes, matriculas }. Con `conNotas` consulta las notas de cada salón vigente.
export async function descargarRespaldo({ salones, estudiantes, matriculas }, { conNotas = false, alAvanzar } = {}) {
  let notas = null
  let fallidos = 0
  if (conNotas) {
    const r = await reunirNotas(salones, alAvanzar)
    notas = r.matrices
    fallidos = r.fallidos
  }
  const blob = await construirRespaldo({ salones, estudiantes, matriculas, notas })
  const nombre = nombreRespaldo()
  guardarArchivo(blob, nombre)
  return { nombre, fallidos }
}
