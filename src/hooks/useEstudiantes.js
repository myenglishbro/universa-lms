import { useCallback, useEffect, useState } from 'react'
import * as apiReal from '../services/personas'

// Estudiantes y matrículas. Se leen por separado: si falla una consulta, la otra sigue disponible y el error se informa.
export default function useEstudiantes(api = apiReal) {
  const [estudiantes, setEstudiantes] = useState([])
  const [matriculas, setMatriculas] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')

  const recargar = useCallback(
    () =>
      Promise.allSettled([api.listarEstudiantes(), api.listarMatriculas()])
        .then(([e, m]) => {
          if (e.status === 'fulfilled') setEstudiantes(e.value)
          if (m.status === 'fulfilled') setMatriculas(m.value)
          const fallos = []
          if (e.status === 'rejected') fallos.push(`estudiantes: ${e.reason?.message ?? e.reason}`)
          if (m.status === 'rejected') fallos.push(`matrículas: ${m.reason?.message ?? m.reason}`)
          setError(fallos.join(' · '))
        })
        .finally(() => setCargando(false)),
    [api],
  )

  useEffect(() => {
    recargar()
  }, [recargar])

  return { estudiantes, matriculas, cargando, error, recargar }
}
