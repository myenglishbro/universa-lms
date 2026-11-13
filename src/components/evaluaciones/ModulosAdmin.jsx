import { useCallback, useRef, useState } from 'react'
import Badge from '../ui/Badge'
import Button from '../ui/Button'
import Card from '../ui/Card'
import Field, { inputClass } from '../ui/Field'
import useCarga from '../../hooks/useCarga'
import { METODOS_CONSOLIDACION } from '../../lib/evaluaciones'
import * as servicioReal from '../../services/evaluaciones'

// Administración: módulos del salón (cantidad libre, ciclo opcional), plantilla de cada módulo y consolidación del nivel.
export default function ModulosAdmin({ salonId, cicloDesde, cicloHasta, servicio = servicioReal, onCambio }) {
  const cargar = useCallback(async () => {
    const [estructura, plantillas] = await Promise.all([servicio.estructuraSalon(salonId), servicio.listarPlantillas()])
    return { estructura, plantillas }
  }, [servicio, salonId])
  const { datos, cargando, error, recargar } = useCarga(cargar, null)
  const [nuevo, setNuevo] = useState({ nombre: '', ciclo: '', aporte: '1' })
  const [rangos, setRangos] = useState({}) // moduloId → {desde, hasta}
  const [metodo, setMetodo] = useState(null)
  const [confirmada, setConfirmada] = useState(null)
  const [aviso, setAviso] = useState('')
  const [fallo, setFallo] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const enCurso = useRef(false)

  const ejecutar = async (fn, ok) => {
    if (enCurso.current) return
    enCurso.current = true
    setOcupado(true)
    setAviso('')
    setFallo('')
    try {
      await fn()
      setAviso(ok)
      await recargar()
      await onCambio?.()
    } catch (e) {
      setFallo(e.message)
    } finally {
      enCurso.current = false
      setOcupado(false)
    }
  }

  if (error) return <p className="text-sm text-red-600">Could not load the setup: {error}</p>
  if (cargando || !datos) return <p className="py-4 text-sm text-slate-400">Loading…</p>
  const { estructura, plantillas } = datos
  // Un solo sistema para todos los módulos: la versión vigente de «Grade Chart Universa».
  const vigente = plantillas.flatMap((p) => (p.nombre === 'Grade Chart Universa' ? p.versiones.filter((v) => v.estado === 'vigente') : [])).map((v) => ({ value: v.id }))[0]
  const ciclos = cicloDesde !== '' && cicloDesde != null ? Array.from({ length: Number(cicloHasta) - Number(cicloDesde) + 1 }, (_, i) => Number(cicloDesde) + i) : []
  const cons = estructura.consolidacion
  const metodoActual = metodo ?? cons.metodo
  const confirmadaActual = confirmada ?? cons.confirmada

  return (
    <Card className="p-5">
      <h2 className="text-base font-semibold text-slate-900">Assessment modules</h2>
      <p className="mt-1 text-xs text-slate-500">Define cuántos módulos tiene este salón y qué clases del calendario abarca cada uno (para la participación de Formative). Todos los módulos usan el mismo sistema de evaluación de Universa. No hay una cantidad obligatoria.</p>
      {estructura.modulos.length === 0 && (ciclos.length === 1 || ciclos.length === 2) && (
        <div className="mt-3 rounded-lg border border-brand-200 bg-brand-50 p-3 text-sm text-brand-900">
          <p>
            {ciclos.length === 1 ? 'This group has 1 cycle.' : 'This group covers 2 cycles.'} You can create the Universa structure: <strong>2 modules per cycle ({ciclos.length * 2} in total)</strong>, each module out of 100 and with the same assessment system. The cycle's classes are split into two halves.
          </p>
          <Button className="mt-2" disabled={ocupado} onClick={() => ejecutar(() => servicio.crearEstructuraEstandar(salonId), `Structure created: ${ciclos.length * 2} modules with their assessment system and classes.`)}>
            {ciclos.length === 1 ? 'Create the cycle\'s 2 modules' : 'Create the 4 modules'}
          </Button>
        </div>
      )}

      {estructura.modulos.length === 0 ? (
        <p className="mt-3 text-sm text-slate-400">No modules yet.</p>
      ) : (
        <ul className="mt-3 divide-y divide-slate-100">
          {estructura.modulos.map((m) => (
            <li key={m.id} className="py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium text-slate-900">
                  {m.nombre} {m.ciclo != null && <Badge color="slate">Cycle {m.ciclo}</Badge>}
                </p>
                <Button variant="ghost" className="px-2 py-1 text-xs" disabled={ocupado} onClick={() => ejecutar(() => servicio.eliminarModulo(m.id), 'Module deleted.')}>
                  Delete
                </Button>
              </div>
              <p className="text-xs text-slate-500">
                {m.version_id ? `Universa assessment system (out of ${m.escala})` : 'No assessment system applied'}
              </p>
              <p className="text-xs text-slate-500">{m.sesion_desde != null ? `Classes ${m.sesion_desde} to ${m.sesion_hasta} of the calendar (${m.clases} classes)` : 'Module classes not defined (needed for Formative participation)'}</p>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <input type="number" min="1" aria-label={`First class of ${m.nombre}`} className={`${inputClass} w-24`} placeholder="From" value={rangos[m.id]?.desde ?? m.sesion_desde ?? ''} onChange={(e) => setRangos((p) => ({ ...p, [m.id]: { desde: e.target.value, hasta: p[m.id]?.hasta ?? m.sesion_hasta ?? '' } }))} />
                <input type="number" min="1" aria-label={`Last class of ${m.nombre}`} className={`${inputClass} w-24`} placeholder="To" value={rangos[m.id]?.hasta ?? m.sesion_hasta ?? ''} onChange={(e) => setRangos((p) => ({ ...p, [m.id]: { desde: p[m.id]?.desde ?? m.sesion_desde ?? '', hasta: e.target.value } }))} />
                <Button variant="secondary" className="px-3 py-1" disabled={ocupado} onClick={() => ejecutar(() => servicio.definirSesionesModulo(m.id, rangos[m.id]?.desde ?? m.sesion_desde, rangos[m.id]?.hasta ?? m.sesion_hasta), 'Module classes saved.')}>
                  Save classes
                </Button>
              </div>
              {!m.version_id && (
                <div className="mt-2">
                  <Button variant="secondary" disabled={ocupado || !vigente} onClick={() => ejecutar(() => servicio.asignarPlantilla(m.id, vigente.value), 'Assessment system applied.')}>
                    Apply the assessment system
                  </Button>
                  {!vigente && <span className="ml-2 text-xs text-slate-400">No hay una versión vigente (actívala en Evaluaciones).</span>}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <form
        className="mt-4 flex flex-wrap items-end gap-2 border-t border-slate-100 pt-4"
        onSubmit={(e) => {
          e.preventDefault()
          ejecutar(async () => {
            await servicio.guardarModulo(null, salonId, nuevo)
            setNuevo({ nombre: '', ciclo: '', aporte: '1' })
          }, 'Module created.')
        }}
      >
        <Field className="min-w-40 flex-1" label="New module" value={nuevo.nombre} onChange={(e) => setNuevo({ ...nuevo, nombre: e.target.value })} placeholder="E.g.: Module 1" required />
        {ciclos.length > 0 && (
          <Field label="Cycle (optional)" options={[{ value: '', label: 'No cycle' }, ...ciclos.map((c) => ({ value: String(c), label: `Cycle ${c}` }))]} value={nuevo.ciclo} onChange={(e) => setNuevo({ ...nuevo, ciclo: e.target.value })} />
        )}
        <Button type="submit" disabled={ocupado}>
          Add module
        </Button>
      </form>

      <div className="mt-5 border-t border-slate-100 pt-4">
        <h3 className="text-sm font-semibold text-slate-900">Final level grade</h3>
        <p className="mt-1 text-xs text-slate-500">Pending Coordination confirmation. Until confirmed, students do not see the level grade.</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <select aria-label="Consolidation method" className={`${inputClass} min-w-56 flex-1 sm:max-w-md`} value={metodoActual} onChange={(e) => { setMetodo(e.target.value); if (e.target.value === 'sin_definir') setConfirmada(false) }}>
            {METODOS_CONSOLIDACION.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" disabled={metodoActual === 'sin_definir'} checked={confirmadaActual} onChange={(e) => setConfirmada(e.target.checked)} />
            Confirmed by Coordination
          </label>
          <Button variant="secondary" disabled={ocupado} onClick={() => ejecutar(() => servicio.guardarConsolidacion(salonId, metodoActual, metodoActual !== 'sin_definir' && confirmadaActual), 'Consolidation saved.')}>
            Save
          </Button>
        </div>
      </div>

      {aviso && <p className="mt-3 rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-800">{aviso}</p>}
      {fallo && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{fallo}</p>}
    </Card>
  )
}
