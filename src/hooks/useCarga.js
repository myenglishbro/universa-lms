import { useCallback, useEffect, useRef, useState } from 'react'

// Carga asíncrona con estado: conserva el error REAL de la consulta (nunca lo convierte en una lista vacía).
// `cargar` debe ser estable (módulo o useCallback). Si `activo` es false no consulta.
export default function useCarga(cargar, inicial, activo = true) {
  const [datos, setDatos] = useState(inicial)
  const [cargando, setCargando] = useState(activo)
  const [error, setError] = useState('')
  const vigente = useRef(0)
  const montado = useRef(true)

  const recargar = useCallback(() => {
    const n = ++vigente.current
    return Promise.resolve()
      .then(cargar)
      .then((d) => {
        if (montado.current && n === vigente.current) {
          setDatos(d)
          setError('')
        }
      })
      .catch((e) => montado.current && n === vigente.current && setError(e?.message ?? String(e)))
      .finally(() => montado.current && n === vigente.current && setCargando(false))
  }, [cargar])

  useEffect(() => {
    montado.current = true
    if (activo) recargar()
    return () => {
      montado.current = false
    }
  }, [activo, recargar])

  return { datos, cargando, error, recargar }
}
