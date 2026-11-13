import { useCallback, useState } from 'react'
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

  const recargarTodo = () => Promise.all([clases.recargar(), progreso.recargar(), resumen.recargar(), grabaciones.recargar(), onCambio?.()])
  const pendientes = clases.datos.filter((c) => c.estado_registro === 'pendiente').length

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
        {clases.error ? (
          <p className="px-4 py-6 text-sm text-red-600">Could not load the classes: {clases.error}</p>
        ) : clases.cargando ? (
          <p className="px-4 py-6 text-center text-sm text-slate-500">Loading…</p>
        ) : clases.datos.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-slate-400">This classroom has no sessions in the calendar yet.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {clases.datos.map((c) => {
              const r = REGISTRO[c.estado_registro]
              return (
                <li key={c.sesion_id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900">
                      Class {c.numero} · {formatFecha(c.fecha)} · {hora(c.hora_inicio)}–{hora(c.hora_fin)}{' '}
                      <Badge color={r.color}>{r.label}</Badge>
                      {sinGrabacion(c) && <span className="ml-1"><Badge color="peach">No recording</Badge></span>}
                      {c.tipo === 'recuperacion' && <span className="ml-1"><Badge color="slate">Make-up</Badge></span>}
                    </p>
                    {c.estado_registro === 'registrada' ? (
                      <p className="mt-0.5 text-xs text-slate-500">
                        {c.tema ? `${c.tema} · ` : 'No topic · '}
                        {c.presentes} presentes · {c.ausentes} ausentes
                        {c.tardanzas > 0 && ` · ${c.tardanzas} tardanzas`}
                        {c.justificados > 0 && ` · ${c.justificados} justificados`}
                      </p>
                    ) : (
                      c.estado_registro === 'pendiente' && <p className="mt-0.5 text-xs text-slate-500">It already took place: attendance and topic still need to be recorded.</p>
                    )}
                  </div>
                  {c.estado_registro !== 'proxima' && (
                    <Button variant={c.estado_registro === 'pendiente' ? 'primary' : 'secondary'} className="px-3 py-1.5" onClick={() => setAbierta(c)}>
                      {c.estado_registro === 'pendiente' ? 'Record class' : 'View / edit'}
                    </Button>
                  )}
                </li>
              )
            })}
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
