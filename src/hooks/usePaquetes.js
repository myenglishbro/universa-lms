import { useCallback, useEffect, useState } from 'react'
import * as api from '../services/paquetes'

// Carga paquetes (con su saldo) y alumnos. Tras cada escritura la pantalla llama a `recargar`.
export default function usePaquetes() {
  const [paquetes, setPaquetes] = useState([])
  const [alumnos, setAlumnos] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')

  const recargar = useCallback(
    () =>
      Promise.all([api.listarPaquetes(), api.listarAlumnos()])
        .then(([p, a]) => {
          setPaquetes(p)
          setAlumnos(a)
          setError('')
        })
        .catch((e) => setError(e.message))
        .finally(() => setCargando(false)),
    [],
  )

  useEffect(() => {
    recargar()
  }, [recargar])

  return { paquetes, alumnos, cargando, error, recargar }
}
