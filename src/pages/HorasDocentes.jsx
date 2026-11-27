import { Fragment, useCallback, useEffect, useState } from 'react'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import Field, { inputClass } from '../components/ui/Field'
import Icon from '../components/ui/Icon'
import Modal from '../components/ui/Modal'
import PageHeader from '../components/ui/PageHeader'
import useCarga from '../hooks/useCarga'
import { aInputLima, deInputLima, etiquetaPeriodo, fmtMinutos, fmtSoles, hoyLima, horaLima, moverPeriodo, periodoDe, porDocente, resumenCsv, totales } from '../lib/horasDocentes'
import { formatFecha } from '../lib/salones'
import * as servicioReal from '../services/horas'

function Dato({ titulo, valor, detalle, destacado = false }) {
  return (
    <Card className={`p-4 ${destacado ? 'ring-2 ring-brand-500/30' : ''}`}>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{titulo}</p>
      <p className="mt-1 text-2xl font-bold text-slate-900">{valor}</p>
      {detalle && <p className="mt-0.5 text-xs text-slate-500">{detalle}</p>}
    </Card>
  )
}

// Enlace de Zoom único para todas las clases. Lo abre el botón de entrada del docente.
function EnlaceZoom({ puedeEditar, servicio }) {
  const cargar = useCallback(() => servicio.zoomClase(), [servicio])
  const zoom = useCarga(cargar, '')
  const [valor, setValor] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const [falla, setFalla] = useState('')
  const [listo, setListo] = useState(false)
  const actual = valor ?? zoom.datos ?? ''

  const guardar = async () => {
    setGuardando(true)
    setFalla('')
    setListo(false)
    try {
      await servicio.guardarZoom(actual)
      await zoom.recargar()
      setValor(null)
      setListo(true)
    } catch (e) {
      setFalla(e.message)
    } finally {
      setGuardando(false)
    }
  }
  return (
    <Card className="mb-5 p-4">
      <p className="flex items-center gap-2 text-sm font-semibold text-slate-900">
        <Icon name="play" className="h-4 w-4 text-brand-600" /> Zoom link for classes
      </p>
      <p className="mb-3 text-xs text-slate-500">The same link opens when a teacher taps “Join class and mark entry”.</p>
      {zoom.error ? (
        <p className="text-sm text-red-600">Could not load the link: {zoom.error}</p>
      ) : (
        <div className="flex flex-wrap items-start gap-2">
          <input value={actual} onChange={(e) => setValor(e.target.value)} readOnly={!puedeEditar} placeholder="https://us06web.zoom.us/j/…" className={`${inputClass} min-w-64 flex-1`} aria-label="Zoom link" />
          {puedeEditar && (
            <Button type="button" onClick={guardar} disabled={guardando || valor === null}>
              {guardando ? 'Saving…' : 'Save link'}
            </Button>
          )}
        </div>
      )}
      {falla && <p className="mt-2 text-sm text-rose-700">{falla}</p>}
      {listo && <p className="mt-2 text-sm text-emerald-700">Link saved.</p>}
      {!zoom.cargando && !zoom.error && !actual && <p className="mt-2 text-xs text-peach-700">No link yet: teachers can mark entry, but no Zoom will open.</p>}
    </Card>
  )
}

function AjustarMarca({ fila, onClose, onGuardado, servicio }) {
  const [entrada, setEntrada] = useState(aInputLima(fila.entrada) || `${fila.fecha}T${fila.hora_inicio.slice(0, 5)}`)
  const [salida, setSalida] = useState(aInputLima(fila.salida) || '')
  const [nota, setNota] = useState(fila.nota ?? '')
  const [guardando, setGuardando] = useState(false)
  const [falla, setFalla] = useState('')
  const ejecutar = async (borrar) => {
    setGuardando(true)
    setFalla('')
    try {
      await servicio.ajustarMarca(fila.sesion_id, borrar ? null : deInputLima(entrada), borrar ? null : deInputLima(salida), nota)
      await onGuardado()
      onClose()
    } catch (e) {
      setFalla(e.message)
      setGuardando(false)
    }
  }
  return (
    <Modal title="Correct entry and exit" subtitulo={`${fila.salon} · ${formatFecha(fila.fecha)} · ${fila.hora_inicio.slice(0, 5)}–${fila.hora_fin.slice(0, 5)}`} onClose={onClose}>
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Entry (Lima time)" type="datetime-local" value={entrada} onChange={(e) => setEntrada(e.target.value)} />
          <Field label="Exit (optional)" type="datetime-local" value={salida} onChange={(e) => setSalida(e.target.value)} />
        </div>
        <Field label="Reason (optional)" value={nota} onChange={(e) => setNota(e.target.value)} placeholder="E.g. The teacher forgot to mark; confirmed in the Zoom report" />
        {falla && (
          <p role="alert" className="text-sm text-rose-700">
            {falla}
          </p>
        )}
        <div className="flex flex-wrap justify-between gap-2">
          {fila.entrada ? (
            <Button type="button" variant="ghost" onClick={() => ejecutar(true)} disabled={guardando}>
              Remove mark
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="button" onClick={() => ejecutar(false)} disabled={guardando || !entrada}>
              {guardando ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  )
}

// Servicio de pago de un salón (define la tarifa) y marca de docente nativo. Solo administración cambia; RR. HH. ve el resultado.
function SelectorServicio({ salon, servicios, puedeEditar, servicio, onCambio }) {
  const [ocupado, setOcupado] = useState(false)
  const [falla, setFalla] = useState('')
  if (!puedeEditar) return <span>{salon.servicio ?? '—'}</span>
  const cambiar = async (valor) => {
    setOcupado(true)
    setFalla('')
    try {
      await servicio.asignarServicioSalon(salon.salon_id, valor)
      await onCambio()
    } catch (e) {
      setFalla(e.message)
    } finally {
      setOcupado(false)
    }
  }
  return (
    <span className="inline-flex flex-col">
      <select value={salon.servicio_codigo} onChange={(e) => cambiar(e.target.value)} disabled={ocupado} className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs text-ink" aria-label={`Service of ${salon.salon}`}>
        {servicios.map(([codigo, nombre]) => (
          <option key={codigo} value={codigo}>
            {nombre}
          </option>
        ))}
      </select>
      {falla && <span className="text-xs text-rose-700">{falla}</span>}
    </span>
  )
}

function MarcaNativo({ docente, puedeEditar, servicio, onCambio }) {
  const [ocupado, setOcupado] = useState(false)
  const [falla, setFalla] = useState('')
  if (!puedeEditar) return docente.nativo ? <Badge color="brand">Native</Badge> : null
  const cambiar = async (valor) => {
    setOcupado(true)
    setFalla('')
    try {
      await servicio.marcarNativo(docente.docente_id, valor)
      await onCambio()
    } catch (e) {
      setFalla(e.message)
    } finally {
      setOcupado(false)
    }
  }
  return (
    <label className="inline-flex items-center gap-2 text-xs font-normal text-slate-600" onClick={(e) => e.stopPropagation()}>
      <input type="checkbox" checked={docente.nativo} onChange={(e) => cambiar(e.target.checked)} disabled={ocupado} />
      Native speaker (Flex Signature Premium pays S/ 30 instead of S/ 18)
      {falla && <span className="text-rose-700">{falla}</span>}
    </label>
  )
}

// Clase por clase de un docente en el periodo.
function DetalleDocente({ periodo, docente, puedeEditar, servicio, onCambio }) {
  const cargar = useCallback(() => servicio.detalleHoras(periodo.desde, periodo.hasta, docente.docente_id), [servicio, periodo, docente.docente_id])
  const detalle = useCarga(cargar, [])
  const [editando, setEditando] = useState(null)
  const hoy = hoyLima()
  if (detalle.error) return <p className="px-4 py-3 text-sm text-red-600">Could not load the classes: {detalle.error}</p>
  if (detalle.cargando) return <p className="px-4 py-3 text-sm text-slate-500">Loading…</p>
  return (
    <div className="overflow-x-auto bg-slate-50/60">
      <table className="w-full text-sm">
        <thead className="text-left text-xs uppercase text-slate-500">
          <tr>
            <th className="px-4 py-2">Date</th>
            <th className="px-2 py-2">Classroom</th>
            <th className="px-2 py-2">Scheduled</th>
            <th className="px-2 py-2">Entry</th>
            <th className="px-2 py-2">Exit</th>
            <th className="px-2 py-2">Late</th>
            <th className="px-2 py-2">Status</th>
            {puedeEditar && <th className="px-2 py-2" />}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {detalle.datos.map((f) => {
            const dictada = f.dictada ?? !!f.entrada
            const pasada = f.fecha < hoy
            return (
              <tr key={f.sesion_id}>
                <td className="whitespace-nowrap px-4 py-2 text-slate-700">{formatFecha(f.fecha)}</td>
                <td className="px-2 py-2 text-slate-900">
                  {f.salon} {f.tipo === 'recuperacion' && <Badge color="slate">Make-up</Badge>}
                </td>
                <td className="whitespace-nowrap px-2 py-2 text-slate-600">
                  {f.hora_inicio.slice(0, 5)}–{f.hora_fin.slice(0, 5)} <span className="text-xs text-slate-400">({fmtMinutos(f.minutos_programados)})</span>
                </td>
                <td className="px-2 py-2 font-medium text-slate-900">{horaLima(f.entrada) || '—'}</td>
                <td className="px-2 py-2 text-slate-700">{dictada ? horaLima(f.salida) || <span className="text-xs text-peach-700">not marked</span> : '—'}</td>
                <td className="px-2 py-2">{f.minutos_tarde > 0 ? <span className="text-peach-700">{f.minutos_tarde} min</span> : dictada ? <span className="text-emerald-700">On time</span> : '—'}</td>
                <td className="px-2 py-2">
                  {dictada ? <Badge color="brand">Held{f.ajustada ? ' · corrected' : !f.entrada ? ' · by attendance' : ''}</Badge> : pasada ? <Badge color="peach">No entry mark</Badge> : <Badge color="slate">Upcoming</Badge>}
                </td>
                {puedeEditar && (
                  <td className="px-2 py-2 text-right">
                    <button type="button" onClick={() => setEditando(f)} className="rounded-md p-1.5 text-slate-400 hover:bg-brand-50 hover:text-brand-700" aria-label="Correct the mark" title="Correct the mark">
                      <Icon name="pencil" className="h-4 w-4" />
                    </button>
                  </td>
                )}
              </tr>
            )
          })}
        </tbody>
      </table>
      {editando && <AjustarMarca fila={editando} servicio={servicio} onClose={() => setEditando(null)} onGuardado={async () => { await Promise.all([detalle.recargar(), onCambio()]) }} />}
    </div>
  )
}

// Horas de los docentes por periodo de pago (del 28 al 27). Se pagan las horas programadas de las clases en las que el docente marcó entrada.
export default function HorasDocentes({ puedeEditar = false, servicio = servicioReal }) {
  const [periodo, setPeriodo] = useState(() => periodoDe(hoyLima()))
  const [abierto, setAbierto] = useState(null) // docente_id con el detalle abierto
  const cargar = useCallback(() => servicio.resumenHoras(periodo.desde, periodo.hasta), [servicio, periodo])
  const resumen = useCarga(cargar, [])
  const cargarTarifas = useCallback(() => servicio.tarifasPago(), [servicio])
  const tarifas = useCarga(cargarTarifas, [])
  const servicios = [...new Map(tarifas.datos.map((r) => [r.servicio, r.servicio_nombre])).entries()]
  const [salonFiltro, setSalonFiltro] = useState('')
  useEffect(() => setAbierto(null), [periodo])

  const filas = salonFiltro ? resumen.datos.filter((f) => f.salon_id === salonFiltro) : resumen.datos
  const docentes = porDocente(filas)
  const t = totales(filas)
  const salones = [...new Map(resumen.datos.map((f) => [f.salon_id, f.salon])).entries()].sort((a, b) => a[1].localeCompare(b[1]))
  const sinTarifa = filas.filter((f) => f.precio_hora == null).length
  const esActual = periodo.desde === periodoDe(hoyLima()).desde

  const exportar = () => {
    const blob = new Blob([resumenCsv(filas, periodo)], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `teacher-hours-${periodo.desde}_${periodo.hasta}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <>
      <PageHeader title="Teacher hours" description="Entry and exit of each class, by payment period (from the 28th to the 27th)" />
      <EnlaceZoom puedeEditar={puedeEditar} servicio={servicio} />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="inline-flex items-center rounded-full border border-slate-200 bg-white">
          <button type="button" onClick={() => setPeriodo(moverPeriodo(periodo, -1))} className="rounded-full p-2 text-slate-500 hover:text-brand-700" aria-label="Previous period">
            <Icon name="back" className="h-4 w-4" />
          </button>
          <span className="px-2 text-sm font-semibold text-slate-900">{etiquetaPeriodo(periodo)}</span>
          <button type="button" onClick={() => setPeriodo(moverPeriodo(periodo, 1))} className="rounded-full p-2 text-slate-500 hover:text-brand-700" aria-label="Next period">
            <Icon name="back" className="h-4 w-4 rotate-180" />
          </button>
        </div>
        {!esActual && (
          <Button type="button" variant="ghost" onClick={() => setPeriodo(periodoDe(hoyLima()))}>
            Current period
          </Button>
        )}
        <select value={salonFiltro} onChange={(e) => setSalonFiltro(e.target.value)} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-ink" aria-label="Classroom">
          <option value="">All classrooms</option>
          {salones.map(([id, nombre]) => (
            <option key={id} value={id}>
              {nombre}
            </option>
          ))}
        </select>
        <Button type="button" variant="secondary" className="ml-auto" onClick={exportar} disabled={filas.length === 0}>
          <Icon name="copy" className="h-4 w-4" /> Export CSV
        </Button>
      </div>

      {resumen.error ? (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">Could not load the report: {resumen.error}</p>
      ) : (
        <>
          <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <Dato titulo="Amount to pay" valor={fmtSoles(t.monto)} detalle={sinTarifa > 0 ? `${sinTarifa} classroom(s) without a rate` : 'Hours to pay × rate per hour'} destacado />
            <Dato titulo="Hours to pay" valor={fmtMinutos(t.minutos_pagables)} detalle={`${t.dictadas} classes held`} />
            <Dato titulo="Scheduled hours" valor={fmtMinutos(t.minutos_programados)} detalle={`${t.programadas} classes in the period`} />
            <Dato titulo="No entry mark" valor={t.sin_marca} detalle="Past classes without an entry" />
            <Dato titulo="Late minutes" valor={t.minutos_tarde} detalle="Sum of entries after the start time" />
          </div>

          <Card>
            {resumen.cargando ? (
              <p className="px-4 py-8 text-center text-sm text-slate-500">Loading…</p>
            ) : docentes.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-slate-500">There are no classes in this period.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                    <tr>
                      <th className="px-4 py-2">Teacher / classroom</th>
                      <th className="px-2 py-2 text-center">Classes</th>
                      <th className="px-2 py-2 text-center">Held</th>
                      <th className="px-2 py-2 text-center">No mark</th>
                      <th className="px-2 py-2 text-right">Scheduled</th>
                      <th className="px-2 py-2 text-right">To pay</th>
                      <th className="px-2 py-2 text-right">Late</th>
                      <th className="px-4 py-2 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {docentes.map((d) => (
                      <Fragment key={d.docente_id}>
                        <tr className="cursor-pointer bg-white hover:bg-brand-50/40" onClick={() => setAbierto(abierto === d.docente_id ? null : d.docente_id)}>
                          <td className="px-4 py-2.5 font-semibold text-slate-900">
                            <span className="inline-flex items-center gap-2">
                              <Icon name="down" className={`h-4 w-4 text-slate-400 transition-transform ${abierto === d.docente_id ? '' : '-rotate-90'}`} />
                              {d.docente}
                            </span>
                          </td>
                          <td className="px-2 py-2.5 text-center">{d.programadas}</td>
                          <td className="px-2 py-2.5 text-center">{d.dictadas}</td>
                          <td className={`px-2 py-2.5 text-center ${d.sin_marca > 0 ? 'font-semibold text-peach-700' : ''}`}>{d.sin_marca}</td>
                          <td className="px-2 py-2.5 text-right text-slate-600">{fmtMinutos(d.minutos_programados)}</td>
                          <td className="px-2 py-2.5 text-right font-semibold text-brand-700">{fmtMinutos(d.minutos_pagables)}</td>
                          <td className="px-2 py-2.5 text-right text-slate-600">{d.minutos_tarde} min</td>
                          <td className="px-4 py-2.5 text-right font-semibold text-slate-900">{fmtSoles(d.monto)}</td>
                        </tr>
                        {abierto === d.docente_id && (
                          <>
                            <tr className="bg-slate-50/40">
                              <td colSpan={8} className="py-1.5 pl-11 pr-4">
                                <MarcaNativo docente={d} puedeEditar={puedeEditar} servicio={servicio} onCambio={resumen.recargar} />
                              </td>
                            </tr>
                            {d.salones.map((s) => (
                              <tr key={s.salon_id} className="bg-slate-50/40 text-slate-600">
                                <td className="py-1.5 pl-11 pr-2">
                                  {s.salon}
                                  <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-slate-500">
                                    <SelectorServicio salon={s} servicios={servicios} puedeEditar={puedeEditar} servicio={servicio} onCambio={resumen.recargar} />
                                    <span>
                                      {s.alumnos} student{s.alumnos === 1 ? '' : 's'} · {s.precio_hora == null ? 'no rate' : `${fmtSoles(s.precio_hora)} / h`}
                                    </span>
                                  </div>
                                </td>
                                <td className="px-2 py-1.5 text-center">{s.programadas}</td>
                                <td className="px-2 py-1.5 text-center">{s.dictadas}</td>
                                <td className="px-2 py-1.5 text-center">{s.sin_marca}</td>
                                <td className="px-2 py-1.5 text-right">{fmtMinutos(s.minutos_programados)}</td>
                                <td className="px-2 py-1.5 text-right">{fmtMinutos(s.minutos_pagables)}</td>
                                <td className="px-2 py-1.5 text-right">{s.minutos_tarde} min</td>
                                <td className="px-4 py-1.5 text-right">{fmtSoles(s.monto)}</td>
                              </tr>
                            ))}
                            <tr>
                              <td colSpan={8} className="p-0">
                                <DetalleDocente periodo={periodo} docente={d} puedeEditar={puedeEditar} servicio={servicio} onCambio={resumen.recargar} />
                              </td>
                            </tr>
                          </>
                        )}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}
    </>
  )
}
