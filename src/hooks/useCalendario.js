import { useCallback, useEffect, useState } from 'react'
import * as api from '../services/calendario'

// Sesiones, conflictos de docente y feriados de un salón. `alCambiar` refresca los datos del salón
// (fecha de fin y progreso) después de cada operación, porque los calcula la base de datos.
export default function useCalendario(salonId, alCambiar) {
  const [sesiones, setSesiones] = useState([])
  const [conflictos, setConflictos] = useState([])
  const [feriados, setFeriados] = useState([])
  const [evaluaciones, setEvaluaciones] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')

  const cargar = useCallback(
    () =>
      Promise.all([api.listarSesiones(salonId), api.listarConflictos(salonId), api.listarFeriados(), api.listarFechasEvaluacion(salonId).catch(() => [])])
        .then(([s, c, f, ev]) => {
          setSesiones(s)
          setConflictos(c)
          setFeriados(f)
          setEvaluaciones(ev)
          setError('')
        })
        .catch((e) => setError(e.message))
        .finally(() => setCargando(false)),
    [salonId],
  )

  useEffect(() => {
    cargar()
  }, [cargar])

  const ejecutar = async (operacion) => {
    await operacion()
    await Promise.all([cargar(), alCambiar()])
  }

  return {
    sesiones,
    conflictos,
    feriados,
    evaluaciones,
    cargando,
    error,
    recargar: cargar,
    generar: () => ejecutar(() => api.generarCalendario(salonId)),
    realizada: (id) => ejecutar(() => api.registrarRealizada(id)),
    cancelar: (id, nota, recuperacion) => ejecutar(() => api.cancelarSesion(id, nota, recuperacion)),
    recuperar: (id, fecha, ini, fin) => ejecutar(() => api.crearRecuperacion(id, fecha, ini, fin)),
    reprogramar: (id, fecha, ini, fin, nota) => ejecutar(() => api.reprogramarSesion(id, fecha, ini, fin, nota)),
    corregir: (id, estado, motivo) => ejecutar(() => api.corregirSesion(id, estado, motivo)),
    guardarEvaluacion: async (datos) => {
      await api.guardarFechaEvaluacion(salonId, datos)
      await cargar()
    },
    eliminarEvaluacion: async (id) => {
      await api.eliminarFechaEvaluacion(id)
      await cargar()
    },
    proponer: api.proponerRecuperacion,
    proponerExtra: () => api.proponerClaseExtra(salonId),
    agregarExtra: (v) => ejecutar(() => api.agregarClaseExtra(salonId, v)),
    eliminarExtra: (id) => ejecutar(() => api.eliminarClaseExtra(id)),
  }
}
