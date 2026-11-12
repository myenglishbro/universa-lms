import Avatar from '../ui/Avatar'
import Button from '../ui/Button'
import useFotosDocentes from '../../hooks/useFotosDocentes'
import Badge from '../ui/Badge'
import EstadoBadge from './EstadoBadge'
import { textoCiclos } from '../../lib/catalogo'
import { fechaFinSalon, formatFecha, formatHorario, proximoAFinalizar } from '../../lib/salones'

export default function SalonesTabla({ salones, puedeEditar, onVer, onEditar }) {
  const fotos = useFotosDocentes()
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
          <tr>
            <th className="px-4 py-2.5 font-medium">Classroom</th>
            <th className="px-4 py-2.5 font-medium">Academic level</th>
            <th className="px-4 py-2.5 font-medium">Teacher</th>
            <th className="px-4 py-2.5 font-medium">Schedule</th>
            <th className="px-4 py-2.5 font-medium">Start</th>
            <th className="px-4 py-2.5 font-medium">Estimated end</th>
            <th className="px-4 py-2.5 font-medium">Progress</th>
            <th className="px-4 py-2.5 font-medium">Capacity</th>
            <th className="px-4 py-2.5 font-medium">Status</th>
            <th className="px-4 py-2.5" />
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {salones.map((s) => (
            <tr key={s.id} className="hover:bg-slate-50">
              <td className="px-4 py-2.5">
                <div className="font-medium text-slate-900">{s.nombre}</div>
                <div className="text-xs text-slate-500">{s.codigo}</div>
              </td>
              <td className="px-4 py-2.5">
                <div>{s.nivel || <span className="text-peach-700">No level assigned</span>}</div>
                {s.curso && <div className="text-xs text-slate-500">{s.curso}</div>}
                {s.plan && (
                  <div className="text-xs text-slate-500">
                    {s.plan.modalidad} · {textoCiclos(s.cicloDesde, s.cicloHasta).toLowerCase()}
                  </div>
                )}
              </td>
              <td className="px-4 py-2.5">
                {s.docente ? (
                  <span className="flex items-center gap-2">
                    <Avatar nombre={s.docente} fotoUrl={fotos.get(s.docenteId)} tamano="sm" /> {s.docente}
                  </span>
                ) : (
                  <span className="text-slate-400">Unassigned</span>
                )}
              </td>
              <td className="px-4 py-2.5 text-slate-600">{formatHorario(s.horarios)}</td>
              <td className="whitespace-nowrap px-4 py-2.5">{formatFecha(s.fechaInicio)}</td>
              <td className="whitespace-nowrap px-4 py-2.5">
                {formatFecha(fechaFinSalon(s))}
                {proximoAFinalizar(s) && (
                  <span className="ml-2">
                    <Badge color="peach">Ending soon</Badge>
                  </span>
                )}
              </td>
              <td className="whitespace-nowrap px-4 py-2.5">
                {s.progreso && s.progreso.sesiones > 0 ? (
                  <span title={`${s.progreso.realizadas} held of ${s.progreso.total}`}>
                    {s.progreso.realizadas}/{s.progreso.total}
                  </span>
                ) : (
                  <span className="text-slate-400">—</span>
                )}
              </td>
              <td className="px-4 py-2.5">{s.capacidad}</td>
              <td className="px-4 py-2.5">
                <EstadoBadge estado={s.estado} />
              </td>
              <td className="whitespace-nowrap px-4 py-2.5 text-right">
                <Button variant="ghost" className="px-2 py-1" onClick={() => onVer(s.id)}>
                  View
                </Button>
                {puedeEditar && (
                  <Button variant="ghost" className="px-2 py-1" onClick={() => onEditar(s.id)}>
                    Edit
                  </Button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
