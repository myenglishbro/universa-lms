// Cambio de libro: al terminar un ciclo PAR (2, 4, 6…) el estudiante pasa a un libro nuevo, y hay que pedirlo con tiempo.
// Cuenta, por ciclo par, los estudiantes activos de los salones en curso cuyo último ciclo es ese (el libro cambia cuando el salón termina).
// Cada estudiante cae en un solo tramo según los días que faltan para el fin de su salón. `estudiantes` null = no se pudo leer la matrícula.
export const esCicloPar = (c) => Number.isInteger(Number(c)) && c !== '' && c != null && Number(c) > 0 && Number(c) % 2 === 0

export function resumenCambioLibro(filas) {
  const por = new Map()
  for (const { salon, a } of filas) {
    if (salon.estado !== 'en_curso' || !esCicloPar(salon.cicloHasta)) continue
    const ciclo = Number(salon.cicloHasta)
    const r = por.get(ciclo) ?? { ciclo, salones: 0, estudiantes: 0, ya: 0, d30: 0, d60: 0, mas: 0, sinFecha: 0, sinDatoEstudiantes: false }
    const n = salon.estudiantes
    if (n == null) r.sinDatoEstudiantes = true
    const k = n ?? 0
    r.salones++
    r.estudiantes += k
    if (a.dias === null) r.sinFecha += k
    else if (a.dias < 0) r.ya += k
    else if (a.dias <= 30) r.d30 += k
    else if (a.dias <= 60) r.d60 += k
    else r.mas += k
    por.set(ciclo, r)
  }
  const ciclos = [...por.values()].sort((x, y) => x.ciclo - y.ciclo)
  const suma = (k) => ciclos.reduce((s, c) => s + c[k], 0)
  return { ciclos, urgentes: suma('ya') + suma('d30'), proximos: suma('d60'), total: suma('estudiantes'), salones: suma('salones') }
}

// Salones que alimentan un ciclo par (para el detalle al tocar el aviso), del que termina primero al último.
export const salonesDeCicloPar = (filas, ciclo) =>
  filas
    .filter(({ salon }) => salon.estado === 'en_curso' && Number(salon.cicloHasta) === Number(ciclo))
    .sort((x, y) => (x.a.fin ?? '9999').localeCompare(y.a.fin ?? '9999') || x.salon.codigo.localeCompare(y.salon.codigo))
