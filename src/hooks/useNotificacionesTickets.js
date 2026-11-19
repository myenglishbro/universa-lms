import { useCallback, useEffect, useState } from 'react'
import { marcarLeidas, misNotificaciones, suscribirTickets } from '../services/tickets'

// Notificaciones internas del Task Board (asignaciones y reasignaciones) con contador y actualización en vivo.
// Si la migración del Task Board aún no está aplicada, la consulta falla y simplemente no hay notificaciones.
export default function useNotificacionesTickets(activo, userId) {
  const [items, setItems] = useState([])

  const recargar = useCallback(
    () =>
      misNotificaciones()
        .then(setItems)
        .catch(() => setItems([])),
    [],
  )

  useEffect(() => {
    if (!activo) return
    recargar()
    // Solo los cambios de MIS notificaciones: sin filtro, cada aviso de cualquiera despertaría a todo el personal conectado.
    return suscribirTickets(['ticket_notificaciones'], recargar, userId ? `user_id=eq.${userId}` : undefined)
  }, [activo, recargar, userId])

  const leer = useCallback(
    async (ids = null) => {
      await marcarLeidas(ids)
      await recargar()
    },
    [recargar],
  )

  return { items, pendientes: items.filter((n) => !n.leida).length, leer, recargar }
}
