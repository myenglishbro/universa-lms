import Badge from '../ui/Badge'
import Button from '../ui/Button'
import { claveItem, estadoAgendaInfo, origenLabel } from '../../lib/agenda'
import { minutosTexto } from '../../lib/paquetes'
import { hoyLima } from '../../lib/salones'

// Una sesión de la agenda. Las grupales (salones) se distinguen por el color morado y las particulares (paquetes) por el verde azulado.
const estilos = {
  grupal: { borde: 'border-l-brand-500', chip: 'bg-brand-50 text-brand-700' },
  particular: { borde: 'border-l-teal-500', chip: 'bg-teal-50 text-teal-700' },
}

export default function ItemAgenda({ item: i, cruces = [], feriado = '', acciones, ocupado }) {
  const e = estilos[i.origen]
  const cancelada = i.estado === 'cancelada'
  const porRegistrar = i.estado === 'programada' && i.fecha < hoyLima()
  const estado = estadoAgendaInfo[i.estado]
  return (
    <li className={`border-l-4 px-3 py-2.5 ${e.borde} ${cancelada ? 'opacity-60' : ''}`}>
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
        <div className="min-w-0">
          <p className={`text-sm font-semibold ${cancelada ? 'text-slate-400 line-through' : 'text-slate-900'}`}>
            {i.horaInicio}–{i.horaFin} <span className="font-normal text-slate-500">({minutosTexto(i.minutos)})</span>
          </p>
          <p className="truncate text-sm text-slate-800">{i.titulo}</p>
          <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
            <span className={`rounded-full px-2 py-0.5 font-medium ${e.chip}`}>{origenLabel[i.origen]}</span>
            <span>{i.docente || 'Sin docente'}</span>
            {i.origen === 'grupal' && i.detalle && <span>· {i.detalle}</span>}
            {i.tipo === 'recuperacion' && <Badge color="brand">Recuperación</Badge>}
          </p>
        </div>
        <Badge color={porRegistrar ? 'peach' : estado.color}>{porRegistrar ? 'Por registrar' : estado.label}</Badge>
      </div>

      {(cruces.length > 0 || feriado) && (
        <ul className="mt-1 space-y-0.5 text-xs text-peach-700">
          {cruces.map((c) => (
            <li key={c}>⚠ Docente ocupado en: {c}</li>
          ))}
          {feriado && <li>⚠ Feriado: {feriado}</li>}
        </ul>
      )}

      <div className="mt-1.5 flex flex-wrap gap-1">
        {acciones?.editable && i.estado === 'programada' && i.origen === 'particular' && (
          <>
            <Button className="px-2.5 py-1" disabled={Boolean(ocupado)} onClick={() => acciones.confirmar(i)}>
              {ocupado === claveItem(i) ? 'Confirmando…' : 'Confirmar dictada'}
            </Button>
            <Button variant="ghost" className="px-2 py-1" onClick={() => acciones.reprogramar(i)}>
              Reprogramar
            </Button>
            <Button variant="ghost" className="px-2 py-1" onClick={() => acciones.cancelar(i)}>
              Cancelar
            </Button>
          </>
        )}
        {acciones?.editable && i.estado === 'programada' && i.origen === 'grupal' && i.fecha <= hoyLima() && (
          <Button variant="ghost" className="px-2 py-1" disabled={Boolean(ocupado)} onClick={() => acciones.realizada(i)}>
            {ocupado === claveItem(i) ? 'Registrando…' : 'Registrar realizada'}
          </Button>
        )}
        {i.origen === 'grupal' ? (
          <Button variant="ghost" className="px-2 py-1" onClick={() => acciones.verSalon(i.salonId)}>
            Ver salón y estudiantes
          </Button>
        ) : (
          <>
            {i.alumnoId && acciones.verAlumno && (
              <Button variant="ghost" className="px-2 py-1" onClick={() => acciones.verAlumno(i.alumnoId)}>
                Ver alumno
              </Button>
            )}
            <Button variant="ghost" className="px-2 py-1" onClick={() => acciones.verPaquete(i.paqueteId)}>
              Ver paquete
            </Button>
          </>
        )}
      </div>
    </li>
  )
}

