// Ruta de aprendizaje Universa: los 7 niveles (120 horas cada uno) y dónde está el estudiante.
// Todo se deriva del progreso de sus cursos activos (progreso_salon.ciclos: [{ ciclo, sesiones, realizadas }]); nada se guarda.
export const NIVELES_RUTA = [
  { id: 'functional', ciclos: [0, 0], mcer: 'A1.1', nombre: 'Functional' },
  { id: 'basic', ciclos: [1, 2], mcer: 'A1.2 – A2.1', nombre: 'Basic' },
  { id: 'intermediate', ciclos: [3, 4], mcer: 'A2.2 – B1.1', nombre: 'Intermediate' },
  { id: 'upper', ciclos: [5, 6], mcer: 'B1.2 – B1.3', nombre: 'Upper Intermediate' },
  { id: 'advanced', ciclos: [7, 8], mcer: 'B2.1 – B2.2', nombre: 'Advanced' },
  { id: 'proficient', ciclos: [9, 10], mcer: 'C1.1 – C1.2', nombre: 'Proficient' },
  { id: 'master', ciclos: [11, 12], mcer: 'C2.1 – C2.2', nombre: 'Master' },
]

export const etiquetaCiclos = (n) => (n.ciclos[0] === n.ciclos[1] ? `Cycle ${n.ciclos[0]}` : `Cycles ${n.ciclos[0]} – ${n.ciclos[1]}`)

// Ciclo en el que está un curso: el primero que aún no se completa (o el último, si ya terminó todos) y su avance (0 a 1).
export function cicloActualDeCurso(ciclos = []) {
  const lista = [...ciclos].filter((c) => Number.isFinite(Number(c.ciclo))).sort((a, b) => a.ciclo - b.ciclo)
  if (lista.length === 0) return null
  const actual = lista.find((c) => !(c.sesiones > 0 && c.realizadas >= c.sesiones)) ?? lista[lista.length - 1]
  const fraccion = actual.sesiones > 0 ? Math.min(1, Math.max(0, actual.realizadas / actual.sesiones)) : 0
  return { ciclo: Number(actual.ciclo), fraccion }
}

// Posición global: el ciclo más alto entre los cursos del estudiante (listas de ciclos, una por curso). null = sin datos.
export function posicionEnRuta(listasDeCiclos = []) {
  const posiciones = listasDeCiclos.map(cicloActualDeCurso).filter(Boolean)
  if (posiciones.length === 0) return null
  return posiciones.reduce((a, b) => (b.ciclo > a.ciclo || (b.ciclo === a.ciclo && b.fraccion > a.fraccion) ? b : a))
}

// Estado de cada nivel según la posición: 'hecho', 'actual' (con `avance` 0 a 1 dentro del nivel) o 'pendiente'.
export function estadoNiveles(pos) {
  return NIVELES_RUTA.map((n) => {
    if (!pos) return { ...n, estado: 'pendiente', avance: 0 }
    const [a, b] = n.ciclos
    if (pos.ciclo > b) return { ...n, estado: 'hecho', avance: 1 }
    if (pos.ciclo >= a) return { ...n, estado: 'actual', avance: (pos.ciclo - a + pos.fraccion) / (b - a + 1) }
    return { ...n, estado: 'pendiente', avance: 0 }
  })
}
