import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

// Impide copiar, cortar, pegar y arrastrar texto (también con el menú de clic derecho) en un campo de escritura.
// Devuelve `props` para esparcir en el textarea o en el texto de la consigna, y `aviso` (true unos segundos tras un intento).
// Nota: es una barrera del navegador; no detecta herramientas fuera de la página.
export default function useSinCopiar() {
  const [aviso, setAviso] = useState(false)
  const timer = useRef(null)
  useEffect(() => () => clearTimeout(timer.current), [])

  const bloquear = useCallback((e) => {
    e.preventDefault()
    setAviso(true)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setAviso(false), 3500)
  }, [])

  const props = useMemo(
    () => ({ onPaste: bloquear, onCopy: bloquear, onCut: bloquear, onDrop: bloquear, onDragStart: bloquear, onContextMenu: bloquear }),
    [bloquear],
  )
  return { props, aviso }
}
