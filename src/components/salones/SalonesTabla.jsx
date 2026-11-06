import Button from '../ui/Button'
import Badge from '../ui/Badge'
import EstadoBadge from './EstadoBadge'
import { textoCiclos } from '../../lib/catalogo'
import { fechaFinSalon, formatFecha, formatHorario, proximoAFinalizar } from '../../lib/salones'

export default function SalonesTabla({ salones, puedeEditar, onVer, onEditar }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
          <tr>
            <th className="px-4 py-2.5 font-medium">Salón</th>
            <th className="px-4 py-2.5 font-medium">Nivel académico</th>
            <th className="px-4 py-2.5 font-medium">Docente</th>
            <th className="px-4 py-2.5 font-medium">Horario</th>
            <th className="px-4 py-2.5 font-medium">Inicio</th>
            <th className="px-4 py-2.5 font-medium">Fin estimado</th>
            <th className="px-4 py-2.5 font-medium">Avance</th>
            <th className="px-4 py-2.5 font-medium">Capacidad</th>
            <th className="px-4 py-2.5 font-medium">Estado</th>
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
                <div>{s.nivel || <span className="text-peach-700">Sin nivel asignado</span>}</div>
                {s.curso && <div className="text-xs text-slate-500">{s.curso}</div>}
                {s.plan && (
                  <div className="text-xs text-slate-500">
                    {s.plan.modalidad} · {textoCiclos(s.cicloDesde, s.cicloHasta).toLowerCase()}
                  </div>
                )}
              </td>
              <td className="px-4 py-2.5">{s.docente || <span className="text-slate-400">Sin asignar</span>}</td>
              <td className="px-4 py-2.5 text-slate-600">{formatHorario(s.horarios)}</td>
              <td className="whitespace-nowrap px-4 py-2.5">{formatFecha(s.fechaInicio)}</td>
              <td className="whitespace-nowrap px-4 py-2.5">
                {formatFecha(fechaFinSalon(s))}
                {proximoAFinalizar(s) && (
                  <span className="ml-2">
                    <Badge color="peach">Por finalizar</Badge>
                  </span>
                )}
              </td>
              <td className="whitespace-nowrap px-4 py-2.5">
                {s.progreso && s.progreso.sesiones > 0 ? (
                  <span title={`${s.progreso.realizadas} realizadas de ${s.progreso.total}`}>
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
                  Ver
                </Button>
                {puedeEditar && (
                  <Button variant="ghost" className="px-2 py-1" onClick={() => onEditar(s.id)}>
                    Editar
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
