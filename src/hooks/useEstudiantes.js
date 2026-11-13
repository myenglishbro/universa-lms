import { useCallback, useEffect, useRef, useState } from 'react'
import * as apiReal from '../services/personas'

// Estudiantes y matrículas. Se leen por separado: si falla una consulta, la otra sigue disponible y el error se informa.
// `activo`: la primera carga espera a que se necesite; `recargar` la hace en cualquier momento (y evita que se repita al activarse).
export default function useEstudiantes(api = apiReal, activo = true) {
  const [estudiantes, setEstudiantes] = useState([])
  const [matriculas, setMatriculas] = useState([])
  const [cargando, setCargando] = useState(activo)
  const [error, setError] = useState('')
  const pedido = useRef(false)

  const recargar = useCallback(
    () => {
      pedido.current = true
      return Promise.allSettled([api.listarEstudiantes(), api.listarMatriculas()])
        .then(([e, m]) => {
          if (e.status === 'fulfilled') setEstudiantes(e.value)
          if (m.status === 'fulfilled') setMatriculas(m.value)
          const fallos = []
          if (e.status === 'rejected') fallos.push(`students: ${e.reason?.message ?? e.reason}`)
          if (m.status === 'rejected') fallos.push(`enrollments: ${m.reason?.message ?? m.reason}`)
          setError(fallos.join(' · '))
        })
        .finally(() => setCargando(false))
    },
    [api],
  )

  useEffect(() => {
    if (activo && !pedido.current) recargar()
  }, [activo, recargar])

  return { estudiantes, matriculas, cargando, error, recargar }
}
