import { useEffect, useMemo, useState } from 'react'
import Badge from '../ui/Badge'
import Button from '../ui/Button'
import Modal from '../ui/Modal'
import { cubreHorarios, aConjunto } from '../../lib/disponibilidad'
import { formatFecha, formatHorario } from '../../lib/salones'
import { choquesHorarioSalon } from '../../services/salones'
import { disponibilidadDocentes } from '../../services/registros'

const MAX_SUGERIDOS = 3

// Salones activos (planificados o en curso) que ya tienen horario pero aún no docente: los que se pueden asignar desde este panel.
// Los finalizados quedan fuera. Primero van los planificados y, dentro de cada grupo, los que empiezan antes.
export const porAsignar = (salones) =>
  salones
    .filter((s) => s.estado !== 'finalizado' && !s.docenteId && s.horarios.length > 0 && s.fechaInicio)
    .sort((a, b) => (a.estado === b.estado ? 0 : a.estado === 'pendiente' ? -1 : 1) || a.fechaInicio.localeCompare(b.fechaInicio))

// Panel «Por asignar»: para cada salón activo sin docente sugiere quién puede dictarlo.
// Candidato = docente activo, sin choques con otros salones o clases particulares en ese rango de fechas y con la disponibilidad
// que marcó cubriendo todo el horario. Los candidatos se ordenan por carga (menos salones activos primero).
// Los docentes sin disponibilidad registrada se ofrecen al final, avisando que no se pudo comprobar.
export default function AsignacionDocentes({ salones, docentes, onAsignar, onClose }) {
  const objetivos = useMemo(() => porAsignar(salones), [salones])
  const clave = objetivos.map((s) => s.id).join(',')
  const [disp, setDisp] = useState(null) // Map docenteId -> Set de franjas; null = aún no cargó
  const [choques, setChoques] = useState(null) // Map salonId -> Map docenteId -> [textos]
  const [errorCarga, setErrorCarga] = useState('')
  const [asignando, setAsignando] = useState('')
  const [errores, setErrores] = useState({})

  useEffect(() => {
    let vigente = true
    disponibilidadDocentes()
      .then((filas) => {
        if (!vigente) return
        const por = new Map()
        for (const f of filas) por.set(f.docente_id, [...(por.get(f.docente_id) ?? []), f])
        setDisp(new Map([...por].map(([id, fs]) => [id, aConjunto(fs)])))
      })
      .catch(() => vigente && setDisp(new Map()))
    return () => {
      vigente = false
    }
  }, [])

  // Se vuelve a consultar al asignar un docente: sus nuevos horarios pueden dejarlo ocupado para los salones que quedan.
  useEffect(() => {
    let vigente = true
    Promise.all(
      objetivos.map((s) =>
        choquesHorarioSalon(s.horarios, s.fechaInicio, s.progreso?.sesiones > 0 ? s.fechaFin : '', s.id, s.totalSesiones).then((m) => [s.id, m]),
      ),
    )
      .then((pares) => {
        if (!vigente) return
        setChoques(new Map(pares))
        setErrorCarga('')
      })
      .catch((e) => vigente && setErrorCarga(e.message))
    return () => {
      vigente = false
    }
    // objetivos cambia de referencia en cada render de la lista; basta la clave de sus ids.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave])

  // Carga actual: salones no finalizados que ya dicta cada docente.
  const carga = useMemo(() => {
    const m = new Map()
    for (const s of salones) if (s.docenteId && s.estado !== 'finalizado') m.set(s.docenteId, (m.get(s.docenteId) ?? 0) + 1)
    return m
  }, [salones])

  const sugeridos = (salon) => {
    const ocupados = choques?.get(salon.id) ?? new Map()
    const lista = []
    let descartados = 0
    for (const d of docentes) {
      if (!d.activo) continue
      if (ocupados.has(d.id)) {
        descartados++
        continue
      }
      const franjas = disp?.get(d.id)
      const estado = !franjas ? 'sin_datos' : cubreHorarios(franjas, salon.horarios) ? 'libre' : 'no_disponible'
      if (estado === 'no_disponible') {
        descartados++
        continue
      }
      lista.push({ d, estado, n: carga.get(d.id) ?? 0 })
    }
    lista.sort((a, b) => (a.estado === b.estado ? 0 : a.estado === 'libre' ? -1 : 1) || a.n - b.n || a.d.nombre.localeCompare(b.d.nombre))
    return { lista, descartados }
  }

  const asignar = async (salon, docenteId) => {
    setAsignando(`${salon.id}:${docenteId}`)
    setErrores((e) => ({ ...e, [salon.id]: '' }))
    try {
      await onAsignar(salon, docenteId)
    } catch (err) {
      setErrores((e) => ({ ...e, [salon.id]: err.message }))
    } finally {
      setAsignando('')
    }
  }

  const cargando = disp === null || choques === null

  return (
    <Modal wide="xl" title="Classrooms to assign" onClose={onClose}>
      <p className="mb-4 text-sm text-slate-600">
        Planned or in-progress classrooms with a schedule and no teacher. Teachers who are free for the <strong>whole</strong> schedule and its dates are suggested, starting with those
        who have the fewest active classrooms.
      </p>
      {errorCarga && <p className="mb-3 text-sm text-red-600">Could not calculate suggestions: {errorCarga}</p>}
      {objetivos.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-500">There are no active classrooms without a teacher.</p>
      ) : cargando && !errorCarga ? (
        <p className="py-8 text-center text-sm text-slate-500">Calculating suggestions…</p>
      ) : (
        <ul className="space-y-3">
          {objetivos.map((s) => {
            const { lista, descartados } = sugeridos(s)
            const top = lista.slice(0, MAX_SUGERIDOS)
            return (
              <li key={s.id} className="rounded-2xl border border-brand-100 bg-white p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div>
                    <span className="font-semibold text-slate-900">{s.nombre}</span>
                    <span className="ml-2 text-xs text-slate-500">{s.codigo}</span>
                    <span className="ml-2 align-middle"><Badge color={s.estado === 'en_curso' ? 'peach' : 'slate'}>{s.estado === 'en_curso' ? 'In progress · no teacher' : 'Planned'}</Badge></span>
                  </div>
                  <span className="text-xs text-slate-500">
                    {s.nivel || 'No level'} · {s.estado === 'en_curso' ? 'started' : 'from'} {formatFecha(s.fechaInicio)}
                  </span>
                </div>
                <p className="mt-1 text-sm text-slate-600">{formatHorario(s.horarios)}</p>

                {top.length === 0 ? (
                  <p className="mt-3 rounded-lg bg-peach-50 px-3 py-2 text-sm text-peach-700">
                    No teacher available at that time{descartados > 0 ? ` (${descartados} ruled out by conflicts or availability)` : ''}. Check the classroom's schedule
                    or the teachers' availability.
                  </p>
                ) : (
                  <ul className="mt-3 space-y-2">
                    {top.map(({ d, estado, n }) => (
                      <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 px-3 py-2">
                        <div className="flex flex-wrap items-center gap-2 text-sm">
                          <span className="font-medium text-slate-900">{d.nombre}</span>
                          <Badge color={estado === 'libre' ? 'brand' : 'slate'}>{estado === 'libre' ? 'Available' : 'No availability on record'}</Badge>
                          <span className="text-xs text-slate-500">{n === 0 ? 'No classrooms' : `${n} active ${n === 1 ? 'classroom' : 'classrooms'}`}</span>
                        </div>
                        <Button className="px-3 py-1.5" disabled={Boolean(asignando)} onClick={() => asignar(s, d.id)}>
                          {asignando === `${s.id}:${d.id}` ? 'Assigning…' : 'Assign'}
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
                {lista.length > MAX_SUGERIDOS && <p className="mt-2 text-xs text-slate-500">and {lista.length - MAX_SUGERIDOS} more; you can choose them from “Edit classroom”.</p>}
                {errores[s.id] && <p className="mt-2 text-sm text-red-600">{errores[s.id]}</p>}
              </li>
            )
          })}
        </ul>
      )}
    </Modal>
  )
}
