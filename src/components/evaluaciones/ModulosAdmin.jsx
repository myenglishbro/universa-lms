import { useCallback, useRef, useState } from 'react'
import Badge from '../ui/Badge'
import Button from '../ui/Button'
import Card from '../ui/Card'
import Field from '../ui/Field'
import Icon from '../ui/Icon'
import useCarga from '../../hooks/useCarga'
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

  const rango = (m) => ({ desde: rangos[m.id]?.desde ?? m.sesion_desde ?? '', hasta: rangos[m.id]?.hasta ?? m.sesion_hasta ?? '' })
  const cambiado = (m) => rangos[m.id] !== undefined && (String(rango(m).desde) !== String(m.sesion_desde ?? '') || String(rango(m).hasta) !== String(m.sesion_hasta ?? ''))
  const ponerRango = (m, parche) => setRangos((p) => ({ ...p, [m.id]: { ...rango(m), ...parche } }))
  const num = 'w-20 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-center text-sm tabular-nums focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20'

  return (
    <Card className="p-5">
      <h2 className="text-base font-semibold text-slate-900">Module setup</h2>
      <p className="mt-1 text-xs text-slate-500">Which calendar classes each module covers (used for Formative participation). All modules use the Universa assessment system.</p>
      {estructura.modulos.length === 0 && (ciclos.length === 1 || ciclos.length === 2) && (
        <div className="mt-3 rounded-xl border border-brand-200 bg-brand-50 p-3 text-sm text-brand-900">
          <p>
            {ciclos.length === 1 ? 'This group has 1 cycle.' : 'This group covers 2 cycles.'} You can create the Universa structure: <strong>2 modules per cycle ({ciclos.length * 2} in total)</strong>, each module out of 100 and with the same assessment system. The cycle classes are split into two halves.
          </p>
          <Button className="mt-2" disabled={ocupado} onClick={() => ejecutar(() => servicio.crearEstructuraEstandar(salonId), `Structure created: ${ciclos.length * 2} modules with their assessment system and classes.`)}>
            {ciclos.length === 1 ? 'Create the 2 modules of the cycle' : 'Create the 4 modules'}
          </Button>
        </div>
      )}

      {estructura.modulos.length === 0 ? (
        <p className="mt-3 text-sm text-slate-400">No modules yet.</p>
      ) : (
        <ul className="mt-4 space-y-2">
          {estructura.modulos.map((m) => (
            <li key={m.id} className="rounded-xl border border-slate-200 bg-white p-3">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <div className="min-w-40 flex-1">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-900">
                    {m.nombre} {m.ciclo != null && <Badge color="slate">Cycle {m.ciclo}</Badge>}
                  </p>
                  <p className="text-xs text-slate-500">
                    {m.sesion_desde != null ? `${m.clases} classes` : 'Classes not defined'} · {m.version_id ? `out of ${m.escala}` : <span className="text-amber-600">no assessment system</span>}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-slate-500">
                  Classes
                  <input type="number" min="1" aria-label={`First class of ${m.nombre}`} className={num} placeholder="From" value={rango(m).desde} onChange={(e) => ponerRango(m, { desde: e.target.value })} />
                  to
                  <input type="number" min="1" aria-label={`Last class of ${m.nombre}`} className={num} placeholder="To" value={rango(m).hasta} onChange={(e) => ponerRango(m, { hasta: e.target.value })} />
                  {cambiado(m) && (
                    <Button className="px-3 py-1.5" disabled={ocupado} onClick={() => ejecutar(() => servicio.definirSesionesModulo(m.id, rango(m).desde, rango(m).hasta), 'Module classes saved.')}>
                      Save
                    </Button>
                  )}
                </div>
                <button
                  type="button"
                  title="Delete module"
                  aria-label={`Delete ${m.nombre}`}
                  disabled={ocupado}
                  onClick={() => window.confirm(`Delete ${m.nombre}? Its grades will be deleted too.`) && ejecutar(() => servicio.eliminarModulo(m.id), 'Module deleted.')}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600"
                >
                  <Icon name="trash" className="h-4 w-4" />
                </button>
              </div>
              {!m.version_id && (
                <div className="mt-2">
                  <Button variant="secondary" disabled={ocupado || !vigente} onClick={() => ejecutar(() => servicio.asignarPlantilla(m.id, vigente.value), 'Assessment system applied.')}>
                    Apply the assessment system
                  </Button>
                  {!vigente && <span className="ml-2 text-xs text-slate-400">There is no current version (activate it in Evaluations).</span>}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <details className="mt-4 border-t border-slate-100 pt-3">
        <summary className="cursor-pointer text-sm font-medium text-brand-700">+ Add another module</summary>
        <form
          className="mt-3 flex flex-wrap items-end gap-2"
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
            <Field label="Cycle" options={[{ value: '', label: 'No cycle' }, ...ciclos.map((c) => ({ value: String(c), label: `Cycle ${c}` }))]} value={nuevo.ciclo} onChange={(e) => setNuevo({ ...nuevo, ciclo: e.target.value })} />
          )}
          <Button type="submit" disabled={ocupado}>
            Add module
          </Button>
        </form>
      </details>

      {aviso && <p className="mt-3 rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-800">{aviso}</p>}
      {fallo && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{fallo}</p>}
    </Card>
  )
}
