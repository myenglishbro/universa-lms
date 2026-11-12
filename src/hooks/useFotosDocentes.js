import { useEffect, useState } from 'react'
import { perfilesDocentes } from '../services/registros'

// Fotos de los docentes (docenteId -> url). Se pide una sola vez por sesión y se comparte entre listas.
// Es un extra visual: si falla, las listas muestran la inicial del nombre.
let pendiente = null
const cargar = () => (pendiente ??= perfilesDocentes().then((f) => new Map(f.map((x) => [x.docente_id, x.foto_url]))).catch(() => { pendiente = null; return new Map() }))

export default function useFotosDocentes() {
  const [fotos, setFotos] = useState(new Map())
  useEffect(() => {
    let vigente = true
    cargar().then((m) => vigente && setFotos(m))
    return () => {
      vigente = false
    }
  }, [])
  return fotos
}
