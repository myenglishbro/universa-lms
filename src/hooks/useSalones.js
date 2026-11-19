import { useCallback, useEffect, useState } from 'react'
import * as api from '../services/salones'
import { listarCatalogo } from '../services/catalogo'
import { MINUTO, guardarCache, leerCache } from '../lib/cacheSesion'

// Los estados solo cambian con el paso de los días: se sincronizan como mucho cada 5 minutos por pestaña (y siempre tras crear o editar un salón).
// El catálogo académico casi no cambia: se reutiliza 10 minutos y se vuelve a pedir al editarlo.
const SINCRONIZAR_CADA = 5 * MINUTO
const CATALOGO_VIGENCIA = 10 * MINUTO

// Carga salones (con su progreso), niveles y docentes, y expone las operaciones de escritura.
// Tras cada escritura se vuelve a consultar, así la interfaz siempre refleja lo guardado en la base.
export default function useSalones() {
  const [salones, setSalones] = useState([])
  const [archivados, setArchivados] = useState([]) // salones de ciclos cerrados: fuera de las listas de trabajo
  const [niveles, setNiveles] = useState([])
  const [docentes, setDocentes] = useState([])
  // El catálogo académico es opcional: si falla, los salones se siguen pudiendo crear y editar sin plan.
  const [catalogo, setCatalogo] = useState({ planes: [], modalidades: [], frecuencias: [], errorFrecuencias: '', error: '', cargando: true })
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')

  const cargar = useCallback(
    (forzar = false) =>
      // Primero se sincronizan los estados (Planificado → En curso) si toca; si falla, la lista se carga igual.
      Promise.resolve(forzar === true || !leerCache('sync-estados', SINCRONIZAR_CADA) ? api.sincronizarEstados().then((n) => (guardarCache('sync-estados'), n)) : 0)
        .catch(() => 0)
        .then(() => Promise.all([api.listarSalones(), api.listarProgreso(), api.listarNiveles(), api.listarDocentes(), api.listarPendientes().catch(() => ({}))]))
        .then(([s, progreso, p, d, pend]) => {
          const todos = s.map((salon) => ({ ...salon, progreso: progreso[salon.id] ?? null, pendientes: pend[salon.id] ?? null }))
          setSalones(todos.filter((x) => !x.archivadoAt))
          setArchivados(todos.filter((x) => x.archivadoAt))
          setNiveles(p)
          setDocentes(d)
          setError('')
        })
        .catch((e) => setError(e.message))
        .finally(() => setCargando(false)),
    [],
  )

  const cargarCatalogo = useCallback(
    (forzar = false) => {
      const guardado = forzar === true ? null : leerCache('catalogo', CATALOGO_VIGENCIA)
      if (guardado) {
        setCatalogo({ ...guardado, error: '', cargando: false })
        return Promise.resolve()
      }
      return listarCatalogo()
        .then((c) => (guardarCache('catalogo', c), setCatalogo({ ...c, error: '', cargando: false })))
        .catch((e) => setCatalogo({ planes: [], modalidades: [], frecuencias: [], errorFrecuencias: '', error: e.message, cargando: false }))
    },
    [],
  )

  useEffect(() => {
    cargar()
    cargarCatalogo()
  }, [cargar, cargarCatalogo])

  const guardarSalon = async (id, salon) => {
    await api.guardarSalon(id, salon)
    await cargar(true)
  }

  const cambiarEstado = async (id, estado) => {
    await api.cambiarEstado(id, estado)
    await cargar(true)
  }

  const eliminarSalon = async (id) => {
    await api.eliminarSalon(id)
    await cargar(true)
  }

  const archivarSalones = async (ids, ciclo) => {
    const n = await api.archivarSalones(ids, ciclo)
    await cargar(true)
    return n
  }

  const crearDocente = async (docente) => {
    const nuevo = await api.crearDocente(docente)
    setDocentes((actuales) => [...actuales, nuevo].sort((a, b) => a.nombre.localeCompare(b.nombre)))
    return nuevo
  }

  return { salones, archivados, niveles, docentes, catalogo, cargando, error, recargar: () => cargar(), recargarCatalogo: () => cargarCatalogo(true), guardarSalon, cambiarEstado, eliminarSalon, archivarSalones, crearDocente }
}
