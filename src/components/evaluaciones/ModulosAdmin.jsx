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
  const [eleccion, setEleccion] = useState({}) // moduloId → versionId
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

  if (error) return <p className="text-sm text-red-600">No se pudo cargar la configuración: {error}</p>
  if (cargando || !datos) return <p className="py-4 text-sm text-slate-400">Cargando…</p>
  const { estructura, plantillas } = datos
  const vigentes = plantillas.flatMap((p) => p.versiones.filter((v) => v.estado === 'vigente').map((v) => ({ value: v.id, label: `${p.nombre} · v${v.version} (escala ${v.escala_puntos})` })))
  const ciclos = cicloDesde !== '' && cicloDesde != null ? Array.from({ length: Number(cicloHasta) - Number(cicloDesde) + 1 }, (_, i) => Number(cicloDesde) + i) : []
  const cons = estructura.consolidacion
  const metodoActual = metodo ?? cons.metodo
  const confirmadaActual = confirmada ?? cons.confirmada

  return (
    <Card className="p-5">
      <h2 className="text-base font-semibold text-slate-900">Módulos de evaluación</h2>
      <p className="mt-1 text-xs text-slate-500">Define cuántos módulos tiene este salón, qué plantilla usa cada uno y qué clases del calendario abarca (para la participación de Formative). No hay una cantidad obligatoria.</p>
      {estructura.modulos.length === 0 && (ciclos.length === 1 || ciclos.length === 2) && (
        <div className="mt-3 rounded-lg border border-brand-200 bg-brand-50 p-3 text-sm text-brand-900">
          <p>
            {ciclos.length === 1 ? 'Este grupo es de 1 ciclo.' : 'Este grupo abarca 2 ciclos.'} Puedes crear la estructura de Universa: <strong>2 módulos por ciclo ({ciclos.length * 2} en total)</strong>, cada módulo sobre 100. Se asigna sola la plantilla «Grade Chart Universa»: el último módulo del último ciclo usa los pesos del módulo final y los demás los de los módulos 1 a 3. Las clases del ciclo se reparten en dos mitades.
          </p>
          <Button className="mt-2" disabled={ocupado} onClick={() => ejecutar(() => servicio.crearEstructuraEstandar(salonId), `Estructura creada: ${ciclos.length * 2} módulos con sus plantillas y clases.`)}>
            {ciclos.length === 1 ? 'Crear los 2 módulos del ciclo' : 'Crear los 4 módulos'}
          </Button>
        </div>
      )}

      {estructura.modulos.length === 0 ? (
        <p className="mt-3 text-sm text-slate-400">Sin módulos todavía.</p>
      ) : (
        <ul className="mt-3 divide-y divide-slate-100">
          {estructura.modulos.map((m) => (
            <li key={m.id} className="py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium text-slate-900">
                  {m.nombre} {m.ciclo != null && <Badge color="slate">Ciclo {m.ciclo}</Badge>} {m.es_final && <Badge color="brand">Módulo final</Badge>}
                </p>
                <Button variant="ghost" className="px-2 py-1 text-xs" disabled={ocupado} onClick={() => ejecutar(() => servicio.eliminarModulo(m.id), 'Módulo eliminado.')}>
                  Eliminar
                </Button>
              </div>
              <p className="text-xs text-slate-500">
                {m.version_id ? `Plantilla: ${m.plantilla} · v${m.version} (escala ${m.escala})${m.es_final ? ' · usa los pesos del módulo final' : ''}` : 'Sin plantilla asignada'}
                {' '}
                <button type="button" disabled={ocupado} aria-label={`${m.es_final ? 'Quitar marca de módulo final de' : 'Marcar como módulo final'} ${m.nombre}`} className="text-brand-700 underline disabled:opacity-50" onClick={() => ejecutar(() => servicio.definirModuloFinal(m.id, !m.es_final), m.es_final ? 'Módulo normal: usa los pesos de los módulos 1 a 3.' : 'Módulo final: usa los pesos del módulo final.')}>
                  {m.es_final ? 'Quitar marca de módulo final' : 'Marcar como módulo final'}
                </button>
              </p>
              <p className="text-xs text-slate-500">{m.sesion_desde != null ? `Clases ${m.sesion_desde} a ${m.sesion_hasta} del calendario (${m.clases} clases)` : 'Clases del módulo sin definir (necesarias para la participación de Formative)'}</p>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <input type="number" min="1" aria-label={`Primera clase de ${m.nombre}`} className={`${inputClass} w-24`} placeholder="Desde" value={rangos[m.id]?.desde ?? m.sesion_desde ?? ''} onChange={(e) => setRangos((p) => ({ ...p, [m.id]: { desde: e.target.value, hasta: p[m.id]?.hasta ?? m.sesion_hasta ?? '' } }))} />
                <input type="number" min="1" aria-label={`Última clase de ${m.nombre}`} className={`${inputClass} w-24`} placeholder="Hasta" value={rangos[m.id]?.hasta ?? m.sesion_hasta ?? ''} onChange={(e) => setRangos((p) => ({ ...p, [m.id]: { desde: p[m.id]?.desde ?? m.sesion_desde ?? '', hasta: e.target.value } }))} />
                <Button variant="secondary" className="px-3 py-1" disabled={ocupado} onClick={() => ejecutar(() => servicio.definirSesionesModulo(m.id, rangos[m.id]?.desde ?? m.sesion_desde, rangos[m.id]?.hasta ?? m.sesion_hasta), 'Clases del módulo guardadas.')}>
                  Guardar clases
                </Button>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                <select aria-label={`Plantilla para ${m.nombre}`} className={`${inputClass} min-w-56 flex-1 sm:max-w-md`} value={eleccion[m.id] ?? ''} onChange={(e) => setEleccion((p) => ({ ...p, [m.id]: e.target.value }))}>
                  <option value="">{vigentes.length ? 'Elegir plantilla vigente…' : 'No hay plantillas vigentes (actívalas en Evaluaciones)'}</option>
                  {vigentes.map((v) => (
                    <option key={v.value} value={v.value}>
                      {v.label}
                    </option>
                  ))}
                </select>
                <Button variant="secondary" disabled={ocupado || !eleccion[m.id]} onClick={() => ejecutar(() => servicio.asignarPlantilla(m.id, eleccion[m.id]), 'Plantilla asignada.')}>
                  Asignar plantilla
                </Button>
              </div>
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
          }, 'Módulo creado.')
        }}
      >
        <Field className="min-w-40 flex-1" label="Nuevo módulo" value={nuevo.nombre} onChange={(e) => setNuevo({ ...nuevo, nombre: e.target.value })} placeholder="Ej.: Module 1" required />
        {ciclos.length > 0 && (
          <Field label="Ciclo (opcional)" options={[{ value: '', label: 'Sin ciclo' }, ...ciclos.map((c) => ({ value: String(c), label: `Ciclo ${c}` }))]} value={nuevo.ciclo} onChange={(e) => setNuevo({ ...nuevo, ciclo: e.target.value })} />
        )}
        <Button type="submit" disabled={ocupado}>
          Agregar módulo
        </Button>
      </form>

      <div className="mt-5 border-t border-slate-100 pt-4">
        <h3 className="text-sm font-semibold text-slate-900">Nota final del nivel</h3>
        <p className="mt-1 text-xs text-slate-500">Pendiente de confirmación de Coordinación. Mientras no se confirme, los estudiantes no ven la nota del nivel.</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <select aria-label="Método de consolidación" className={`${inputClass} min-w-56 flex-1 sm:max-w-md`} value={metodoActual} onChange={(e) => { setMetodo(e.target.value); if (e.target.value === 'sin_definir') setConfirmada(false) }}>
            {METODOS_CONSOLIDACION.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" disabled={metodoActual === 'sin_definir'} checked={confirmadaActual} onChange={(e) => setConfirmada(e.target.checked)} />
            Confirmada por Coordinación
          </label>
          <Button variant="secondary" disabled={ocupado} onClick={() => ejecutar(() => servicio.guardarConsolidacion(salonId, metodoActual, metodoActual !== 'sin_definir' && confirmadaActual), 'Consolidación guardada.')}>
            Guardar
          </Button>
        </div>
      </div>

      {aviso && <p className="mt-3 rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-800">{aviso}</p>}
      {fallo && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{fallo}</p>}
    </Card>
  )
}
