import { useCallback, useEffect, useRef, useState } from 'react'
import * as api from '../services/paquetes'

// Carga los paquetes (con su saldo). Los alumnos ya los trae useEstudiantes: no se consultan dos veces.
// `activo`: la primera carga espera a que se necesite (p. ej. a que se abra una pantalla que usa paquetes).
// Tras cada escritura la pantalla llama a `recargar`.
export default function usePaquetes(activo = true) {
  const [paquetes, setPaquetes] = useState([])
  const [cargando, setCargando] = useState(activo)
  const [error, setError] = useState('')
  const pedido = useRef(false)

  const recargar = useCallback(() => {
    pedido.current = true
    return api
      .listarPaquetes()
      .then((p) => {
        setPaquetes(p)
        setError('')
      })
      .catch((e) => setError(e.message))
      .finally(() => setCargando(false))
  }, [])

  useEffect(() => {
    if (activo && !pedido.current) recargar()
  }, [activo, recargar])

  return { paquetes, cargando, error, recargar }
}
