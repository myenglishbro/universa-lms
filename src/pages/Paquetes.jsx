import { useState } from 'react'
import PaqueteDetalle from '../components/paquetes/PaqueteDetalle'
import PaqueteForm from '../components/paquetes/PaqueteForm'
import { Anillo } from '../components/ui/Anillo'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import { inputClass } from '../components/ui/Field'
import Icon from '../components/ui/Icon'
import PageHeader from '../components/ui/PageHeader'
import { advertenciaSaldo, estadoPaquete, estadosFiltro, minutosTexto, nivelSaldo } from '../lib/paquetes'
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
export default function Paquetes({ data, docentes, niveles, catalogo, puedeEditar, paqueteInicialId = null, onVerAlumno, onVerSalon, onRecargarSalones, servicio = servicioReal }) {
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

  const guardar = async (valores) => {
    const id = await servicio.registrarPaquete(valores)
    await Promise.all([recargar(), onRecargarSalones?.()])
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
          alumnos={alumnos}
          docentes={docentes}
          niveles={niveles}
          catalogo={catalogo}
          onSalonCreado={onRecargarSalones}
          puedeEditar={puedeEditar}
          onVerAlumno={onVerAlumno}
          onVerSalon={onVerSalon}
          onVolver={() => setDetalleId(null)}
          onCambio={recargar}
          onRenovar={(p) => setForm({ origen: p })}
        />
      ) : (
        <>
          <PageHeader
            title="Hour packages"
            description="Prepaid hours for private classes: see how many hours each student has left"
            action={
              puedeEditar && (
                <Button onClick={() => setForm({ origen: null })} disabled={cargando || Boolean(error)}>
                  <Icon name="plus" className="h-4 w-4" /> New package
                </Button>
              )
            }
          />

          {!cargando && !error && (
            <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Resumen icono="box" tono="brand" valor={activos} etiqueta={activos === 1 ? 'Active package' : 'Active packages'} />
              <Resumen icono="clock" tono={porRenovar > 0 ? 'peach' : 'slate'} valor={porRenovar} etiqueta="To renew (few or no hours)" />
              <Resumen icono="calendar" tono="slate" valor={minutosTexto(horasAgendadas)} etiqueta="Scheduled to teach" />
            </div>
          )}

          <div className="mb-5 flex flex-wrap items-center gap-3">
            <div className="relative min-w-56 flex-1 sm:max-w-xs">
              <Icon name="search" className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Search by student or teacher" className={`${inputClass} pl-9`} />
            </div>
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by status">
              {estadosFiltro.map((e) => {
                const n = e.value ? paquetes.filter((p) => p.estado === e.value).length : paquetes.length
                const activo = estado === e.value
                return (
                  <button
                    key={e.value}
                    type="button"
                    onClick={() => setEstado(e.value)}
                    aria-pressed={activo}
                    className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
                      activo ? 'bg-brand-600 text-white shadow-sm' : 'bg-white text-slate-600 ring-1 ring-inset ring-brand-100 hover:bg-brand-50'
                    }`}
                  >
                    {e.value ? e.label : 'All'} <span className={activo ? 'text-white/80' : 'text-slate-400'}>{n}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {cargando ? (
            <p className="py-16 text-center text-sm text-slate-500">Loading packages…</p>
          ) : error ? (
            <p className="py-16 text-center text-sm text-red-600">Could not load packages: {error}</p>
          ) : visibles.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-brand-200 bg-white px-4 py-16 text-center">
              <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
                <Icon name="box" className="h-6 w-6" />
              </span>
              <p className="font-medium text-slate-900">{paquetes.length === 0 ? 'No packages yet' : 'No package matches the filters'}</p>
              <p className="mt-1 text-sm text-slate-500">
                {paquetes.length === 0 ? 'Create the first one: it also creates the private classroom of the student.' : 'Try another search or status.'}
              </p>
              {paquetes.length === 0 && puedeEditar && (
                <Button className="mt-4" onClick={() => setForm({ origen: null })}>
                  <Icon name="plus" className="h-4 w-4" /> New package
                </Button>
              )}
            </div>
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {visibles.map((p) => {
                const e = estadoPaquete[p.estado]
                const nivel = nivelSaldo(p)
                const t = TONOS[nivel.tono]
                const total = Math.max(p.compradas + p.ajustes, 1)
                const usado = Math.min(100, (p.consumidas / total) * 100)
                const agendado = Math.min(100 - usado, (p.programadas / total) * 100)
                return (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => setDetalleId(p.id)}
                      className="group flex h-full w-full flex-col gap-4 rounded-2xl border border-brand-100 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-100 text-base font-bold text-brand-700">{p.alumno.trim().charAt(0).toUpperCase()}</span>
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-slate-900 group-hover:text-brand-700">{p.alumno}</p>
                            <p className="flex items-center gap-1 truncate text-xs text-slate-500">
                              <Icon name="teacher" className="h-3.5 w-3.5 shrink-0" /> {p.docente || 'No teacher'}
                            </p>
                          </div>
                        </div>
                        {p.estado !== 'activo' && <Badge color={e.color}>{e.label}</Badge>}
                      </div>

                      <div className="flex items-center gap-4">
                        <Anillo valor={100 - usado} size={84} grosor={9} etiqueta={`Hours left for ${p.alumno}`}>
                          <span className="text-base font-bold leading-none text-slate-900">{minutosTexto(Math.max(p.disponibles, 0))}</span>
                        </Anillo>
                        <div className="min-w-0 flex-1 space-y-2">
                          <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${t.chip}`}>
                            <Icon name={nivel.icono} className="h-3.5 w-3.5" /> {nivel.texto}
                          </span>
                          <p className="text-xs text-slate-500">
                            Used {minutosTexto(p.consumidas)} of {minutosTexto(total)}
                          </p>
                          <div
                            role="img"
                            aria-label={`Used ${minutosTexto(p.consumidas)} of ${minutosTexto(total)}`}
                            className="flex h-2 overflow-hidden rounded-full bg-brand-50"
                          >
                            <div className="h-full bg-brand-500" style={{ width: `${usado}%` }} />
                            <div className="h-full bg-peach-200" style={{ width: `${agendado}%` }} />
                          </div>
                          {p.programadas > 0 && (
                            <p className="flex items-center gap-1 text-xs text-slate-500">
                              <span className="h-2 w-2 rounded-full bg-peach-200" /> {minutosTexto(p.programadas)} scheduled
                            </p>
                          )}
                        </div>
                      </div>
                      {advertenciaSaldo(p) && <p className="text-xs text-peach-700">Has more classes scheduled than hours available.</p>}

                      <div className="mt-auto flex items-center justify-between border-t border-brand-100 pt-3 text-xs">
                        <span className="inline-flex min-w-0 items-center gap-1.5 text-slate-500">
                          {p.nivel && (
                            <>
                              <Icon name="book" className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">{p.nivel}</span>
                            </>
                          )}
                          {!p.salon_id && <span className="rounded-full bg-peach-50 px-2 py-0.5 font-medium text-peach-700">No classroom yet</span>}
                        </span>
                        <span className="inline-flex shrink-0 items-center gap-1 font-semibold text-brand-700">
                          View details <Icon name="back" className="h-3.5 w-3.5 rotate-180 transition group-hover:translate-x-0.5" />
                        </span>
                      </div>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </>
      )}

      {form && (
        <PaqueteForm
          origen={form.origen}
          alumnos={alumnos}
          docentes={docentes}
          niveles={niveles}
          catalogo={catalogo}
          onSave={guardar}
          onCrearAlumno={crearAlumno}
          onClose={() => setForm(null)}
        />
      )}
    </>
  )
}
