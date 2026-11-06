import { useCallback, useEffect, useState } from 'react'
import { aItemAgenda, conflictosPorSesion, ordenarAgenda } from '../lib/agenda'
import * as agendaReal from '../services/agenda'
import { listarFeriados as feriadosReal } from '../services/calendario'

const apiReal = { ...agendaReal, listarFeriados: feriadosReal }

// Sesiones (grupales + particulares), conflictos de docente y feriados del rango [desde, hasta].
export default function useAgenda(desde, hasta, api = apiReal) {
  const [items, setItems] = useState([])
  const [conflictos, setConflictos] = useState(new Map())
  const [feriados, setFeriados] = useState(new Map())
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')

  const recargar = useCallback(
    () =>
      Promise.all([api.listarAgenda(desde, hasta), api.listarConflictosAgenda(desde, hasta), api.listarFeriados()])
        .then(([a, c, f]) => {
          setItems(ordenarAgenda(a.map(aItemAgenda)))
          setConflictos(conflictosPorSesion(c))
          setFeriados(new Map(f.map((x) => [x.fecha, x.nombre])))
          setError('')
        })
        .catch((e) => setError(e.message))
        .finally(() => setCargando(false)),
    [api, desde, hasta],
  )

  useEffect(() => {
    recargar()
  }, [recargar])

  return { items, conflictos, feriados, cargando, error, recargar }
}
