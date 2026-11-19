import { useCallback, useEffect, useState } from 'react'
import { cargarPerfilInterno } from '../services/docentesPerfil'

// Campos y perfiles internos de docentes (solo los lee administración; con otro rol queda vacío y no estorba).
export default function usePerfilInterno() {
  const [estado, setEstado] = useState({ campos: [], perfiles: new Map(), listo: false })
  const recargar = useCallback(() => {
    return cargarPerfilInterno().then((r) => setEstado({ ...r, listo: true })).catch(() => setEstado((e) => ({ ...e, listo: true })))
  }, [])
  useEffect(() => {
    recargar()
  }, [recargar])
  return { ...estado, recargar }
}
