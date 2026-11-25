import { useCallback, useMemo, useState } from 'react'
import Badge from '../ui/Badge'
import Button from '../ui/Button'
import Card from '../ui/Card'
import useCarga from '../../hooks/useCarga'
import { REGISTRO } from '../../lib/asistencia'
import { formatFecha } from '../../lib/salones'
import * as asistenciaReal from '../../services/asistencia'
import * as portalReal from '../../services/portal'
import ProgresoSalon from './ProgresoSalon'
import RegistroClase from './RegistroClase'

const hora = (h) => (h ?? '').slice(0, 5)
const POR_PAGINA = 10

// Filtros de la lista de clases (un salón puede tener más de cien). Las que piden acción van primero.
const FILTROS = [
  { id: 'hacer', label: 'To do' },
  { id: 'proximas', label: 'Upcoming' },
  { id: 'dadas', label: 'Held' },
  { id: 'todas', label: 'All' },
]

// Clases del calendario con su estado de registro, avance por sesiones y resumen por estudiante.
// Lo usan el docente asignado (portal) y la administración (detalle del salón): mismas funciones, mismas reglas.
export default function SeguimientoSalon({ salonId, servicio = asistenciaReal, portal = portalReal, onCambio }) {
  const cargarClases = useCallback(() => servicio.clasesDelSalon(salonId), [servicio, salonId])
  const cargarProgreso = useCallback(() => servicio.progresoDelSalon(salonId), [servicio, salonId])
  const cargarResumen = useCallback(() => servicio.resumenDelSalon(salonId), [servicio, salonId])
  // La grabación es un extra: si no se puede consultar, simplemente no se marca.
  const cargarGrabaciones = useCallback(() => (servicio.clasesConGrabacion ? servicio.clasesConGrabacion(salonId).catch(() => null) : Promise.resolve(null)), [servicio, salonId])
  const grabaciones = useCarga(cargarGrabaciones, null)
  const conGrabacion = new Set(grabaciones.datos ?? [])
  const hoy = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' })
  const sinGrabacion = (c) => grabaciones.datos != null && c.fecha < hoy && !conGrabacion.has(c.sesion_id)
  const clases = useCarga(cargarClases, [])
  const progreso = useCarga(cargarProgreso, null)
  const resumen = useCarga(cargarResumen, [])
  const [abierta, setAbierta] = useState(null)
  const [filtro, setFiltro] = useState(null) // null = elegir solo: «To do» si hay algo por hacer; si no, «Upcoming»
  const [mostrar, setMostrar] = useState(POR_PAGINA)

  const recargarTodo = () => Promise.all([clases.recargar(), progreso.recargar(), resumen.recargar(), grabaciones.recargar(), onCambio?.()])
  const pendientes = clases.datos.filter((c) => c.estado_registro === 'pendiente').length

  const grupos = useMemo(
    () => ({
      hacer: clases.datos.filter((c) => c.estado_registro === 'pendiente' || sinGrabacion(c)),
      proximas: clases.datos.filter((c) => c.estado_registro === 'proxima'),
      dadas: clases.datos.filter((c) => c.estado_registro === 'registrada'),
      todas: clases.datos,
    }),
    // sinGrabacion depende de grabaciones y de hoy; se recalcula cuando llegan las clases o las grabaciones.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [clases.datos, grabaciones.datos],
  )
  const activo = filtro ?? (grupos.hacer.length ? 'hacer' : grupos.proximas.length ? 'proximas' : 'todas')
  // «Held» y «To do» de la más reciente a la más antigua; «Upcoming» y «All» en el orden del calendario.
  const lista = activo === 'dadas' || activo === 'hacer' ? [...grupos[activo]].reverse() : grupos[activo]
  const elegir = (id) => {
    setFiltro(id)
    setMostrar(POR_PAGINA)
  }

  return (
    <div className="space-y-6">
      <Card className="p-5">
        <h2 className="mb-3 text-base font-semibold text-slate-900">Classroom progress</h2>
        {progreso.error ? (
          <p className="text-sm text-red-600">Could not load progress: {progreso.error}</p>
        ) : progreso.datos ? (
          <ProgresoSalon progreso={progreso.datos} />
        ) : (
          <p className="text-sm text-slate-400">Loading…</p>
        )}
      </Card>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-4 py-3">
          <h2 className="text-base font-semibold text-slate-900">Classes</h2>
          <div className="flex flex-wrap gap-1.5">
            {pendientes > 0 && <Badge color="peach">{pendientes} without attendance</Badge>}
            {clases.datos.filter(sinGrabacion).length > 0 && <Badge color="peach">{clases.datos.filter(sinGrabacion).length} without recording</Badge>}
          </div>
        </div>
        {clases.datos.length > 0 && (
          <div role="tablist" aria-label="Filter classes" className="flex flex-wrap gap-1.5 border-b border-slate-100 px-4 py-2.5">
            {FILTROS.map((f) => (
              <button
                key={f.id}
                type="button"
                role="tab"
                aria-selected={activo === f.id}
                onClick={() => elegir(f.id)}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition ${
                  activo === f.id ? 'bg-brand-600 text-white' : 'bg-slate-50 text-slate-600 hover:bg-brand-50 hover:text-brand-700'
                }`}
              >
                {f.label}
                <span className={`rounded-full px-1.5 text-[11px] ${activo === f.id ? 'bg-white/25' : 'bg-white text-slate-500'}`}>{grupos[f.id].length}</span>
              </button>
            ))}
          </div>
        )}
        {clases.error ? (
          <p className="px-4 py-6 text-sm text-red-600">Could not load the classes: {clases.error}</p>
        ) : clases.cargando ? (
          <p className="px-4 py-6 text-center text-sm text-slate-500">Loading…</p>
        ) : clases.datos.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-slate-400">This classroom has no sessions in the calendar yet.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {lista.length === 0 && (
              <li className="px-4 py-8 text-center text-sm text-slate-500">
                {activo === 'hacer' ? 'Nothing to do: every class is recorded.' : 'There are no classes in this view.'}
              </li>
            )}
            {lista.slice(0, mostrar).map((c) => {
              const r = REGISTRO[c.estado_registro]
              const f = new Date(`${c.fecha}T00:00:00Z`)
              const urgente = c.estado_registro === 'pendiente'
              return (
                <li key={c.sesion_id} className={`flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 ${urgente ? 'bg-peach-50/30' : ''}`}>
                  <div className={`flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl leading-none ${urgente ? 'bg-peach-100 text-peach-800' : c.estado_registro === 'registrada' ? 'bg-brand-50 text-brand-700' : 'bg-slate-100 text-slate-600'}`}>
                    <span className="text-lg font-bold">{f.getUTCDate()}</span>
                    <span className="mt-0.5 text-[11px] font-semibold uppercase">{f.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' })}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                      <span className="font-semibold text-slate-900">Class {c.numero}</span>
                      <span className="text-slate-500">
                        {f.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' })} · {hora(c.hora_inicio)}–{hora(c.hora_fin)}
                      </span>
                      <Badge color={r.color}>{r.label}</Badge>
                      {sinGrabacion(c) && <Badge color="peach">No recording</Badge>}
                      {c.tipo === 'recuperacion' && <Badge color="slate">Make-up</Badge>}
                    </p>
                    {c.estado_registro === 'registrada' ? (
                      <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-500">
                        <span className="max-w-full truncate">{c.tema || 'No topic'}</span>
                        <span className="text-emerald-700">{c.presentes} present</span>
                        <span className={c.ausentes > 0 ? 'text-rose-600' : ''}>{c.ausentes} absent</span>
                        {c.tardanzas > 0 && <span>{c.tardanzas} late</span>}
                        {c.justificados > 0 && <span>{c.justificados} excused</span>}
                      </p>
                    ) : (
                      urgente && <p className="mt-1 text-xs text-slate-500">Already held: record attendance and the topic.</p>
                    )}
                  </div>
                  {c.estado_registro !== 'proxima' && (
                    <Button variant={urgente ? 'primary' : 'secondary'} className="px-3 py-1.5 text-xs" onClick={() => setAbierta(c)}>
                      {urgente ? 'Record class' : 'View / edit'}
                    </Button>
                  )}
                </li>
              )
            })}
            {lista.length > mostrar && (
              <li className="flex items-center justify-between gap-3 bg-slate-50/60 px-4 py-3 text-sm text-slate-500">
                <span>
                  Showing {mostrar} of {lista.length}
                </span>
                <Button variant="secondary" className="px-3 py-1.5" onClick={() => setMostrar(mostrar + POR_PAGINA * 2)}>
                  Show more
                </Button>
              </li>
            )}
          </ul>
        )}
      </Card>

      <Card>
        <div className="border-b border-slate-200 px-4 py-3">
          <h2 className="text-base font-semibold text-slate-900">Attendance by student</h2>
        </div>
        {resumen.error ? (
          <p className="px-4 py-6 text-sm text-red-600">Could not load the summary: {resumen.error}</p>
        ) : resumen.datos.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-slate-400">There are no students or recorded attendance yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-2">Student</th>
                  <th className="px-2 py-2 text-center">Present</th>
                  <th className="px-2 py-2 text-center">Absent</th>
                  <th className="px-2 py-2 text-center">Late</th>
                  <th className="px-2 py-2 text-center">Excused</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {resumen.datos.map((a) => (
                  <tr key={a.alumno_id}>
                    <td className="px-4 py-2 font-medium text-slate-900">
                      {a.nombre} {!a.matriculado && <Badge color="slate">Withdrawn</Badge>}
                    </td>
                    <td className="px-2 py-2 text-center">{a.presentes}</td>
                    <td className="px-2 py-2 text-center">{a.ausentes}</td>
                    <td className="px-2 py-2 text-center">{a.tardanzas}</td>
                    <td className="px-2 py-2 text-center">{a.justificados}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {abierta && (
        <RegistroClase
          sesionId={abierta.sesion_id}
          salonId={salonId}
          titulo={`Class ${abierta.numero} · ${formatFecha(abierta.fecha)}`}
          servicio={servicio}
          portal={portal}
          onClose={() => setAbierta(null)}
          onGuardado={recargarTodo}
        />
      )}
    </div>
  )
}
