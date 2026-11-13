import { useState } from 'react'
import PaqueteDetalle from '../components/paquetes/PaqueteDetalle'
import PaqueteForm from '../components/paquetes/PaqueteForm'
import Ayuda, { Paso } from '../components/ui/Ayuda'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import { inputClass } from '../components/ui/Field'
import Icon from '../components/ui/Icon'
import PageHeader from '../components/ui/PageHeader'
import { advertenciaSaldo, dinero, estadoPaquete, estadosFiltro, minutosTexto, nivelSaldo } from '../lib/paquetes'
import * as servicioReal from '../services/paquetes'

const TONOS = {
  rose: { chip: 'bg-rose-50 text-rose-700 ring-rose-200' },
  peach: { chip: 'bg-peach-50 text-peach-700 ring-peach-200' },
  brand: { chip: 'bg-brand-50 text-brand-700 ring-brand-200' },
}

function Resumen({ icono, tono, valor, etiqueta }) {
  const t = tono === 'peach' ? 'bg-peach-100 text-peach-700' : tono === 'slate' ? 'bg-teal-50 text-teal-700' : 'bg-brand-100 text-brand-600'
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-brand-100 bg-white p-3 shadow-sm">
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${t}`}>
        <Icon name={icono} className="h-5 w-5" />
      </span>
      <div className="min-w-0">
        <p className="text-2xl font-bold leading-none text-slate-900">{valor}</p>
        <p className="mt-1 text-xs leading-tight text-slate-500">{etiqueta}</p>
      </div>
    </div>
  )
}

// Paquetes de horas de clases privadas. `data` viene de usePaquetes; `servicio` es inyectable para pruebas.
export default function Paquetes({ data, docentes, niveles, puedeEditar, paqueteInicialId = null, onVerAlumno, servicio = servicioReal }) {
  const { paquetes, alumnos, cargando, error, recargar } = data
  const [busqueda, setBusqueda] = useState('')
  const [estado, setEstado] = useState('')
  const [detalleId, setDetalleId] = useState(paqueteInicialId)
  const [form, setForm] = useState(null) // null = cerrado, { origen } = abierto (origen null = paquete nuevo)

  const texto = busqueda.trim().toLowerCase()
  const visibles = paquetes.filter((p) => (!estado || p.estado === estado) && (!texto || `${p.alumno} ${p.docente ?? ''}`.toLowerCase().includes(texto)))
  const detalle = paquetes.find((p) => p.id === detalleId)
  const vigentes = paquetes.filter((p) => p.estado === 'activo' || p.estado === 'agotado')
  const activos = paquetes.filter((p) => p.estado === 'activo').length
  const porRenovar = vigentes.filter((p) => nivelSaldo(p).tono !== 'brand').length
  const horasAgendadas = vigentes.reduce((n, p) => n + (p.programadas ?? 0), 0)
  const conDeuda = paquetes.filter((p) => p.estado !== 'anulado' && Number(p.pendiente) > 0).length

  const guardar = async (valores) => {
    const id = await servicio.registrarPaquete(valores)
    await recargar()
    setForm(null)
    setDetalleId(id)
  }
  const crearAlumno = async (a) => {
    const id = await servicio.crearAlumno(a)
    await recargar()
    return id
  }

  return (
    <>
      {detalle ? (
        <PaqueteDetalle
          key={detalle.id}
          paquete={detalle}
          servicio={servicio}
          docentes={docentes}
          puedeEditar={puedeEditar}
          onVerAlumno={onVerAlumno}
          onVolver={() => setDetalleId(null)}
          onCambio={recargar}
          onRenovar={(p) => setForm({ origen: p })}
        />
      ) : (
        <>
          <PageHeader
            title="Hour packages"
            description="Private classes (1-on-1): how many hours each student bought and how many are left"
            action={
              puedeEditar && (
                <Button onClick={() => setForm({ origen: null })} disabled={cargando || Boolean(error)}>
                  <Icon name="plus" className="h-4 w-4" /> New package
                </Button>
              )
            }
          />

          <Ayuda id="paquetes" titulo="What are hour packages for?">
            <p>
              A <strong>package</strong> is like a <strong>prepaid card</strong> for private classes: the student buys, for example, 10 hours and uses them one by one. Here you track their hours and payment.
            </p>
            <div className="space-y-1.5">
              <Paso n={1}>
                <strong>Sell the package</strong> with “New package” and record what they pay.
              </Paso>
              <Paso n={2}>
                <strong>Schedule their classes</strong> in the <strong>Agenda</strong> (“Schedule a private class” button).
              </Paso>
              <Paso n={3}>
                When the class is given, <strong>mark it as taught</strong>: the package deducts that hour automatically.
              </Paso>
              <Paso n={4}>
                If it runs out, use <strong>Renew</strong> inside the package to sell them another.
              </Paso>
            </div>
            <p className="text-slate-600">
              Colors show the balance: <strong className="text-brand-700">purple</strong> = has hours, <strong className="text-peach-700">peach</strong> = few hours (time to offer a renewal), <strong className="text-rose-700">red</strong> = no hours.
            </p>
          </Ayuda>

          {!cargando && !error && (
            <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Resumen icono="box" tono="brand" valor={activos} etiqueta={activos === 1 ? 'Active package' : 'Active packages'} />
              <Resumen icono="clock" tono={porRenovar > 0 ? 'peach' : 'slate'} valor={porRenovar} etiqueta="To renew (few or no hours)" />
              <Resumen icono="calendar" tono="slate" valor={minutosTexto(horasAgendadas)} etiqueta="Already scheduled in the Agenda" />
              <Resumen icono="alert" tono={conDeuda > 0 ? 'peach' : 'slate'} valor={conDeuda} etiqueta={conDeuda === 1 ? 'Student with pending payment' : 'Students with pending payment'} />
            </div>
          )}

          <Card>
            <div className="flex flex-wrap gap-3 border-b border-brand-100 p-4">
              <div className="relative min-w-56 flex-1 sm:max-w-xs">
                <Icon name="search" className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Search by student or teacher" className={`${inputClass} pl-9`} />
              </div>
              <select value={estado} onChange={(e) => setEstado(e.target.value)} className={`${inputClass} w-auto`} aria-label="Filter by status">
                {estadosFiltro.map((e) => (
                  <option key={e.value} value={e.value}>
                    {e.label}
                  </option>
                ))}
              </select>
            </div>

            {cargando ? (
              <p className="px-4 py-10 text-center text-sm text-slate-500">Loading packages…</p>
            ) : error ? (
              <p className="px-4 py-10 text-center text-sm text-red-600">Could not load packages: {error}</p>
            ) : visibles.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-slate-500">
                {paquetes.length === 0 ? 'No packages yet. Register the first one with “New package”.' : 'No package matches the filters.'}
              </p>
            ) : (
              <ul className="grid gap-4 p-4 sm:grid-cols-2 xl:grid-cols-3">
                {visibles.map((p) => {
                  const e = estadoPaquete[p.estado]
                  const nivel = nivelSaldo(p)
                  const t = TONOS[nivel.tono]
                  const total = Math.max(p.compradas + p.ajustes, 1)
                  const usado = Math.min(100, (p.consumidas / total) * 100)
                  const agendado = Math.min(100 - usado, (p.programadas / total) * 100)
                  const debe = Number(p.pendiente) > 0
                  return (
                    <li key={p.id}>
                      <button
                        type="button"
                        onClick={() => setDetalleId(p.id)}
                        className="flex h-full w-full flex-col gap-3 rounded-2xl border border-brand-100 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex min-w-0 items-center gap-3">
                            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-100 text-base font-bold text-brand-700">{p.alumno.trim().charAt(0).toUpperCase()}</span>
                            <div className="min-w-0">
                              <p className="truncate font-semibold text-slate-900">{p.alumno}</p>
                              <p className="flex items-center gap-1 truncate text-xs text-slate-500">
                                <Icon name="teacher" className="h-3.5 w-3.5 shrink-0" /> {p.docente || 'No teacher'}
                              </p>
                            </div>
                          </div>
                          {p.estado !== 'activo' && <Badge color={e.color}>{e.label}</Badge>}
                        </div>

                        <div>
                          <div className="flex items-end justify-between">
                            <div>
                              <p className="text-xs text-slate-500">Remaining</p>
                              <p className="text-2xl font-bold leading-tight text-slate-900">{minutosTexto(Math.max(p.disponibles, 0))}</p>
                            </div>
                            <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${t.chip}`}>
                              <Icon name={nivel.icono} className="h-3.5 w-3.5" /> {nivel.texto}
                            </span>
                          </div>
                          <div
                            role="img"
                            aria-label={`Used ${minutosTexto(p.consumidas)} of ${minutosTexto(total)}`}
                            className="mt-2 flex h-2.5 overflow-hidden rounded-full bg-brand-50"
                          >
                            <div className="h-full bg-brand-500" style={{ width: `${usado}%` }} />
                            <div className="h-full bg-peach-200" style={{ width: `${agendado}%` }} />
                          </div>
                          <p className="mt-1 flex flex-wrap items-center gap-x-3 text-xs text-slate-500">
                            <span className="inline-flex items-center gap-1">
                              <span className="h-2 w-2 rounded-full bg-brand-500" /> Used {minutosTexto(p.consumidas)}
                            </span>
                            {p.programadas > 0 && (
                              <span className="inline-flex items-center gap-1">
                                <span className="h-2 w-2 rounded-full bg-peach-200" /> Scheduled {minutosTexto(p.programadas)}
                              </span>
                            )}
                            <span>of {minutosTexto(total)}</span>
                          </p>
                          {advertenciaSaldo(p) && <p className="mt-1 text-xs text-peach-700">Has more classes scheduled than hours available.</p>}
                        </div>

                        <div className="mt-auto flex items-center justify-between border-t border-brand-100 pt-3 text-xs">
                          {debe ? (
                            <span className="inline-flex items-center gap-1 font-medium text-peach-700">
                              <Icon name="alert" className="h-3.5 w-3.5" /> Owes {dinero(p.pendiente, p.moneda)}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-slate-500">
                              <Icon name="check" className="h-3.5 w-3.5 text-brand-500" /> Paid
                            </span>
                          )}
                          <span className="inline-flex items-center gap-1 font-semibold text-brand-700">
                            View details <Icon name="back" className="h-3.5 w-3.5 rotate-180" />
                          </span>
                        </div>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </Card>
        </>
      )}

      {form && (
        <PaqueteForm
          origen={form.origen}
          alumnos={alumnos}
          docentes={docentes}
          niveles={niveles}
          onSave={guardar}
          onCrearAlumno={crearAlumno}
          onClose={() => setForm(null)}
        />
      )}
    </>
  )
}
