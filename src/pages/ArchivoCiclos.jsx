import { useCallback, useMemo, useState } from 'react'
import InformeDialogo from '../components/evaluaciones/InformeDialogo'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import { inputClass } from '../components/ui/Field'
import Icon from '../components/ui/Icon'
import PageHeader from '../components/ui/PageHeader'
import useCarga from '../hooks/useCarga'
import { descargarInforme } from '../lib/informeNotas'
import { formatFecha } from '../lib/salones'
import { listarArchivoAlumnos } from '../services/salones'

const sinTildes = (s) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()

// Historial de ciclos cerrados: ciclo → salones → estudiantes con su informe de notas guardado al cerrar.
export default function ArchivoCiclos({ archivados }) {
  const cargar = useCallback(() => listarArchivoAlumnos(), [])
  const { datos: alumnos, cargando, error, recargar } = useCarga(cargar, [])
  const [busqueda, setBusqueda] = useState('')
  const [abierto, setAbierto] = useState(null) // salon_id expandido
  const [informe, setInforme] = useState(null)

  const texto = sinTildes(busqueda.trim())
  const ciclos = useMemo(() => {
    const porSalon = new Map()
    for (const a of alumnos) porSalon.set(a.salon_id, [...(porSalon.get(a.salon_id) ?? []), a])
    const grupos = new Map()
    for (const s of archivados) {
      const est = porSalon.get(s.id) ?? []
      const coincideSalon = !texto || sinTildes(`${s.nombre} ${s.codigo} ${s.docente}`).includes(texto)
      const visibles = coincideSalon ? est : est.filter((a) => sinTildes(a.alumno_nombre).includes(texto))
      if (texto && !coincideSalon && visibles.length === 0) continue
      grupos.set(s.cicloArchivo, [...(grupos.get(s.cicloArchivo) ?? []), { salon: s, estudiantes: visibles, total: est.length }])
    }
    // Ciclos más recientes primero (por la fecha de archivo más reciente de sus salones).
    const ultimo = (g) => Math.max(...g.map((x) => new Date(x.salon.archivadoAt).getTime()))
    return [...grupos].sort((a, b) => ultimo(b[1]) - ultimo(a[1]))
  }, [alumnos, archivados, texto])

  return (
    <>
      <PageHeader title="Archivo de ciclos" description="Salones de ciclos cerrados, con sus estudiantes y reportes, guardados tal como terminaron" />

      {informe && (
        <InformeDialogo
          datos={informe}
          onClose={() => setInforme(null)}
          onGenerar={(extra) => {
            descargarInforme(informe, extra)
            setInforme(null)
          }}
        />
      )}

      <Card>
        <div className="border-b border-brand-100 p-4">
          <div className="relative max-w-sm">
            <Icon name="search" className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar estudiante, salón o docente" className={`${inputClass} pl-9`} />
          </div>
        </div>

        {cargando ? (
          <p className="px-4 py-10 text-center text-sm text-slate-500">Cargando archivo…</p>
        ) : error ? (
          <div className="px-4 py-10 text-center text-sm">
            <p className="text-red-600">No se pudo cargar el archivo: {error}</p>
            <Button variant="secondary" className="mt-3" onClick={recargar}>
              Reintentar
            </Button>
          </div>
        ) : archivados.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-slate-500">Aún no hay ciclos archivados. Cuando un ciclo termine, usa «Cerrar ciclo» en Salones grupales.</p>
        ) : ciclos.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-slate-500">Nada coincide con la búsqueda.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {ciclos.map(([ciclo, items]) => (
              <section key={ciclo} className="p-4">
                <h2 className="mb-2 flex items-center gap-2 text-base font-semibold text-slate-900">
                  Ciclo {ciclo}
                  <Badge color="slate">
                    {items.length} {items.length === 1 ? 'salón' : 'salones'}
                  </Badge>
                </h2>
                <ul className="space-y-2">
                  {items.map(({ salon, estudiantes, total }) => {
                    const abre = abierto === salon.id || Boolean(texto && estudiantes.length)
                    return (
                      <li key={salon.id} className="rounded-xl border border-slate-200">
                        <button
                          type="button"
                          aria-expanded={abre}
                          onClick={() => setAbierto(abierto === salon.id ? null : salon.id)}
                          className="flex w-full flex-wrap items-center justify-between gap-2 px-4 py-3 text-left"
                        >
                          <span>
                            <span className="block text-sm font-medium text-slate-900">{salon.nombre}</span>
                            <span className="block text-xs text-slate-500">
                              {salon.nivel || 'Sin nivel'} · {salon.docente || 'Sin docente'} · {formatFecha(salon.fechaInicio)} → {formatFecha(salon.fechaFin)}
                            </span>
                          </span>
                          <span className="flex items-center gap-2 text-xs text-slate-500">
                            {total} {total === 1 ? 'estudiante' : 'estudiantes'}
                            <Icon name={abre ? 'up' : 'down'} className="h-4 w-4" />
                          </span>
                        </button>
                        {abre && (
                          <ul className="divide-y divide-slate-100 border-t border-slate-100">
                            {estudiantes.length === 0 ? (
                              <li className="px-4 py-3 text-sm text-slate-500">Este salón no tenía estudiantes matriculados.</li>
                            ) : (
                              estudiantes.map((a) => (
                                <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2">
                                  <div>
                                    <p className="text-sm text-slate-900">{a.alumno_nombre}</p>
                                    <p className="text-xs text-slate-500">
                                      {a.matricula_estado === 'activa'
                                        ? 'Terminó el ciclo'
                                        : `Se retiró${a.fecha_fin ? ` el ${formatFecha(a.fecha_fin)}` : ''}${a.motivo_retiro ? ` · ${a.motivo_retiro}` : ''}`}
                                    </p>
                                  </div>
                                  {a.informe ? (
                                    <Button variant="ghost" className="px-2 py-1 text-xs" onClick={() => setInforme(a.informe)}>
                                      <Icon name="doc" className="h-4 w-4" /> Ver informe
                                    </Button>
                                  ) : (
                                    <span className="text-xs text-slate-400">Sin informe guardado</span>
                                  )}
                                </li>
                              ))
                            )}
                          </ul>
                        )}
                      </li>
                    )
                  })}
                </ul>
              </section>
            ))}
          </div>
        )}
      </Card>
    </>
  )
}
